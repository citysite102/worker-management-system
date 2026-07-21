import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { MapPin, Users, Plus, Pencil } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PublicHeader } from "@/components/public/PublicHeader";
import { formatSalary, type PostingStatusValue } from "@/lib/marketplace";

/** 雇主專區：我的需求單列表。 */
export default function EmployerPostings() {
  const { t } = useTranslation();
  const postingsQuery = trpc.employer.myPostings.useQuery();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {t("employer.myPostings")}
            </h1>
          </div>
          <Link
            href="/employer/post"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
            data-testid="new-posting"
          >
            <Plus className="w-4 h-4" />
            {t("employer.newPosting")}
          </Link>
        </div>

        {postingsQuery.isLoading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            …
          </div>
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
                <div
                  key={p.id}
                  className="rounded-lg border border-border bg-card p-5"
                  data-testid="posting-row"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">
                          {t(`jobs.jobType.${p.jobType}`)}
                        </h3>
                        <StatusBadge status={p.status} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-4 h-4" />
                          {p.city}
                          {p.district ? `・${p.district}` : ""}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Users className="w-4 h-4" />
                          {p.headcount} {t("jobs.people")}
                        </span>
                        <span>
                          {formatSalary(p.salaryMin, p.salaryMax) ??
                            t("jobs.salaryNegotiable")}
                        </span>
                      </div>
                    </div>
                    {editable && (
                      <Link
                        href={`/employer/post/${p.id}`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
                        data-testid={`edit-posting-${p.id}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        {t("employer.editPosting")}
                      </Link>
                    )}
                  </div>
                  {p.status === "rejected" && p.rejectReason && (
                    <div className="mt-3 rounded-md border border-border bg-muted/40 p-3 text-sm">
                      <p className="font-medium status-red inline-block">
                        {t("employer.rejectedReason")}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        {p.rejectReason}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: PostingStatusValue }) {
  const { t } = useTranslation();
  const cls: Record<PostingStatusValue, string> = {
    draft: "status-gray",
    pending_review: "status-amber",
    approved: "status-green",
    rejected: "status-red",
    paused: "status-gray",
    filled: "status-green",
    closed: "status-gray",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls[status]}`}
      data-testid={`posting-status-${status}`}
    >
      {t(`employer.status.${status}`)}
    </span>
  );
}
