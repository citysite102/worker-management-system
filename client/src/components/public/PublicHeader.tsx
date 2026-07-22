import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Logo } from "@/components/brand/Logo";
import { useAuth } from "@/_core/hooks/useAuth";

/** 公開站共用頁首：品牌 + 導覽 + 語言 + 登入/帳號。 */
export function PublicHeader() {
  const { t } = useTranslation();
  const { user, isAuthenticated, logout } = useAuth();
  const isEmployer =
    user?.accountType === "employer" ||
    user?.role === "staff" ||
    user?.role === "admin";

  return (
    <header className="border-b border-border bg-card">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
        <Link
          href="/"
          className="flex items-center gap-2"
          data-testid="public-logo"
        >
          <Logo variant="color" size="sm" />
          <span className="font-bold tracking-tight">長誠媒合</span>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
          <Link
            href="/jobs"
            className="hover:text-foreground transition-colors"
            data-testid="nav-find-jobs"
          >
            {t("nav.findJobs")}
          </Link>
          {isAuthenticated && (
            <Link
              href="/my-interests"
              className="hover:text-foreground transition-colors"
              data-testid="nav-my-interests"
            >
              {t("jobs.myNav")}
            </Link>
          )}
          {isEmployer && (
            <Link
              href="/employer"
              className="hover:text-foreground transition-colors"
              data-testid="nav-employer"
            >
              {t("employer.title")}
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          {isAuthenticated ? (
            <button
              type="button"
              onClick={() => logout()}
              className="inline-flex items-center rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
              data-testid="logout-btn"
            >
              {user?.name || user?.email || "登出"}
            </button>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
              data-testid="login-link"
            >
              {t("nav.login")}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
