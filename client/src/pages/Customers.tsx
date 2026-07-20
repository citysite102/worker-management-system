import { useState, useMemo, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { CustomerModal } from "@/components/CustomerModal";
import { getStatusLabel, CONTRACT_STATUS_OPTIONS, PRICING_TIER_OPTIONS, EMPLOYER_TYPE_OPTIONS } from "@/lib/constants";
import { exportToCsv } from "@/lib/exportToCsv";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, Building2, CheckCircle, MessageSquare, RefreshCw, X, User, Briefcase, Download } from "lucide-react";
import { TableRowSkeleton } from "@/components/LoadingStates";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Customers() {
  const [search, setSearch] = useState("");
  const [managerFilter, setManagerFilter] = useState("all");
  const [contractFilter, setContractFilter] = useState("all");
  const [pricingFilter, setPricingFilter] = useState("all");
  const [employerTypeFilter, setEmployerTypeFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"name" | "created_desc" | "created_asc">("created_desc");
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const { data: customers = [], isLoading } = trpc.customers.list.useQuery();
  const { data: managers = [] } = trpc.managers.list.useQuery();

  const deleteMutation = trpc.customers.delete.useMutation({
    onSuccess: () => {
      utils.customers.list.invalidate();
      toast.success("客戶已刪除");
      setDeleteId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const managerMap = useMemo(() => {
    const map: Record<number, string> = {};
    managers.forEach(m => { map[m.id] = m.name; });
    return map;
  }, [managers]);

  const filtered = useMemo(() => {
    const list = customers.filter(c => {
      const q = search.trim().toLowerCase();
      const ca = c as any;
      const matchSearch = !q ||
        c.name.toLowerCase().includes(q) ||
        (c.taxId ?? "").toLowerCase().includes(q) ||
        (c.industry ?? "").toLowerCase().includes(q) ||
        (c.contactName ?? "").toLowerCase().includes(q) ||
        (ca.employerNo ?? "").toLowerCase().includes(q) ||
        (ca.idNo ?? "").toLowerCase().includes(q) ||
        (ca.phone ?? "").toLowerCase().includes(q) ||
        (managerMap[c.managerId] ?? "").toLowerCase().includes(q);
      const matchManager = managerFilter === "all" || String(c.managerId) === managerFilter;
      const matchContract = contractFilter === "all" || c.contractStatus === contractFilter;
      const matchPricing = pricingFilter === "all" || c.pricingTier === pricingFilter;
      const matchEmployerType = employerTypeFilter === "all" || (ca.employerType ?? "company") === employerTypeFilter;
      return matchSearch && matchManager && matchContract && matchPricing && matchEmployerType;
    });
    return [...list].sort((a, b) => {
      if (sortOrder === "name") {
        return a.name.localeCompare(b.name, "zh-TW");
      }
      const ta = (a as any).createdAt ? new Date((a as any).createdAt).getTime() : 0;
      const tb = (b as any).createdAt ? new Date((b as any).createdAt).getTime() : 0;
      return sortOrder === "created_desc" ? tb - ta : ta - tb;
    });
  }, [customers, search, managerFilter, contractFilter, pricingFilter, employerTypeFilter, managerMap, sortOrder]);

  // 統計卡
  const stats = useMemo(() => ({
    total: customers.length,
    individual: customers.filter(c => (c as any).employerType === "individual").length,
    company: customers.filter(c => (c as any).employerType === "company" || !(c as any).employerType).length,
    inService: customers.filter(c => c.contractStatus === "in_service").length,
    negotiating: customers.filter(c => c.contractStatus === "negotiating").length,
    pendingRenewal: customers.filter(c => c.contractStatus === "pending_renewal").length,
  }), [customers]);

  const hasActiveFilter = search || managerFilter !== "all" || contractFilter !== "all" || pricingFilter !== "all" || employerTypeFilter !== "all";

  // ─── CSV 匯出 ────────────────────────────────────────────────────────────────
  const handleExportCsv = useCallback(() => {
    const headers = [
      "雇主類型", "名稱", "雇主編號", "手機", "市話", "地址", "登記地址",
      "尋人人", "合約狀態", "定價級距",
      "身分證字號", "前課程編號",
      "統一編號", "產業別", "聯絡人", "聯絡電話",
      "負責人", "備註",
    ];
    const rows = filtered.map((c: any) => [
      c.employerType === "individual" ? "個人雇主" : "事業雇主",
      c.name || "",
      c.employerNo || "",
      c.phone || "",
      c.landline || "",
      c.address || "",
      c.registeredAddress || "",
      c.referrer || "",
      getStatusLabel(c.contractStatus),
      getStatusLabel(c.pricingTier),
      c.idNo || "",
      c.preCourseNo || "",
      c.taxId || "",
      c.industry || "",
      c.contactName || "",
      c.contactPhone || "",
      managerMap[c.managerId] || "",
      c.notes || "",
    ]);
    exportToCsv("客戶名單", headers, rows);
  }, [filtered, managerMap]);

  const clearAllFilters = useCallback(() => {
    setSearch("");
    setManagerFilter("all");
    setContractFilter("all");
    setPricingFilter("all");
    setEmployerTypeFilter("all");
  }, []);

  const [, navigate] = useLocation();
  const openEdit = (id: number) => { setEditId(id); setModalOpen(true); };
  const openCreate = () => { setEditId(null); setModalOpen(true); };

  // Stat card click → quick filter
  const handleStatClick = (type: "in_service" | "negotiating" | "pending_renewal") => {
    clearAllFilters();
    setContractFilter(type);
  };

  const handleTypeClick = (type: "individual" | "company") => {
    clearAllFilters();
    setEmployerTypeFilter(type);
  };

  return (
    <div className="p-6 space-y-5">
      {/* 頁面標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">客戶管理</h1>
          <p className="text-sm text-muted-foreground mt-0.5">管理所有客戶資料與合約狀態</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            data-testid="customers-export-csv"
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="gap-1.5"
            title={`匯出目前篩選的 ${filtered.length} 筆客戶資料`}
          >
            <Download className="w-4 h-4" />
            匯出 CSV
          </Button>
          <Button data-testid="customers-create" onClick={openCreate} size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" />
            新增雇主
          </Button>
        </div>
      </div>

      {/* 統計卡 — 可點擊快速篩選 */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {/* 總數卡（不可點擊篩選） */}
        <div data-testid="customers-stat-total" className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground font-medium">雇主總數</span>
            <Building2 className="w-4 h-4 text-foreground" />
          </div>
          <p data-testid="customers-stat-value" className="text-2xl font-semibold text-foreground">{stats.total}</p>
        </div>
        {/* 個人 / 公司 類型卡 — 灰色系，不用強調色 */}
        {[
          { label: "個人雇主", value: stats.individual, icon: User, type: "individual" as const },
          { label: "公司行號", value: stats.company, icon: Briefcase, type: "company" as const },
        ].map(card => {
          const active = employerTypeFilter === card.type;
          return (
            <button
              key={card.label}
              data-testid="customers-stat-card"
              data-stat-type={card.type}
              data-active={active}
              type="button"
              onClick={() => active ? clearAllFilters() : handleTypeClick(card.type)}
              className={`bg-card border rounded-lg p-4 text-left transition-all hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                active ? "border-foreground/30 ring-1 ring-foreground/10 bg-muted/50" : "border-border hover:border-muted-foreground/30"
              }`}
              title={active ? "點擊取消篩選" : `點擊篩選「${card.label}」`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground font-medium">{card.label}</span>
                <card.icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-semibold text-foreground">{card.value}</p>
            </button>
          );
        })}
        {/* 合約狀態快篩卡 — 只有「需注意」才用警示色 */}
        {[
          // 服務中 → 正常狀態，灰色系
          { label: "服務中", value: stats.inService, icon: CheckCircle, warn: false, filterVal: "in_service" as const },
          // 洽談中 → 警示，唯一強調色
          { label: "洽談中", value: stats.negotiating, icon: MessageSquare, warn: true, filterVal: "negotiating" as const },
          // 待續約 → 警示，唯一強調色
          { label: "待續約", value: stats.pendingRenewal, icon: RefreshCw, warn: true, filterVal: "pending_renewal" as const },
        ].map(card => {
          const active = contractFilter === card.filterVal;
          return (
            <button
              key={card.label}
              data-testid="customers-stat-card"
              data-stat-type={card.filterVal}
              data-active={active}
              type="button"
              onClick={() => active ? clearAllFilters() : handleStatClick(card.filterVal)}
              className={`bg-card border rounded-lg p-4 text-left transition-all hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                active
                  ? card.warn
                    ? "border-amber-400/60 ring-1 ring-amber-400/20 bg-amber-50/60 dark:bg-amber-950/20"
                    : "border-foreground/30 ring-1 ring-foreground/10 bg-muted/50"
                  : "border-border hover:border-muted-foreground/30"
              }`}
              title={active ? "點擊取消篩選" : `點擊篩選「${card.label}」`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground font-medium">{card.label}</span>
                <card.icon className={`w-4 h-4 ${card.warn ? "text-amber-500" : "text-muted-foreground"}`} />
              </div>
              <p className={`text-2xl font-semibold ${
                card.warn && card.value > 0 ? "text-amber-600" : "text-foreground"
              }`}>{card.value}</p>
            </button>
          );
        })}
      </div>

      {/* 搜尋與篩選列 */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          {/* 搜尋框 */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              data-testid="customers-search"
              ref={searchRef}
              placeholder="搜尋名稱、統編、產業、聯絡窗口、負責人..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === "Escape" && setSearch("")}
              className="pl-9 pr-8"
            />
            {search && (
              <button
                data-testid="customers-search-clear"
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
            <SelectTrigger data-testid="customers-filter-manager" className="w-full sm:w-36">
              <SelectValue placeholder="負責人" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部負責人</SelectItem>
              {managers.map(m => (
                <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 合約狀態篩選 */}
          <Select value={contractFilter} onValueChange={setContractFilter}>
            <SelectTrigger data-testid="customers-filter-contract" className="w-full sm:w-36">
              <SelectValue placeholder="合約狀態" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部狀態</SelectItem>
              {CONTRACT_STATUS_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 雇主類型篩選 */}
          <Select value={employerTypeFilter} onValueChange={setEmployerTypeFilter}>
            <SelectTrigger data-testid="customers-filter-employer-type" className="w-full sm:w-32">
              <SelectValue placeholder="雇主類型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部類型</SelectItem>
              {EMPLOYER_TYPE_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 定價篩選（暂時隐藏，待定價資料建立後再開啟） */}
          {/* <Select value={pricingFilter} onValueChange={setPricingFilter}>
            <SelectTrigger className="w-full sm:w-32">
              <SelectValue placeholder="定價" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部定價</SelectItem>
              {PRICING_TIER_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select> */}

          {/* 排序 */}
          <Select value={sortOrder} onValueChange={v => setSortOrder(v as typeof sortOrder)}>
            <SelectTrigger data-testid="customers-sort" className="w-full sm:w-36">
              <SelectValue placeholder="排序" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created_desc">建立時間（新→舊）</SelectItem>
              <SelectItem value="created_asc">建立時間（舊→新）</SelectItem>
              <SelectItem value="name">名稱（A→Z）</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 篩選中提示列 */}
        {hasActiveFilter && (
          <div data-testid="customers-filter-summary" className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              顯示 <strong className="text-foreground">{filtered.length}</strong> / {customers.length} 筆
              {contractFilter !== "all" && (
                <span className="ml-1.5 inline-flex items-center gap-1 bg-muted px-1.5 py-0.5 rounded">
                  {getStatusLabel(contractFilter)}
                  <button onClick={() => setContractFilter("all")} className="hover:text-destructive"><X className="w-3 h-3" /></button>
                </span>
              )}
              {pricingFilter !== "all" && (
                <span className="ml-1.5 inline-flex items-center gap-1 bg-muted px-1.5 py-0.5 rounded">
                  {getStatusLabel(pricingFilter)}
                  <button onClick={() => setPricingFilter("all")} className="hover:text-destructive"><X className="w-3 h-3" /></button>
                </span>
              )}
              {managerFilter !== "all" && (
                <span className="ml-1.5 inline-flex items-center gap-1 bg-muted px-1.5 py-0.5 rounded">
                  {managerMap[parseInt(managerFilter)]}
                  <button onClick={() => setManagerFilter("all")} className="hover:text-destructive"><X className="w-3 h-3" /></button>
                </span>
              )}
            </span>
            <button
              data-testid="customers-clear-filters"
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
                <th className="px-4 py-3 text-left">名稱</th>
                <th className="px-4 py-3 text-left hidden sm:table-cell">類型</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">編號</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">電話</th>
                <th className="px-4 py-3 text-left">合約狀態</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">負責人</th>
                <th className="px-4 py-3 text-left hidden xl:table-cell">案件狀態</th>
                <th className="px-4 py-3 text-right w-20">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <TableRowSkeleton cols={8} rows={6} />
              ) : filtered.length === 0 ? (
                <tr data-testid="customers-empty">
                  <td colSpan={8} className="px-4 py-14 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Building2 className="w-8 h-8 opacity-30" />
                      <p className="text-sm">
                        {hasActiveFilter
                          ? "沒有符合條件的客戶資料"
                          : "尚無雇主資料，點擊「新增雇主」開始建立"}
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
                filtered.map(c => (
                  <tr
                    key={c.id}
                    data-testid="customer-row"
                    data-customer-id={c.id}
                    className="transition-colors cursor-pointer hover:bg-muted/40"
                    onClick={() => navigate(`/customers/${c.id}`)}
                    title="點擊查看詳情"
                  >
                    <td className="px-4 py-3.5 font-medium">{c.name}</td>
                    <td className="px-4 py-3.5 hidden sm:table-cell">
                      {(c as any).employerType === "individual" ? (
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground tracking-wide">
                          <User className="w-3 h-3" />個人雇主
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground tracking-wide">
                          <Briefcase className="w-3 h-3" />公司行號
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <span className="font-mono text-sm text-muted-foreground">{(c as any).employerNo || c.taxId || "—"}</span>
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell text-muted-foreground text-sm">
                      {(c as any).phone || c.contactPhone || "—"}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={c.contractStatus} />
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell text-muted-foreground">
                      {managerMap[c.managerId] || "—"}
                    </td>
                    <td className="px-4 py-3.5 hidden xl:table-cell">
                      {(c as any).caseStatus ? <StatusBadge status={(c as any).caseStatus} /> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          data-testid="customer-row-edit"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                          onClick={(e) => { e.stopPropagation(); openEdit(c.id); }}
                          title="編輯"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          data-testid="customer-row-delete"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); setDeleteId(c.id); }}
                          title="刪除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* 底部計數列 */}
        <div className="px-4 py-2.5 bg-muted/30 border-t border-border flex items-center justify-between">
          <p data-testid="customers-count" className="text-xs text-muted-foreground">
            {filtered.length > 0
              ? `顯示 ${filtered.length} 筆${customers.length !== filtered.length ? `，共 ${customers.length} 筆` : ""}`
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
      <CustomerModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => utils.customers.list.invalidate()}
        editId={editId}
      />

      {/* 刪除確認 */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除</AlertDialogTitle>
            <AlertDialogDescription>
              此操作無法復原，確定要刪除這筆客戶資料嗎？
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
