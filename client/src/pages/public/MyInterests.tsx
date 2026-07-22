import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { MapPin } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PublicHeader } from "@/components/public/PublicHeader";
import {
  PageHeader,
  SurfaceCard,
  StatusPill,
  CategoryChip,
  MetaItem,
  matchStatusTone,
} from "@/components/marketplace/ui";

/** 公開站：我的媒合意向（發起者看自己送出的意向與狀態）。 */
export default function MyInterests() {
  const { t } = useTranslation();
  const q = trpc.publicJobs.myInterests.useQuery();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <main className="max-w-3xl mx-auto px-6 py-8">
        <PageHeader title={t("jobs.myTitle")} />

        {q.isLoading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            …
          </div>
        ) : !q.data || q.data.length === 0 ? (
          <div
            className="py-16 text-center text-sm text-muted-foreground"
            data-testid="my-interests-empty"
          >
            {t("jobs.myEmpty")}
          </div>
        ) : (
          <div className="space-y-3" data-testid="my-interests-list">
            {q.data.map(m => {
              const inner = (
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">
                        {m.jobType
                          ? t(`jobs.jobType.${m.jobType}`)
                          : t("jobs.title")}
                      </h3>
                      {m.category && (
                        <CategoryChip>
                          {t(`jobs.category.${m.category}`)}
                        </CategoryChip>
                      )}
                    </div>
                    <div className="mt-1.5">
                      <MetaItem icon={MapPin}>
                        {m.city || t("jobs.cityNegotiable")}
                      </MetaItem>
                    </div>
                  </div>
                  <StatusPill
                    tone={matchStatusTone(m.status)}
                    data-testid={`interest-status-${m.status}`}
                  >
                    {t(`jobs.status.${m.status}`)}
                  </StatusPill>
                </div>
              );
              // 公開需求單可回到職缺詳情；既有需求單無公開詳情頁，僅顯示。
              return m.targetType === "job_posting" ? (
                <Link
                  key={m.id}
                  href={`/jobs/posting/${m.targetId}`}
                  className="block"
                  data-testid="my-interest-row"
                >
                  <SurfaceCard interactive>{inner}</SurfaceCard>
                </Link>
              ) : (
                <SurfaceCard key={m.id} data-testid="my-interest-row">
                  {inner}
                </SurfaceCard>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
