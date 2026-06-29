import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useSearch, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { WorkerModal } from "@/components/WorkerModal";
import { ImportWorkerModal } from "@/components/ImportWorkerModal";
import { getStatusLabel, LIFECYCLE_STATUS_OPTIONS, DOCUMENT_STATUS_OPTIONS, OCCUPATION_OPTIONS } from "@/lib/constants";
import { exportToCsv } from "@/lib/exportToCsv";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, Users, Briefcase, FileWarning, UserSearch, X, CalendarClock, ExternalLink, Upload, Download } from "lucide-react";
import { TableRowSkeleton } from "@/components/LoadingStates";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ─── 到期日工具函數 ────────────────────────────────────────────────────────────

/** 計算距今天數（負數 = 已過期） */
function daysUntilExpiry(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(dateStr);
  expiry.setHours(0, 0, 0, 0);
  return Math.round((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/** 到期日標色與標籤 */
function expiryInfo(dateStr: string | null | undefined): {
  label: string;
  className: string;
  urgent: boolean;
} {
  if (!dateStr) return { label: "—", className: "text-muted-foreground", urgent: false };
  const days = daysUntilExpiry(dateStr);
  if (days < 0) {
    return { label: `${dateStr}（已過期 ${Math.abs(days)} 天）`, className: "text-red-500 font-medium", urgent: true };
  }
  if (days === 0) {
    return { label: `${dateStr}（今日到期）`, className: "text-red-500 font-medium", urgent: true };
  }
  if (days <= 30) {
    return { label: `${dateStr}（剩 ${days} 天）`, className: "text-red-500 font-medium", urgent: true };
  }
  if (days <= 90) {
    return { label: `${dateStr}（剩 ${days} 天）`, className: "text-amber-500 font-medium", urgent: false };
  }
  return { label: dateStr, className: "text-muted-foreground", urgent: false };
}

// ─── 快速篩選標籤定義 ─────────────────────────────────────────────────────────
const EXPIRY_QUICK_FILTERS = [
  { key: "expiring_30", label: "證件 30 天內到期", days: 30 },
  { key: "expiring_90", label: "證件 90 天內到期", days: 90 },
  { key: "expired", label: "證件已過期", days: -1 },
] as const;

type ExpiryFilter = typeof EXPIRY_QUICK_FILTERS[number]["key"] | "all";

export default function Workers() {
  const searchParams = useSearch();
  const [search, setSearch] = useState("");
  const [managerFilter, setManagerFilter] = useState("all");
  const [lifecycleFilter, setLifecycleFilter] = useState("all");
  const [documentFilter, setDocumentFilter] = useState("all");
  const [expiryFilter, setExpiryFilter] = useState<ExpiryFilter>("all");
  const [sortOrder, setSortOrder] = useState<"name" | "created_desc" | "created_asc">("created_desc");
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // 讀取 URL 參數，支援通知鈴鐺點擊自動篩選
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const expiry = params.get("expiry");
    if (expiry && ["expiring_30", "expiring_90", "expired"].includes(expiry)) {
      setExpiryFilter(expiry as ExpiryFilter);
    }
  }, [searchParams]);

  const utils = trpc.useUtils();
  const { data: workers = [], isLoading } = trpc.workers.list.useQuery();
  const { data: managers = [] } = trpc.managers.list.useQuery();

  const deleteMutation = trpc.workers.delete.useMutation({
    onSuccess: () => {
      utils.workers.list.invalidate();
      toast.success("移工已刪除");
      setDeleteId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const managerMap = useMemo(() => {
    const map: Record<number, string> = {};
    managers.forEach(m => { map[m.id] = m.name; });
    return map;
  }, [managers]);

  // ─── 到期篩選邏輯 ────────────────────────────────────────────────────────────
  const matchesExpiryFilter = useCallback((w: { residentPermitExpiry?: string | null; passportExpiry?: string | null }, filter: ExpiryFilter): boolean => {
    if (filter === "all") return true;
    // 取居留證或護照中較早到期的日期來判斷
    const dates = [w.residentPermitExpiry, w.passportExpiry].filter(Boolean) as string[];
    if (dates.length === 0) return false;
    const days = Math.min(...dates.map(d => daysUntilExpiry(d)));
    if (filter === "expired") return days < 0;
    if (filter === "expiring_30") return days >= 0 && days <= 30;
    if (filter === "expiring_90") return days >= 0 && days <= 90;
    return true;
  }, []);

  const filtered = useMemo(() => {
    const list = workers.filter(w => {
      const q = search.trim().toLowerCase();
      const displayName = w.nameCn || w.nameEn || w.name;
      const matchSearch = !q ||
        displayName.toLowerCase().includes(q) ||
        (w.nameEn ?? "").toLowerCase().includes(q) ||
        (w.residentPermitNo ?? "").toLowerCase().includes(q) ||
        (w.passportNo ?? "").toLowerCase().includes(q) ||
        (w.nationality ?? "").toLowerCase().includes(q) ||
        (managerMap[w.managerId] ?? "").toLowerCase().includes(q);
      const matchManager = managerFilter === "all" || String(w.managerId) === managerFilter;
      const matchLifecycle = lifecycleFilter === "all" || w.lifecycleStatus === lifecycleFilter;
      const matchDocument = documentFilter === "all" || w.documentStatus === documentFilter;
      const matchExpiry = matchesExpiryFilter(w, expiryFilter);
      return matchSearch && matchManager && matchLifecycle && matchDocument && matchExpiry;
    });
    return [...list].sort((a, b) => {
      if (sortOrder === "name") {
        const na = (a.nameCn || a.nameEn || a.name || "").toLowerCase();
        const nb = (b.nameCn || b.nameEn || b.name || "").toLowerCase();
        return na.localeCompare(nb, "zh-TW");
      }
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return sortOrder === "created_desc" ? tb - ta : ta - tb;
    });
  }, [workers, search, managerFilter, lifecycleFilter, documentFilter, expiryFilter, managerMap, matchesExpiryFilter, sortOrder]);

  // ─── 統計卡 ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiring30 = workers.filter(w => {
      const dates = [w.residentPermitExpiry, w.passportExpiry].filter(Boolean) as string[];
      if (dates.length === 0) return false;
      const days = Math.min(...dates.map(d => daysUntilExpiry(d)));
      return days >= 0 && days <= 30;
    }).length;

    const expired = workers.filter(w => {
      const dates = [w.residentPermitExpiry, w.passportExpiry].filter(Boolean) as string[];
      if (dates.length === 0) return false;
      return Math.min(...dates.map(d => daysUntilExpiry(d))) < 0;
    }).length;

    return {
      total: workers.length,
      employed: workers.filter(w => w.lifecycleStatus === "employed").length,
      pendingSupplement: workers.filter(w => w.documentStatus === "pending_supplement").length,
      preparingAbroad: workers.filter(w => w.lifecycleStatus === "preparing_abroad").length,
      expiring30,
      expired,
    };
  }, [workers]);

  const hasActiveFilter = search || managerFilter !== "all" || lifecycleFilter !== "all" || documentFilter !== "all" || expiryFilter !== "all";

  // ─── CSV 匯出 ────────────────────────────────────────────────────────────────
  const handleExportCsv = useCallback(() => {
    const occupationMap = Object.fromEntries(OCCUPATION_OPTIONS.map(o => [o.value, o.label]));
    const headers = [
      "中文姓名", "英文姓名", "性別", "國籍", "出生地", "職業類別",
      "在職狀態", "文件狀態",
      "居留證號", "居留證效期", "護照號碼", "護照效期",
      "入境日期", "手機", "Email",
      "最近體檢日", "下次體檢類型",
      "負責人", "外部連結", "備註",
    ];
    const rows = filtered.map(w => [
      w.nameCn || w.name || "",
      w.nameEn || "",
      w.gender === "male" ? "男" : w.gender === "female" ? "女" : w.gender === "other" ? "其他" : "",
      w.nationality || "",
      w.birthPlace || "",
      occupationMap[w.occupation ?? ""] || w.occupation || "",
      getStatusLabel(w.lifecycleStatus),
      getStatusLabel(w.documentStatus),
      w.residentPermitNo || "",
      w.residentPermitExpiry || "",
      w.passportNo || "",
      w.passportExpiry || "",
      w.entryDate || "",
      w.phone || "",
      w.email || "",
      w.lastMedicalExamDate || "",
      w.nextMedicalExamType || "",
      managerMap[w.managerId] || "",
      w.externalLink || "",
      w.notes || "",
    ]);
    exportToCsv("移工名單", headers, rows);
  }, [filtered, managerMap]);

  const clearAllFilters = useCallback(() => {
    setSearch("");
    setManagerFilter("all");
    setLifecycleFilter("all");
    setDocumentFilter("all");
    setExpiryFilter("all");
  }, []);

  const [, navigate] = useLocation();
  const openEdit = (id: number) => { setEditId(id); setModalOpen(true); };
  const openCreate = () => { setEditId(null); setModalOpen(true); };

  // 統計卡點擊快速篩選
  const handleStatClick = (type: "employed" | "pendingSupplement" | "preparingAbroad" | "expiring30") => {
    clearAllFilters();
    if (type === "employed") setLifecycleFilter("employed");
    else if (type === "pendingSupplement") setDocumentFilter("pending_supplement");
    else if (type === "preparingAbroad") setLifecycleFilter("preparing_abroad");
    else if (type === "expiring30") setExpiryFilter("expiring_30");
  };

  // 到期篩選標籤文字
  const expiryFilterLabel = EXPIRY_QUICK_FILTERS.find(f => f.key === expiryFilter)?.label;

  return (
    <div className="p-6 space-y-5">
      {/* 頁面標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">移工管理</h1>
          <p className="text-sm text-muted-foreground mt-0.5">管理所有移工資料與狀態</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="gap-1.5"
            title={`匯出目前笛選的 ${filtered.length} 筆移工資料`}
          >
            <Download className="w-4 h-4" />
            匯出 CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportModalOpen(true)}
            className="gap-1.5"
          >
            <Upload className="w-4 h-4" />
            匯入 CSV
          </Button>
          <Button onClick={openCreate} size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" />
            新增移工
          </Button>
        </div>
      </div>

      {/* 統計卡 — 可點擊快速篩選（5 張） */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* 總數（不可點擊） */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground font-medium">移工總數</span>
            <Users className="w-4 h-4 text-foreground" />
          </div>
          <p className="text-2xl font-semibold text-foreground">{stats.total}</p>
        </div>

        {/* 可點擊篩選卡 — 方向二：單一主色 + 語義灰階 */}
        {[
          // 在職中 → 正常狀態，灰色系
          {
            label: "在職中", value: stats.employed, icon: Briefcase,
            warn: false, danger: false,
            type: "employed" as const,
            active: lifecycleFilter === "employed",
          },
          // 文件待補 → 需行動，紅色
          {
            label: "文件待補", value: stats.pendingSupplement, icon: FileWarning,
            warn: false, danger: true,
            type: "pendingSupplement" as const,
            active: documentFilter === "pending_supplement",
          },
          // 準備來台 → 警示，琥珀色
          {
            label: "準備來台", value: stats.preparingAbroad, icon: UserSearch,
            warn: true, danger: false,
            type: "preparingAbroad" as const,
            active: lifecycleFilter === "preparing_abroad",
          },
          // 證件即將到期 → 有數則紅色警示，無則灰色
          {
            label: "證件即將到期", value: stats.expiring30, icon: CalendarClock,
            warn: false, danger: stats.expiring30 > 0,
            type: "expiring30" as const,
            active: expiryFilter === "expiring_30",
          },
        ].map(card => (
          <button
            key={card.label}
            type="button"
            onClick={() => card.active ? clearAllFilters() : handleStatClick(card.type)}
            className={`bg-card border rounded-lg p-4 text-left transition-all hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              card.active
                ? card.danger
                  ? "border-red-400/60 ring-1 ring-red-400/20 bg-red-50/60 dark:bg-red-950/20"
                  : card.warn
                    ? "border-amber-400/60 ring-1 ring-amber-400/20 bg-amber-50/60 dark:bg-amber-950/20"
                    : "border-foreground/30 ring-1 ring-foreground/10 bg-muted/50"
                : "border-border hover:border-muted-foreground/30"
            }`}
            title={card.active ? "點擊取消篩選" : `點擊篩選「${card.label}」`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">{card.label}</span>
              <card.icon className={`w-4 h-4 ${
                card.danger && card.value > 0 ? "text-red-500" :
                card.warn && card.value > 0 ? "text-amber-500" :
                "text-muted-foreground"
              }`} />
            </div>
            <p className={`text-2xl font-semibold ${
              card.danger && card.value > 0 ? "text-red-500" :
              card.warn && card.value > 0 ? "text-amber-600" :
              "text-foreground"
            }`}>{card.value}</p>
          </button>
        ))}
      </div>

      {/* 搜尋與篩選列 */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
          {/* 搜尋框 */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              ref={searchRef}
              placeholder="搜尋姓名、證號、國籍、負責人..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === "Escape" && setSearch("")}
              className="pl-9 pr-8"
            />
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(""); searchRef.current?.focus(); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="清除搜尋"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* 負責人篩選 */}
          <Select value={managerFilter} onValueChange={setManagerFilter}>
            <SelectTrigger className="w-full sm:w-32">
              <SelectValue placeholder="負責人" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部負責人</SelectItem>
              {managers.map(m => (
                <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 在職狀態篩選 */}
          <Select value={lifecycleFilter} onValueChange={setLifecycleFilter}>
            <SelectTrigger className="w-full sm:w-32">
              <SelectValue placeholder="全部狀態" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部狀態</SelectItem>
              {LIFECYCLE_STATUS_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 文件狀態篩選 */}
          <Select value={documentFilter} onValueChange={setDocumentFilter}>
            <SelectTrigger className="w-full sm:w-32">
              <SelectValue placeholder="文件狀態" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部文件</SelectItem>
              {DOCUMENT_STATUS_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 證件到期篩選 */}
          <Select value={expiryFilter} onValueChange={v => setExpiryFilter(v as ExpiryFilter)}>
            <SelectTrigger className={`w-full sm:w-36 ${expiryFilter !== "all" ? "border-amber-400 text-amber-600" : ""}`}>
              <SelectValue placeholder="證件到期" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部證件</SelectItem>
              {EXPIRY_QUICK_FILTERS.map(f => (
                <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 排序 */}
          <Select value={sortOrder} onValueChange={v => setSortOrder(v as typeof sortOrder)}>
            <SelectTrigger className="w-full sm:w-36">
              <SelectValue placeholder="排序" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created_desc">建立時間（新→舊）</SelectItem>
              <SelectItem value="created_asc">建立時間（舊→新）</SelectItem>
              <SelectItem value="name">姓名（A→Z）</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 篩選中提示列 */}
        {hasActiveFilter && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            <span>
              顯示 <strong className="text-foreground">{filtered.length}</strong> / {workers.length} 筆
              {lifecycleFilter !== "all" && (
                <span className="ml-1.5 inline-flex items-center gap-1 bg-muted px-1.5 py-0.5 rounded">
                  {getStatusLabel(lifecycleFilter)}
                  <button onClick={() => setLifecycleFilter("all")} className="hover:text-destructive"><X className="w-3 h-3" /></button>
                </span>
              )}
              {documentFilter !== "all" && (
                <span className="ml-1.5 inline-flex items-center gap-1 bg-muted px-1.5 py-0.5 rounded">
                  {getStatusLabel(documentFilter)}
                  <button onClick={() => setDocumentFilter("all")} className="hover:text-destructive"><X className="w-3 h-3" /></button>
                </span>
              )}
              {managerFilter !== "all" && (
                <span className="ml-1.5 inline-flex items-center gap-1 bg-muted px-1.5 py-0.5 rounded">
                  {managerMap[parseInt(managerFilter)]}
                  <button onClick={() => setManagerFilter("all")} className="hover:text-destructive"><X className="w-3 h-3" /></button>
                </span>
              )}
              {expiryFilter !== "all" && (
                <span className="ml-1.5 inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-700 px-1.5 py-0.5 rounded">
                  <CalendarClock className="w-3 h-3" />
                  {expiryFilterLabel}
                  <button onClick={() => setExpiryFilter("all")} className="hover:text-destructive"><X className="w-3 h-3" /></button>
                </span>
              )}
            </span>
            <button
              onClick={clearAllFilters}
              className="ml-auto text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              清除全部篩選
            </button>
          </div>
        )}
      </div>

      {/* 資料表格 */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full data-table">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left">姓名</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">國籍</th>
                <th className="px-4 py-3 text-left">證號</th>
                <th className="px-4 py-3 text-left">在職狀態</th>
                <th className="px-4 py-3 text-left hidden sm:table-cell">文件狀態</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">負責人</th>
                <th className="px-4 py-3 text-left hidden xl:table-cell">入境日期</th>
                <th className="px-4 py-3 text-left hidden xl:table-cell">
                  <span className="flex items-center gap-1">
                    <CalendarClock className="w-3.5 h-3.5 text-amber-500" />
                    證件到期日
                  </span>
                </th>
                <th className="px-4 py-3 text-right w-20">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <TableRowSkeleton cols={9} rows={6} />
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-14 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Users className="w-8 h-8 opacity-30" />
                      <p className="text-sm">
                        {hasActiveFilter
                          ? "沒有符合條件的移工資料"
                          : "尚無移工資料，點擊「新增移工」開始建立"}
                      </p>
                      {hasActiveFilter && (
                        <button
                          onClick={clearAllFilters}
                          className="text-xs text-primary hover:underline mt-1"
                        >
                          清除篩選條件
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(w => {
                  // 取居留證或護照中較早到期的日期顯示
                  const earliestExpiry = [w.residentPermitExpiry, w.passportExpiry]
                    .filter(Boolean)
                    .sort()[0];
                  const expiry = expiryInfo(earliestExpiry);
                  const displayName = w.nameCn || w.nameEn || w.name;
                  return (
                    <tr
                      key={w.id}
                      className={`transition-colors cursor-pointer hover:bg-muted/40 ${expiry.urgent ? "bg-red-50/40 hover:bg-red-50/70" : ""}`}
                      onClick={() => navigate(`/workers/${w.id}`)}
                      title="點擊查看詳情"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium">{displayName}</span>
                          {expiry.urgent && (() => {
                            const rpDays = w.residentPermitExpiry ? daysUntilExpiry(w.residentPermitExpiry) : Infinity;
                            const ppDays = w.passportExpiry ? daysUntilExpiry(w.passportExpiry) : Infinity;
                            const urgentDoc = rpDays <= ppDays ? (
                              rpDays < 0 ? `居留證過期 ${Math.abs(rpDays)} 天` :
                              rpDays === 0 ? `居留證今日到期` :
                              `居留證剩 ${rpDays} 天`
                            ) : (
                              ppDays < 0 ? `護照過期 ${Math.abs(ppDays)} 天` :
                              ppDays === 0 ? `護照今日到期` :
                              `護照剩 ${ppDays} 天`
                            );
                            return (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-red-500 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded whitespace-nowrap">
                                <CalendarClock className="w-2.5 h-2.5 shrink-0" />
                                {urgentDoc}
                              </span>
                            );
                          })()}
                          {w.externalLink && (
                            <a
                              href={w.externalLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              title="開啟外部連結"
                              className="inline-flex items-center text-muted-foreground hover:text-blue-500 transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 hidden md:table-cell text-muted-foreground">{w.nationality || "—"}</td>
                      <td className="px-4 py-3.5">
                        <div className="space-y-0.5">
                          {w.residentPermitNo && (
                            <div><span className="text-xs text-muted-foreground mr-1">居留證</span><span className="font-mono text-sm">{w.residentPermitNo}</span></div>
                          )}
                          {w.passportNo && (
                            <div><span className="text-xs text-muted-foreground mr-1">護照</span><span className="font-mono text-sm">{w.passportNo}</span></div>
                          )}
                          {!w.residentPermitNo && !w.passportNo && <span className="text-muted-foreground">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={w.lifecycleStatus} />
                      </td>
                      <td className="px-4 py-3.5 hidden sm:table-cell">
                        <StatusBadge status={w.documentStatus} />
                      </td>
                      <td className="px-4 py-3.5 hidden lg:table-cell text-muted-foreground">
                        {managerMap[w.managerId] || "—"}
                      </td>
                      <td className="px-4 py-3.5 hidden xl:table-cell text-muted-foreground text-sm">
                        {w.entryDate || "—"}
                      </td>
                      <td className="px-4 py-3.5 hidden xl:table-cell text-sm">
                        <div className="space-y-0.5">
                          {w.residentPermitExpiry && (
                            <div className={expiryInfo(w.residentPermitExpiry).className}>
                              <span className="text-xs text-muted-foreground mr-1">居留</span>{expiryInfo(w.residentPermitExpiry).label}
                            </div>
                          )}
                          {w.passportExpiry && (
                            <div className={expiryInfo(w.passportExpiry).className}>
                              <span className="text-xs text-muted-foreground mr-1">護照</span>{expiryInfo(w.passportExpiry).label}
                            </div>
                          )}
                          {!w.residentPermitExpiry && !w.passportExpiry && <span className="text-muted-foreground">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                            onClick={(e) => { e.stopPropagation(); openEdit(w.id); }}
                            title="編輯"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); setDeleteId(w.id); }}
                            title="刪除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {/* 底部計數列 */}
        <div className="px-4 py-2.5 bg-muted/30 border-t border-border flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {filtered.length > 0
              ? `顯示 ${filtered.length} 筆${workers.length !== filtered.length ? `，共 ${workers.length} 筆` : ""}`
              : "無資料"}
          </p>
          {hasActiveFilter && filtered.length > 0 && (
            <button
              onClick={clearAllFilters}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              清除篩選
            </button>
          )}
        </div>
      </div>

      {/* 新增/編輯 Modal */}
      <WorkerModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => utils.workers.list.invalidate()}
        editId={editId}
      />

      {/* CSV 匯入 Modal */}
      <ImportWorkerModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onSuccess={() => utils.workers.list.invalidate()}
      />

      {/* 删除確認 */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除</AlertDialogTitle>
            <AlertDialogDescription>
              此操作無法復原，確定要刪除這筆移工資料嗎？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
            >
              確認刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
