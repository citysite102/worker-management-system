import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import {
  Heart,
  FileUser,
  Briefcase,
  LogOut,
  LayoutDashboard,
} from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Logo } from "@/components/brand/Logo";
import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

/** 公開站共用頁首：品牌 + 主導覽（瀏覽用）＋ 語言 ＋ 登入鈕／帳號選單。 */
export function PublicHeader() {
  const { t } = useTranslation();
  const { user, isAuthenticated, logout } = useAuth();
  const [, navigate] = useLocation();
  const isStaff = user?.role === "staff" || user?.role === "admin";
  const isEmployer = user?.accountType === "employer" || isStaff;
  const isWorker = user?.accountType === "worker" || isStaff;

  // 帳號選單的頭像縮寫（取名稱/Email 首字）。
  const displayName = user?.name || user?.email || "";
  const initial = displayName.trim().charAt(0).toUpperCase() || "?";

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="flex items-center gap-2"
            data-testid="public-logo"
          >
            <Logo variant="color" size="sm" />
            <span className="font-bold tracking-tight">長誠媒合</span>
          </Link>
          {/* 主導覽只放「瀏覽」入口；個人/角色頁移到帳號選單內 */}
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <Link
              href="/jobs"
              className="transition-colors hover:text-foreground"
              data-testid="nav-find-jobs"
            >
              {t("nav.findJobs")}
            </Link>
            <Link
              href="/find-workers"
              className="transition-colors hover:text-foreground"
              data-testid="nav-find-workers"
            >
              {t("nav.findWorkers")}
            </Link>
            <Link
              href="/inquiry"
              className="transition-colors hover:text-foreground"
              data-testid="nav-inquiry"
            >
              {t("inquiry.nav")}
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="rounded-full outline-none ring-ring focus-visible:ring-2"
                data-testid="account-menu-trigger"
              >
                <Avatar className="h-9 w-9 border border-border">
                  <AvatarFallback className="bg-accent text-sm font-semibold text-accent-foreground">
                    {initial}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">
                  {displayName}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => navigate("/my-interests")}
                  data-testid="menu-my-interests"
                >
                  <Heart className="h-4 w-4" />
                  {t("jobs.myNav")}
                </DropdownMenuItem>
                {isWorker && (
                  <DropdownMenuItem
                    onClick={() => navigate("/worker/profile")}
                    data-testid="menu-worker-profile"
                  >
                    <FileUser className="h-4 w-4" />
                    {t("worker.nav")}
                  </DropdownMenuItem>
                )}
                {isEmployer && (
                  <DropdownMenuItem
                    onClick={() => navigate("/employer")}
                    data-testid="menu-employer"
                  >
                    <Briefcase className="h-4 w-4" />
                    {t("employer.title")}
                  </DropdownMenuItem>
                )}
                {isStaff && (
                  <>
                    <DropdownMenuSeparator />
                    {/* 內部人員：一鍵進後台（離開 nest 的公開站，用整頁導頁）*/}
                    <DropdownMenuItem asChild data-testid="menu-admin">
                      <a href="/admin">
                        <LayoutDashboard className="h-4 w-4" />
                        {t("nav.admin")}
                      </a>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => logout()}
                  data-testid="menu-logout"
                >
                  <LogOut className="h-4 w-4" />
                  {t("nav.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
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
