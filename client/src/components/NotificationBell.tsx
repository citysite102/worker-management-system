import { useMemo, useRef, useEffect, useState } from "react";
import { Bell, CalendarClock, ChevronRight, CheckCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

// ─── 到期日工具函數（與 Workers.tsx 保持一致）────────────────────────────────
function daysUntilExpiry(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(dateStr);
  expiry.setHours(0, 0, 0, 0);
  return Math.round((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

type NotificationItem = {
  id: string; // 複合 key：`${workerId}-${expiryType}`
  workerId: number;
  name: string;
  expiryDate: string;
  expiryType: "resident" | "passport" | "medical";
  days: number;
  managerName: string;
  urgency: "expired" | "critical" | "warning"; // 已過期 / 30天內 / 90天內
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();

  const { data: workers = [], isLoading: workersLoading } = trpc.workers.list.useQuery();
  const { data: managers = [], isLoading: managersLoading } = trpc.managers.list.useQuery();
  const isLoading = workersLoading || managersLoading;

  const managerMap = useMemo(() => {
    const map: Record<number, string> = {};
    managers.forEach(m => { map[m.id] = m.name; });
    return map;
  }, [managers]);

  // 計算所有 90 天內到期或已過期的移工（居留證 + 護照 + 體檢）
  const notifications = useMemo((): NotificationItem[] => {
    const items: NotificationItem[] = [];
    workers.forEach(w => {
      const displayName = (w as any).nameCn || (w as any).nameEn || (w as any).name || "—";
      const managerName = managerMap[w.managerId] ?? "—";
      const makeItem = (dateStr: string, type: NotificationItem["expiryType"]): NotificationItem => {
        const days = daysUntilExpiry(dateStr);
        return {
          id: `${w.id}-${type}`, // 複合唯一 key
          workerId: w.id,
          name: displayName,
          expiryDate: dateStr,
          expiryType: type,
          days,
          managerName,
          urgency: (days < 0 ? "expired" : days <= 30 ? "critical" : "warning") as NotificationItem["urgency"],
        };
      };
      if ((w as any).residentPermitExpiry) {
        const item = makeItem((w as any).residentPermitExpiry, "resident");
        if (item.days <= 90) items.push(item);
      }
      if ((w as any).passportExpiry) {
        const item = makeItem((w as any).passportExpiry, "passport");
        if (item.days <= 90) items.push(item);
      }
      // 體檢：根據最近一次體檢日期自動計算下次可體檢日（+5個月）
      const lastExam = (w as any).lastMedicalExamDate as string | undefined;
      if (lastExam) {
        const d = new Date(lastExam);
        if (!isNaN(d.getTime())) {
          d.setMonth(d.getMonth() + 5);
          const nextExamStr = d.toISOString().slice(0, 10);
          const item = makeItem(nextExamStr, "medical");
          if (item.days <= 90) items.push(item);
        }
      }
    });
    return items.sort((a, b) => a.days - b.days);
  }, [workers, managerMap]);

  const expiredCount = notifications.filter(n => n.urgency === "expired").length;
  const criticalCount = notifications.filter(n => n.urgency === "critical").length;
  const badgeCount = expiredCount + criticalCount; // 只算 30 天內+已過期

  // 點擊外部關閉
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Escape 關閉
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  // 點擊通知項目 → 導航至該名移工詳情頁，並醒目對應文件區塊
  const handleItemClick = (n: NotificationItem) => {
    setOpen(false);
    setLocation(`/workers/${n.workerId}?highlight=${n.expiryType}`);
  };

  // urgency 樣式
  const urgencyStyle = (urgency: NotificationItem["urgency"]) => {
    if (urgency === "expired") return { dot: "bg-red-500", text: "text-red-600", bg: "hover:bg-red-50", badge: "bg-red-50 text-red-600 border-red-200" };
    if (urgency === "critical") return { dot: "bg-red-400", text: "text-red-500", bg: "hover:bg-red-50/60", badge: "bg-orange-50 text-orange-600 border-orange-200" };
    return { dot: "bg-amber-400", text: "text-amber-600", bg: "hover:bg-amber-50/50", badge: "bg-amber-50 text-amber-600 border-amber-200" };
  };

  const urgencyLabel = (n: NotificationItem) => {
    if (n.urgency === "expired") return `已過期 ${Math.abs(n.days)} 天`;
    return `${n.days} 天後到期`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 鈴鐺按鈕 */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`relative h-9 w-9 flex items-center justify-center rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          open ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
        }`}
        aria-label={`通知（${badgeCount} 筆待處理）`}
      >
        <Bell className="w-4 h-4" />
        {badgeCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        )}
      </button>

      {/* 下拉面板 */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-80 bg-background border border-border rounded-xl shadow-lg z-50 overflow-hidden"
          style={{ animation: "fadeInScale 150ms cubic-bezier(0.23,1,0.32,1)" }}
        >
          {/* 面板標題 */}
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-semibold text-foreground">到期提醒</span>
            </div>
            {notifications.length > 0 && (
              <span className="text-xs text-muted-foreground">
                共 {notifications.length} 筆
              </span>
            )}
          </div>

          {/* 通知列表 */}
          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                <div className="w-5 h-5 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                <p className="text-xs">載入中...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                <CheckCheck className="w-7 h-7 opacity-40" />
                <p className="text-sm">目前無到期提醒</p>
                <p className="text-xs opacity-70">所有移工證件均在 90 天有效期內</p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {notifications.map(n => {
                  const s = urgencyStyle(n.urgency);
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => handleItemClick(n)}
                      className={`w-full px-4 py-3 text-left flex items-start gap-3 transition-colors ${s.bg} group`}
                    >
                      {/* 狀態點 */}
                      <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${s.dot}`} />

                      {/* 內容 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-foreground truncate">
                            {n.name}
                          </span>
                          <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded border shrink-0 ${s.badge}`}>
                            {urgencyLabel(n)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">
                            {n.expiryType === "resident" ? "居留證" : n.expiryType === "passport" ? "護照" : "體檢"}到期：{n.expiryDate}
                          </span>
                          <span className="text-muted-foreground/40">·</span>
                          <span className="text-xs text-muted-foreground truncate">
                            負責人：{n.managerName}
                          </span>
                        </div>
                      </div>

                      {/* 箭頭 */}
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 mt-1 group-hover:text-muted-foreground transition-colors" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 底部快速篩選入口 */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-border bg-muted/30 flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {expiredCount > 0 && <span className="text-red-500 font-medium">{expiredCount} 筆已過期</span>}
                {expiredCount > 0 && criticalCount > 0 && <span className="mx-1 text-muted-foreground/40">·</span>}
                {criticalCount > 0 && <span className="text-orange-500 font-medium">{criticalCount} 筆 30 天內</span>}
              </span>
              <button
                type="button"
                onClick={() => { setOpen(false); setLocation("/workers?expiry=expiring_90"); }}
                className="text-xs text-primary hover:underline underline-offset-2 flex items-center gap-0.5"
              >
                查看全部
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
