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
import {
  Eyebrow,
  Section,
  Figure,
  useDisplay,
} from "@/components/marketplace/ui";
import { TW_CITIES, type JobCategory } from "@/lib/marketplace";

const CATEGORIES: JobCategory[] = ["caregiver", "domestic_helper", "other"];

// Hero 背景：沉穩深藏青（navy）。刻意避開飽和藍→藍紫的 135° 大漸層（那是「AI 模板感」的來源），
// 改用近乎單色的深 navy + 極淡的右上柔光，色階都走 token。文字白色。品牌亮藍只留給 CTA/搜尋鈕。
// 換成情境大圖：把已授權／去識別的照片放 client/public/hero.jpg，右欄會自動顯示（缺圖時收合為單欄）。
const HERO_BG: React.CSSProperties = {
  backgroundColor: "var(--color-brand-darker)",
  backgroundImage:
    "radial-gradient(1100px 600px at 85% -30%, rgba(255,255,255,0.07), transparent 60%)," +
    "linear-gradient(180deg, var(--color-brand-dark) 0%, var(--color-brand-darker) 100%)",
};

/** 公開站首頁：大圖 hero + 蓋在上面的職缺搜尋框（WS4 分流 + WS5 i18n 落點）。 */
export default function PublicHome() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const display = useDisplay(); // 襯線大標：拉丁語系用 Fraunces，中文維持粗黑
  const [category, setCategory] = useState<JobCategory | "">("");
  const [city, setCity] = useState("");
  // 情境照片：/hero.jpg 存在→雙欄帶圖；缺圖(404)→收合為單欄，不留空框。
  const [heroImgFailed, setHeroImgFailed] = useState(false);

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

      {/* ── Hero（深藏青滿版 + 情境照片版位）── */}
      <section style={HERO_BG} className="text-white">
        <div
          className={`mx-auto grid max-w-6xl items-center gap-10 px-6 py-16 sm:py-24 ${
            heroImgFailed ? "" : "lg:grid-cols-[1.05fr_0.95fr]"
          }`}
        >
          <div className="max-w-xl animate-in fade-in slide-in-from-bottom-4 duration-700">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur">
              <ShieldCheck className="h-3.5 w-3.5" />
              {t("home.eyebrow")}
            </span>
            <h1
              className={`mt-5 text-4xl font-bold tracking-tight text-balance text-white sm:text-5xl ${display}`}
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
              <Link
                href="/inquiry"
                className="inline-flex items-center rounded-md border border-white/40 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
                data-testid="cta-inquiry"
              >
                {t("inquiry.nav")}
              </Link>
            </div>

            {/* 搜尋框：白卡浮在 navy 上，藍色只出現在搜尋鈕 */}
            <div className="mt-8 rounded-2xl border border-white/60 bg-card/95 p-3 shadow-lg backdrop-blur">
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

          {/* 情境照片版位（照片就緒）：放 client/public/hero.jpg 即顯示；缺圖時自動收合，不留空框。 */}
          {!heroImgFailed && (
            <div className="hidden lg:block animate-in fade-in duration-1000">
              <img
                src="/hero.jpg"
                alt=""
                onError={() => setHeroImgFailed(true)}
                className="aspect-[4/5] w-full rounded-2xl border border-white/10 object-cover shadow-2xl"
              />
            </div>
          )}
        </div>
      </section>

      <main className="max-w-6xl mx-auto px-6">
        {/* ── 如何運作（editorial：左標題欄 + 右側細線分隔步驟）── */}
        <Section className="grid gap-10 md:grid-cols-[300px_1fr]">
          <div className="md:sticky md:top-24 md:self-start">
            <Eyebrow>{t("home.how.eyebrow")}</Eyebrow>
            <h2
              className={`mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl ${display}`}
            >
              {t("home.how.title")}
            </h2>
            <p className="mt-3 text-muted-foreground">
              {t("home.how.subtitle")}
            </p>
            <Link
              href="/jobs"
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              {t("home.how.cta")} →
            </Link>
          </div>
          <div className="divide-y divide-border">
            {(
              t("home.how.steps", { returnObjects: true }) as Array<{
                title: string;
                desc: string;
              }>
            ).map((step, i) => (
              <div
                key={i}
                className="flex gap-5 py-6 first:pt-0 last:pb-0 animate-in fade-in slide-in-from-bottom-2 fill-mode-both"
                style={{ animationDelay: `${i * 90}ms` }}
              >
                <span
                  className={`shrink-0 text-2xl font-bold tabular-nums text-primary/35 ${display}`}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="text-lg font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── 信任訴求（editorial 圖文帶；Figure 照片就緒，放圖前為品牌色塊）── */}
        <Section divider>
          <div className="grid items-center gap-10 md:grid-cols-2">
            <div>
              <Eyebrow>{t("home.trustEyebrow")}</Eyebrow>
              <h2
                className={`mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl ${display}`}
              >
                {t("home.trustTitle")}
              </h2>
              <ul className="mt-6 space-y-4">
                {[
                  { icon: ShieldCheck, key: "trustVerified" },
                  { icon: Briefcase, key: "trustAgency" },
                  { icon: Languages, key: "trustMultilang" },
                ].map(({ icon: Icon, key }) => (
                  <li key={key} className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-sm font-medium">
                      {t(`home.${key}`)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            {/* 放圖：把已授權/去識別的照片放 client/public/trust.jpg，改成 src="/trust.jpg" 即顯示 */}
            <Figure alt={t("home.trustTitle")} aspect="5 / 4" />
          </div>
        </Section>

        {/* ── 常見問題（FAQ）── */}
        <Section id="faq" divider className="scroll-mt-20">
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
        </Section>
      </main>
    </div>
  );
}
