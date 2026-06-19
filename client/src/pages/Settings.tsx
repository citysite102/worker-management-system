import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Trash2, Users } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Settings() {
  const [newName, setNewName] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteName, setDeleteName] = useState("");

  const utils = trpc.useUtils();
  const { data: managers = [], isLoading } = trpc.managers.list.useQuery();

  const createMutation = trpc.managers.create.useMutation({
    onSuccess: () => {
      utils.managers.list.invalidate();
      toast.success("負責人已新增");
      setNewName("");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.managers.delete.useMutation({
    onSuccess: () => {
      utils.managers.list.invalidate();
      toast.success("負責人已刪除");
      setDeleteId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) { toast.error("請輸入負責人名稱"); return; }
    if (name.length > 50) { toast.error("名稱最多 50 字"); return; }
    createMutation.mutate({ name });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleAdd();
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      {/* 頁面標題 */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">設定</h1>
        <p className="text-sm text-muted-foreground mt-0.5">管理系統設定與負責人清單</p>
      </div>

      {/* 負責人管理 */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-medium text-foreground">負責人清單</h2>
          <span className="ml-auto text-xs text-muted-foreground">{managers.length} 位</span>
        </div>

        {/* 新增輸入 */}
        <div className="p-4 border-b border-border">
          <div className="flex gap-2">
            <Input
              placeholder="輸入負責人姓名"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={50}
              className="flex-1"
            />
            <Button
              onClick={handleAdd}
              disabled={createMutation.isPending || !newName.trim()}
              size="sm"
              className="gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" />
              新增
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">按 Enter 或點擊「新增」以加入負責人</p>
        </div>

        {/* 清單 */}
        <div className="divide-y divide-border">
          {isLoading ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">載入中...</div>
          ) : managers.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">尚無負責人，請新增</div>
          ) : (
            managers.map(m => (
              <div key={m.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-foreground">{m.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => { setDeleteId(m.id); setDeleteName(m.name); }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 刪除確認 */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除負責人</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除負責人「{deleteName}」嗎？此操作無法復原。
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
