import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { MapPin, Users, Plus, Pencil } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PublicHeader } from "@/components/public/PublicHeader";
import { formatSalary } from "@/lib/marketplace";
import {
  PageHeader,
  SurfaceCard,
  SkeletonList,
  StatusPill,
  MetaItem,
  MetaRow,
  postingStatusTone,
} from "@/components/marketplace/ui";

/** 雇主專區：我的需求單列表。 */
export default function EmployerPostings() {
  const { t } = useTranslation();
  const postingsQuery = trpc.employer.myPostings.useQuery();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <main className="max-w-3xl mx-auto px-6 py-8">
        <PageHeader
          title={t("employer.myPostings")}
          action={
            <Link
              href="/employer/post"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
              data-testid="new-posting"
            >
              <Plus className="w-4 h-4" />
              {t("employer.newPosting")}
            </Link>
          }
        />

        {postingsQuery.isLoading ? (
          <SkeletonList />
        ) : !postingsQuery.data || postingsQuery.data.length === 0 ? (
          <div
            className="py-16 text-center text-sm text-muted-foreground"
            data-testid="postings-empty"
          >
            {t("employer.empty")}
          </div>
        ) : (
          <div className="space-y-3" data-testid="postings-list">
            {postingsQuery.data.map(p => {
              const editable = p.status === "draft" || p.status === "rejected";
              return (
                <SurfaceCard key={p.id} data-testid="posting-row">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">
                          {t(`jobs.jobType.${p.jobType}`)}
                        </h3>
                        <StatusPill
                          tone={postingStatusTone(p.status)}
                          data-testid={`posting-status-${p.status}`}
                        >
                          {t(`employer.status.${p.status}`)}
                        </StatusPill>
                      </div>
                      <MetaRow>
                        <MetaItem icon={MapPin}>
                          {p.city}
                          {p.district ? `・${p.district}` : ""}
                        </MetaItem>
                        <MetaItem icon={Users}>
                          {p.headcount} {t("jobs.people")}
                        </MetaItem>
                        <span className="text-sm text-muted-foreground">
                          {formatSalary(p.salaryMin, p.salaryMax) ??
                            t("jobs.salaryNegotiable")}
                        </span>
                      </MetaRow>
                    </div>
                    {editable && (
                      <Link
                        href={`/employer/post/${p.id}`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors shrink-0"
                        data-testid={`edit-posting-${p.id}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        {t("employer.editPosting")}
                      </Link>
                    )}
                  </div>
                  {p.status === "rejected" && p.rejectReason && (
                    <div className="mt-3 rounded-md border border-border bg-muted/40 p-3 text-sm">
                      <p className="font-medium status-red inline-block rounded px-1">
                        {t("employer.rejectedReason")}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        {p.rejectReason}
                      </p>
                    </div>
                  )}
                </SurfaceCard>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
