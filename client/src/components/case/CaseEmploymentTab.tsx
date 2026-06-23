import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, CalendarDays } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { getStatusLabel } from "@/lib/constants";

const EMPLOYMENT_STATUS_OPTIONS = [
  { value: "pending", label: "待確認" },
  { value: "active", label: "在職" },
  { value: "terminated", label: "已終止" },
  { value: "expired", label: "合約到期" },
];

interface Props { caseId: number; }

const EMPTY_FORM = {
  workerId: 0, qualificationId: undefined as number | undefined,
  contractStart: "", contractEnd: "", position: "",
  status: "active" as "active" | "terminated" | "expired" | "pending",
  terminationReason: "", notes: "",
};

export default function CaseEmploymentTab({ caseId }: Props) {
  const utils = trpc.useUtils();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const { data: employments = [], isLoading } = trpc.caseEmployments.listByCase.useQuery({ caseId });
  // 延遲載入：資格和配對資料只有 modal 開啟時才需要
  const { data: quals = [] } = trpc.caseQualifications.listByCase.useQuery({ caseId }, { enabled: showModal });
  const { data: assignments = [] } = trpc.caseAssignments.listByCase.useQuery({ caseId }, { enabled: showModal });

  // 從配對中取得所有已配對移工（去重）
  const assignedWorkers = Array.from(
    new Map(
      assignments.flatMap(a => (a.members ?? []).map((m: any) => [m.workerId, { id: m.workerId, name: m.workerName, nameEn: m.workerNameEn }]))
    ).values()
  );

  const createMutation = trpc.caseEmployments.create.useMutation({
    onSuccess: () => { toast.success("聘僱記錄已建立"); utils.caseEmployments.listByCase.invalidate({ caseId }); utils.cases.getById.invalidate({ id: caseId }); closeModal(); },
    onError: e => toast.error(e.message),
  });
  const updateMutation = trpc.caseEmployments.update.useMutation({
    onSuccess: () => { toast.success("聘僱記錄已更新"); utils.caseEmployments.listByCase.invalidate({ caseId }); closeModal(); },
    onError: e => toast.error(e.message),
  });
  const deleteMutation = trpc.caseEmployments.delete.useMutation({
    onSuccess: () => { toast.success("聘僱記錄已刪除"); utils.caseEmployments.listByCase.invalidate({ caseId }); utils.cases.getById.invalidate({ id: caseId }); setDeleting(null); },
    onError: e => toast.error(e.message),
  });

  const openAdd = () => { setEditing(null); setForm({ ...EMPTY_FORM }); setShowModal(true); };
  const openEdit = (e: any) => {
    setEditing(e);
    setForm({
      workerId: e.workerId, qualificationId: e.qualificationId ?? undefined,
      contractStart: e.contractStart ?? "", contractEnd: e.contractEnd ?? "",
      position: e.position ?? "", status: e.status,
      terminationReason: e.terminationReason ?? "", notes: e.notes ?? "",
    });
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditing(null); };

  const setField = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = () => {
    if (!form.workerId) return toast.error("請選擇移工");
    if (editing) {
      updateMutation.mutate({ id: editing.id, ...form });
    } else {
      createMutation.mutate({ caseId, ...form });
    }
  };

  // 計算合約剩餘天數
  const daysRemaining = (end: string | null) => {
    if (!end) return null;
    const diff = Math.ceil((new Date(end).getTime() - Date.now()) / 86400000);
    return diff;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">管理此案件的正式聘僱合約與在職狀態</p>
        <Button size="sm" className="gap-1.5" onClick={openAdd}>
          <Plus className="w-3.5 h-3.5" />新增聘僱
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : employments.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground text-sm">
          尚無聘僱記錄，點擊「新增聘僱」開始建立
        </div>
      ) : (
        <div className="space-y-3">
          {employments.map(e => {
            const days = daysRemaining(e.contractEnd);
            const isExpiringSoon = days !== null && days >= 0 && days <= 30;
            const isExpired = days !== null && days < 0;
            return (
              <div key={e.id} className="rounded-lg border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{e.workerName}</span>
                      {e.workerNameEn && <span className="text-xs text-muted-foreground">{e.workerNameEn}</span>}
                      <StatusBadge status={e.status} />
                      {e.position && <span className="text-xs text-muted-foreground">· {e.position}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      {e.contractStart && (
                        <div className="flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          <span>{e.contractStart} → {e.contractEnd ?? "未定"}</span>
                        </div>
                      )}
                      {days !== null && (
                        <span className={isExpired ? "text-red-500 font-medium" : isExpiringSoon ? "text-amber-500 font-medium" : ""}>
                          {isExpired ? `合約已過期 ${Math.abs(days)} 天` : `合約剩餘 ${days} 天`}
                        </span>
                      )}
                    </div>
                    {e.qualificationLabel && (
                      <p className="text-xs text-muted-foreground mt-1">資格：{e.qualificationLabel}</p>
                    )}
                    {e.terminationReason && (
                      <p className="text-xs text-muted-foreground mt-1">終止原因：{e.terminationReason}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(e)}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleting(e)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <Dialog open={showModal} onOpenChange={v => !v && closeModal()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "編輯聘僱記錄" : "新增聘僱記錄"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>移工 <span className="text-destructive">*</span></Label>
              <Select
                value={form.workerId ? String(form.workerId) : ""}
                onValueChange={v => setField("workerId", Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇移工（從配對人員中選取）" />
                </SelectTrigger>
                <SelectContent>
                  {assignedWorkers.length === 0 ? (
                    <SelectItem value="__empty__" disabled>請先在媒合管理中加入配對人員</SelectItem>
                  ) : assignedWorkers.map(w => (
                    <SelectItem key={w.id} value={String(w.id)}>
                      {w.name}{w.nameEn ? ` (${w.nameEn})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>關聯資格（選填）</Label>
              <Select
                value={form.qualificationId ? String(form.qualificationId) : "__none__"}
                onValueChange={v => setField("qualificationId", v === "__none__" ? undefined : Number(v))}
              >
                <SelectTrigger><SelectValue placeholder="不指定資格" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">不指定資格</SelectItem>
                  {quals.map(q => <SelectItem key={q.id} value={String(q.id)}>{q.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>職位</Label>
              <Input value={form.position} onChange={e => setField("position", e.target.value)} placeholder="例：製造業作業員" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>合約起始日</Label>
                <Input type="date" value={form.contractStart} onChange={e => setField("contractStart", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>合約結束日</Label>
                <Input type="date" value={form.contractEnd} onChange={e => setField("contractEnd", e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>聘僱狀態</Label>
              <Select value={form.status} onValueChange={v => setField("status", v as typeof form.status)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT_STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {(form.status === "terminated") && (
              <div className="space-y-1.5">
                <Label>終止原因</Label>
                <Input value={form.terminationReason} onChange={e => setField("terminationReason", e.target.value)} placeholder="填寫終止原因" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>備註</Label>
              <Textarea value={form.notes} onChange={e => setField("notes", e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>取消</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editing ? "儲存變更" : "建立記錄"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 刪除確認 */}
      <AlertDialog open={!!deleting} onOpenChange={open => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除聘僱記錄</AlertDialogTitle>
            <AlertDialogDescription>即將刪除「{deleting?.workerName}」的聘僱記錄，此操作無法復原。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteMutation.mutate({ id: deleting.id })}>
              確認刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
