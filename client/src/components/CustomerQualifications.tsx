import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, FileText, Image as ImageIcon, Home, Building2, Link2 } from "lucide-react";
import { AttachmentPreviewModal } from "@/components/AttachmentPreviewModal";
import { toast } from "sonner";

// ─── 常數 ─────────────────────────────────────────────────────────────────────
const QUALIFIER_CATEGORY_OPTIONS = [
  { value: "family", label: "家庭類雇主", icon: Home },
  { value: "business", label: "事業類雇主", icon: Building2 },
];
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

const JOB_SEEKER_LABEL: Record<string, string> = Object.fromEntries(JOB_SEEKER_TYPE_OPTIONS.map(o => [o.value, o.label]));
const RECRUITMENT_LABEL: Record<string, string> = Object.fromEntries(RECRUITMENT_LETTER_TYPE_OPTIONS.map(o => [o.value, o.label]));
const EMPLOYMENT_LABEL: Record<string, string> = Object.fromEntries(EMPLOYMENT_LETTER_TYPE_OPTIONS.map(o => [o.value, o.label]));

// ─── 型別 ─────────────────────────────────────────────────────────────────────
type Qualification = {
  id: number;
  customerId: number;
  qualifierCategory?: string | null;
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

type FormState = Omit<Qualification, "id" | "customerId"> & {
  qualifierCategory: "family" | "business";
};

const EMPTY_FORM: FormState = {
  qualifierCategory: "family",
  careReceiverId: null, caseId: null, label: "",
  caseNo: "", caseStatus: null, managerId: null,
  jobSeekerType: null, jobSeekerDate: "", jobSeekerFileKey: "",
  recruitmentLetterType: null, recruitmentLetterDate: "", recruitmentLetterFileKey: "",
  recruitmentPermitNote: "", recruitmentPermitDays: null, previousWorkerDepartureDate: "",
  employmentLetterType: null, employmentLetterDate: "", employmentLetterFileKey: "",
  approvedStartDate: "", approvedPeriod: "", approvedEndDate: "", notes: "",
};

// ─── 子元件 ───────────────────────────────────────────────────────────────────
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

function CategoryBadge({ category }: { category?: string | null }) {
  if (category === "family") return (
    <Badge variant="secondary" className="text-xs gap-1 shrink-0">
      <Home className="w-3 h-3" />家庭類
    </Badge>
  );
  if (category === "business") return (
    <Badge variant="outline" className="text-xs gap-1 shrink-0 border-blue-400/60 text-blue-600 dark:text-blue-400">
      <Building2 className="w-3 h-3" />事業類
    </Badge>
  );
  return null;
}

// ─── 主元件 ───────────────────────────────────────────────────────────────────
interface Props {
  customerId: number;
  isPersonal: boolean;
}

export function CustomerQualifications({ customerId, isPersonal }: Props) {
  const utils = trpc.useUtils();
  const { data: items = [], isLoading } = trpc.customers.qualifications.listByCustomer.useQuery({ customerId });
  const { data: managers = [] } = trpc.managers.list.useQuery();
  const { data: careReceivers = [] } = trpc.customers.careReceivers.listByCustomer.useQuery({ customerId });
  const { data: cases = [] } = trpc.cases.list.useQuery({ customerId });

  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Qualification | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const createMutation = trpc.customers.qualifications.create.useMutation({
    onSuccess: () => {
      utils.customers.qualifications.listByCustomer.invalidate({ customerId });
      setShowModal(false);
      toast.success("申請資格已新增");
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.customers.qualifications.update.useMutation({
    onSuccess: () => {
      utils.customers.qualifications.listByCustomer.invalidate({ customerId });
      setShowModal(false);
      toast.success("申請資格已更新");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.customers.qualifications.delete.useMutation({
    onSuccess: () => {
      utils.customers.qualifications.listByCustomer.invalidate({ customerId });
      setDeleteConfirmId(null);
      toast.success("申請資格已刪除");
    },
    onError: (e) => toast.error(e.message),
  });

  function openCreate() {
    setEditItem(null);
    setForm({ ...EMPTY_FORM, qualifierCategory: isPersonal ? "family" : "business" });
    setShowModal(true);
  }
  function openEdit(item: Qualification) {
    setEditItem(item);
    setForm({
      qualifierCategory: (item.qualifierCategory as "family" | "business") ?? (isPersonal ? "family" : "business"),
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
      qualifierCategory: form.qualifierCategory,
      careReceiverId: form.qualifierCategory === "family" ? (form.careReceiverId ?? null) : null,
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
  const careReceiverMap = Object.fromEntries((careReceivers as any[]).map((cr: any) => [cr.id, cr.careReceiverName || `被照顧者 #${cr.id}`]));
  const caseMap = Object.fromEntries((cases as any[]).map((c: any) => [c.id, `${c.caseNo || ""} ${c.name || ""}`.trim()]));

  // 依類別分組
  const familyItems = (items as Qualification[]).filter(i => !i.qualifierCategory || i.qualifierCategory === "family");
  const businessItems = (items as Qualification[]).filter(i => i.qualifierCategory === "business");

  function renderQualCard(item: Qualification) {
    const isExpanded = expandedId === item.id;
    const title = item.label || (item.qualifierCategory === "family" ? "家庭類申請" : "事業類申請");
    const hasAttachments = item.jobSeekerFileKey || item.recruitmentLetterFileKey || item.employmentLetterFileKey;
    const linkedCaseName = item.caseId ? caseMap[item.caseId] : null;
    const linkedCareReceiver = item.careReceiverId ? careReceiverMap[item.careReceiverId] : null;

    return (
      <div key={item.id} className="rounded-lg border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <button type="button"
            className="flex items-center gap-2 flex-1 text-left group min-w-0"
            onClick={() => setExpandedId(isExpanded ? null : item.id)}>
            <span className="text-sm font-medium group-hover:underline truncate">{title}</span>
            {/* 被照顧者（家庭類） */}
            {linkedCareReceiver && (
              <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">· {linkedCareReceiver}</span>
            )}
            {/* 連結案件 */}
            {linkedCaseName && (
              <span className="flex items-center gap-1 text-xs text-blue-500 shrink-0 hidden sm:inline-flex">
                <Link2 className="w-3 h-3" />{linkedCaseName}
              </span>
            )}
            {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground ml-auto shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto shrink-0" />}
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

        {/* 展開詳情 */}
        {isExpanded && (
          <div className="px-4 pb-4 border-t border-border/50">
            {/* 家庭類：被照顧者 */}
            {item.qualifierCategory === "family" && linkedCareReceiver && (
              <div className="mt-4 rounded-md bg-muted/40 border border-border/50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">被照顧者</p>
                <span className="text-sm font-medium">{linkedCareReceiver}</span>
              </div>
            )}
            {/* 連結案件 */}
            {linkedCaseName && (
              <div className="mt-4 rounded-md bg-blue-500/5 border border-blue-400/30 p-3 flex items-center gap-2">
                <Link2 className="w-4 h-4 text-blue-500 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">連結案件</p>
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400">{linkedCaseName}</p>
                </div>
              </div>
            )}
            {/* 申請資格 */}
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-4 mb-3">申請資格</p>
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
            {item.notes && <div className="mt-4"><InfoRow label="備註" value={item.notes} /></div>}
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
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">申請資格</h3>
        <button onClick={openCreate}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors px-2 py-1 rounded-md hover:bg-primary/10">
          <Plus className="w-3.5 h-3.5" />新增資格
        </button>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">載入中…</div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          <p>尚無申請資格</p>
          <p className="text-xs mt-1">點擊「新增資格」建立家庭類或事業類雇主資格</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 家庭類雇主 */}
          {familyItems.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CategoryBadge category="family" />
                <span className="text-xs text-muted-foreground">({familyItems.length})</span>
              </div>
              <div className="space-y-2">{familyItems.map(renderQualCard)}</div>
            </div>
          )}
          {/* 事業類雇主 */}
          {businessItems.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CategoryBadge category="business" />
                <span className="text-xs text-muted-foreground">({businessItems.length})</span>
              </div>
              <div className="space-y-2">{businessItems.map(renderQualCard)}</div>
            </div>
          )}
        </div>
      )}

      {/* 新增 / 編輯 Modal */}
      <Dialog open={showModal} onOpenChange={(v) => { if (!v) setShowModal(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editItem ? "編輯申請資格" : "新增申請資格"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">

            {/* 資格類別選擇 */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">資格類別 <span className="text-destructive">*</span></Label>
              <div className="grid grid-cols-2 gap-3">
                {QUALIFIER_CATEGORY_OPTIONS.map(opt => {
                  const Icon = opt.icon;
                  const isSelected = form.qualifierCategory === opt.value;
                  return (
                    <button key={opt.value} type="button"
                      onClick={() => setForm(f => ({
                        ...f,
                        qualifierCategory: opt.value as "family" | "business",
                        careReceiverId: opt.value === "business" ? null : f.careReceiverId,
                      }))}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                        isSelected
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border hover:border-border/80 hover:bg-muted/40"
                      }`}>
                      <Icon className="w-5 h-5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{opt.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {opt.value === "family" ? "一對一，可連結被照顧者" : "可一對多移工"}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 家庭類：被照顧者選擇 */}
            {form.qualifierCategory === "family" && (
              <div className="space-y-1.5">
                <Label>被照顧者（選填）</Label>
                {(careReceivers as any[]).length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2 px-3 rounded-md bg-muted/40 border border-dashed">
                    此客戶尚未建立被照顧者資料，請先在「被照顧者」區塊新增
                  </p>
                ) : (
                  <Select
                    value={form.careReceiverId?.toString() ?? "__none__"}
                    onValueChange={v => setForm(f => ({ ...f, careReceiverId: v === "__none__" ? null : Number(v) }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="選擇被照顧者（選填）" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— 不指定 —</SelectItem>
                      {(careReceivers as any[]).map((cr: any) => (
                        <SelectItem key={cr.id} value={cr.id.toString()}>
                          {cr.careReceiverName || `被照顧者 #${cr.id}`}
                          {cr.careReceiverRelation ? ` · ${cr.careReceiverRelation}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {/* 連結案件（選填） */}
            <div className="space-y-1.5">
              <Label>連結案件（選填）</Label>
              {(cases as any[]).length === 0 ? (
                <p className="text-xs text-muted-foreground py-2 px-3 rounded-md bg-muted/40 border border-dashed">
                  此客戶尚未建立案件，資格建立後可再連結
                </p>
              ) : (
                <Select
                  value={form.caseId?.toString() ?? "__none__"}
                  onValueChange={v => setForm(f => ({ ...f, caseId: v === "__none__" ? null : Number(v) }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="選擇連結案件（選填）" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— 不連結 —</SelectItem>
                    {(cases as any[]).map((c: any) => (
                      <SelectItem key={c.id} value={c.id.toString()}>
                        {c.caseNo ? `${c.caseNo} ` : ""}{c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* 資格標籤 */}
            <div className="space-y-1.5">
              <Label>資格標籤（選填，方便辨識）</Label>
              <Input value={form.label ?? ""} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder={form.qualifierCategory === "family" ? "例：照顧母親申請" : "例：建築工人申請"} />
            </div>

            {/* 申請資格 */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">申請資格文件</p>
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
