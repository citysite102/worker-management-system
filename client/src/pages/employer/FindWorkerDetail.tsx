import { useState } from "react";
import { Link, useParams } from "wouter";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Globe, CalendarClock, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PublicHeader } from "@/components/public/PublicHeader";
import {
  SurfaceCard,
  CategoryChip,
  StatusPill,
  MetaItem,
  MetaRow,
} from "@/components/marketplace/ui";

/** 找移工詳情（雇主）：匿名履歷 + 平台驗證紀錄 + 自填經歷 + 送出媒合意向。 */
export default function FindWorkerDetail() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [sent, setSent] = useState(false);

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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <main className="max-w-3xl mx-auto px-6 py-8">
        <Link
          href="/find-workers"
          className="text-sm text-muted-foreground hover:text-foreground"
          data-testid="fw-detail-back"
        >
          {t("findWorkers.back")}
        </Link>

        {q.isLoading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            …
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
            <SurfaceCard>
              <div className="flex items-center gap-2">
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
              <h1 className="mt-3 text-2xl font-bold tracking-tight">
                {p.alias}
              </h1>
              {p.headline && (
                <p className="mt-1 text-muted-foreground">{p.headline}</p>
              )}
              <MetaRow>
                {p.nationality && (
                  <MetaItem icon={Globe}>{p.nationality}</MetaItem>
                )}
                {p.availability && (
                  <MetaItem icon={CalendarClock}>{p.availability}</MetaItem>
                )}
              </MetaRow>
              {p.languages.length > 0 && (
                <p className="mt-3 text-sm text-muted-foreground">
                  {t("findWorkers.languages")}：{p.languages.join("、")}
                </p>
              )}
              {p.skills.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.skills.map(s => (
                    <span
                      key={s}
                      className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}
              {p.selfIntro && (
                <p className="mt-4 text-sm whitespace-pre-wrap text-muted-foreground">
                  {p.selfIntro}
                </p>
              )}

              <div className="mt-6 flex items-center gap-3">
                <button
                  type="button"
                  disabled={interestMut.isPending || sent}
                  onClick={() => interestMut.mutate({ id })}
                  className="inline-flex items-center rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-60"
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
            </SurfaceCard>

            {/* 平台驗證工作紀錄 */}
            <section>
              <h2 className="flex items-center gap-1.5 text-sm font-semibold mb-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                {t("findWorkers.verifiedRecords")}
              </h2>
              {p.platformRecords.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("findWorkers.noRecords")}
                </p>
              ) : (
                <div className="space-y-2">
                  {p.platformRecords.map(r => (
                    <SurfaceCard key={r.id} className="py-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm">
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
                    </SurfaceCard>
                  ))}
                </div>
              )}
            </section>

            {/* 自填經歷 */}
            {p.experiences.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold mb-2">
                  {t("findWorkers.selfReported")}
                </h2>
                <div className="space-y-2">
                  {p.experiences.map(e => (
                    <SurfaceCard key={e.id} className="py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{e.role}</span>
                        <span className="text-xs text-muted-foreground">
                          {t(`worker.employerType.${e.employerType}`)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {e.startDate || "?"} –{" "}
                        {e.endDate || t("findWorkers.present")}
                      </p>
                      {e.description && (
                        <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                          {e.description}
                        </p>
                      )}
                    </SurfaceCard>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
