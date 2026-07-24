// ─── 信箱 OTP 註冊的編排（深模組）──────────────────────────────────────────────
// 「先驗證才建帳號」的兩步驟核心：寄碼、驗碼＋建帳號。刻意不含發 session／稽核／
// cookie——那些需要 tRPC ctx，留在路由那層當薄轉接器。這裡只做「決策＋持久化」，
// 因此可以不經 tRPC caller 直接單元測試（見 server/emailRegister.test.ts）。
import { TRPCError } from "@trpc/server";
import {
  getUserByEmail,
  getLatestEmailOtp,
  createEmailOtp,
  deleteEmailOtps,
  bumpEmailOtpAttempts,
  consumeEmailOtp,
  createUser,
} from "../../db";
import { hashPassword } from "./password";
import { newLocalOpenId } from "./session";
import { generateOtp, hashOtp, checkOtp } from "./otp";
import {
  EMAIL_OTP_TTL_MS,
  EMAIL_OTP_RESEND_COOLDOWN_MS,
  devFixedOtp,
  sendEmailOtp,
} from "./emailOtp";

/**
 * 步驟 1：寄註冊驗證碼。此步不寫 users，只寄碼。
 * Email 已註冊 → CONFLICT（沿用註冊慣例，換取「打錯字馬上知道」；登入端才嚴格不洩漏）。
 */
export async function requestEmailRegistrationOtp(
  email: string
): Promise<{ sent: true }> {
  const existing = await getUserByEmail(email);
  if (existing) {
    throw new TRPCError({ code: "CONFLICT", message: "此 Email 已註冊" });
  }
  // 防轟炸：同信箱 30 秒內僅發一次（開發/E2E 固定碼模式不限制，便於測試）。
  if (!devFixedOtp()) {
    const last = await getLatestEmailOtp(email);
    if (
      last &&
      !last.consumedAt &&
      Date.now() - last.createdAt.getTime() < EMAIL_OTP_RESEND_COOLDOWN_MS
    ) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "驗證碼剛寄出，請稍候再試",
      });
    }
  }
  const code = devFixedOtp() ?? generateOtp();
  await deleteEmailOtps(email); // 單一有效碼
  await createEmailOtp({
    email,
    codeHash: hashOtp(code, email),
    expiresAt: new Date(Date.now() + EMAIL_OTP_TTL_MS),
  });
  await sendEmailOtp(email, code);
  return { sent: true };
}

export interface EmailRegistrationInput {
  email: string;
  code: string;
  password: string;
  accountType: "worker" | "employer";
  name?: string;
}

export interface NewEmailUser {
  id: number;
  openId: string;
  name: string | null;
  accountType: "worker" | "employer";
}

/**
 * 步驟 2：驗碼並建立帳號（emailVerified=1）。回傳新帳號資訊給路由去發 session／記稽核。
 * 不含 session／cookie／audit（那些是 ctx 職責）。
 */
export async function verifyEmailOtpAndCreateUser(
  input: EmailRegistrationInput
): Promise<NewEmailUser> {
  const otp = await getLatestEmailOtp(input.email);
  const verdict = checkOtp(otp, input.code, input.email);
  if (!verdict.ok) {
    if (verdict.reason === "bad_code" && otp) {
      await bumpEmailOtpAttempts(otp.id);
      throw new TRPCError({ code: "UNAUTHORIZED", message: "驗證碼不正確" });
    }
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "驗證碼無效或已過期，請重新取得",
    });
  }
  // verdict.ok 保證 otp 存在。
  const validOtp = otp!;

  // 驗碼成功 → 再次確認 Email 仍可用（防兩步之間被搶註的競態）。
  const existing = await getUserByEmail(input.email);
  if (existing) {
    await consumeEmailOtp(validOtp.id);
    throw new TRPCError({ code: "CONFLICT", message: "此 Email 已註冊" });
  }

  const openId = newLocalOpenId();
  const passwordHash = await hashPassword(input.password);
  const name = input.name ?? null;
  let id: number;
  try {
    id = await createUser({
      openId,
      email: input.email,
      name,
      loginMethod: "email",
      role: "user",
      accountType: input.accountType,
      passwordHash,
      emailVerified: 1, // 已通過信箱驗證
      lastSignedIn: new Date(),
    });
  } catch (e) {
    // getUserByEmail 檢查非原子；靠 users.email 唯一索引擋並行 verify 的競態，
    // 重複鍵一律當 CONFLICT。
    await consumeEmailOtp(validOtp.id);
    if (
      e &&
      typeof e === "object" &&
      (e as { code?: string }).code === "ER_DUP_ENTRY"
    ) {
      throw new TRPCError({ code: "CONFLICT", message: "此 Email 已註冊" });
    }
    throw e;
  }
  await consumeEmailOtp(validOtp.id);
  return { id, openId, name, accountType: input.accountType };
}
