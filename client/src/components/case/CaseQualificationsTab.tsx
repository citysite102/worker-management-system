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
import { Progress } from "@/components/ui/progress";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { getStatusLabel, QUAL_CATEGORY_OPTIONS, QUAL_TYPE_OPTIONS, APPLICATION_STATUS_OPTIONS } from "@/lib/constants";

interface Props { caseId: number; }

const EMPTY_FORM = {
  label: "", category: "labor_in" as const, qualType: "manufacturing" as const,
  employerName: "", employerTaxId: "", employerNote: "",
  applicationStatus: "preparing" as const, expectedApprovalDate: "",
  quotaTotal: 0, docValidUntil: "", notes: "",
};

export default function CaseQualificationsTab({ caseId }: Props) {
  const utils = trpc.useUtils();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const { data: quals = [], isLoading } = trpc.caseQualifications.listByCase.useQuery({ caseId });

  const createMutation = trpc.caseQualifications.create.useMutation({
    onSuccess: () => { toast.success("資格已建立"); utils.caseQualifications.listByCase.invalidate({ caseId }); utils.cases.getById.invalidate({ id: caseId }); closeModal(); },
    onError: e => toast.error(e.message),
  });
  const updateMutation = trpc.caseQualifications.update.useMutation({
    onSuccess: () => { toast.success("資格已更新"); utils.caseQualifications.listByCase.invalidate({ caseId }); closeModal(); },
    onError: e => toast.error(e.message),
  });
  const deleteMutation = trpc.caseQualifications.delete.useMutation({
    onSuccess: () => { toast.success("資格已刪除"); utils.caseQualifications.listByCase.invalidate({ caseId }); utils.cases.getById.invalidate({ id: caseId }); setDeleting(null); },
    onError: e => toast.error(e.message),
  });

  const openAdd = () => { setEditing(null); setForm({ ...EMPTY_FORM }); setShowModal(true); };
  const openEdit = (q: any) => {
    setEditing(q);
    setForm({
      label: q.label, category: q.category, qualType: q.qualType,
      employerName: q.employerName ?? "", employerTaxId: q.employerTaxId ?? "",
      employerNote: q.employerNote ?? "", applicationStatus: q.applicationStatus,
      expectedApprovalDate: q.expectedApprovalDate ?? "", quotaTotal: q.quotaTotal,
      docValidUntil: q.docValidUntil ?? "", notes: q.notes ?? "",
    });
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditing(null); };

  const handleSubmit = () => {
    if (!form.label.trim()) return toast.error("請填寫資格標籤");
    if (editing) {
      updateMutation.mutate({ id: editing.id, ...form, quotaTotal: Number(form.quotaTotal) });
    } else {
      createMutation.mutate({ caseId, ...form, quotaTotal: Number(form.quotaTotal) });
    }
  };

  const setField = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">管理此案件的勞動力引進資格申請</p>
        <Button size="sm" className="gap-1.5" onClick={openAdd}>
          <Plus className="w-3.5 h-3.5" />新增資格
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : quals.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground text-sm">
          尚無資格申請，點擊「新增資格」開始建立
        </div>
      ) : (
        <div className="space-y-3">
          {quals.map(q => (
            <div key={q.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{q.label}</span>
                    <StatusBadge status={q.applicationStatus} />
                    <span className="text-xs text-muted-foreground">{getStatusLabel(q.category)} · {getStatusLabel(q.qualType)}</span>
                  </div>
                  {q.employerName && (
                    <p className="text-xs text-muted-foreground mt-1">
                      雇主：{q.employerName}{q.employerTaxId ? `（${q.employerTaxId}）` : ""}
                    </p>
                  )}
                  <div className="mt-3 space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>名額使用 {q.quotaUsed} / {q.quotaTotal}</span>
                      <span>{q.quotaRemaining} 名額剩餘</span>
                    </div>
                    <Progress
                      value={q.quotaTotal > 0 ? Math.round((q.quotaUsed / q.quotaTotal) * 100) : 0}
                      className="h-1.5"
                    />
                  </div>
                  {q.docValidUntil && (
                    <p className="text-xs text-muted-foreground mt-1.5">文件有效至：{q.docValidUntil}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(q)}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleting(q)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <Dialog open={showModal} onOpenChange={v => !v && closeModal()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "編輯資格" : "新增資格"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>資格標籤 <span className="text-destructive">*</span></Label>
              <Input value={form.label} onChange={e => setField("label", e.target.value)} placeholder="例：製造業初次引進 2025" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>類別</Label>
                <Select value={form.category} onValueChange={v => setField("category", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{QUAL_CATEGORY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>資格類型</Label>
                <Select value={form.qualType} onValueChange={v => setField("qualType", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{QUAL_TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>雇主名稱</Label>
                <Input value={form.employerName} onChange={e => setField("employerName", e.target.value)} placeholder="雇主公司名稱" />
              </div>
              <div className="space-y-1.5">
                <Label>統一編號</Label>
                <Input value={form.employerTaxId} onChange={e => setField("employerTaxId", e.target.value)} placeholder="8 碼統編" maxLength={8} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>申請狀態</Label>
                <Select value={form.applicationStatus} onValueChange={v => setField("applicationStatus", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{APPLICATION_STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>預計核准日</Label>
                <Input type="date" value={form.expectedApprovalDate} onChange={e => setField("expectedApprovalDate", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>核准名額</Label>
                <Input type="number" min={0} value={form.quotaTotal} onChange={e => setField("quotaTotal", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>文件有效期限</Label>
                <Input type="date" value={form.docValidUntil} onChange={e => setField("docValidUntil", e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>雇主備註</Label>
              <Textarea value={form.employerNote} onChange={e => setField("employerNote", e.target.value)} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label>備註</Label>
              <Textarea value={form.notes} onChange={e => setField("notes", e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>取消</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editing ? "儲存變更" : "建立資格"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 刪除確認 */}
      <AlertDialog open={!!deleting} onOpenChange={open => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除資格</AlertDialogTitle>
            <AlertDialogDescription>即將刪除「{deleting?.label}」，此操作無法復原。</AlertDialogDescription>
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
