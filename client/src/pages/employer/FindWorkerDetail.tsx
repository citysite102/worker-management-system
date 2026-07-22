import { useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Globe,
  CalendarClock,
  ShieldCheck,
  Languages,
  Lock,
  Sparkles,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { PublicHeader } from "@/components/public/PublicHeader";
import {
  SurfaceCard,
  StatusPill,
  SkeletonCard,
} from "@/components/marketplace/ui";
import {
  AnonAvatar,
  CategoryTag,
  RatingStars,
} from "@/components/marketplace/worker";

/** 找外籍工作者詳情：履歷版型（開放匿名瀏覽摘要）；完整內容登入後才由後端下傳。 */
export default function FindWorkerDetail() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [sent, setSent] = useState(false);
  const { isAuthenticated } = useAuth();
  const [location, navigate] = useLocation();

  const q = trpc.findWorkers.get.useQuery(
    { id },
    { enabled: Number.isFinite(id) && id > 0, retry: false }
  );

  const interestMut = trpc.findWorkers.expressInterest.useMutation({
    onSuccess: () => {
      toast.success(t("findWorkers.interestedSent"));
      setSent(true);
    },
    onError: e => toast.error(e.message),
  });

  const p = q.data;
  const goLogin = () => navigate(`/login?next=${encodeURIComponent(location)}`);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-6 py-8">
        <Link
          href="/find-workers"
          className="text-sm text-muted-foreground hover:text-foreground"
          data-testid="fw-detail-back"
        >
          {t("findWorkers.back")}
        </Link>

        {q.isLoading ? (
          <div className="mt-4">
            <SkeletonCard />
          </div>
        ) : q.error || !p ? (
          <div
            className="py-16 text-center text-sm text-muted-foreground"
            data-testid="fw-detail-notfound"
          >
            {t("findWorkers.empty")}
          </div>
        ) : (
          <div className="mt-4 space-y-6" data-testid="worker-detail">
            {/* ── 履歷頁首（公開摘要）── */}
            <SurfaceCard className="overflow-hidden p-0">
              <div className="bg-accent/40 px-6 py-6">
                <div className="flex items-start gap-4">
                  {/* 登入後若有真實照片就顯示（後端只在登入時下傳 photoUrl）；否則匿名頭像 */}
                  {p.photoUrl ? (
                    <img
                      src={p.photoUrl}
                      alt={p.alias}
                      loading="lazy"
                      className="h-20 w-20 shrink-0 rounded-full border border-border object-cover"
                    />
                  ) : (
                    <AnonAvatar
                      jobType={p.jobType}
                      size="lg"
                      locked={p.gated}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {p.jobTypes.map(jt => (
                        <CategoryTag
                          key={jt}
                          jobType={jt}
                          label={t(`jobs.jobType.${jt}`)}
                        />
                      ))}
                      {p.ageRange && (
                        <span className="text-xs text-muted-foreground">
                          {t("findWorkers.ageRange")} {p.ageRange}
                        </span>
                      )}
                    </div>
                    <h1 className="mt-2 text-2xl font-bold tracking-tight">
                      {p.alias}
                    </h1>
                    {p.headline && (
                      <p className="mt-1 text-muted-foreground">{p.headline}</p>
                    )}
                    {p.rating && (
                      <div className="mt-2">
                        <RatingStars
                          avg={p.rating.avg}
                          count={p.rating.count}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4 px-6 py-5">
                <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                  {p.nationality && (
                    <span className="flex items-center gap-1.5">
                      <Globe className="h-4 w-4" /> {p.nationality}
                    </span>
                  )}
                  {p.availability && (
                    <span className="flex items-center gap-1.5">
                      <CalendarClock className="h-4 w-4" /> {p.availability}
                    </span>
                  )}
                  {p.languages.length > 0 && (
                    <span className="flex items-center gap-1.5">
                      <Languages className="h-4 w-4" /> {p.languages.join("、")}
                    </span>
                  )}
                </div>

                {p.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {p.skills.map(s => (
                      <span
                        key={s}
                        className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    disabled={interestMut.isPending || sent}
                    onClick={() => {
                      if (!isAuthenticated) return goLogin();
                      interestMut.mutate({ id });
                    }}
                    className="inline-flex items-center rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                    data-testid="fw-express-interest"
                  >
                    {sent
                      ? t("findWorkers.alreadyInterested")
                      : t("findWorkers.interested")}
                  </button>
                  <span className="text-xs text-muted-foreground">
                    {t("findWorkers.viaAgency")}
                  </span>
                </div>
              </div>
            </SurfaceCard>

            {/* ── 完整履歷：登入後由後端下傳；未登入顯示模糊佔位（資料不在 HTML）── */}
            {p.gated ? (
              <LockedResume onLogin={goLogin} />
            ) : (
              <div className="space-y-6" data-testid="fw-full-resume">
                {/* 自我介紹 */}
                {p.selfIntro && (
                  <ResumeSection
                    icon={<Sparkles className="h-4 w-4 text-primary" />}
                    title={t("findWorkers.aboutMe")}
                  >
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {p.selfIntro}
                    </p>
                  </ResumeSection>
                )}

                {/* 平台驗證工作紀錄 */}
                <ResumeSection
                  icon={<ShieldCheck className="h-4 w-4 text-primary" />}
                  title={t("findWorkers.verifiedRecords")}
                >
                  {p.platformRecords.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t("findWorkers.noRecords")}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {p.platformRecords.map(r => (
                        <div
                          key={r.id}
                          className="rounded-md border border-border px-3 py-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium">
                              {r.position || "—"}
                            </span>
                            <StatusPill
                              tone={r.status === "active" ? "green" : "gray"}
                            >
                              {r.status}
                            </StatusPill>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {r.contractStart || "?"} –{" "}
                            {r.contractEnd || t("findWorkers.present")}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </ResumeSection>

                {/* 自填經歷 */}
                {p.experiences.length > 0 && (
                  <ResumeSection
                    title={t("findWorkers.selfReported")}
                    icon={<CalendarClock className="h-4 w-4 text-primary" />}
                  >
                    <div className="space-y-2">
                      {p.experiences.map(e => (
                        <div
                          key={e.id}
                          className="rounded-md border border-border px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {e.role}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {t(`worker.employerType.${e.employerType}`)}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {e.startDate || "?"} –{" "}
                            {e.endDate || t("findWorkers.present")}
                          </p>
                          {e.description && (
                            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                              {e.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </ResumeSection>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

/** 履歷區塊：標題 + icon + 內容。 */
function ResumeSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * 未登入的完整履歷佔位：模糊的「假骨架」+ 置中登入 CTA。
 * 真實資料（自我介紹/經歷/紀錄/評價）未登入時後端根本不下傳，無法從 HTML 取得。
 */
function LockedResume({ onLogin }: { onLogin: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="relative" data-testid="fw-locked-resume">
      {/* 假骨架：純裝飾、無任何真實資料，且整體模糊 */}
      <div
        className="space-y-6 select-none blur-sm"
        aria-hidden
        style={{ pointerEvents: "none" }}
      >
        <div className="space-y-2">
          <div className="h-3 w-24 rounded bg-muted" />
          <div className="h-3 w-full rounded bg-muted" />
          <div className="h-3 w-11/12 rounded bg-muted" />
          <div className="h-3 w-4/5 rounded bg-muted" />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-32 rounded bg-muted" />
          <div className="h-16 rounded-md border border-border bg-card" />
          <div className="h-16 rounded-md border border-border bg-card" />
        </div>
      </div>

      {/* 置中登入 CTA */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-background/50 px-6 text-center backdrop-blur-[2px]">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Lock className="h-5 w-5" />
        </span>
        <div>
          <p className="font-semibold">{t("findWorkers.lockedTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("findWorkers.lockedHint")}
          </p>
        </div>
        <button
          type="button"
          onClick={onLogin}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          data-testid="fw-locked-login"
        >
          <Lock className="h-4 w-4" />
          {t("findWorkers.lockedCta")}
        </button>
      </div>
    </div>
  );
}
