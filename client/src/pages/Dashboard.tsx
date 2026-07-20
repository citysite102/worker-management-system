import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { getStatusLabel } from "@/lib/constants";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Building2, Briefcase, UserCheck, CalendarClock, AlertTriangle, ChevronRight, ArrowUp, ArrowDown } from "lucide-react";

// 各狀態對應的長條顏色（與既有狀態色系一致）
const BAR_COLOR: Record<string, string> = {
  // 移工生命週期
  employed: "bg-emerald-500",
  idle_in_tw: "bg-amber-500",
  preparing_abroad: "bg-blue-500",
  returned: "bg-gray-400",
  absconded: "bg-rose-500",
  // 案件狀態
  in_progress: "bg-blue-500",
  completed: "bg-emerald-500",
  paused: "bg-amber-500",
  cancelled: "bg-gray-400",
  // 雇主類型
  individual: "bg-violet-500",
  company: "bg-sky-500",
};

const DOC_TYPE_LABEL: Record<string, string> = {
  residentPermit: "居留證",
  passport: "護照",
};

type Distribution = { value: string; count: number }[];

/** 最大餘額法：將百分比四捨五入後，確保整體加總恰為 100%。 */
function largestRemainderPercents(counts: number[]): number[] {
  const total = counts.reduce((s, c) => s + c, 0);
  if (total === 0) return counts.map(() => 0);
  const raw = counts.map(c => (c / total) * 100);
  const floors = raw.map(Math.floor);
  let remainder = 100 - floors.reduce((s, f) => s + f, 0);
  // 餘數依小數部分由大到小逐一補 1%
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);
  const result = [...floors];
  for (let k = 0; k < order.length && remainder > 0; k++, remainder--) {
    result[order[k].i] += 1;
  }
  return result;
}

function DistributionPanel({ title, data }: { title: string; data: Distribution }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const percents = largestRemainderPercents(data.map(d => d.count));
  return (
    <div data-testid="dashboard-distribution" data-distribution-title={title} className="rounded-lg border bg-card p-5 space-y-4">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <div className="space-y-3">
        {data.map((d, idx) => {
          const pct = percents[idx];
          return (
            <div key={d.value} data-testid="dashboard-distribution-bar" data-distribution-value={d.value} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{getStatusLabel(d.value)}</span>
                <span className="tabular-nums">
                  <span className="font-medium">{d.count}</span>
                  <span className="text-muted-foreground ml-1.5">{pct}%</span>
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${BAR_COLOR[d.value] ?? "bg-primary"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
        {total === 0 && <p data-testid="dashboard-distribution-empty" className="text-xs text-muted-foreground">尚無資料</p>}
      </div>
    </div>
  );
}

// 趨勢徽章：依方向與「漲是好是壞」決定顏色
function TrendBadge({ delta, goodWhenUp, since }: { delta: number; goodWhenUp: boolean; since?: string }) {
  if (delta === 0) {
    return <span className="text-xs text-muted-foreground tabular-nums" title={since ? `自 ${since}` : undefined}>—</span>;
  }
  const up = delta > 0;
  const good = up === goodWhenUp;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span
      data-testid="dashboard-trend"
      data-trend-delta={delta}
      className={`inline-flex items-center gap-0.5 text-xs font-medium tabular-nums ${good ? "text-emerald-600" : "text-rose-500"}`}
      title={since ? `較 ${since}` : undefined}
    >
      <Icon className="w-3 h-3" />
      {Math.abs(delta)}
    </span>
  );
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { data, isLoading } = trpc.dashboard.summary.useQuery();
  const trends = data?.trends ?? null;

  const statCards = [
    { key: "workers" as const, label: "移工總數", value: data?.totals.workers ?? 0, icon: <Users className="w-4 h-4" />, accent: false, goodWhenUp: true },
    { key: "customers" as const, label: "雇主總數", value: data?.totals.customers ?? 0, icon: <Building2 className="w-4 h-4" />, accent: false, goodWhenUp: true },
    { key: "cases" as const, label: "案件總數", value: data?.totals.cases ?? 0, icon: <Briefcase className="w-4 h-4" />, accent: false, goodWhenUp: true },
    { key: "employed" as const, label: "在職移工", value: data?.totals.employed ?? 0, icon: <UserCheck className="w-4 h-4" />, accent: false, goodWhenUp: true },
    { key: "expiringSoon" as const, label: "即將到期", value: data?.totals.expiringSoon ?? 0, icon: <CalendarClock className="w-4 h-4" />, accent: (data?.totals.expiringSoon ?? 0) > 0, goodWhenUp: false },
    { key: "expired" as const, label: "已過期", value: data?.totals.expired ?? 0, icon: <AlertTriangle className="w-4 h-4" />, accent: (data?.totals.expired ?? 0) > 0, goodWhenUp: false },
  ];

  const updatedAt = data?.generatedAt
    ? new Date(data.generatedAt).toLocaleString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false })
    : null;

  return (
    <div className="p-6 space-y-6">
      {/* 頁首 */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">儀表板</h1>
          <p className="text-sm text-muted-foreground mt-0.5">營運總覽與證件到期提醒</p>
        </div>
        {updatedAt && (
          <p data-testid="dashboard-updated-at" className="text-xs text-muted-foreground tabular-nums">資料更新於 {updatedAt}</p>
        )}
      </div>

      {/* 統計卡（到期兩卡以「移工人數」計，一人多證不重複） */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map(card => {
          const delta = trends ? trends[card.key] : undefined;
          return (
            <div key={card.label} data-testid="dashboard-stat-card" data-stat-key={card.key} className="rounded-lg border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{card.label}</span>
                <span className={card.accent ? "text-amber-500" : "text-muted-foreground"}>{card.icon}</span>
              </div>
              {isLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <div className="flex items-baseline justify-between gap-1">
                  <p data-testid="dashboard-stat-value" className={`text-2xl font-bold tabular-nums ${card.accent ? "text-amber-500" : "text-foreground"}`}>
                    {card.value}
                  </p>
                  {delta !== undefined && (
                    <TrendBadge delta={delta} goodWhenUp={card.goodWhenUp} since={trends?.since} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 狀態分布 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DistributionPanel title="移工生命週期分布" data={data?.workersByLifecycle ?? []} />
        <DistributionPanel title="案件狀態分布" data={data?.casesByStatus ?? []} />
        <DistributionPanel title="雇主類型分布" data={data?.customersByType ?? []} />
      </div>

      {/* 證件到期提醒 */}
      <div data-testid="dashboard-expiring" className="rounded-lg border bg-card">
        <div className="flex items-center gap-2 px-5 py-4 border-b">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <h2 className="text-sm font-semibold">證件到期提醒</h2>
          <span className="text-xs text-muted-foreground">（已過期或 60 天內到期，不含已離境）</span>
        </div>
        {isLoading ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">載入中…</div>
        ) : (data?.expiringDocuments.length ?? 0) === 0 ? (
          <div data-testid="dashboard-expiring-empty" className="px-5 py-8 text-center text-sm text-muted-foreground">目前沒有即將到期或已過期的證件 🎉</div>
        ) : (
          <ul data-testid="dashboard-expiring-list" className="divide-y">
            {data!.expiringDocuments.map((d, i) => {
              const expired = d.daysLeft < 0;
              return (
                <li
                  key={`${d.workerId}-${d.docType}-${i}`}
                  data-testid="dashboard-expiring-row"
                  data-worker-id={d.workerId}
                  data-doc-type={d.docType}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/workers/${d.workerId}`)}
                >
                  <span className="flex-1 min-w-0">
                    <span className="font-medium text-sm">{d.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {DOC_TYPE_LABEL[d.docType]} · {d.expiry}
                    </span>
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      expired ? "status-red" : "status-amber"
                    }`}
                  >
                    {expired ? `已過期 ${Math.abs(d.daysLeft)} 天` : `${d.daysLeft} 天後到期`}
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
