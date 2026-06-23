import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Search, Briefcase, CheckCircle2, PauseCircle, XCircle, Pencil, Trash2, ArrowRight } from "lucide-react";
import { getStatusLabel, getStatusColor, CASE_MGMT_STATUS_OPTIONS } from "@/lib/constants";
import { StatusBadge } from "@/components/StatusBadge";
import CaseModal from "@/components/CaseModal";

export default function Cases() {
  const [, navigate] = useLocation();
  const searchParams = useSearch();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [managerFilter, setManagerFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editingCase, setEditingCase] = useState<any>(null);
  const [deletingCase, setDeletingCase] = useState<any>(null);
  const [prefilledCustomerId, setPrefilledCustomerId] = useState<number | null>(null);
  const [prefilledWorkerId, setPrefilledWorkerId] = useState<number | null>(null);

  // 讀取 URL 參數，自動開啟 Modal 並預填雇主或移工
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const customerId = params.get("customerId");
    const workerId = params.get("workerId");
    if (customerId || workerId) {
      setPrefilledCustomerId(customerId ? Number(customerId) : null);
      setPrefilledWorkerId(workerId ? Number(workerId) : null);
      setEditingCase(null);
      setShowModal(true);
      // 清除 URL 參數，避免重複觸發
      navigate("/cases", { replace: true });
    }
  }, [searchParams]);

  // Debounce search input: 延遲 300ms 再觸發 API 請求
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const utils = trpc.useUtils();
  const { data: cases = [], isLoading } = trpc.cases.list.useQuery({
    status: statusFilter !== "all" ? statusFilter : undefined,
    managerId: managerFilter !== "all" ? Number(managerFilter) : undefined,
    search: debouncedSearch || undefined,
  });
  const { data: managers = [] } = trpc.managers.list.useQuery();
  const deleteMutation = trpc.cases.delete.useMutation({
    onSuccess: () => {
      toast.success("案件已刪除");
      utils.cases.list.invalidate();
      setDeletingCase(null);
    },
    onError: (e) => toast.error(e.message),
  });

  // 統計卡
  const total = cases.length;
  const inProgress = cases.filter(c => c.status === "in_progress").length;
  const completed = cases.filter(c => c.status === "completed").length;
  const paused = cases.filter(c => c.status === "paused").length;
  const cancelled = cases.filter(c => c.status === "cancelled").length;

  const statCards = [
    { label: "案件總數", value: total, icon: <Briefcase className="w-4 h-4" />, accent: false },
    { label: "進行中", value: inProgress, icon: <ArrowRight className="w-4 h-4" />, accent: inProgress > 0 },
    { label: "已完成", value: completed, icon: <CheckCircle2 className="w-4 h-4" />, accent: false },
    { label: "暫停", value: paused, icon: <PauseCircle className="w-4 h-4" />, accent: paused > 0 },
    { label: "取消", value: cancelled, icon: <XCircle className="w-4 h-4" />, accent: false },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* 頁首 */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">案件管理</h1>
          <p className="text-sm text-muted-foreground mt-0.5">管理所有媒合案件與進度</p>
        </div>
        <Button onClick={() => { setEditingCase(null); setShowModal(true); }} className="gap-2">
          <Plus className="w-4 h-4" />新增案件
        </Button>
      </div>

      {/* 統計卡 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {statCards.map(card => (
          <div key={card.label} className="rounded-lg border bg-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{card.label}</span>
              <span className={card.accent ? "text-amber-500" : "text-muted-foreground"}>{card.icon}</span>
            </div>
            <p className={`text-2xl font-bold tabular-nums ${card.accent ? "text-amber-500" : "text-foreground"}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* 篩選列 */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜尋案件名稱、客戶名稱..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={managerFilter} onValueChange={setManagerFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="全部負責人" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部負責人</SelectItem>
            {managers.map(m => (
              <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="全部狀態" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部狀態</SelectItem>
            {CASE_MGMT_STATUS_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 列表 */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">案件編號</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">案件名稱</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">客戶</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">負責人</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">狀態</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">資格</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">需求</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">配對</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">操作</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b">
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="px-4 py-4"><Skeleton className="h-4 w-full" /></td>
                  ))}
                </tr>
              ))
            ) : cases.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                  尚無案件資料
                </td>
              </tr>
            ) : (
              cases.map(c => (
                <tr
                  key={c.id}
                  className="border-b hover:bg-muted/20 cursor-pointer transition-colors"
                  onClick={() => navigate(`/cases/${c.id}`)}
                >
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs text-muted-foreground">{(c as any).caseNo || "—"}</span>
                      {(c as any).needsReview === 1 && (
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-destructive/15 text-destructive" title="需檢查">
                          <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 font-medium">{c.name}</td>
                  <td className="px-4 py-4 text-muted-foreground">{c.customerName}</td>
                  <td className="px-4 py-4 text-muted-foreground">{c.managerName}</td>
                  <td className="px-4 py-4"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-4">
                    <span className="tabular-nums text-muted-foreground">{(c as any).qualCount ?? 0}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="tabular-nums text-muted-foreground">{(c as any).demandCount ?? 0}</span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1.5">
                      <span className="tabular-nums text-muted-foreground">{(c as any).memberCount ?? 0}</span>
                      {(c as any).employedCount > 0 && (
                        <Badge variant="outline" className="text-xs px-1.5 py-0 text-green-600 border-green-200">
                          {(c as any).employedCount} 在職
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => { setEditingCase(c); setShowModal(true); }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeletingCase(c)}
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

      {/* Modal */}
      {showModal && (
        <CaseModal
          open={showModal}
          onClose={() => {
            setShowModal(false);
            setEditingCase(null);
            setPrefilledCustomerId(null);
            setPrefilledWorkerId(null);
          }}
          editingCase={editingCase}
          defaultCustomerId={prefilledCustomerId ?? undefined}
          defaultWorkerId={prefilledWorkerId ?? undefined}
        />
      )}

      {/* 刪除確認 */}
      <AlertDialog open={!!deletingCase} onOpenChange={open => !open && setDeletingCase(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除案件</AlertDialogTitle>
            <AlertDialogDescription>
              即將刪除「{deletingCase?.name}」，此操作無法復原，相關資格、需求、配對資料也將一併刪除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate({ id: deletingCase.id })}
            >
              確認刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
