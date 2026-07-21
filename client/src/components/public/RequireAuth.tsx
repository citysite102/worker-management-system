import { Redirect, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";

/**
 * 公開站登入守衛：未登入者導向 /login，並用 ?next= 記住原目的地，
 * 登入後才會回到原本想去的頁面（修掉「登入後被丟回首頁」的問題）。
 *
 * accountType 指定時，額外要求帳號型別相符（staff/admin 一律放行，可代操作）。
 */
export function RequireAuth({
  children,
  accountType,
}: {
  children: React.ReactNode;
  accountType?: "worker" | "employer";
}) {
  const { t } = useTranslation();
  const [location] = useLocation();
  const { data: me, isLoading } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        {t("jobs.loginRequired")}…
      </div>
    );
  }

  if (!me) {
    return <Redirect to={`/login?next=${encodeURIComponent(location)}`} />;
  }

  const isStaff = me.role === "staff" || me.role === "admin";
  if (accountType && me.accountType !== accountType && !isStaff) {
    return (
      <div className="min-h-screen grid place-items-center px-6 text-center bg-background">
        <div>
          <p className="text-lg font-semibold">
            {accountType === "employer" ? "此區為雇主專區" : "此區為移工專區"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            請使用對應身分的帳號登入。
          </p>
          <a
            href="/"
            className="mt-4 inline-block text-sm text-primary hover:underline"
          >
            返回首頁
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
