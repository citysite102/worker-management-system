// ─── 一次性驗證碼（OTP）共用工具 ────────────────────────────────────────────────
// 手機（WhatsApp）與信箱註冊共用同一套產碼／HMAC 存碼／常數時間比對。
// salt 綁定通道識別（手機號或信箱），避免同一碼跨通道／跨對象重放。

import { createHmac, randomInt } from "node:crypto";

export const OTP_TTL_MS = 5 * 60_000; // 5 分鐘
export const OTP_MAX_ATTEMPTS = 5; // 同一碼最多驗證次數

/** 6 位數字 OTP（用 crypto，不用 Math.random）。 */
export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** 存 HMAC 後的碼（不存明碼）；salt 綁通道識別（手機號/信箱），避免重放。 */
export function hashOtp(code: string, salt: string): string {
  const secret = process.env.JWT_SECRET ?? "dev-otp-secret";
  return createHmac("sha256", secret).update(`${salt}:${code}`).digest("hex");
}

/** 常數時間比對（避免計時攻擊；長度相同才逐位比）。 */
export function verifyOtpHash(
  code: string,
  salt: string,
  storedHash: string
): boolean {
  const h = hashOtp(code, salt);
  if (h.length !== storedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < h.length; i++)
    diff |= h.charCodeAt(i) ^ storedHash.charCodeAt(i);
  return diff === 0;
}
