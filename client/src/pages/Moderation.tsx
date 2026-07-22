import { useState } from "react";
import { toast } from "sonner";
import { MapPin, Users, Check, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  REJECT_REASON_VALUES,
  type RejectReasonValue,
} from "@/lib/marketplace";
import {
  PageHeader,
  SurfaceCard,
  StatusPill,
  MetaItem,
  MetaRow,
  FilterChip,
} from "@/components/marketplace/ui";

const JOB_TYPE_LABEL: Record<string, string> = {
  caregiver: "看護",
  domestic_helper: "幫傭",
  manufacturing: "製造業",
  agriculture: "農業",
  construction: "營造業",
  white_collar: "白領",
  intermediate: "中階技術",
  overseas_student: "僑外生",
};
const EMPLOYMENT_LABEL: Record<string, string> = {
  live_in: "住家",
  live_out: "不住家",
  institution: "機構",
  other: "其他",
};
const REJECT_LABEL: Record<RejectReasonValue, string> = {
  incomplete: "資料不全",
  illegal_content: "違規文案",
  illegal_terms: "條件不合法",
  duplicate: "重複張貼",
  other: "其他",
};

/** 內部後台：需求單審核佇列（通過→自動轉 case / 退件附理由）。 */
type Tab = "postings" | "profiles" | "experiences";

export default function Moderation() {
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<Tab>("postings");
  const pending = trpc.moderation.pendingPostings.useQuery();
  const managers = trpc.managers.list.useQuery();
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [managerByPosting, setManagerByPosting] = useState<
    Record<number, number>
  >({});

  const refresh = () => utils.moderation.pendingPostings.invalidate();

  const approveMut = trpc.moderation.approvePosting.useMutation({
    onSuccess: r => {
      toast.success(`已通過並建立案件 #${r.caseId}`);
      void refresh();
    },
    onError: e => toast.error(e.message),
  });
  const rejectMut = trpc.moderation.rejectPosting.useMutation({
    onSuccess: () => {
      toast.success("已退件");
      setRejectingId(null);
      void refresh();
    },
    onError: e => toast.error(e.message),
  });

  const rows = pending.data ?? [];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="審核佇列"
        subtitle="需求單、移工履歷與自填經歷的審核；通過後才對外公開。"
      />

      <div className="flex flex-wrap gap-1.5 mb-6">
        {(
          [
            ["postings", "需求單"],
            ["profiles", "移工履歷"],
            ["experiences", "自填經歷"],
          ] as const
        ).map(([v, label]) => (
          <FilterChip
            key={v}
            active={tab === v}
            onClick={() => setTab(v)}
            data-testid={`mod-tab-${v}`}
          >
            {label}
          </FilterChip>
        ))}
      </div>

      {tab === "profiles" && <ProfileQueue />}
      {tab === "experiences" && <ExperienceQueue />}
      {tab !== "postings" ? null : pending.isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          載入中…
        </div>
      ) : rows.length === 0 ? (
        <div
          className="py-16 text-center text-sm text-muted-foreground"
          data-testid="moderation-empty"
        >
          目前沒有待審需求單
        </div>
      ) : (
        <div className="space-y-3" data-testid="moderation-list">
          {rows.map(p => (
            <SurfaceCard key={p.id} data-testid="moderation-row">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">
                  {JOB_TYPE_LABEL[p.jobType] ?? p.jobType}
                </h3>
                <StatusPill tone="amber">審核中</StatusPill>
              </div>
              <MetaRow>
                <MetaItem icon={MapPin}>
                  {p.city}
                  {p.district ? `・${p.district}` : ""}
                </MetaItem>
                <MetaItem icon={Users}>{p.headcount} 人</MetaItem>
                <span className="text-sm text-muted-foreground">
                  {EMPLOYMENT_LABEL[p.employmentType] ?? ""}
                </span>
                <span className="text-sm text-muted-foreground">
                  雇主：{p.employerName || p.employerEmail || "—"}
                </span>
              </MetaRow>
              {p.publicDescription && (
                <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                  {p.publicDescription}
                </p>
              )}
              {p.requirements && (
                <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                  條件：{p.requirements}
                </p>
              )}

              {rejectingId === p.id ? (
                <RejectForm
                  pending={rejectMut.isPending}
                  onCancel={() => setRejectingId(null)}
                  onConfirm={(reasonCode, note) =>
                    rejectMut.mutate({ id: p.id, reasonCode, note })
                  }
                />
              ) : (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <select
                    value={managerByPosting[p.id] ?? ""}
                    onChange={e =>
                      setManagerByPosting(m => ({
                        ...m,
                        [p.id]: Number(e.target.value),
                      }))
                    }
                    className="h-9 rounded-md border border-border bg-card px-3 text-sm"
                    data-testid={`approve-manager-${p.id}`}
                  >
                    <option value="">指派負責人…</option>
                    {(managers.data ?? []).map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={approveMut.isPending || !managerByPosting[p.id]}
                    onClick={() =>
                      approveMut.mutate({
                        id: p.id,
                        managerId: managerByPosting[p.id],
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                    data-testid={`approve-${p.id}`}
                  >
                    <Check className="w-4 h-4" />
                    通過並建立案件
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejectingId(p.id)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
                    data-testid={`reject-${p.id}`}
                  >
                    <X className="w-4 h-4" />
                    退件
                  </button>
                </div>
              )}
            </SurfaceCard>
          ))}
        </div>
      )}
    </div>
  );
}

function RejectForm({
  pending,
  onCancel,
  onConfirm,
}: {
  pending: boolean;
  onCancel: () => void;
  onConfirm: (reasonCode: RejectReasonValue, note?: string) => void;
}) {
  const [reasonCode, setReasonCode] = useState<RejectReasonValue>("incomplete");
  const [note, setNote] = useState("");
  return (
    <div className="mt-4 rounded-md border border-border bg-muted/30 p-4 space-y-3">
      <select
        value={reasonCode}
        onChange={e => setReasonCode(e.target.value as RejectReasonValue)}
        className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm"
        data-testid="reject-reason"
      >
        {REJECT_REASON_VALUES.map(v => (
          <option key={v} value={v}>
            {REJECT_LABEL[v]}
          </option>
        ))}
      </select>
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        rows={2}
        placeholder="補正說明（選填）"
        className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
        data-testid="reject-note"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => onConfirm(reasonCode, note || undefined)}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          data-testid="reject-confirm"
        >
          確認退件
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          取消
        </button>
      </div>
    </div>
  );
}

// ─── 移工履歷審核 ─────────────────────────────────────────────────────────────
function ProfileQueue() {
  const utils = trpc.useUtils();
  const q = trpc.moderation.pendingProfiles.useQuery();
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const refresh = () => utils.moderation.pendingProfiles.invalidate();
  const approveMut = trpc.moderation.approveProfile.useMutation({
    onSuccess: () => {
      toast.success("已通過");
      void refresh();
    },
    onError: e => toast.error(e.message),
  });
  const rejectMut = trpc.moderation.rejectProfile.useMutation({
    onSuccess: () => {
      toast.success("已退件");
      setRejectingId(null);
      setNote("");
      void refresh();
    },
    onError: e => toast.error(e.message),
  });
  const rows = q.data ?? [];
  if (q.isLoading)
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        載入中…
      </div>
    );
  if (rows.length === 0)
    return (
      <div
        className="py-16 text-center text-sm text-muted-foreground"
        data-testid="mod-profiles-empty"
      >
        目前沒有待審履歷
      </div>
    );
  return (
    <div className="space-y-3" data-testid="mod-profiles-list">
      {rows.map(p => (
        <SurfaceCard key={p.id} data-testid="mod-profile-row">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{p.alias || `移工 #${p.id}`}</h3>
            {p.jobType && (
              <span className="text-xs text-muted-foreground">
                {JOB_TYPE_LABEL[p.jobType] ?? p.jobType}
              </span>
            )}
            <StatusPill tone="amber">審核中</StatusPill>
          </div>
          {p.headline && <p className="mt-1 text-sm">{p.headline}</p>}
          <MetaRow>
            <span className="text-sm text-muted-foreground">
              國籍：{p.nationality || "—"}
            </span>
            <span className="text-sm text-muted-foreground">
              可上工：{p.availability || "—"}
            </span>
            <span className="text-sm text-muted-foreground">
              帳號：{p.accountName || p.accountEmail || "—"}
            </span>
          </MetaRow>
          {p.selfIntro && (
            <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
              {p.selfIntro}
            </p>
          )}
          {rejectingId === p.id ? (
            <div className="mt-3 flex items-center gap-2">
              <input
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="退件理由（選填）"
                className="h-9 flex-1 rounded-md border border-border bg-card px-3 text-sm"
                data-testid="mod-profile-reject-note"
              />
              <button
                type="button"
                onClick={() =>
                  rejectMut.mutate({ id: p.id, reason: note || undefined })
                }
                className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
                data-testid={`mod-profile-reject-confirm-${p.id}`}
              >
                確認退件
              </button>
              <button
                type="button"
                onClick={() => setRejectingId(null)}
                className="rounded-md border border-border px-3 py-2 text-sm"
              >
                取消
              </button>
            </div>
          ) : (
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                disabled={approveMut.isPending}
                onClick={() => approveMut.mutate({ id: p.id })}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                data-testid={`mod-profile-approve-${p.id}`}
              >
                通過
              </button>
              <button
                type="button"
                onClick={() => setRejectingId(p.id)}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
                data-testid={`mod-profile-reject-${p.id}`}
              >
                退件
              </button>
            </div>
          )}
        </SurfaceCard>
      ))}
    </div>
  );
}

// ─── 自填經歷審核 ─────────────────────────────────────────────────────────────
const EXP_EMPLOYER_LABEL: Record<string, string> = {
  family_care: "家庭看護",
  institution: "機構",
  manufacturing: "製造",
  agriculture: "農業",
  construction: "營造",
  other: "其他",
};

function ExperienceQueue() {
  const utils = trpc.useUtils();
  const q = trpc.moderation.pendingExperiences.useQuery();
  const refresh = () => utils.moderation.pendingExperiences.invalidate();
  const reviewMut = trpc.moderation.reviewExperience.useMutation({
    onSuccess: () => {
      toast.success("已處理");
      void refresh();
    },
    onError: e => toast.error(e.message),
  });
  const rows = q.data ?? [];
  if (q.isLoading)
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        載入中…
      </div>
    );
  if (rows.length === 0)
    return (
      <div
        className="py-16 text-center text-sm text-muted-foreground"
        data-testid="mod-experiences-empty"
      >
        目前沒有待審經歷
      </div>
    );
  return (
    <div className="space-y-3" data-testid="mod-experiences-list">
      {rows.map(e => (
        <SurfaceCard key={e.id} data-testid="mod-experience-row">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{e.role}</h3>
            <span className="text-xs text-muted-foreground">
              {EXP_EMPLOYER_LABEL[e.employerType] ?? e.employerType}
            </span>
            <StatusPill tone="amber">審核中</StatusPill>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {e.startDate || "?"} – {e.endDate || "迄今"}・帳號：
            {e.accountName || e.accountEmail || "—"}
          </p>
          {e.description && (
            <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
              {e.description}
            </p>
          )}
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              disabled={reviewMut.isPending}
              onClick={() => reviewMut.mutate({ id: e.id, approve: true })}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              data-testid={`mod-exp-approve-${e.id}`}
            >
              通過
            </button>
            <button
              type="button"
              disabled={reviewMut.isPending}
              onClick={() => reviewMut.mutate({ id: e.id, approve: false })}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
              data-testid={`mod-exp-reject-${e.id}`}
            >
              退件
            </button>
          </div>
        </SurfaceCard>
      ))}
    </div>
  );
}
