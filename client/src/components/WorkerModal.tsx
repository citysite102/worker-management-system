import { useEffect, useRef, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, Upload, FileText, Image as ImageIcon, Loader2, CalendarClock } from "lucide-react";
import { LIFECYCLE_STATUS_OPTIONS, DOCUMENT_STATUS_OPTIONS } from "@/lib/constants";
import { useFormEnterNav } from "@/hooks/useFormEnterNav";

// ─── 選項定義 ─────────────────────────────────────────────────────────────────
const NATIONALITY_OPTIONS = [
  { value: "印尼", label: "009 印尼" },
  { value: "越南", label: "越南" },
  { value: "菲律賓", label: "菲律賓" },
  { value: "泰國", label: "泰國" },
  { value: "其他", label: "其他" },
];

const GENDER_OPTIONS = [
  { value: "female", label: "女" },
  { value: "male", label: "男" },
  { value: "other", label: "其他" },
];

const OCCUPATION_OPTIONS = [
  { value: "caregiver_family", label: "家庭看護工" },
  { value: "caregiver_hospital", label: "機構看護工" },
  { value: "manufacturing", label: "製造業" },
  { value: "construction", label: "建築業" },
  { value: "agriculture", label: "農業" },
  { value: "fishery", label: "漁業" },
  { value: "other", label: "其他" },
];

const MEDICAL_EXAM_TYPE_OPTIONS = [
  { value: "6_month", label: "6 個月體檢" },
  { value: "annual", label: "年度體檢" },
  { value: "pre_entry", label: "入境前體檢" },
  { value: "other", label: "其他" },
];

// ─── 自動計算工具 ─────────────────────────────────────────────────────────────
function daysFromToday(dateStr: string | undefined): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function calcNextMedicalExamDate(lastDate: string | undefined): string {
  if (!lastDate) return "";
  const d = new Date(lastDate);
  if (isNaN(d.getTime())) return "";
  d.setMonth(d.getMonth() + 5);
  return d.toISOString().slice(0, 10);
}

function DaysLeftBadge({ dateStr, label }: { dateStr?: string; label: string }) {
  if (!dateStr) return null;
  const days = daysFromToday(dateStr);
  if (days === null) return null;
  const color = days < 0 ? "text-red-500" : days <= 30 ? "text-red-500" : days <= 90 ? "text-amber-500" : "text-green-600";
  const text = days < 0 ? `已過期 ${Math.abs(days)} 天` : `${days} 天後到期`;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium mt-1 ${color}`}>
      <CalendarClock className="w-3 h-3" />
      {label}：{text}
    </span>
  );
}

// ─── 檔案上傳元件 ─────────────────────────────────────────────────────────────
type AttachmentField = "photoKey" | "ktpKey" | "residentPermitFrontKey" | "residentPermitBackKey" | "passportKey" | "passportEntryKey" | "medicalReportKey";

interface FileUploadFieldProps {
  label: string;
  fieldName: AttachmentField;
  workerId: number | null;
  currentKey: string | undefined;
  onUploaded: (key: string) => void;
  accept?: string;
}

function FileUploadField({ label, fieldName, workerId, currentKey, onUploaded, accept = "image/*,application/pdf" }: FileUploadFieldProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = trpc.workers.uploadFile.useMutation();
  const isImage = accept.startsWith("image");
  const hasFile = !!currentKey;

  const handleFile = useCallback(async (file: File) => {
    if (!workerId) {
      toast.error("請先儲存移工基本資料後再上傳附件");
      return;
    }
    setUploading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      const result = await uploadMutation.mutateAsync({
        workerId,
        fieldName,
        fileName: file.name,
        fileBase64: base64,
        mimeType: file.type || "application/octet-stream",
      });
      onUploaded(result.key);
      toast.success(`${label} 上傳成功`);
    } catch (err: any) {
      toast.error(`上傳失敗：${err?.message || "未知錯誤"}`);
    } finally {
      setUploading(false);
    }
  }, [workerId, fieldName, label, uploadMutation, onUploaded]);

  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      <div
        className={`relative flex items-center gap-2 border rounded-md px-3 py-2.5 text-sm cursor-pointer hover:bg-muted/30 transition-colors ${hasFile ? "border-green-300 bg-green-50/30" : "border-border"}`}
        onClick={() => inputRef.current?.click()}
      >
        {hasFile ? (
          <>
            {isImage ? <ImageIcon className="w-4 h-4 text-green-600 shrink-0" /> : <FileText className="w-4 h-4 text-green-600 shrink-0" />}
            <span className="text-green-700 text-xs flex-1">已上傳</span>
            <span className="text-xs text-muted-foreground">點擊更換</span>
          </>
        ) : (
          <>
            <Upload className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground text-xs">點擊上傳{isImage ? "圖片" : "圖片 / PDF"}</span>
          </>
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-md">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept={accept} className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
    </div>
  );
}

// ─── 表單資料型別 ─────────────────────────────────────────────────────────────
interface WorkerFormData {
  nameEn: string;
  nameCn: string;
  birthDate: string;
  gender: string;
  nationality: string;
  birthPlace: string;
  occupation: string;
  lifecycleStatus: string;
  documentStatus: string;
  managerId: string;
  residentPermitNo: string;
  residentPermitExpiry: string;
  passportNo: string;
  passportExpiry: string;
  entryDate: string;
  phone: string;
  email: string;
  lastMedicalExamDate: string;
  nextMedicalExamType: string;
  photoKey: string;
  ktpKey: string;
  residentPermitFrontKey: string;
  residentPermitBackKey: string;
  passportKey: string;
  passportEntryKey: string;
  medicalReportKey: string;
  externalLink: string;
  notes: string;
}

const EMPTY_FORM: WorkerFormData = {
  nameEn: "", nameCn: "", birthDate: "", gender: "", nationality: "", birthPlace: "",
  occupation: "", lifecycleStatus: "recruiting", documentStatus: "not_started", managerId: "",
  residentPermitNo: "", residentPermitExpiry: "", passportNo: "", passportExpiry: "",
  entryDate: "", phone: "", email: "", lastMedicalExamDate: "", nextMedicalExamType: "",
  photoKey: "", ktpKey: "", residentPermitFrontKey: "", residentPermitBackKey: "",
  passportKey: "", passportEntryKey: "", medicalReportKey: "", externalLink: "", notes: "",
};

// ─── 主元件 ──────────────────────────────────────────────────────────────────
interface WorkerModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  editId?: number | null;
}

export function WorkerModal({ open, onClose, onSuccess, editId }: WorkerModalProps) {
  const isEdit = !!editId;
  const utils = trpc.useUtils();
  const formRef = useRef<HTMLFormElement>(null);
  const handleEnterNav = useFormEnterNav(formRef);

  const { data: managers = [] } = trpc.managers.list.useQuery();
  const { data: existingWorker } = trpc.workers.getById.useQuery(
    { id: editId! }, { enabled: !!editId }
  );

  const [savedWorkerId, setSavedWorkerId] = useState<number | null>(null);

  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<WorkerFormData>({
    defaultValues: EMPTY_FORM,
  });

  // 監聽自動計算欄位
  const residentPermitExpiry = watch("residentPermitExpiry");
  const passportExpiry = watch("passportExpiry");
  const lastMedicalExamDate = watch("lastMedicalExamDate");
  const nextMedicalExamDate = calcNextMedicalExamDate(lastMedicalExamDate);
  const nextMedicalExamDays = daysFromToday(nextMedicalExamDate);

  // 附件 key 監聽
  const photoKey = watch("photoKey");
  const ktpKey = watch("ktpKey");
  const residentPermitFrontKey = watch("residentPermitFrontKey");
  const residentPermitBackKey = watch("residentPermitBackKey");
  const passportKey = watch("passportKey");
  const passportEntryKey = watch("passportEntryKey");
  const medicalReportKey = watch("medicalReportKey");

  // 填入既有資料 / 重置
  useEffect(() => {
    if (!open) return;
    if (isEdit && existingWorker) {
      const w = existingWorker;
      reset({
        nameEn: w.nameEn ?? "", nameCn: w.nameCn ?? "",
        birthDate: w.birthDate ?? "", gender: w.gender ?? "",
        nationality: w.nationality ?? "", birthPlace: w.birthPlace ?? "",
        occupation: w.occupation ?? "", lifecycleStatus: w.lifecycleStatus,
        documentStatus: w.documentStatus, managerId: String(w.managerId),
        residentPermitNo: w.residentPermitNo ?? "", residentPermitExpiry: w.residentPermitExpiry ?? "",
        passportNo: w.passportNo ?? "", passportExpiry: w.passportExpiry ?? "",
        entryDate: w.entryDate ?? "", phone: w.phone ?? "", email: w.email ?? "",
        lastMedicalExamDate: w.lastMedicalExamDate ?? "", nextMedicalExamType: w.nextMedicalExamType ?? "",
        photoKey: w.photoKey ?? "", ktpKey: w.ktpKey ?? "",
        residentPermitFrontKey: w.residentPermitFrontKey ?? "", residentPermitBackKey: w.residentPermitBackKey ?? "",
        passportKey: w.passportKey ?? "", passportEntryKey: w.passportEntryKey ?? "",
        medicalReportKey: w.medicalReportKey ?? "", externalLink: w.externalLink ?? "", notes: w.notes ?? "",
      });
      setSavedWorkerId(editId);
    } else if (!isEdit) {
      reset({ ...EMPTY_FORM, managerId: managers.length > 0 ? String(managers[0].id) : "" });
      setSavedWorkerId(null);
    }
  }, [open, isEdit, existingWorker, editId, managers, reset]);

  const createMutation = trpc.workers.create.useMutation({
    onSuccess: (data) => {
      utils.workers.list.invalidate();
      toast.success("移工已新增");
      setSavedWorkerId(data.id);
      onSuccess?.();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.workers.update.useMutation({
    onSuccess: () => {
      utils.workers.list.invalidate();
      toast.success("移工資料已更新");
      onSuccess?.();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const onSubmit = async (data: WorkerFormData) => {
    const managerId = parseInt(data.managerId);
    if (!managerId) { toast.error("請選擇負責人"); return; }
    if (!data.nameCn.trim() && !data.nameEn.trim()) { toast.error("請填寫中文或英文姓名"); return; }

    const payload = {
      name: data.nameCn || data.nameEn,
      nameEn: data.nameEn || undefined,
      nameCn: data.nameCn || undefined,
      birthDate: data.birthDate || undefined,
      gender: (data.gender as any) || undefined,
      nationality: data.nationality || undefined,
      birthPlace: data.birthPlace || undefined,
      occupation: (data.occupation as any) || undefined,
      lifecycleStatus: data.lifecycleStatus as any,
      documentStatus: data.documentStatus as any,
      managerId,
      residentPermitNo: data.residentPermitNo || undefined,
      residentPermitExpiry: data.residentPermitExpiry || undefined,
      passportNo: data.passportNo || undefined,
      passportExpiry: data.passportExpiry || undefined,
      entryDate: data.entryDate || undefined,
      phone: data.phone || undefined,
      email: data.email || undefined,
      lastMedicalExamDate: data.lastMedicalExamDate || undefined,
      nextMedicalExamType: (data.nextMedicalExamType as any) || undefined,
      photoKey: data.photoKey || undefined,
      ktpKey: data.ktpKey || undefined,
      residentPermitFrontKey: data.residentPermitFrontKey || undefined,
      residentPermitBackKey: data.residentPermitBackKey || undefined,
      passportKey: data.passportKey || undefined,
      passportEntryKey: data.passportEntryKey || undefined,
      medicalReportKey: data.medicalReportKey || undefined,
      externalLink: data.externalLink || undefined,
      notes: data.notes || undefined,
    };

    if (isEdit && editId) {
      await updateMutation.mutateAsync({ id: editId, ...payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
  };

  const enterProps = { onKeyDown: handleEnterNav };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "編輯移工資料" : "新增移工"}</DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            按 <kbd className="kbd">Tab</kbd> 切換欄位，<kbd className="kbd">Enter</kbd> 跳至下一欄
          </p>
        </DialogHeader>

        <form ref={formRef} onSubmit={handleSubmit(onSubmit)} className="space-y-0 py-2">

          {/* ── 區段一：基本資料 ── */}
          <div className="space-y-4 pb-5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2">基本資料</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>英文姓名</Label>
                <Input placeholder="INTAN SUSELA" {...register("nameEn")} {...enterProps} autoComplete="off" />
              </div>
              <div className="space-y-2">
                <Label>中文姓名</Label>
                <Input placeholder="白茵瑤" {...register("nameCn")} {...enterProps} autoComplete="off" />
              </div>
              <div className="space-y-2">
                <Label>出生日期</Label>
                <Input type="date" {...register("birthDate")} {...enterProps} />
              </div>
              <div className="space-y-2">
                <Label>性別</Label>
                <Select value={watch("gender")} onValueChange={v => setValue("gender", v)}>
                  <SelectTrigger><SelectValue placeholder="請選擇" /></SelectTrigger>
                  <SelectContent>{GENDER_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>國籍</Label>
                <Select value={watch("nationality")} onValueChange={v => setValue("nationality", v)}>
                  <SelectTrigger><SelectValue placeholder="請選擇" /></SelectTrigger>
                  <SelectContent>{NATIONALITY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>出生地點（國籍）</Label>
                <Input placeholder="印尼" {...register("birthPlace")} {...enterProps} />
              </div>
              <div className="space-y-2">
                <Label>職業</Label>
                <Select value={watch("occupation")} onValueChange={v => setValue("occupation", v)}>
                  <SelectTrigger><SelectValue placeholder="請選擇" /></SelectTrigger>
                  <SelectContent>{OCCUPATION_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>目前狀態 <span className="text-destructive">*</span></Label>
                <Select value={watch("lifecycleStatus")} onValueChange={v => setValue("lifecycleStatus", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LIFECYCLE_STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>文件狀態 <span className="text-destructive">*</span></Label>
                <Select value={watch("documentStatus")} onValueChange={v => setValue("documentStatus", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DOCUMENT_STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>負責人 <span className="text-destructive">*</span></Label>
                <Select value={watch("managerId")} onValueChange={v => setValue("managerId", v)}>
                  <SelectTrigger><SelectValue placeholder="請選擇負責人" /></SelectTrigger>
                  <SelectContent>{managers.map(m => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* ── 區段二：證件資料 ── */}
          <div className="space-y-4 py-5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">證件資料</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>統一證碼（居留證號）</Label>
                <Input placeholder="F901260600" {...register("residentPermitNo")} {...enterProps} className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label>居留證有效日期</Label>
                <Input type="date" {...register("residentPermitExpiry")} {...enterProps} />
                <DaysLeftBadge dateStr={residentPermitExpiry} label="居留證" />
              </div>
              <div className="space-y-2">
                <Label>護照號碼</Label>
                <Input placeholder="E4608889" {...register("passportNo")} {...enterProps} className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label>護照有效日期</Label>
                <Input type="date" {...register("passportExpiry")} {...enterProps} />
                <DaysLeftBadge dateStr={passportExpiry} label="護照" />
              </div>
              <div className="space-y-2">
                <Label>入國日期</Label>
                <Input type="date" {...register("entryDate")} {...enterProps} max={new Date().toISOString().slice(0, 10)} />
              </div>
            </div>
          </div>

          <Separator />

          {/* ── 區段三：聯絡資料 ── */}
          <div className="space-y-4 py-5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">聯絡資料</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>在臺聯絡手機號碼</Label>
                <Input placeholder="0972146087" {...register("phone")} {...enterProps} inputMode="tel" />
              </div>
              <div className="space-y-2">
                <Label>電子信箱</Label>
                <Input type="email" placeholder="example@email.com" {...register("email")} {...enterProps} />
              </div>
            </div>
          </div>

          <Separator />

          {/* ── 區段四：體檢資料 ── */}
          <div className="space-y-4 py-5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">體檢資料</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>最近一次體檢日期</Label>
                <Input type="date" {...register("lastMedicalExamDate")} {...enterProps} />
              </div>
              <div className="space-y-2">
                <Label>下次需要體檢類型</Label>
                <Select value={watch("nextMedicalExamType")} onValueChange={v => setValue("nextMedicalExamType", v)}>
                  <SelectTrigger><SelectValue placeholder="請選擇" /></SelectTrigger>
                  <SelectContent>{MEDICAL_EXAM_TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {nextMedicalExamDate && (
                <div className="sm:col-span-2 flex flex-wrap gap-5 p-3 bg-muted/30 rounded-md text-sm border border-border/50">
                  <div>
                    <span className="text-muted-foreground text-xs">下次可以體檢日期</span>
                    <p className="font-medium mt-0.5">{nextMedicalExamDate}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">參考驗證天數</span>
                    <p className={`font-medium mt-0.5 ${nextMedicalExamDays !== null && nextMedicalExamDays < 0 ? "text-red-500" : nextMedicalExamDays !== null && nextMedicalExamDays <= 30 ? "text-amber-500" : ""}`}>
                      {nextMedicalExamDays !== null
                        ? (nextMedicalExamDays < 0 ? `已過期 ${Math.abs(nextMedicalExamDays)} 天` : `${nextMedicalExamDays} 天`)
                        : "—"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* ── 區段五：附件上傳 ── */}
          <div className="space-y-4 py-5">
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">附件上傳</h3>
              {!savedWorkerId && (
                <p className="text-xs text-amber-600 mt-1">💡 新增移工時，請先儲存後再上傳附件。</p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FileUploadField label="大頭照" fieldName="photoKey" workerId={savedWorkerId} currentKey={photoKey} onUploaded={k => setValue("photoKey", k)} accept="image/*" />
              <FileUploadField label="母國身分證（KTP）" fieldName="ktpKey" workerId={savedWorkerId} currentKey={ktpKey} onUploaded={k => setValue("ktpKey", k)} />
              <FileUploadField label="居留證正面" fieldName="residentPermitFrontKey" workerId={savedWorkerId} currentKey={residentPermitFrontKey} onUploaded={k => setValue("residentPermitFrontKey", k)} />
              <FileUploadField label="居留證被面" fieldName="residentPermitBackKey" workerId={savedWorkerId} currentKey={residentPermitBackKey} onUploaded={k => setValue("residentPermitBackKey", k)} />
              <FileUploadField label="護照" fieldName="passportKey" workerId={savedWorkerId} currentKey={passportKey} onUploaded={k => setValue("passportKey", k)} />
              <FileUploadField label="護照入境頁" fieldName="passportEntryKey" workerId={savedWorkerId} currentKey={passportEntryKey} onUploaded={k => setValue("passportEntryKey", k)} />
              <FileUploadField label="體檢報告" fieldName="medicalReportKey" workerId={savedWorkerId} currentKey={medicalReportKey} onUploaded={k => setValue("medicalReportKey", k)} accept="image/*,application/pdf" />
            </div>
          </div>

          <Separator />

          {/* ── 區段六：其他 ── */}
          <div className="space-y-4 py-5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">其他資料</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>連結（Google Drive / Sheets 等）</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://drive.google.com/..."
                    {...register("externalLink")}
                    {...enterProps}
                    className="flex-1"
                  />
                  {watch("externalLink") && (
                    <Button type="button" variant="outline" size="sm" className="shrink-0"
                      onClick={() => window.open(watch("externalLink"), "_blank")}>
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>備註</Label>
                <Textarea
                  placeholder="備註事項..."
                  rows={3}
                  {...register("notes")}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) e.stopPropagation(); }}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mr-auto hidden sm:block">Tab / Enter 切換欄位</p>
            <Button type="button" variant="outline" onClick={onClose}>取消</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />儲存中...</>
                : (isEdit ? "儲存變更" : "新增移工")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
