import { useState } from "react";
import { useSearch } from "wouter";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { PublicHeader } from "@/components/public/PublicHeader";
import { JobCard } from "@/components/marketplace/JobCard";
import { PageHeader, FilterChip } from "@/components/marketplace/ui";
import {
  TW_CITIES,
  EMPLOYMENT_TYPE_VALUES,
  JOB_CATEGORY_VALUES,
  type JobCategory,
  type EmploymentTypeValue,
} from "@/lib/marketplace";

const CATEGORIES: JobCategory[] = ["caregiver", "domestic_helper", "other"];

/** 公開站「找工作」列表（需登入；統一呈現公開需求單 + 既有內部需求單）。 */
export default function Jobs() {
  const { t } = useTranslation();
  // 首頁 hero 搜尋會帶 ?category=..&city=.. 進來，這裡作為初始篩選。
  const searchStr = useSearch();
  const initial = new URLSearchParams(searchStr);
  const initCategory = initial.get("category");
  const [category, setCategory] = useState<JobCategory | undefined>(
    (JOB_CATEGORY_VALUES as readonly string[]).includes(initCategory ?? "")
      ? (initCategory as JobCategory)
      : undefined
  );
  const [city, setCity] = useState<string | undefined>(
    initial.get("city") || undefined
  );
  const [employmentType, setEmploymentType] = useState<
    EmploymentTypeValue | undefined
  >();

  const jobsQuery = trpc.publicJobs.list.useQuery({
    category,
    city,
    employmentType,
  });

  const selectCls =
    "h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <main className="max-w-6xl mx-auto px-6 py-8">
        <PageHeader title={t("jobs.title")} subtitle={t("jobs.subtitle")} />

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3 mb-6">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              {t("jobs.filterCategory")}
            </span>
            <div className="flex flex-wrap gap-1.5">
              <FilterChip
                active={category === undefined}
                onClick={() => setCategory(undefined)}
                data-testid="filter-category-all"
              >
                {t("jobs.any")}
              </FilterChip>
              {CATEGORIES.map(c => (
                <FilterChip
                  key={c}
                  active={category === c}
                  onClick={() => setCategory(c)}
                  data-testid={`filter-category-${c}`}
                >
                  {t(`jobs.category.${c}`)}
                </FilterChip>
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {t("jobs.filterCity")}
            <select
              value={city ?? ""}
              onChange={e => setCity(e.target.value || undefined)}
              className={selectCls}
              data-testid="filter-city"
            >
              <option value="">{t("jobs.any")}</option>
              {TW_CITIES.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {t("jobs.filterEmployment")}
            <select
              value={employmentType ?? ""}
              onChange={e =>
                setEmploymentType(
                  (e.target.value || undefined) as
                    | EmploymentTypeValue
                    | undefined
                )
              }
              className={selectCls}
              data-testid="filter-employment"
            >
              <option value="">{t("jobs.any")}</option>
              {EMPLOYMENT_TYPE_VALUES.map(v => (
                <option key={v} value={v}>
                  {t(`jobs.employmentType.${v}`)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* List */}
        {jobsQuery.isLoading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            {t("jobs.title")}…
          </div>
        ) : !jobsQuery.data || jobsQuery.data.length === 0 ? (
          <div
            className="py-16 text-center text-sm text-muted-foreground"
            data-testid="jobs-empty"
          >
            {t("jobs.empty")}
          </div>
        ) : (
          <div
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            data-testid="jobs-list"
          >
            {jobsQuery.data.map(job => (
              <JobCard key={`${job.source}-${job.refId}`} job={job} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
