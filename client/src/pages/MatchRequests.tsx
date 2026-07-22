import { useState } from "react";
import { toast } from "sonner";
import { MapPin, User, Mail, Phone, UserCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  PageHeader,
  SurfaceCard,
  StatusPill,
  MetaItem,
  MetaRow,
  FilterChip,
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
        <div className="py-16 text-center text-sm text-muted-foreground">
          載入中…
        </div>
      ) : rows.length === 0 ? (
        <div
          className="py-16 text-center text-sm text-muted-foreground"
          data-testid="match-empty"
        >
          目前沒有媒合意向
        </div>
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
                  </MetaRow>
                  {m.note && (
                    <p className="mt-2 text-sm text-foreground">
                      留言：{m.note}
                    </p>
                  )}
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
