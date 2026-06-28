import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, FileText, Image as ImageIcon } from "lucide-react";
import { AttachmentPreviewModal } from "@/components/AttachmentPreviewModal";
import { StatusBadge } from "@/components/StatusBadge";
import { getStatusLabel } from "@/lib/constants";
import { toast } from "sonner";

const JOB_SEEKER_TYPE_OPTIONS = [
  { value: "new_hire", label: "新聘" },
  { value: "renewal", label: "續聘" },
  { value: "transfer", label: "轉換雇主" },
  { value: "supplement", label: "補件" },
];
const RECRUITMENT_LETTER_TYPE_OPTIONS = [
  { value: "domestic", label: "國內招募" },
  { value: "overseas", label: "國外招募" },
  { value: "both", label: "國內外" },
];
const EMPLOYMENT_LETTER_TYPE_OPTIONS = [
  { value: "initial", label: "初次聘僱" },
  { value: "renewal", label: "續聘" },
  { value: "transfer", label: "轉換" },
];
const CASE_STATUS_OPTIONS = [
  { value: "pending", label: "待處理" },
  { value: "processing", label: "處理中" },
  { value: "matched", label: "已媒合" },
  { value: "completed", label: "已完成" },
  { value: "cancelled", label: "已取消" },
];

const JOB_SEEKER_LABEL: Record<string, string> = Object.fromEntries(JOB_SEEKER_TYPE_OPTIONS.map(o => [o.value, o.label]));
const RECRUITMENT_LABEL: Record<string, string> = Object.fromEntries(RECRUITMENT_LETTER_TYPE_OPTIONS.map(o => [o.value, o.label]));
const EMPLOYMENT_LABEL: Record<string, string> = Object.fromEntries(EMPLOYMENT_LETTER_TYPE_OPTIONS.map(o => [o.value, o.label]));

type Qualification = {
  id: number;
  customerId: number;
  careReceiverId?: number | null;
  caseId?: number | null;
  label?: string | null;
  caseNo?: string | null;
  caseStatus?: string | null;
  managerId?: number | null;
  jobSeekerType?: string | null;
  jobSeekerDate?: string | null;
  jobSeekerFileKey?: string | null;
  recruitmentLetterType?: string | null;
  recruitmentLetterDate?: string | null;
  recruitmentLetterFileKey?: string | null;
  recruitmentPermitNote?: string | null;
  recruitmentPermitDays?: number | null;
  previousWorkerDepartureDate?: string | null;
  employmentLetterType?: string | null;
  employmentLetterDate?: string | null;
  employmentLetterFileKey?: string | null;
  approvedStartDate?: string | null;
  approvedPeriod?: string | null;
  approvedEndDate?: string | null;
  notes?: string | null;
};

type FormState = Omit<Qualification, "id" | "customerId">;

const EMPTY_FORM: FormState = {
  careReceiverId: null, caseId: null, label: "",
  caseNo: "", caseStatus: null, managerId: null,
  jobSeekerType: null, jobSeekerDate: "", jobSeekerFileKey: "",
  recruitmentLetterType: null, recruitmentLetterDate: "", recruitmentLetterFileKey: "",
  recruitmentPermitNote: "", recruitmentPermitDays: null, previousWorkerDepartureDate: "",
  employmentLetterType: null, employmentLetterDate: "", employmentLetterFileKey: "",
  approvedStartDate: "", approvedPeriod: "", approvedEndDate: "", notes: "",
};

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

function AttachmentBtn({ label, fileKey }: { label: string; fileKey?: string | null }) {
  const [open, setOpen] = useState(false);
  if (!fileKey) return null;
  const ext = fileKey.split(".").pop()?.toLowerCase() ?? "";
  const isPdf = ext === "pdf";
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-md border bg-muted/30 hover:bg-muted/60 transition-colors text-sm w-full text-left">
        {isPdf ? <FileText className="w-4 h-4 text-muted-foreground shrink-0" /> : <ImageIcon className="w-4 h-4 text-muted-foreground shrink-0" />}
        <span className="truncate flex-1">{label}</span>
        <span className="text-xs text-muted-foreground shrink-0">點擊預覽</span>
      </button>
      <AttachmentPreviewModal open={open} onClose={() => setOpen(false)} label={label} fileKey={fileKey} />
    </>
  );
}

interface Props {
  customerId: number;
  isPersonal: boolean;
}

export function CustomerQualifications({ customerId, isPersonal }: Props) {
  const utils = trpc.useUtils();
  const { data: items = [], isLoading } = trpc.customers.qualifications.listByCustomer.useQuery({ customerId });
  const { data: managers = [] } = trpc.managers.list.useQuery();

  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Qualification | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const createMutation = trpc.customers.qualifications.create.useMutation({
    onSuccess: () => { utils.customers.qualifications.listByCustomer.invalidate({ customerId }); setShowModal(false); toast.success("申請資格已新增"); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.customers.qualifications.update.useMutation({
    onSuccess: () => { utils.customers.qualifications.listByCustomer.invalidate({ customerId }); setShowModal(false); toast.success("申請資格已更新"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.customers.qualifications.delete.useMutation({
    onSuccess: () => { utils.customers.qualifications.listByCustomer.invalidate({ customerId }); setDeleteConfirmId(null); toast.success("申請資格已刪除"); },
    onError: (e) => toast.error(e.message),
  });

  function openCreate() { setEditItem(null); setForm(EMPTY_FORM); setShowModal(true); }
  function openEdit(item: Qualification) {
    setEditItem(item);
    setForm({
      careReceiverId: item.careReceiverId ?? null,
      caseId: item.caseId ?? null,
      label: item.label ?? "",
      caseNo: item.caseNo ?? "",
      caseStatus: item.caseStatus ?? null,
      managerId: item.managerId ?? null,
      jobSeekerType: item.jobSeekerType ?? null,
      jobSeekerDate: item.jobSeekerDate ?? "",
      jobSeekerFileKey: item.jobSeekerFileKey ?? "",
      recruitmentLetterType: item.recruitmentLetterType ?? null,
      recruitmentLetterDate: item.recruitmentLetterDate ?? "",
      recruitmentLetterFileKey: item.recruitmentLetterFileKey ?? "",
      recruitmentPermitNote: item.recruitmentPermitNote ?? "",
      recruitmentPermitDays: item.recruitmentPermitDays ?? null,
      previousWorkerDepartureDate: item.previousWorkerDepartureDate ?? "",
      employmentLetterType: item.employmentLetterType ?? null,
      employmentLetterDate: item.employmentLetterDate ?? "",
      employmentLetterFileKey: item.employmentLetterFileKey ?? "",
      approvedStartDate: item.approvedStartDate ?? "",
      approvedPeriod: item.approvedPeriod ?? "",
      approvedEndDate: item.approvedEndDate ?? "",
      notes: item.notes ?? "",
    });
    setShowModal(true);
  }

  function handleSave() {
    const payload = {
      careReceiverId: form.careReceiverId ?? null,
      caseId: form.caseId ?? null,
      label: form.label || null,
      caseNo: form.caseNo || null,
      caseStatus: (form.caseStatus as any) || null,
      managerId: form.managerId ?? null,
      jobSeekerType: (form.jobSeekerType as any) || null,
      jobSeekerDate: form.jobSeekerDate || null,
      jobSeekerFileKey: form.jobSeekerFileKey || null,
      recruitmentLetterType: (form.recruitmentLetterType as any) || null,
      recruitmentLetterDate: form.recruitmentLetterDate || null,
      recruitmentLetterFileKey: form.recruitmentLetterFileKey || null,
      recruitmentPermitNote: form.recruitmentPermitNote || null,
      recruitmentPermitDays: form.recruitmentPermitDays ?? null,
      previousWorkerDepartureDate: form.previousWorkerDepartureDate || null,
      employmentLetterType: (form.employmentLetterType as any) || null,
      employmentLetterDate: form.employmentLetterDate || null,
      employmentLetterFileKey: form.employmentLetterFileKey || null,
      approvedStartDate: form.approvedStartDate || null,
      approvedPeriod: form.approvedPeriod || null,
      approvedEndDate: form.approvedEndDate || null,
      notes: form.notes || null,
    };
    if (editItem) {
      updateMutation.mutate({ id: editItem.id, ...payload });
    } else {
      createMutation.mutate({ customerId, ...payload });
    }
  }

  const isBusy = createMutation.isPending || updateMutation.isPending;
  const managerMap = Object.fromEntries((managers as any[]).map((m: any) => [m.id, m.name]));

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">申請資格</h3>
        <button onClick={openCreate}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors px-2 py-1 rounded-md hover:bg-primary/10">
          <Plus className="w-3.5 h-3.5" />新增申請資格
        </button>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">載入中…</div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">尚無申請資格</div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const isExpanded = expandedId === item.id;
            const title = item.label || item.caseNo || `資格 #${item.id}`;
            const hasAttachments = item.jobSeekerFileKey || item.recruitmentLetterFileKey || item.employmentLetterFileKey;
            return (
              <div key={item.id} className="rounded-lg border bg-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3">
                  <button type="button"
                    className="flex items-center gap-2 flex-1 text-left group"
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}>
                    <span className="text-sm font-medium group-hover:underline">{title}</span>
                    {item.caseStatus && <StatusBadge status={item.caseStatus} />}
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground ml-auto" /> : <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto" />}
                  </button>
                  <div className="flex items-center gap-1 ml-2 shrink-0">
                    <button type="button" onClick={() => openEdit(item)}
                      className="p-1.5 rounded-md hover:bg-muted transition-colors" title="編輯">
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <button type="button" onClick={() => setDeleteConfirmId(item.id)}
                      className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors" title="刪除">
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-border/50">
                    {/* 媒合案件 */}
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-4 mb-3">媒合案件</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
                      <InfoRow label="案件編號" value={item.caseNo} />
                      <InfoRow label="管理狀態" value={item.caseStatus ? getStatusLabel(item.caseStatus) : null} />
                      <InfoRow label="管理負責人" value={item.managerId ? managerMap[item.managerId] : null} />
                    </div>
                    {/* 申請資格 */}
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-5 mb-3">申請資格</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
                      <InfoRow label="求才類別" value={item.jobSeekerType ? JOB_SEEKER_LABEL[item.jobSeekerType] : null} />
                      <InfoRow label="求才日期" value={item.jobSeekerDate} />
                      <InfoRow label="招募函類別" value={item.recruitmentLetterType ? RECRUITMENT_LABEL[item.recruitmentLetterType] : null} />
                      <InfoRow label="招募函申請日期" value={item.recruitmentLetterDate} />
                      <InfoRow label="招募許可情況說明" value={item.recruitmentPermitNote} />
                      <InfoRow label="許可天數" value={item.recruitmentPermitDays?.toString()} />
                      <InfoRow label="舊工離境日期" value={item.previousWorkerDepartureDate} />
                    </div>
                    {/* 聘僱函 */}
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-5 mb-3">聘僱函</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
                      <InfoRow label="聘僱函類別" value={item.employmentLetterType ? EMPLOYMENT_LABEL[item.employmentLetterType] : null} />
                      <InfoRow label="聘僱函申請日期" value={item.employmentLetterDate} />
                      <InfoRow label="核准聘僱起始日" value={item.approvedStartDate} />
                      <InfoRow label="核准聘僱期限" value={item.approvedPeriod} />
                      <InfoRow label="核准聘僱截止日" value={item.approvedEndDate} />
                    </div>
                    {item.notes && <InfoRow label="備註" value={item.notes} />}
                    {hasAttachments && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                        <AttachmentBtn label="求才資格檔案" fileKey={item.jobSeekerFileKey} />
                        <AttachmentBtn label="招募函許可檔案" fileKey={item.recruitmentLetterFileKey} />
                        <AttachmentBtn label="聘僱函檔案" fileKey={item.employmentLetterFileKey} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 新增 / 編輯 Modal */}
      <Dialog open={showModal} onOpenChange={(v) => { if (!v) setShowModal(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editItem ? "編輯申請資格" : "新增申請資格"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {/* 標籤 */}
            <div className="space-y-1.5">
              <Label>資格標籤（選填，方便辨識）</Label>
              <Input value={form.label ?? ""} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="例：照顧母親 / 建築工人申請" />
            </div>

            {/* 媒合案件 */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">媒合案件</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>案件編號</Label>
                  <Input value={form.caseNo ?? ""} onChange={e => setForm(f => ({ ...f, caseNo: e.target.value }))} placeholder="例：00033" />
                </div>
                <div className="space-y-1.5">
                  <Label>管理狀態</Label>
                  <Select value={form.caseStatus ?? ""} onValueChange={v => setForm(f => ({ ...f, caseStatus: v || null }))}>
                    <SelectTrigger><SelectValue placeholder="請選擇" /></SelectTrigger>
                    <SelectContent>
                      {CASE_STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>管理負責人</Label>
                  <Select value={form.managerId?.toString() ?? ""} onValueChange={v => setForm(f => ({ ...f, managerId: v ? Number(v) : null }))}>
                    <SelectTrigger><SelectValue placeholder="請選擇負責人" /></SelectTrigger>
                    <SelectContent>
                      {(managers as any[]).map((m: any) => <SelectItem key={m.id} value={m.id.toString()}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* 申請資格 */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">申請資格</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>求才類別</Label>
                  <Select value={form.jobSeekerType ?? ""} onValueChange={v => setForm(f => ({ ...f, jobSeekerType: v || null }))}>
                    <SelectTrigger><SelectValue placeholder="請選擇" /></SelectTrigger>
                    <SelectContent>
                      {JOB_SEEKER_TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>求才日期</Label>
                  <Input type="date" value={form.jobSeekerDate ?? ""} onChange={e => setForm(f => ({ ...f, jobSeekerDate: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>招募函類別</Label>
                  <Select value={form.recruitmentLetterType ?? ""} onValueChange={v => setForm(f => ({ ...f, recruitmentLetterType: v || null }))}>
                    <SelectTrigger><SelectValue placeholder="請選擇" /></SelectTrigger>
                    <SelectContent>
                      {RECRUITMENT_LETTER_TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>招募函申請日期</Label>
                  <Input type="date" value={form.recruitmentLetterDate ?? ""} onChange={e => setForm(f => ({ ...f, recruitmentLetterDate: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>許可天數</Label>
                  <Input type="number" value={form.recruitmentPermitDays?.toString() ?? ""} onChange={e => setForm(f => ({ ...f, recruitmentPermitDays: e.target.value ? Number(e.target.value) : null }))} placeholder="天數" />
                </div>
                <div className="space-y-1.5">
                  <Label>舊工離境日期</Label>
                  <Input type="date" value={form.previousWorkerDepartureDate ?? ""} onChange={e => setForm(f => ({ ...f, previousWorkerDepartureDate: e.target.value }))} />
                </div>
                <div className="col-span-2 sm:col-span-3 space-y-1.5">
                  <Label>招募許可情況說明</Label>
                  <Textarea value={form.recruitmentPermitNote ?? ""} onChange={e => setForm(f => ({ ...f, recruitmentPermitNote: e.target.value }))} rows={2} />
                </div>
              </div>
            </div>

            {/* 聘僱函 */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">聘僱函</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>聘僱函類別</Label>
                  <Select value={form.employmentLetterType ?? ""} onValueChange={v => setForm(f => ({ ...f, employmentLetterType: v || null }))}>
                    <SelectTrigger><SelectValue placeholder="請選擇" /></SelectTrigger>
                    <SelectContent>
                      {EMPLOYMENT_LETTER_TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>聘僱函申請日期</Label>
                  <Input type="date" value={form.employmentLetterDate ?? ""} onChange={e => setForm(f => ({ ...f, employmentLetterDate: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>核准聘僱起始日</Label>
                  <Input type="date" value={form.approvedStartDate ?? ""} onChange={e => setForm(f => ({ ...f, approvedStartDate: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>核准聘僱期限</Label>
                  <Input value={form.approvedPeriod ?? ""} onChange={e => setForm(f => ({ ...f, approvedPeriod: e.target.value }))} placeholder="例：3年" />
                </div>
                <div className="space-y-1.5">
                  <Label>核准聘僱截止日</Label>
                  <Input type="date" value={form.approvedEndDate ?? ""} onChange={e => setForm(f => ({ ...f, approvedEndDate: e.target.value }))} />
                </div>
              </div>
            </div>

            {/* 備註 */}
            <div className="space-y-1.5">
              <Label>備註</Label>
              <Textarea value={form.notes ?? ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)} disabled={isBusy}>取消</Button>
            <Button onClick={handleSave} disabled={isBusy}>{isBusy ? "儲存中…" : "儲存"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 刪除確認 */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={(v) => { if (!v) setDeleteConfirmId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>確認刪除</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">此操作無法復原，確定要刪除這筆申請資格嗎？</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>取消</Button>
            <Button variant="destructive" onClick={() => deleteConfirmId && deleteMutation.mutate({ id: deleteConfirmId })} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "刪除中…" : "確認刪除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
