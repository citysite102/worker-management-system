import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { MapPin, Users, ShieldCheck } from "lucide-react";
import { formatSalary, type JobCategory } from "@/lib/marketplace";
import {
  CategoryChip,
  MetaItem,
  MetaRow,
  SurfaceCard,
} from "@/components/marketplace/ui";

export type JobCardData = {
  source: "posting" | "demand";
  refId: number;
  category: JobCategory;
  jobType: string;
  city: string | null;
  district?: string | null;
  employmentType?: string | null;
  headcount: number;
  salaryMin: number | null;
  salaryMax: number | null;
};

/** 找工作卡片：職類籤 + 職種 + 地點/人數 + 薪資；既有需求標「既有需求」徽章。 */
export function JobCard({
  job,
  index = 0,
}: {
  job: JobCardData;
  index?: number;
}) {
  const { t } = useTranslation();
  const salary =
    formatSalary(job.salaryMin, job.salaryMax) ?? t("jobs.salaryNegotiable");
  return (
    <Link
      href={`/jobs/${job.source}/${job.refId}`}
      className="block animate-in fade-in slide-in-from-bottom-2 fill-mode-both"
      style={{ animationDelay: `${Math.min(index, 11) * 45}ms` }}
      data-testid="job-card"
    >
      <SurfaceCard interactive className="h-full">
        <div className="flex items-center justify-between gap-2">
          <CategoryChip>{t(`jobs.category.${job.category}`)}</CategoryChip>
          {job.source === "demand" && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              {t("jobs.internalTag")}
            </span>
          )}
        </div>
        <h3 className="mt-3 font-semibold">
          {t(`jobs.jobType.${job.jobType}`)}
        </h3>
        <div className="mt-2 space-y-1">
          <MetaItem icon={MapPin}>
            {job.city || t("jobs.cityNegotiable")}
            {job.district ? `・${job.district}` : ""}
          </MetaItem>
          <MetaItem icon={Users}>
            {t("jobs.headcount")}：{job.headcount} {t("jobs.people")}
          </MetaItem>
        </div>
        {job.employmentType && (
          <p className="mt-2 text-xs text-muted-foreground">
            {t(`jobs.employmentType.${job.employmentType}`)}
          </p>
        )}
        <p className="mt-3 text-sm font-medium text-foreground tabular-nums">
          {salary}
        </p>
      </SurfaceCard>
    </Link>
  );
}
