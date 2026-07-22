import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Briefcase, ShieldCheck, Languages, Search } from "lucide-react";
import { PublicHeader } from "@/components/public/PublicHeader";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Eyebrow } from "@/components/marketplace/ui";
import { TW_CITIES, type JobCategory } from "@/lib/marketplace";

const CATEGORIES: JobCategory[] = ["caregiver", "domestic_helper", "other"];

// Hero 背景：品牌深藍漸層（含柔光），文字用白色；顏色一律走 token（見 index.css @theme）。
// 白/黑 rgba 為柔光與陰影，非品牌色。要換成實拍大圖時，把 linear-gradient 換成
// `linear-gradient(暗遮罩), url('/hero.jpg')` 即可（圖片放 public/）。
const HERO_BG: React.CSSProperties = {
  backgroundColor: "var(--color-primary)",
  backgroundImage:
    "radial-gradient(1200px 500px at 15% -10%, rgba(255,255,255,0.22), transparent 60%)," +
    "radial-gradient(900px 500px at 100% 120%, rgba(0,0,0,0.35), transparent 55%)," +
    "linear-gradient(135deg, var(--color-primary) 0%, var(--color-brand-dark) 55%, var(--color-brand-darker) 100%)",
};

/** 公開站首頁：大圖 hero + 蓋在上面的職缺搜尋框（WS4 分流 + WS5 i18n 落點）。 */
export default function PublicHome() {
  const { t, i18n } = useTranslation();
  const [, navigate] = useLocation();
  // 行銷大標的襯線字（Fraunces）只給拉丁語系；中文維持粗黑（設計系統 §3）。
  const display = i18n.language.startsWith("zh") ? "" : "font-display";
  const [category, setCategory] = useState<JobCategory | "">("");
  const [city, setCity] = useState("");

  const search = () => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (city) params.set("city", city);
    const qs = params.toString();
    navigate(`/jobs${qs ? `?${qs}` : ""}`);
  };

  const selectCls =
    "h-11 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-accent";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />

      <main className="max-w-6xl mx-auto px-6">
        {/* ── Hero（大圖背景 + 蓋在上面的搜尋框）── */}
        <section className="pt-6">
          <div
            className="relative overflow-hidden rounded-3xl px-6 py-16 sm:px-12 sm:py-24"
            style={HERO_BG}
          >
            <div className="relative max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-700">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur">
                <ShieldCheck className="h-3.5 w-3.5" />
                {t("home.eyebrow")}
              </span>
              <h1
                className={`mt-5 text-4xl font-bold tracking-tight text-balance text-white sm:text-6xl ${display}`}
              >
                {t("home.heroTitle")}
              </h1>
              <p className="mt-4 max-w-xl text-white/85">
                {t("home.heroSubtitle")}
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href="/jobs"
                  className="inline-flex items-center rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-primary hover:bg-white/90 transition-colors"
                  data-testid="cta-find-jobs"
                >
                  {t("home.ctaFindJobs")} →
                </Link>
                <Link
                  href="/employer"
                  className="inline-flex items-center rounded-md border border-white/40 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
                  data-testid="cta-post-job"
                >
                  {t("home.ctaPostJob")}
                </Link>
              </div>
            </div>

            {/* 蓋在 hero 上的搜尋框 */}
            <div className="relative mt-10 max-w-3xl rounded-2xl border border-white/60 bg-card/95 p-3 shadow-lg backdrop-blur sm:mt-12">
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <label className="sr-only" htmlFor="hero-category">
                  {t("jobs.filterCategory")}
                </label>
                <select
                  id="hero-category"
                  value={category}
                  onChange={e =>
                    setCategory(e.target.value as JobCategory | "")
                  }
                  className={selectCls}
                  data-testid="hero-category"
                >
                  <option value="">
                    {t("jobs.filterCategory")}（{t("jobs.any")}）
                  </option>
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>
                      {t(`jobs.category.${c}`)}
                    </option>
                  ))}
                </select>
                <label className="sr-only" htmlFor="hero-city">
                  {t("jobs.filterCity")}
                </label>
                <select
                  id="hero-city"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  className={selectCls}
                  data-testid="hero-city"
                >
                  <option value="">
                    {t("jobs.filterCity")}（{t("jobs.any")}）
                  </option>
                  {TW_CITIES.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={search}
                  className="inline-flex h-11 items-center justify-center gap-1.5 rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
                  data-testid="hero-search"
                >
                  <Search className="h-4 w-4" />
                  {t("home.searchCta")}
                </button>
              </div>
              <p className="mt-2 px-1 text-xs text-muted-foreground">
                {t("home.searchHint")}
              </p>
            </div>
          </div>
        </section>

        {/* ── Trust ── */}
        <section className="grid gap-4 sm:grid-cols-3 py-16">
          {[
            { icon: ShieldCheck, key: "trustVerified" },
            { icon: Briefcase, key: "trustAgency" },
            { icon: Languages, key: "trustMultilang" },
          ].map(({ icon: Icon, key }, i) => (
            <div
              key={key}
              style={{ animationDelay: `${i * 90}ms` }}
              className="rounded-lg border border-border bg-card p-5 shadow-xs transition-all duration-200 ease-out animate-in fade-in slide-in-from-bottom-2 fill-mode-both hover:-translate-y-0.5 hover:shadow-sm"
            >
              <Icon className="w-5 h-5 text-primary" />
              <p className="mt-3 text-sm font-medium">{t(`home.${key}`)}</p>
            </div>
          ))}
        </section>

        {/* ── 常見問題（FAQ）── */}
        <section id="faq" className="scroll-mt-20 border-t border-border py-16">
          <div className="mx-auto max-w-3xl">
            <div className="text-center">
              <Eyebrow>{t("home.faqEyebrow")}</Eyebrow>
              <h2
                className={`mt-2 text-3xl font-bold tracking-tight ${display}`}
              >
                {t("home.faqTitle")}
              </h2>
              <p className="mt-2 text-muted-foreground">
                {t("home.faqSubtitle")}
              </p>
            </div>

            <Accordion
              type="single"
              collapsible
              className="mt-8"
              data-testid="home-faq"
            >
              {(
                t("home.faq", { returnObjects: true }) as Array<{
                  q: string;
                  a: string;
                }>
              ).map((item, i) => (
                <AccordionItem key={i} value={`faq-${i}`}>
                  <AccordionTrigger className="text-left text-base font-medium">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>
      </main>
    </div>
  );
}
