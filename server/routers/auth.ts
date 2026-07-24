// ─── auth 子路由（登入／註冊／OTP／登出）────────────────────────────────────────
// 從 server/routers.ts 拆出的 per-domain 路由（架構深化 C）。編排邏輯已於 A 收進
// _core/auth 深模組，這裡是薄轉接器：解析輸入 → 呼叫模組 → 發 session／稽核。
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { router, publicProcedure } from "../_core/trpc";
import { getSessionCookieOptions } from "../_core/cookies";
import { DEV_BYPASS_OFF_COOKIE } from "../_core/context";
import { logAudit } from "../_core/audit";
import {
  getUserByEmail,
  deletePhoneOtps,
  createPhoneOtp,
  getLatestPhoneOtp,
  bumpPhoneOtpAttempts,
  consumePhoneOtp,
} from "../db";
import { verifyPassword } from "../_core/auth/password";
import { issueSession } from "../_core/auth/session";
import { enabledProviders } from "../_core/auth/oauthProviders";
import {
  whatsappEnabled,
  generateOtp,
  hashOtp,
  normalizePhone as normalizeWaPhone,
  sendOtp,
  resolveWhatsappUser,
  OTP_TTL_MS,
} from "../_core/auth/whatsapp";
import { checkOtp } from "../_core/auth/otp";
import {
  requestEmailRegistrationOtp,
  verifyEmailOtpAndCreateUser,
} from "../_core/auth/emailRegister";

export const authRouter = router({
  me: publicProcedure.query(opts => opts.ctx.user),
  // 已啟用的社群登入 provider（憑證設定與否決定）；登入頁未登入即需，故 public。
  oauthProviders: publicProcedure.query(() => enabledProviders()),
  // WhatsApp OTP 是否啟用（前端決定是否顯示手機登入）。
  whatsappEnabled: publicProcedure.query(() => whatsappEnabled()),
  // 取得 OTP：發碼到手機（WhatsApp）。不揭露手機是否已註冊（一律回 sent）。
  whatsappRequestOtp: publicProcedure
    .input(z.object({ phone: z.string().trim().min(6).max(30) }))
    .mutation(async ({ input }) => {
      if (!whatsappEnabled())
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "WhatsApp 登入未啟用",
        });
      let phone: string;
      try {
        phone = normalizeWaPhone(input.phone);
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "手機號格式不正確",
        });
      }
      const code = generateOtp();
      await deletePhoneOtps(phone); // 單一有效碼
      await createPhoneOtp({
        phone,
        codeHash: hashOtp(code, phone),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      });
      await sendOtp(phone, code);
      return { sent: true } as const;
    }),
  // 驗證 OTP：成功即以手機號 resolve/建立帳號並發 session。
  whatsappVerifyOtp: publicProcedure
    .input(
      z.object({
        phone: z.string().trim().min(6).max(30),
        code: z
          .string()
          .trim()
          .regex(/^\d{6}$/, "驗證碼為 6 位數字"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!whatsappEnabled())
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "WhatsApp 登入未啟用",
        });
      let phone: string;
      try {
        phone = normalizeWaPhone(input.phone);
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "手機號格式不正確",
        });
      }
      const otp = await getLatestPhoneOtp(phone);
      const verdict = checkOtp(otp, input.code, phone);
      if (!verdict.ok) {
        if (verdict.reason === "bad_code" && otp) {
          await bumpPhoneOtpAttempts(otp.id);
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "驗證碼錯誤",
          });
        }
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "驗證碼無效或已過期，請重新取得",
        });
      }
      await consumePhoneOtp(otp!.id);
      const user = await resolveWhatsappUser(phone);
      await issueSession(ctx.req, ctx.res, {
        openId: user.openId,
        name: user.name,
      });
      return { ok: true } as const;
    }),
  logout: publicProcedure.mutation(async ({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    // 本地開發 bypass 模式：不設抑制旗標的話，context 會在下一個請求立刻重新
    // 注入假 admin，讓登出看起來「完全沒作用」。設 dev_bypass_off 抑制注入，
    // 直到重新登入（login/register 會清掉）或清 cookie。
    if (
      process.env.NODE_ENV !== "production" &&
      process.env.DEV_AUTH_BYPASS === "1"
    ) {
      ctx.res.cookie(DEV_BYPASS_OFF_COOKIE, "1", cookieOptions);
    }
    await logAudit(ctx, { action: "auth.logout" });
    return { success: true } as const;
  }),

  // ─── Email/密碼 註冊：一律走信箱 OTP 兩步驟（見下方 requestEmailOtp /
  //     verifyEmailOtpAndRegister）。舊的一步 auth.register 已移除，避免繞過
  //     信箱驗證直接建立未驗證帳號（可被拿來搶註他人信箱）。

  // ─── 信箱 OTP 註冊：步驟 1／寄驗證碼（公開）────────────────────────────────
  // 「先驗證才建帳號」：此步不寫 users，只寄碼。
  // 注意：Email 已註冊會回 CONFLICT，等於揭露該信箱已註冊（沿用註冊流程慣例，
  // 換取「打錯字馬上知道」的體驗）；登入端才嚴格不洩漏。之後若要收斂列舉風險，
  // 可改為一律回 { sent: true } 並僅在信中提示。
  requestEmailOtp: publicProcedure
    .input(
      z.object({
        email: z
          .string()
          .trim()
          .toLowerCase()
          .email("Email 格式不正確")
          .max(320),
      })
    )
    .mutation(({ input }) => requestEmailRegistrationOtp(input.email)),

  // ─── 信箱 OTP 註冊：步驟 2／驗碼並建帳號（公開）────────────────────────────
  // 驗碼成功才真正建立帳號（emailVerified=1）並發 session。取代舊 register 的前端呼叫。
  verifyEmailOtpAndRegister: publicProcedure
    .input(
      z.object({
        email: z
          .string()
          .trim()
          .toLowerCase()
          .email("Email 格式不正確")
          .max(320),
        code: z
          .string()
          .trim()
          .regex(/^\d{6}$/, "驗證碼為 6 位數字"),
        password: z.string().min(8, "密碼至少 8 碼").max(200),
        accountType: z.enum(["worker", "employer"]),
        name: z
          .string()
          .trim()
          .max(100)
          .optional()
          .transform(s => s?.trim() || undefined),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 深模組負責驗碼＋建帳號；路由只做 ctx 相關的收尾（發 session／清 cookie／稽核）。
      const user = await verifyEmailOtpAndCreateUser(input);
      await issueSession(ctx.req, ctx.res, {
        openId: user.openId,
        name: user.name,
      });
      ctx.res.clearCookie(DEV_BYPASS_OFF_COOKIE, {
        ...getSessionCookieOptions(ctx.req),
        maxAge: -1,
      });
      await logAudit(ctx, {
        action: "auth.register",
        entityType: "users",
        entityId: user.id,
        actorUserId: user.id,
        meta: {
          accountType: user.accountType,
          loginMethod: "email",
          emailVerified: true,
        },
      });
      return {
        success: true,
        id: user.id,
        accountType: user.accountType,
      } as const;
    }),

  // ─── Email/密碼 登入（公開）───────────────────────────────────────────────
  login: publicProcedure
    .input(
      z.object({
        email: z
          .string()
          .trim()
          .toLowerCase()
          .email("Email 格式不正確")
          .max(320),
        password: z.string().min(1).max(200),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getUserByEmail(input.email);
      const ok =
        user && (await verifyPassword(input.password, user.passwordHash));
      // 不區分「帳號不存在」與「密碼錯誤」，避免洩漏 email 是否註冊
      if (!user || !ok) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "帳號或密碼錯誤",
        });
      }
      await issueSession(ctx.req, ctx.res, {
        openId: user.openId,
        name: user.name,
      });
      // 清掉 dev bypass 抑制旗標（若有），讓本地開發登入後狀態乾淨。
      ctx.res.clearCookie(DEV_BYPASS_OFF_COOKIE, {
        ...getSessionCookieOptions(ctx.req),
        maxAge: -1,
      });
      await logAudit(ctx, {
        action: "auth.login",
        actorUserId: user.id,
        meta: { loginMethod: "email" },
      });
      return { success: true } as const;
    }),
});
