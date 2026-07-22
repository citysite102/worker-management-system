import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { MapPin } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PublicHeader } from "@/components/public/PublicHeader";

const STATUS_CLASS: Record<string, string> = {
  new: "status-gray",
  staff_handling: "status-amber",
  introduced: "status-amber",
  matched: "status-green",
  closed: "status-gray",
};

/** 公開站：我的媒合意向（發起者看自己送出的意向與狀態）。 */
export default function MyInterests() {
  const { t } = useTranslation();
  const q = trpc.publicJobs.myInterests.useQuery();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <main className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold tracking-tight mb-6">
          {t("jobs.myTitle")}
        </h1>

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
                        <span className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                          {t(`jobs.category.${m.category}`)}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      {m.city || t("jobs.cityNegotiable")}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      STATUS_CLASS[m.status] ?? "status-gray"
                    }`}
                    data-testid={`interest-status-${m.status}`}
                  >
                    {t(`jobs.status.${m.status}`)}
                  </span>
                </div>
              );
              // 公開需求單可回到職缺詳情；既有需求單無公開詳情頁，僅顯示。
              return m.targetType === "job_posting" ? (
                <Link
                  key={m.id}
                  href={`/jobs/posting/${m.targetId}`}
                  className="block rounded-lg border border-border bg-card p-5 hover:border-primary transition-colors"
                  data-testid="my-interest-row"
                >
                  {inner}
                </Link>
              ) : (
                <div
                  key={m.id}
                  className="rounded-lg border border-border bg-card p-5"
                  data-testid="my-interest-row"
                >
                  {inner}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
