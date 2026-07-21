import { useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { MapPin, Users, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PublicHeader } from "@/components/public/PublicHeader";
import {
  TW_CITIES,
  EMPLOYMENT_TYPE_VALUES,
  formatSalary,
  type JobCategory,
  type EmploymentTypeValue,
} from "@/lib/marketplace";

const CATEGORIES: JobCategory[] = ["caregiver", "domestic_helper", "other"];

/** 公開站「找工作」列表（需登入；統一呈現公開需求單 + 既有內部需求單）。 */
export default function Jobs() {
  const { t } = useTranslation();
  const [category, setCategory] = useState<JobCategory | undefined>();
  const [city, setCity] = useState<string | undefined>();
  const [employmentType, setEmploymentType] = useState<
    EmploymentTypeValue | undefined
  >();

  const jobsQuery = trpc.publicJobs.list.useQuery({
    category,
    city,
    employmentType,
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">
            {t("jobs.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("jobs.subtitle")}
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3 mb-6">
          <FilterGroup label={t("jobs.filterCategory")}>
            <button
              type="button"
              onClick={() => setCategory(undefined)}
              className={chip(category === undefined)}
              data-testid="filter-category-all"
            >
              {t("jobs.any")}
            </button>
            {CATEGORIES.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={chip(category === c)}
                data-testid={`filter-category-${c}`}
              >
                {t(`jobs.category.${c}`)}
              </button>
            ))}
          </FilterGroup>

          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {t("jobs.filterCity")}
            <select
              value={city ?? ""}
              onChange={e => setCity(e.target.value || undefined)}
              className="h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground"
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
              className="h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground"
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
              <Link
                key={`${job.source}-${job.refId}`}
                href={`/jobs/${job.source}/${job.refId}`}
                className="rounded-lg border border-border bg-card p-5 hover:border-primary transition-colors block"
                data-testid="job-card"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
                    {t(`jobs.category.${job.category}`)}
                  </span>
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
                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <p className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" />
                    {job.city || t("jobs.cityNegotiable")}
                    {job.district ? `・${job.district}` : ""}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    {t("jobs.headcount")}：{job.headcount} {t("jobs.people")}
                  </p>
                </div>
                {job.employmentType && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t(`jobs.employmentType.${job.employmentType}`)}
                  </p>
                )}
                <p className="mt-3 text-sm font-medium text-foreground">
                  {formatSalary(job.salaryMin, job.salaryMax) ??
                    t("jobs.salaryNegotiable")}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function chip(active: boolean) {
  return `rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
    active
      ? "border-primary bg-accent text-accent-foreground"
      : "border-border bg-card text-muted-foreground hover:bg-muted"
  }`;
}
