import { Link, useParams, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { MapPin, Users, Calendar, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { PublicHeader } from "@/components/public/PublicHeader";
import { formatSalary } from "@/lib/marketplace";
import {
  CategoryChip,
  MetaItem,
  SurfaceCard,
} from "@/components/marketplace/ui";

/** 公開站職缺詳情（開放匿名瀏覽）。「我有興趣」需登入 → 建立媒合意向交客服居中（P3）。 */
export default function JobDetail() {
  const { t } = useTranslation();
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <main className="max-w-3xl mx-auto px-6 py-8">
        <Link
          href="/jobs"
          className="text-sm text-muted-foreground hover:text-foreground"
          data-testid="detail-back"
        >
          {t("jobs.detailBack")}
        </Link>

        {jobQuery.isLoading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            …
          </div>
        ) : jobQuery.error || !jobQuery.data ? (
          <div
            className="py-16 text-center text-sm text-muted-foreground"
            data-testid="detail-notfound"
          >
            {t("jobs.empty")}
          </div>
        ) : (
          <SurfaceCard className="mt-4" data-testid="job-detail">
            <div className="flex items-center gap-2">
              <CategoryChip>
                {t(`jobs.category.${jobQuery.data.category}`)}
              </CategoryChip>
              {jobQuery.data.source === "demand" && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                  {t("jobs.internalTag")}
                </span>
              )}
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight">
              {t(`jobs.jobType.${jobQuery.data.jobType}`)}
            </h1>

            <div className="mt-4 grid gap-2">
              <MetaItem icon={MapPin}>
                {jobQuery.data.city || t("jobs.cityNegotiable")}
                {jobQuery.data.district ? `・${jobQuery.data.district}` : ""}
              </MetaItem>
              <MetaItem icon={Users}>
                {t("jobs.headcount")}：{jobQuery.data.headcount}{" "}
                {t("jobs.people")}
              </MetaItem>
              {jobQuery.data.employmentType && (
                <p className="text-sm text-muted-foreground">
                  {t("jobs.filterEmployment")}：
                  {t(`jobs.employmentType.${jobQuery.data.employmentType}`)}
                </p>
              )}
              {jobQuery.data.expectedStartDate && (
                <MetaItem icon={Calendar}>
                  {t("jobs.expectedStart")}：{jobQuery.data.expectedStartDate}
                </MetaItem>
              )}
            </div>

            <p className="mt-4 text-lg font-semibold">
              {formatSalary(jobQuery.data.salaryMin, jobQuery.data.salaryMax) ??
                t("jobs.salaryNegotiable")}
            </p>

            {jobQuery.data.publicDescription && (
              <section className="mt-6">
                <h2 className="text-sm font-semibold">
                  {t("jobs.detailDesc")}
                </h2>
                <p className="mt-1.5 text-sm whitespace-pre-wrap text-muted-foreground">
                  {jobQuery.data.publicDescription}
                </p>
              </section>
            )}
            {jobQuery.data.requirements && (
              <section className="mt-4">
                <h2 className="text-sm font-semibold">{t("jobs.detailReq")}</h2>
                <p className="mt-1.5 text-sm whitespace-pre-wrap text-muted-foreground">
                  {jobQuery.data.requirements}
                </p>
              </section>
            )}

            <div className="mt-6 flex items-center gap-3">
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
                className="inline-flex items-center rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-60"
                data-testid="express-interest"
              >
                {alreadySent
                  ? t("jobs.alreadyInterested")
                  : t("jobs.interested")}
              </button>
              <span className="text-xs text-muted-foreground">
                {t("jobs.viaAgency")}
              </span>
            </div>
          </SurfaceCard>
        )}
      </main>
    </div>
  );
}
