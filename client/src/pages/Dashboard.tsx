import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { getStatusLabel } from "@/lib/constants";
import { Users, Building2, Briefcase, UserCheck, CalendarClock, AlertTriangle, ChevronRight } from "lucide-react";

// 各狀態對應的長條顏色（與既有狀態色系一致）
const BAR_COLOR: Record<string, string> = {
  // 移工生命週期
  employed: "bg-emerald-500",
  document_processing: "bg-amber-500",
  recruiting: "bg-blue-500",
  pending_renewal: "bg-orange-500",
  departed: "bg-gray-400",
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

function DistributionPanel({ title, data }: { title: string; data: Distribution }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  return (
    <div className="rounded-lg border bg-card p-5 space-y-4">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <div className="space-y-3">
        {data.map(d => {
          const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
          return (
            <div key={d.value} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{getStatusLabel(d.value)}</span>
                <span className="font-medium tabular-nums">{d.count}</span>
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
        {total === 0 && <p className="text-xs text-muted-foreground">尚無資料</p>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { data, isLoading } = trpc.dashboard.summary.useQuery();

  const statCards = [
    { label: "移工總數", value: data?.totals.workers ?? 0, icon: <Users className="w-4 h-4" />, accent: false },
    { label: "雇主總數", value: data?.totals.customers ?? 0, icon: <Building2 className="w-4 h-4" />, accent: false },
    { label: "案件總數", value: data?.totals.cases ?? 0, icon: <Briefcase className="w-4 h-4" />, accent: false },
    { label: "在職移工", value: data?.totals.employed ?? 0, icon: <UserCheck className="w-4 h-4" />, accent: false },
    { label: "即將到期", value: data?.totals.expiringSoon ?? 0, icon: <CalendarClock className="w-4 h-4" />, accent: (data?.totals.expiringSoon ?? 0) > 0 },
    { label: "已過期", value: data?.totals.expired ?? 0, icon: <AlertTriangle className="w-4 h-4" />, accent: (data?.totals.expired ?? 0) > 0 },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* 頁首 */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">儀表板</h1>
        <p className="text-sm text-muted-foreground mt-0.5">營運總覽與證件到期提醒</p>
      </div>

      {/* 統計卡 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map(card => (
          <div key={card.label} className="rounded-lg border bg-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{card.label}</span>
              <span className={card.accent ? "text-amber-500" : "text-muted-foreground"}>{card.icon}</span>
            </div>
            <p className={`text-2xl font-bold tabular-nums ${card.accent ? "text-amber-500" : "text-foreground"}`}>
              {isLoading ? "—" : card.value}
            </p>
          </div>
        ))}
      </div>

      {/* 狀態分布 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DistributionPanel title="移工生命週期分布" data={data?.workersByLifecycle ?? []} />
        <DistributionPanel title="案件狀態分布" data={data?.casesByStatus ?? []} />
        <DistributionPanel title="雇主類型分布" data={data?.customersByType ?? []} />
      </div>

      {/* 證件到期提醒 */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-center gap-2 px-5 py-4 border-b">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <h2 className="text-sm font-semibold">證件到期提醒</h2>
          <span className="text-xs text-muted-foreground">（已過期或 60 天內到期，不含已離境）</span>
        </div>
        {isLoading ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">載入中…</div>
        ) : (data?.expiringDocuments.length ?? 0) === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">目前沒有即將到期或已過期的證件 🎉</div>
        ) : (
          <ul className="divide-y">
            {data!.expiringDocuments.map((d, i) => {
              const expired = d.daysLeft < 0;
              return (
                <li
                  key={`${d.workerId}-${d.docType}-${i}`}
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
