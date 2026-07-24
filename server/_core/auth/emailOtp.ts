// ─── 信箱註冊 OTP 的網域小工具 ──────────────────────────────────────────────────
// 產碼／存碼／比對共用 ./otp；此處只放信箱專屬的 TTL、寄信文案與 E2E 固定碼。
import { getEmailSender } from "../email/sender";

// 信箱比手機簡訊慢，給 10 分鐘（手機為 5 分鐘，見 ./otp 的 OTP_TTL_MS）。
export const EMAIL_OTP_TTL_MS = 10 * 60_000;

// 重寄冷卻：同信箱 30 秒內僅能發一次（防寄信轟炸）。
export const EMAIL_OTP_RESEND_COOLDOWN_MS = 30_000;

/**
 * 非正式環境的固定驗證碼（供 E2E：真實伺服器沒有信箱可收碼）。
 * 僅當 NODE_ENV!==production 且 E2E_FIXED_OTP 為 6 位數字時生效；正式環境一律 null。
 */
export function devFixedOtp(): string | null {
  if (process.env.NODE_ENV === "production") return null;
  const fixed = process.env.E2E_FIXED_OTP;
  return fixed && /^\d{6}$/.test(fixed) ? fixed : null;
}

/** 寄出信箱驗證碼（暫用 zh/en 雙語純文字；正式多語文案之後補）。 */
export async function sendEmailOtp(email: string, code: string): Promise<void> {
  const subject = "長誠媒合 註冊驗證碼 / Verification code";
  const text =
    `您的註冊驗證碼是 ${code}，10 分鐘內有效，請勿轉告他人。\n` +
    `Your verification code is ${code}. It expires in 10 minutes.`;
  await getEmailSender().send({ to: email, subject, text });
}
