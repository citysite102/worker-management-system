import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { WorkerModal } from "@/components/WorkerModal";
import { getStatusLabel } from "@/lib/constants";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, Users, Briefcase, FileWarning, UserSearch } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Workers() {
  const [search, setSearch] = useState("");
  const [managerFilter, setManagerFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

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
      const matchSearch = !search || w.name.toLowerCase().includes(search.toLowerCase());
      const matchManager = managerFilter === "all" || String(w.managerId) === managerFilter;
      return matchSearch && matchManager;
    });
  }, [workers, search, managerFilter]);

  // 統計卡
  const stats = useMemo(() => ({
    total: workers.length,
    employed: workers.filter(w => w.lifecycleStatus === "employed").length,
    pendingSupplement: workers.filter(w => w.documentStatus === "pending_supplement").length,
    recruiting: workers.filter(w => w.lifecycleStatus === "recruiting").length,
  }), [workers]);

  const openEdit = (id: number) => { setEditId(id); setModalOpen(true); };
  const openCreate = () => { setEditId(null); setModalOpen(true); };

  return (
    <div className="p-6 space-y-6">
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

      {/* 統計卡 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "移工總數", value: stats.total, icon: Users, color: "text-foreground" },
          { label: "在職中", value: stats.employed, icon: Briefcase, color: "text-green-600" },
          { label: "文件待補", value: stats.pendingSupplement, icon: FileWarning, color: "text-red-500" },
          { label: "招募中", value: stats.recruiting, icon: UserSearch, color: "text-amber-500" },
        ].map(card => (
          <div key={card.label} className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">{card.label}</span>
              <card.icon className={`w-4 h-4 ${card.color}`} />
            </div>
            <p className={`text-2xl font-semibold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* 搜尋與篩選 */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜尋姓名..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={managerFilter} onValueChange={setManagerFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="負責人篩選" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部負責人</SelectItem>
            {managers.map(m => (
              <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 資料表格 */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full data-table">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left">姓名</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">國籍</th>
                <th className="px-4 py-3 text-left">證號</th>
                <th className="px-4 py-3 text-left">生命週期</th>
                <th className="px-4 py-3 text-left hidden sm:table-cell">文件狀態</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">負責人</th>
                <th className="px-4 py-3 text-left hidden xl:table-cell">入境日期</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground text-sm">載入中...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground text-sm">
                    {search || managerFilter !== "all" ? "沒有符合條件的資料" : "尚無移工資料，點擊「新增移工」開始建立"}
                  </td>
                </tr>
              ) : (
                filtered.map(w => (
                  <tr key={w.id} className="transition-colors">
                    <td className="px-4 py-3 font-medium">{w.name}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{w.nationality || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-muted-foreground mr-1">{getStatusLabel(w.idType)}</span>
                      <span className="font-mono text-sm">{w.idNumber}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={w.lifecycleStatus} />
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <StatusBadge status={w.documentStatus} />
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                      {managerMap[w.managerId] || "—"}
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell text-muted-foreground text-sm">
                      {w.entryDate || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                          onClick={() => openEdit(w.id)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteId(w.id)}
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
        {filtered.length > 0 && (
          <div className="px-4 py-2.5 bg-muted/30 border-t border-border">
            <p className="text-xs text-muted-foreground">共 {filtered.length} 筆{workers.length !== filtered.length ? `（篩選自 ${workers.length} 筆）` : ""}</p>
          </div>
        )}
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
