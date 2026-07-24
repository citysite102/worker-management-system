import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Eye, EyeOff, Wrench } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Logo } from "@/components/brand/Logo";

type Mode = "login" | "register";

/** 社群 provider 的品牌顯示名（品牌名不翻譯）。 */
const OAUTH_LABEL: Record<string, string> = {
  google: "Google",
  facebook: "Facebook",
};

/** 登入後導回的目的地：只接受站內相對路徑（避免 open redirect）。 */
function safeNext(search: string): string {
  const raw = new URLSearchParams(search).get("next");
  // 只接受站內相對路徑；擋掉 //host 與含反斜線（瀏覽器可能把 \ 正規化成 /）的變形。
  if (
    raw &&
    raw.startsWith("/") &&
    !raw.startsWith("//") &&
    !raw.includes("\\")
  )
    return raw;
  return "/";
}

/** 公開站登入 / 註冊（Email/密碼，接 WS2 auth）。員工走 Manus OAuth。 */
export default function Login() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const search = useSearch();
  const next = safeNext(search);
  const utils = trpc.useUtils();
  // 已啟用的社群登入（未設憑證時為空陣列 → 不顯示任何社群鈕）。
  const oauthProviders = trpc.auth.oauthProviders.useQuery().data ?? [];
  const whatsappOn = trpc.auth.whatsappEnabled.useQuery().data ?? false;
  const [waStage, setWaStage] = useState<"idle" | "code">("idle");
  const [waPhone, setWaPhone] = useState("");
  const [waCode, setWaCode] = useState("");
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [accountType, setAccountType] = useState<"worker" | "employer">(
    "worker"
  );
  // 註冊分兩步：form（填資料）→ otp（輸入寄到信箱的驗證碼）。
  const [regStage, setRegStage] = useState<"form" | "otp">("form");
  const [otpCode, setOtpCode] = useState("");

  const afterAuth = async () => {
    await utils.auth.me.invalidate();
    // 內部人員（staff/admin）用 Email/密碼登入時，若沒有指定 next，直接進後台。
    const me = await utils.auth.me.fetch();
    if (next === "/" && (me?.role === "staff" || me?.role === "admin")) {
      navigate("/admin");
      return;
    }
    navigate(next);
  };

  const loginMut = trpc.auth.login.useMutation({
    onSuccess: async () => {
      toast.success(t("login.successLogin"));
      await afterAuth();
    },
    onError: () => toast.error(t("login.errorGeneric")),
  });

  // 註冊步驟 1：寄信箱驗證碼（成功→切到 otp 步驟）。
  const requestOtpMut = trpc.auth.requestEmailOtp.useMutation({
    onSuccess: () => {
      setRegStage("otp");
      toast.success(t("login.emailOtpSent"));
    },
    onError: e => toast.error(e.message),
  });
  // 註冊步驟 2：驗碼並建立帳號（成功→自動登入）。
  const verifyRegisterMut = trpc.auth.verifyEmailOtpAndRegister.useMutation({
    onSuccess: async () => {
      toast.success(t("login.successRegister"));
      await afterAuth();
    },
    onError: e => toast.error(e.message),
  });

  // WhatsApp 手機 OTP 登入
  const waRequestMut = trpc.auth.whatsappRequestOtp.useMutation({
    onSuccess: () => {
      setWaStage("code");
      toast.success(t("login.otpSent"));
    },
    onError: e => toast.error(e.message),
  });
  const waVerifyMut = trpc.auth.whatsappVerifyOtp.useMutation({
    onSuccess: async () => {
      toast.success(t("login.successLogin"));
      await afterAuth();
    },
    onError: e => toast.error(e.message),
  });

  const pending =
    loginMut.isPending ||
    requestOtpMut.isPending ||
    verifyRegisterMut.isPending;
  const isRegister = mode === "register";

  /** 切換登入／註冊，並重置註冊步驟與輸入。 */
  const switchMode = () => {
    setMode(isRegister ? "login" : "register");
    setRegStage("form");
    setOtpCode("");
    setPasswordConfirm("");
  };

  /** 回到填資料步驟（改用別的信箱）。 */
  const backToForm = () => {
    setRegStage("form");
    setOtpCode("");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isRegister) {
      loginMut.mutate({ email, password });
      return;
    }
    // 註冊步驟 1：先在前端擋兩次密碼不一致，再寄驗證碼。
    if (password !== passwordConfirm) {
      toast.error(t("login.passwordMismatch"));
      return;
    }
    requestOtpMut.mutate({ email });
  };

  const submitOtp = (e: React.FormEvent) => {
    e.preventDefault();
    verifyRegisterMut.mutate({
      email,
      code: otpCode,
      password,
      name: name || undefined,
      accountType,
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex justify-end p-4">
        <LanguageSwitcher />
      </div>
      <div className="flex-1 flex items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm">
          <a
            href="/"
            className="mb-6 flex items-center justify-center gap-2"
            aria-label="長誠媒合"
          >
            <Logo variant="color" size="sm" />
            <span className="text-lg font-bold tracking-tight">長誠媒合</span>
          </a>
          <h1 className="text-2xl font-bold tracking-tight text-center mb-6">
            {isRegister ? t("login.registerTitle") : t("login.title")}
          </h1>
          {regStage === "form" ? (
            <form
              onSubmit={submit}
              className="space-y-4 rounded-lg border border-border bg-card p-6"
            >
              {isRegister && (
                <div className="grid grid-cols-2 gap-2">
                  {(["worker", "employer"] as const).map(type => (
                    <button
                      key={type}
                      type="button"
                      data-testid={`register-as-${type}`}
                      onClick={() => setAccountType(type)}
                      className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                        accountType === type
                          ? "border-primary bg-accent text-accent-foreground"
                          : "border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {type === "worker"
                        ? t("login.asWorker")
                        : t("login.asEmployer")}
                    </button>
                  ))}
                </div>
              )}
              {isRegister && (
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    {t("login.name")}
                  </label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    data-testid="login-name"
                    autoComplete="name"
                    className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-accent"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  {t("login.email")}
                </label>
                <input
                  type="email"
                  required
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  data-testid="login-email"
                  className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-accent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  {t("login.password")}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={isRegister ? 8 : undefined}
                    autoComplete={
                      isRegister ? "new-password" : "current-password"
                    }
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    data-testid="login-password"
                    className="w-full rounded-md border border-border bg-card px-3 py-2 pr-10 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-accent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    aria-label={
                      showPassword
                        ? t("login.hidePassword")
                        : t("login.showPassword")
                    }
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              {isRegister && (
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    {t("login.passwordConfirm")}
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={passwordConfirm}
                    onChange={e => setPasswordConfirm(e.target.value)}
                    data-testid="login-password-confirm"
                    className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-accent"
                  />
                </div>
              )}
              <button
                type="submit"
                disabled={pending}
                data-testid="login-submit"
                className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isRegister ? t("login.registerBtn") : t("login.loginBtn")}
              </button>
              <button
                type="button"
                data-testid="login-toggle-mode"
                onClick={switchMode}
                className="w-full text-center text-sm text-primary hover:underline"
              >
                {isRegister ? t("login.toLogin") : t("login.toRegister")}
              </button>
            </form>
          ) : (
            <form
              onSubmit={submitOtp}
              className="space-y-4 rounded-lg border border-border bg-card p-6"
              data-testid="register-otp-stage"
            >
              <p className="text-sm text-muted-foreground">
                {t("login.emailOtpSentTo")}
                <span className="font-medium text-foreground"> {email}</span>
              </p>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  {t("login.emailOtpCode")}
                </label>
                <input
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value)}
                  inputMode="numeric"
                  maxLength={6}
                  required
                  autoFocus
                  placeholder="000000"
                  data-testid="register-otp-code"
                  className="w-full rounded-md border border-border bg-card px-3 py-2 text-center text-sm tracking-widest focus:outline-none focus:border-primary focus:ring-2 focus:ring-accent"
                />
              </div>
              <button
                type="submit"
                disabled={pending || otpCode.length !== 6}
                data-testid="register-otp-verify"
                className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {t("login.emailOtpVerify")}
              </button>
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={backToForm}
                  data-testid="register-otp-back"
                  className="text-muted-foreground hover:text-foreground"
                >
                  {t("login.emailOtpChange")}
                </button>
                <button
                  type="button"
                  disabled={requestOtpMut.isPending}
                  onClick={() => requestOtpMut.mutate({ email })}
                  data-testid="register-otp-resend"
                  className="text-primary hover:underline disabled:opacity-50"
                >
                  {t("login.emailOtpResend")}
                </button>
              </div>
            </form>
          )}

          {/* 社群登入（Google/FB 一鍵）+ WhatsApp 手機 OTP；未設憑證 → 各自隱藏 */}
          {(oauthProviders.length > 0 || whatsappOn) && (
            <div className="mt-5" data-testid="alt-login">
              <div className="relative mb-4 text-center">
                <span className="relative z-10 bg-card px-2 text-xs text-muted-foreground">
                  {t("login.orContinueWith")}
                </span>
                <div className="absolute inset-x-0 top-1/2 border-t border-border" />
              </div>
              <div className="space-y-2" data-testid="oauth-providers">
                {oauthProviders.map(p => (
                  <a
                    key={p}
                    href={`/auth/oauth/${p}/start`}
                    className="flex w-full items-center justify-center rounded-md border border-border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
                    data-testid={`oauth-${p}`}
                  >
                    {t("login.continueWith", { provider: OAUTH_LABEL[p] ?? p })}
                  </a>
                ))}
              </div>

              {whatsappOn && (
                <div
                  className="mt-2 rounded-md border border-border p-3"
                  data-testid="wa-login"
                >
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    {t("login.whatsappLogin")}
                  </p>
                  {waStage === "idle" ? (
                    <div className="flex gap-2">
                      <input
                        value={waPhone}
                        onChange={e => setWaPhone(e.target.value)}
                        inputMode="tel"
                        placeholder="+886912345678"
                        className="h-10 flex-1 rounded-md border border-border bg-card px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-accent"
                        data-testid="wa-phone"
                      />
                      <button
                        type="button"
                        disabled={
                          waRequestMut.isPending || waPhone.trim().length < 6
                        }
                        onClick={() => waRequestMut.mutate({ phone: waPhone })}
                        className="shrink-0 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                        data-testid="wa-send"
                      >
                        {t("login.sendCode")}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <input
                        value={waCode}
                        onChange={e => setWaCode(e.target.value)}
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="000000"
                        className="h-10 w-full rounded-md border border-border bg-card px-3 text-center text-sm tracking-widest focus:border-primary focus:outline-none focus:ring-2 focus:ring-accent"
                        data-testid="wa-code"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={
                            waVerifyMut.isPending || waCode.length !== 6
                          }
                          onClick={() =>
                            waVerifyMut.mutate({ phone: waPhone, code: waCode })
                          }
                          className="flex-1 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                          data-testid="wa-verify"
                        >
                          {t("login.verifyCode")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setWaStage("idle")}
                          className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
                          data-testid="wa-back"
                        >
                          {t("login.changeNumber")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="mt-4 text-center">
            <a
              href={getLoginUrl()}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {t("login.staffLogin")} →
            </a>
          </div>

          {/* 本地開發捷徑：一鍵回到自動注入的假 admin（僅 Vite dev 顯示）。
              走後端 /dev/restore-bypass 清掉登出抑制 cookie 後導回首頁。 */}
          {import.meta.env.DEV && (
            <div className="mt-3 text-center">
              <a
                href="/dev/restore-bypass"
                className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
                data-testid="dev-bypass-login"
              >
                <Wrench className="h-3.5 w-3.5" />
                以本地開發者身分登入
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
