import { Link, useParams, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { MapPin, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { PublicHeader } from "@/components/public/PublicHeader";
import { formatSalary } from "@/lib/marketplace";
import {
  CategoryChip,
  SurfaceCard,
  SkeletonCard,
  useDisplay,
} from "@/components/marketplace/ui";

/** 公開站職缺詳情（開放匿名瀏覽）。「我有興趣」需登入 → 建立媒合意向交客服居中（P3）。 */
export default function JobDetail() {
  const { t } = useTranslation();
  const display = useDisplay();
  const params = useParams<{ source: string; id: string }>();
  const source = params.source === "demand" ? "demand" : "posting";
  const id = Number(params.id);
  const utils = trpc.useUtils();
  const { isAuthenticated } = useAuth();
  const [location, navigate] = useLocation();

  const jobQuery = trpc.publicJobs.get.useQuery(
    { source, id },
    { enabled: Number.isFinite(id) && id > 0, retry: false }
  );

  // 已送出過的意向 → 反映「已送出」狀態，避免重複點（僅登入者查）。
  const myInterests = trpc.publicJobs.myInterests.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const targetType = source === "posting" ? "job_posting" : "case_demand";
  const alreadySent = (myInterests.data ?? []).some(
    m => m.targetType === targetType && m.targetId === id
  );

  const interestMut = trpc.publicJobs.expressInterest.useMutation({
    onSuccess: async () => {
      toast.success(t("jobs.interestedSent"));
      await utils.publicJobs.myInterests.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  const d = jobQuery.data;

  // 右側應徵卡的「關鍵事實」鍵值列（薪資另置頂）。
  const facts = d
    ? ([
        {
          label: t("jobs.filterCity"),
          value: d.city
            ? `${d.city}${d.district ? `・${d.district}` : ""}`
            : t("jobs.cityNegotiable"),
        },
        {
          label: t("jobs.headcount"),
          value: `${d.headcount} ${t("jobs.people")}`,
        },
        d.employmentType && {
          label: t("jobs.filterEmployment"),
          value: t(`jobs.employmentType.${d.employmentType}`),
        },
        d.employerType && {
          label: t("jobs.employerLabel"),
          value:
            d.employerType === "individual"
              ? t("jobs.employerIndividual")
              : t("jobs.employerCompany"),
        },
        d.expectedStartDate && {
          label: t("jobs.expectedStart"),
          value: d.expectedStartDate,
        },
      ].filter(Boolean) as Array<{ label: string; value: string }>)
    : [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Link
          href="/jobs"
          className="text-sm text-muted-foreground hover:text-foreground"
          data-testid="detail-back"
        >
          {t("jobs.detailBack")}
        </Link>

        {jobQuery.isLoading ? (
          <div className="mt-4">
            <SkeletonCard />
          </div>
        ) : jobQuery.error || !d ? (
          <div
            className="py-16 text-center text-sm text-muted-foreground"
            data-testid="detail-notfound"
          >
            {t("jobs.empty")}
          </div>
        ) : (
          <div
            className="mt-4 grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start"
            data-testid="job-detail"
          >
            {/* ── 左：職缺內容 ── */}
            <SurfaceCard>
              <div className="flex flex-wrap items-center gap-2">
                <CategoryChip>{t(`jobs.category.${d.category}`)}</CategoryChip>
                {d.source === "demand" && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                    {t("jobs.internalTag")}
                  </span>
                )}
              </div>
              <h1
                className={`mt-3 text-3xl font-bold tracking-tight text-balance ${display}`}
              >
                {t(`jobs.jobType.${d.jobType}`)}
              </h1>
              <p className="mt-2 flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" />
                {d.city || t("jobs.cityNegotiable")}
                {d.district ? `・${d.district}` : ""}
              </p>

              {d.publicDescription && (
                <section className="mt-6 border-t border-border pt-6">
                  <h2 className="text-sm font-semibold">
                    {t("jobs.detailDesc")}
                  </h2>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {d.publicDescription}
                  </p>
                </section>
              )}
              {d.requirements && (
                <section className="mt-6 border-t border-border pt-6">
                  <h2 className="text-sm font-semibold">
                    {t("jobs.detailReq")}
                  </h2>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {d.requirements}
                  </p>
                </section>
              )}
            </SurfaceCard>

            {/* ── 右：應徵卡（薪資置頂 + 關鍵事實 + CTA），桌機 sticky ── */}
            <SurfaceCard className="lg:sticky lg:top-24">
              <p className="text-2xl font-bold tracking-tight tabular-nums">
                {formatSalary(d.salaryMin, d.salaryMax) ??
                  t("jobs.salaryNegotiable")}
              </p>
              <dl className="mt-4 space-y-3 border-t border-border pt-4 text-sm">
                {facts.map(f => (
                  <div
                    key={f.label}
                    className="flex items-start justify-between gap-4"
                  >
                    <dt className="shrink-0 text-muted-foreground">
                      {f.label}
                    </dt>
                    <dd className="text-right font-medium">{f.value}</dd>
                  </div>
                ))}
              </dl>
              <button
                type="button"
                disabled={interestMut.isPending || alreadySent}
                onClick={() => {
                  if (!isAuthenticated) {
                    navigate(`/login?next=${encodeURIComponent(location)}`);
                    return;
                  }
                  interestMut.mutate({ source, id });
                }}
                className="mt-5 w-full rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                data-testid="express-interest"
              >
                {alreadySent
                  ? t("jobs.alreadyInterested")
                  : t("jobs.interested")}
              </button>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                {t("jobs.viaAgency")}
              </p>
            </SurfaceCard>
          </div>
        )}
      </main>
    </div>
  );
}
