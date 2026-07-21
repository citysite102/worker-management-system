import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

type Mode = "login" | "register";

/** 登入後導回的目的地：只接受站內相對路徑（避免 open redirect）。 */
function safeNext(search: string): string {
  const raw = new URLSearchParams(search).get("next");
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/";
}

/** 公開站登入 / 註冊（Email/密碼，接 WS2 auth）。員工走 Manus OAuth。 */
export default function Login() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const search = useSearch();
  const next = safeNext(search);
  const utils = trpc.useUtils();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState<"worker" | "employer">(
    "worker"
  );

  const afterAuth = async () => {
    await utils.auth.me.invalidate();
    navigate(next);
  };

  const loginMut = trpc.auth.login.useMutation({
    onSuccess: async () => {
      toast.success(t("login.successLogin"));
      await afterAuth();
    },
    onError: () => toast.error(t("login.errorGeneric")),
  });

  const registerMut = trpc.auth.register.useMutation({
    onSuccess: async () => {
      toast.success(t("login.successRegister"));
      await afterAuth();
    },
    onError: e => toast.error(e.message),
  });

  const pending = loginMut.isPending || registerMut.isPending;
  const isRegister = mode === "register";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegister)
      registerMut.mutate({
        email,
        password,
        name: name || undefined,
        accountType,
      });
    else loginMut.mutate({ email, password });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex justify-end p-4">
        <LanguageSwitcher />
      </div>
      <div className="flex-1 flex items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold tracking-tight text-center mb-6">
            {isRegister ? t("login.registerTitle") : t("login.title")}
          </h1>
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
              <input
                type="password"
                required
                minLength={isRegister ? 8 : undefined}
                value={password}
                onChange={e => setPassword(e.target.value)}
                data-testid="login-password"
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-accent"
              />
            </div>
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
              onClick={() => setMode(isRegister ? "login" : "register")}
              className="w-full text-center text-sm text-primary hover:underline"
            >
              {isRegister ? t("login.toLogin") : t("login.toRegister")}
            </button>
          </form>
          <div className="mt-4 text-center">
            <a
              href={getLoginUrl()}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {t("login.staffLogin")} →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
