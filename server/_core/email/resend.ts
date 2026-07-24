// ─── Resend 寄信實作（EmailSender 的正式服務商之一）──────────────────────────
// 用 Resend REST API 直接寄，不引 SDK（比照 whatsapp.sendOtp 的 fetch 做法，
// 不新增相依、與 Manus 部署相容）。env 未設（api key / from 缺）即不啟用。
//
// 需要的環境變數：
//   RESEND_API_KEY  Resend 後台的 API key（re_...）
//   EMAIL_FROM      寄件者，如 "長誠媒合 <noreply@your-domain.com>"
//                   —— 網域需先在 Resend 驗證（SPF/DKIM）；測試可用 onboarding@resend.dev
import type { EmailMessage, EmailSender } from "./sender";

export interface ResendConfig {
  apiKey: string;
  from: string;
}

/** 讀 env；缺 api key 或 from 回 null（＝未設定，不啟用 Resend）。 */
export function resendConfig(): ResendConfig | null {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return null;
  return { apiKey, from };
}

export class ResendEmailSender implements EmailSender {
  constructor(private readonly cfg: ResendConfig) {}

  async send(msg: EmailMessage): Promise<void> {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.cfg.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: this.cfg.from,
        to: msg.to,
        subject: msg.subject,
        text: msg.text,
        ...(msg.html ? { html: msg.html } : {}),
      }),
    });
    if (!resp.ok) {
      // 不把回應內文往外拋給使用者；這裡只記在伺服器端錯誤供排查。
      throw new Error(`Resend 寄信失敗：${resp.status} ${await resp.text()}`);
    }
  }
}
