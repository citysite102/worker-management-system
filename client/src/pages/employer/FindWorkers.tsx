import { useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Globe, CalendarClock } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PublicHeader } from "@/components/public/PublicHeader";
import {
  PageHeader,
  SurfaceCard,
  CategoryChip,
  MetaItem,
  MetaRow,
  FilterChip,
} from "@/components/marketplace/ui";
import { JOB_TYPE_VALUES, type JobTypeValue } from "@/lib/marketplace";

/** 找移工列表（雇主，需有通過的需求單）。 */
export default function FindWorkers() {
  const { t } = useTranslation();
  const [jobType, setJobType] = useState<JobTypeValue | undefined>();
  const q = trpc.findWorkers.list.useQuery({ jobType }, { retry: false });

  const gated = q.error?.data?.code === "FORBIDDEN";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <main className="max-w-6xl mx-auto px-6 py-8">
        <PageHeader
          title={t("findWorkers.title")}
          subtitle={t("findWorkers.subtitle")}
        />

        {gated ? (
          <SurfaceCard data-testid="find-workers-gate">
            <p className="text-sm text-muted-foreground">
              {t("findWorkers.gateRequired")}
            </p>
            <Link
              href="/employer/post"
              className="mt-3 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              {t("findWorkers.goPost")}
            </Link>
          </SurfaceCard>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5 mb-6">
              <FilterChip
                active={jobType === undefined}
                onClick={() => setJobType(undefined)}
                data-testid="fw-filter-all"
              >
                {t("jobs.any")}
              </FilterChip>
              {JOB_TYPE_VALUES.map(v => (
                <FilterChip
                  key={v}
                  active={jobType === v}
                  onClick={() => setJobType(v)}
                  data-testid={`fw-filter-${v}`}
                >
                  {t(`jobs.jobType.${v}`)}
                </FilterChip>
              ))}
            </div>

            {q.isLoading ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                …
              </div>
            ) : !q.data || q.data.length === 0 ? (
              <div
                className="py-16 text-center text-sm text-muted-foreground"
                data-testid="find-workers-empty"
              >
                {t("findWorkers.empty")}
              </div>
            ) : (
              <div
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                data-testid="find-workers-list"
              >
                {q.data.map(p => (
                  <Link
                    key={p.id}
                    href={`/find-workers/${p.id}`}
                    className="block"
                    data-testid="worker-card"
                  >
                    <SurfaceCard interactive className="h-full">
                      <div className="flex items-center justify-between gap-2">
                        {p.category && (
                          <CategoryChip>
                            {t(`jobs.category.${p.category}`)}
                          </CategoryChip>
                        )}
                        {p.ageRange && (
                          <span className="text-xs text-muted-foreground">
                            {t("findWorkers.ageRange")} {p.ageRange}
                          </span>
                        )}
                      </div>
                      <h3 className="mt-3 font-semibold">{p.alias}</h3>
                      {p.headline && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {p.headline}
                        </p>
                      )}
                      <MetaRow>
                        {p.nationality && (
                          <MetaItem icon={Globe}>{p.nationality}</MetaItem>
                        )}
                        {p.availability && (
                          <MetaItem icon={CalendarClock}>
                            {p.availability}
                          </MetaItem>
                        )}
                      </MetaRow>
                      {p.skills.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {p.skills.slice(0, 4).map(s => (
                            <span
                              key={s}
                              className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </SurfaceCard>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
