import { useState } from "react";
import { toast } from "sonner";
import {
  MapPin,
  User,
  Mail,
  Phone,
  UserCheck,
  Inbox,
  MessageCircle,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  PageHeader,
  SurfaceCard,
  SkeletonList,
  EmptyState,
  StatusPill,
  MetaItem,
  MetaRow,
  FilterChip,
  inputCls,
  matchStatusTone,
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
  // 開放諮詢的職類意向（公開三桶 + 還不確定）
  other: "其他",
  unsure: "待確認",
};

// 開放諮詢的聯絡偏好（供業務接手；後台 zh-TW）。
const CHANNEL_LABEL: Record<string, string> = {
  phone: "電話",
  line: "LINE",
  whatsapp: "WhatsApp",
  zalo: "Zalo",
  email: "Email",
};
const TIME_LABEL: Record<string, string> = {
  anytime: "皆可",
  daytime: "白天",
  evening: "晚上",
  weekend: "週末",
};

const STATUS_OPTIONS = [
  { value: "new", label: "新進", cls: "status-gray" },
  { value: "staff_handling", label: "處理中", cls: "status-amber" },
  { value: "introduced", label: "已引介", cls: "status-amber" },
  { value: "matched", label: "已成交", cls: "status-green" },
  { value: "closed", label: "已關閉", cls: "status-gray" },
] as const;

type Status = (typeof STATUS_OPTIONS)[number]["value"];

const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map(s => [s.value, s.label])
);

/** 內部後台：媒合意向佇列（仲介居中，P3）。 */
export default function MatchRequests() {
  const utils = trpc.useUtils();
  const [filter, setFilter] = useState<Status | "all">("all");
  const q = trpc.matchRequests.queue.useQuery(
    filter === "all" ? undefined : { status: filter }
  );

  const refresh = () => utils.matchRequests.queue.invalidate();
  const assignMut = trpc.matchRequests.assign.useMutation({
    onSuccess: () => {
      toast.success("已指派給你");
      void refresh();
    },
    onError: e => toast.error(e.message),
  });
  const statusMut = trpc.matchRequests.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("已更新狀態");
      void refresh();
    },
    onError: e => toast.error(e.message),
  });

  const rows = q.data ?? [];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="媒合意向"
        subtitle="求職者/雇主表達興趣後由客服居中安排；雙方不直接聯繫。"
      />

      <div className="flex flex-wrap gap-1.5 mb-6">
        {(["all", ...STATUS_OPTIONS.map(s => s.value)] as const).map(v => (
          <FilterChip
            key={v}
            active={filter === v}
            onClick={() => setFilter(v)}
            data-testid={`match-filter-${v}`}
          >
            {v === "all" ? "全部" : STATUS_LABEL[v]}
          </FilterChip>
        ))}
      </div>

      {q.isLoading ? (
        <SkeletonList />
      ) : rows.length === 0 ? (
        <EmptyState icon={Inbox} data-testid="match-empty">
          目前沒有媒合意向
        </EmptyState>
      ) : (
        <div className="space-y-3" data-testid="match-list">
          {rows.map(m => (
            <SurfaceCard key={m.id} data-testid="match-row">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">
                      {JOB_TYPE_LABEL[m.targetJobType ?? ""] ?? "職缺"}
                    </h3>
                    <StatusPill tone={matchStatusTone(m.status)}>
                      {STATUS_LABEL[m.status] ?? m.status}
                    </StatusPill>
                    <span className="text-xs text-muted-foreground">
                      {m.targetLabel}
                    </span>
                  </div>
                  <MetaRow>
                    <MetaItem icon={MapPin}>{m.targetCity || "面議"}</MetaItem>
                    <MetaItem icon={User}>
                      {m.initiatorName || "—"}（
                      {m.initiatorType === "worker"
                        ? "求職者"
                        : m.initiatorType === "employer"
                          ? "雇主"
                          : "使用者"}
                      ）
                    </MetaItem>
                    {m.initiatorEmail && (
                      <MetaItem icon={Mail}>{m.initiatorEmail}</MetaItem>
                    )}
                    {m.initiatorPhone && (
                      <MetaItem icon={Phone}>{m.initiatorPhone}</MetaItem>
                    )}
                    {(m.preferredChannel || m.preferredTime) && (
                      <MetaItem icon={MessageCircle}>
                        {[
                          m.preferredChannel &&
                            CHANNEL_LABEL[m.preferredChannel],
                          m.preferredTime && TIME_LABEL[m.preferredTime],
                        ]
                          .filter(Boolean)
                          .join("・")}
                      </MetaItem>
                    )}
                  </MetaRow>
                  {m.note && (
                    <p className="mt-2 text-sm text-foreground">
                      留言：{m.note}
                    </p>
                  )}
                  {(m.staffNote || m.closeReason) && (
                    <div className="mt-2 space-y-0.5 text-sm text-muted-foreground">
                      {m.staffNote && <p>內部備註：{m.staffNote}</p>}
                      {m.closeReason && <p>關閉原因：{m.closeReason}</p>}
                    </div>
                  )}
                  <RequestNotes
                    id={m.id}
                    staffNote={m.staffNote}
                    closeReason={m.closeReason}
                    pending={statusMut.isPending}
                    onSave={(staffNote, closeReason) =>
                      statusMut.mutate({
                        id: m.id,
                        status: m.status as Status,
                        staffNote,
                        closeReason,
                      })
                    }
                  />
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <select
                    value={m.status}
                    onChange={e =>
                      statusMut.mutate({
                        id: m.id,
                        status: e.target.value as Status,
                      })
                    }
                    className="h-9 rounded-md border border-border bg-card px-2 text-sm"
                    data-testid={`match-status-${m.id}`}
                  >
                    {STATUS_OPTIONS.map(s => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => assignMut.mutate({ id: m.id })}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
                    data-testid={`match-assign-${m.id}`}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    接手
                  </button>
                </div>
              </div>
            </SurfaceCard>
          ))}
        </div>
      )}
    </div>
  );
}

/** 內部備註 / 關閉原因編輯器（沿用 updateStatus 既有欄位；關閉原因僅在狀態為已關閉時保留）。 */
function RequestNotes({
  id,
  staffNote,
  closeReason,
  pending,
  onSave,
}: {
  id: number;
  staffNote: string | null;
  closeReason: string | null;
  pending: boolean;
  onSave: (staffNote?: string, closeReason?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(staffNote ?? "");
  const [reason, setReason] = useState(closeReason ?? "");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 text-xs font-medium text-primary hover:underline"
        data-testid={`match-notes-toggle-${id}`}
      >
        編輯備註 / 關閉原因
      </button>
    );
  }
  return (
    <div
      className="mt-3 space-y-2 rounded-md border border-border bg-muted/30 p-3"
      data-testid={`match-notes-${id}`}
    >
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">
          內部備註（僅客服可見）
        </span>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={2}
          className={inputCls}
          data-testid={`match-staffNote-${id}`}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">
          關閉原因（狀態為「已關閉」時保留）
        </span>
        <input
          value={reason}
          onChange={e => setReason(e.target.value)}
          className={inputCls}
          data-testid={`match-closeReason-${id}`}
        />
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            onSave(note.trim() || undefined, reason.trim() || undefined);
            setOpen(false);
          }}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          data-testid={`match-notes-save-${id}`}
        >
          儲存
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          取消
        </button>
      </div>
    </div>
  );
}
