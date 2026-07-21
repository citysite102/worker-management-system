import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Briefcase, ShieldCheck, Languages } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Logo } from "@/components/brand/Logo";

/** 公開站首頁（WS4 分流 + WS5 i18n 的落點）。 */
export default function PublicHome() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Logo variant="color" size="sm" />
            <span className="font-bold tracking-tight">長誠媒合</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <span>{t("nav.findJobs")}</span>
            <span>{t("nav.findWorkers")}</span>
            <span>{t("nav.employer")}</span>
          </nav>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Link
              href="/login"
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              {t("nav.login")}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-6xl mx-auto px-6">
        <section className="py-20 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-balance max-w-2xl mx-auto">
            {t("home.heroTitle")}
          </h1>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
            {t("home.heroSubtitle")}
          </p>
          <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/login"
              className="inline-flex items-center rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              {t("home.ctaFindJobs")} →
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center rounded-md border border-border bg-card px-5 py-2.5 text-sm font-semibold hover:bg-muted transition-colors"
            >
              {t("home.ctaPostJob")}
            </Link>
          </div>
        </section>

        {/* Trust */}
        <section className="grid gap-4 sm:grid-cols-3 pb-24">
          {[
            { icon: ShieldCheck, key: "trustVerified" },
            { icon: Briefcase, key: "trustAgency" },
            { icon: Languages, key: "trustMultilang" },
          ].map(({ icon: Icon, key }) => (
            <div
              key={key}
              className="rounded-lg border border-border bg-card p-5"
            >
              <Icon className="w-5 h-5 text-primary" />
              <p className="mt-3 text-sm font-medium">{t(`home.${key}`)}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
