import { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { PublicHeader } from "@/components/public/PublicHeader";
import {
  PageHero,
  FilterChip,
  SkeletonGrid,
} from "@/components/marketplace/ui";
import { WorkerCard, categoryIcon } from "@/components/marketplace/worker";
import { JOB_TYPE_VALUES, type JobTypeValue } from "@/lib/marketplace";

/** 找外籍工作者列表（開放匿名瀏覽去識別履歷；送出意向才需雇主登入）。 */
export default function FindWorkers() {
  const { t } = useTranslation();
  const [jobType, setJobType] = useState<JobTypeValue | undefined>();
  const q = trpc.findWorkers.list.useQuery({ jobType }, { retry: false });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <main className="max-w-6xl mx-auto px-6 py-8">
        <PageHero
          title={t("findWorkers.title")}
          subtitle={t("findWorkers.subtitle")}
        />

        {/* 分類篩選：每個職類帶專屬 icon 做視覺區隔 */}
        <div className="mb-6 flex flex-wrap gap-1.5">
          <FilterChip
            active={jobType === undefined}
            onClick={() => setJobType(undefined)}
            data-testid="fw-filter-all"
          >
            {t("jobs.any")}
          </FilterChip>
          {JOB_TYPE_VALUES.map(v => {
            const Icon = categoryIcon(v);
            return (
              <FilterChip
                key={v}
                active={jobType === v}
                onClick={() => setJobType(v)}
                data-testid={`fw-filter-${v}`}
                className="inline-flex items-center gap-1.5"
              >
                <Icon className="h-3.5 w-3.5" />
                {t(`jobs.jobType.${v}`)}
              </FilterChip>
            );
          })}
        </div>

        {q.isLoading ? (
          <SkeletonGrid />
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
            {q.data.map((p, i) => (
              <WorkerCard key={p.id} p={p} index={i} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
