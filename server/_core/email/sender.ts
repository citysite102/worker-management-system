// ─── 寄信抽象介面（可插拔）────────────────────────────────────────────────────
// 上層（信箱 OTP、未來的密碼重設/通知）只依賴 EmailSender 介面；正式服務商
// （Resend/SendGrid/SMTP）之後各實作一個 EmailSender，靠環境變數挑選，不影響上層。
// 本期只提供 StubEmailSender：把信件記在記憶體 + 印 log，讓開發/測試跑得動。

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailSender {
  send(msg: EmailMessage): Promise<void>;
}

/**
 * 開發/測試用寄信器：不真的寄，只把最後一封信記在記憶體並印 log。
 * 整合測試會 stub 掉 sendEmailOtp；此 stub 主要服務本機開發與「未接正式服務」的預設。
 */
class StubEmailSender implements EmailSender {
  async send(msg: EmailMessage): Promise<void> {
    lastByRecipient.set(msg.to.trim().toLowerCase(), msg);
    // 不印出內文（可能含驗證碼）；僅記錄有寄出這件事。
    console.warn(`[email:stub] to=${msg.to} subject=${msg.subject}`);
  }
}

const lastByRecipient = new Map<string, EmailMessage>();

/** 取某收件人最後一封 stub 信件（僅供本機/測試查看，正式寄信器不會記錄）。 */
export function getLastStubEmail(to: string): EmailMessage | undefined {
  return lastByRecipient.get(to.trim().toLowerCase());
}

let sender: EmailSender | null = null;

/** 取得目前的寄信器。尚未接正式服務 → StubEmailSender；正式環境用 stub 會警示。 */
export function getEmailSender(): EmailSender {
  if (sender) return sender;
  if (process.env.NODE_ENV === "production") {
    console.error(
      "[email] 未設定正式寄信服務，回退為 StubEmailSender —— 信件不會真的寄出！"
    );
  }
  sender = new StubEmailSender();
  return sender;
}

/** 測試用：覆蓋寄信器（例如注入記錄用的假寄信器）。 */
export function __setEmailSenderForTest(s: EmailSender | null): void {
  sender = s;
}
