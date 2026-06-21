import { useState, useMemo, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { WorkerModal } from "@/components/WorkerModal";
import { getStatusLabel, LIFECYCLE_STATUS_OPTIONS, DOCUMENT_STATUS_OPTIONS } from "@/lib/constants";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, Users, Briefcase, FileWarning, UserSearch, X } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Workers() {
  const [search, setSearch] = useState("");
  const [managerFilter, setManagerFilter] = useState("all");
  const [lifecycleFilter, setLifecycleFilter] = useState("all");
  const [documentFilter, setDocumentFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

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

  const filtered = useMemo(() => {
    return workers.filter(w => {
      const q = search.trim().toLowerCase();
      const matchSearch = !q ||
        w.name.toLowerCase().includes(q) ||
        w.idNumber.toLowerCase().includes(q) ||
        (w.nationality ?? "").toLowerCase().includes(q) ||
        (managerMap[w.managerId] ?? "").toLowerCase().includes(q);
      const matchManager = managerFilter === "all" || String(w.managerId) === managerFilter;
      const matchLifecycle = lifecycleFilter === "all" || w.lifecycleStatus === lifecycleFilter;
      const matchDocument = documentFilter === "all" || w.documentStatus === documentFilter;
      return matchSearch && matchManager && matchLifecycle && matchDocument;
    });
  }, [workers, search, managerFilter, lifecycleFilter, documentFilter, managerMap]);

  // 統計卡
  const stats = useMemo(() => ({
    total: workers.length,
    employed: workers.filter(w => w.lifecycleStatus === "employed").length,
    pendingSupplement: workers.filter(w => w.documentStatus === "pending_supplement").length,
    recruiting: workers.filter(w => w.lifecycleStatus === "recruiting").length,
  }), [workers]);

  const hasActiveFilter = search || managerFilter !== "all" || lifecycleFilter !== "all" || documentFilter !== "all";

  const clearAllFilters = useCallback(() => {
    setSearch("");
    setManagerFilter("all");
    setLifecycleFilter("all");
    setDocumentFilter("all");
  }, []);

  const openEdit = (id: number) => { setEditId(id); setModalOpen(true); };
  const openCreate = () => { setEditId(null); setModalOpen(true); };

  // Stat card click → quick filter
  const handleStatClick = (type: "employed" | "pendingSupplement" | "recruiting") => {
    clearAllFilters();
    if (type === "employed") setLifecycleFilter("employed");
    else if (type === "pendingSupplement") setDocumentFilter("pending_supplement");
    else if (type === "recruiting") setLifecycleFilter("recruiting");
  };

  return (
    <div className="p-6 space-y-5">
      {/* 頁面標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">移工管理</h1>
          <p className="text-sm text-muted-foreground mt-0.5">管理所有移工資料與狀態</p>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" />
          新增移工
        </Button>
      </div>

      {/* 統計卡 — 可點擊快速篩選 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* 總數卡（不可點擊篩選） */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground font-medium">移工總數</span>
            <Users className="w-4 h-4 text-foreground" />
          </div>
          <p className="text-2xl font-semibold text-foreground">{stats.total}</p>
        </div>
        {/* 可點擊篩選卡 */}
        {[
          {
            label: "在職中", value: stats.employed, icon: Briefcase,
            color: "text-green-600", type: "employed" as const,
            active: lifecycleFilter === "employed",
          },
          {
            label: "文件待補", value: stats.pendingSupplement, icon: FileWarning,
            color: "text-red-500", type: "pendingSupplement" as const,
            active: documentFilter === "pending_supplement",
          },
          {
            label: "招募中", value: stats.recruiting, icon: UserSearch,
            color: "text-amber-500", type: "recruiting" as const,
            active: lifecycleFilter === "recruiting",
          },
        ].map(card => (
          <button
            key={card.label}
            type="button"
            onClick={() => card.active ? clearAllFilters() : handleStatClick(card.type)}
            className={`bg-card border rounded-lg p-4 text-left transition-all hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              card.active
                ? "border-primary ring-1 ring-primary/20 bg-primary/5"
                : "border-border hover:border-muted-foreground/30"
            }`}
            title={card.active ? "點擊取消篩選" : `點擊篩選「${card.label}」`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">{card.label}</span>
              <card.icon className={`w-4 h-4 ${card.color}`} />
            </div>
            <p className={`text-2xl font-semibold ${card.color}`}>{card.value}</p>
          </button>
        ))}
      </div>

      {/* 搜尋與篩選列 */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          {/* 搜尋框 */}
          <div className="relative flex-1">
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
            <SelectTrigger className="w-full sm:w-36">
              <SelectValue placeholder="負責人" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部負責人</SelectItem>
              {managers.map(m => (
                <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 生命週期篩選 */}
          <Select value={lifecycleFilter} onValueChange={setLifecycleFilter}>
            <SelectTrigger className="w-full sm:w-36">
              <SelectValue placeholder="生命週期" />
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
            <SelectTrigger className="w-full sm:w-36">
              <SelectValue placeholder="文件狀態" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部文件</SelectItem>
              {DOCUMENT_STATUS_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 篩選中提示列 */}
        {hasActiveFilter && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
                <th className="px-4 py-3 text-left">生命週期</th>
                <th className="px-4 py-3 text-left hidden sm:table-cell">文件狀態</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">負責人</th>
                <th className="px-4 py-3 text-left hidden xl:table-cell">入境日期</th>
                <th className="px-4 py-3 text-right w-20">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-14 text-center text-muted-foreground text-sm">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-5 h-5 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                      載入中...
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-14 text-center">
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
                filtered.map(w => (
                  <tr
                    key={w.id}
                    className="transition-colors cursor-default"
                    onDoubleClick={() => openEdit(w.id)}
                    title="雙擊編輯"
                  >
                    <td className="px-4 py-3.5 font-medium">{w.name}</td>
                    <td className="px-4 py-3.5 hidden md:table-cell text-muted-foreground">{w.nationality || "—"}</td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs text-muted-foreground mr-1">{getStatusLabel(w.idType)}</span>
                      <span className="font-mono text-sm">{w.idNumber}</span>
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
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                          onClick={() => openEdit(w.id)}
                          title="編輯"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteId(w.id)}
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

      {/* 刪除確認 */}
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
