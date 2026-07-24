// ─── WhatsApp 手機號 OTP 登入（Meta WhatsApp Cloud API）──────────────────────
// 非 OAuth：輸入手機號 → 發 OTP（WhatsApp 訊息）→ 驗證 → 以手機號 resolve/建立帳號。
// env 未設（token/phoneNumberId/template 缺）即停用（whatsappEnabled=false，路由/鈕隱藏）。
// 設計文件：docs/feature-oauth-social-login.md「WhatsApp」節。
import { getUserByPhone, createUser, markPhoneVerified } from "../../db";
// OTP 產碼／HMAC 存碼／比對共用工具（手機與信箱共用）；re-export 維持既有匯入路徑。
import {
  OTP_TTL_MS,
  OTP_MAX_ATTEMPTS,
  generateOtp,
  hashOtp,
  verifyOtpHash,
} from "./otp";

export { OTP_TTL_MS, OTP_MAX_ATTEMPTS, generateOtp, hashOtp, verifyOtpHash };

interface WhatsappConfig {
  token: string;
  phoneNumberId: string;
  template: string;
  lang: string;
  graphVersion: string;
}

/** 讀 env；缺任一必要項回 null（＝停用）。 */
export function whatsappConfig(): WhatsappConfig | null {
  const token = process.env.WHATSAPP_CLOUD_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const template = process.env.WHATSAPP_OTP_TEMPLATE;
  if (!token || !phoneNumberId || !template) return null;
  return {
    token,
    phoneNumberId,
    template,
    lang: process.env.WHATSAPP_OTP_LANG ?? "en",
    graphVersion: process.env.FACEBOOK_GRAPH_VERSION ?? "v25.0",
  };
}

export function whatsappEnabled(): boolean {
  return whatsappConfig() !== null;
}

/**
 * 基本正規化成 E.164（`+` + 8~15 位數）。台灣手機 09xxxxxxxx → +8869xxxxxxxx。
 * 其他一律：帶 `+` 就保留、否則視為已含國碼。無法判定就丟錯。
 */
export function normalizePhone(input: string): string {
  const trimmed = input.trim().replace(/[\s-()]/g, "");
  let digits: string;
  if (trimmed.startsWith("+")) {
    digits = trimmed.slice(1).replace(/\D/g, "");
  } else if (trimmed.startsWith("0")) {
    digits = "886" + trimmed.slice(1).replace(/\D/g, ""); // 台灣本地格式
  } else {
    digits = trimmed.replace(/\D/g, "");
  }
  if (digits.length < 8 || digits.length > 15) {
    throw new Error("手機號格式不正確");
  }
  return "+" + digits;
}

/** 透過 Cloud API 發送 OTP（authentication 範本：body + 複製鈕帶入碼）。 */
export async function sendOtp(phoneE164: string, code: string): Promise<void> {
  const cfg = whatsappConfig();
  if (!cfg) throw new Error("WhatsApp 未設定");
  const url = `https://graph.facebook.com/${cfg.graphVersion}/${cfg.phoneNumberId}/messages`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${cfg.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phoneE164.replace(/^\+/, ""),
      type: "template",
      template: {
        name: cfg.template,
        language: { code: cfg.lang },
        components: [
          { type: "body", parameters: [{ type: "text", text: code }] },
          {
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [{ type: "text", text: code }],
          },
        ],
      },
    }),
  });
  if (!resp.ok) {
    throw new Error(`WhatsApp 發送失敗：${resp.status} ${await resp.text()}`);
  }
}

/** 驗證成功後：以手機號 resolve/建立帳號，回傳要發 session 的 openId/name。 */
export async function resolveWhatsappUser(
  phoneE164: string
): Promise<{ openId: string; name: string | null }> {
  const existing = await getUserByPhone(phoneE164);
  if (existing) {
    await markPhoneVerified(existing.id);
    return { openId: existing.openId, name: existing.name };
  }
  const openId = `whatsapp_${phoneE164}`;
  await createUser({
    openId,
    phone: phoneE164,
    phoneVerified: 1,
    loginMethod: "whatsapp",
    role: "user",
  });
  return { openId, name: null };
}
