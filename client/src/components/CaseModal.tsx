import { useEffect, useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { CASE_MGMT_STATUS_OPTIONS } from "@/lib/constants";
import {
  Building2, User, Phone, MapPin, Heart, Briefcase, AlertTriangle,
  Upload, X, Calendar, Clock, FileText, Shield,
} from "lucide-react";

const schema = z.object({
  customerId: z.number().int().positive("請選擇客戶"),
  name: z.string().min(2, "案件名稱至少 2 字").max(100),
  managerId: z.number().int().positive("請選擇負責人"),
  status: z.enum(["in_progress", "completed", "paused", "cancelled"]),
  caseCondition: z.string().max(100).optional(),
  primaryWorkerId: z.number().int().positive().optional().nullable(),
  needsReview: z.boolean().optional(),
  recruitmentPermitFileKey: z.string().max(300).optional().nullable(),
  // Phase 2: 聘僱時間
  continuousEmploymentDate: z.string().max(10).optional().nullable(),
  employmentPeriodMonths: z.number().int().min(1).max(36).optional().nullable(),
  terminationDate: z.string().max(10).optional().nullable(),
  // Phase 2: 代辦事項
  recruitmentAgencyItems: z.enum(["none", "self", "agency"]).optional().nullable(),
  employmentAgencyItems: z.enum(["none", "self", "agency"]).optional().nullable(),
  postEmploymentInsurance: z.enum(["none", "health", "accident", "both"]).optional().nullable(),
  // Phase 2: 聘僱許可函與情況
  employmentPermitFileKey: z.string().max(300).optional().nullable(),
  employmentStatus: z.enum(["normal", "suspended", "terminated", "transferred"]).optional().nullable(),
  terminationLetterFileKey: z.string().max(300).optional().nullable(),
  // Phase 3: 承接通報/入國通報
  notificationNo: z.string().max(50).optional().nullable(),
  entryNotificationDate: z.string().max(10).optional().nullable(),
  certificateNo: z.string().max(50).optional().nullable(),
  // Phase 3: 內政部移民署
  niaCategory: z.string().max(50).optional().nullable(),
  niaNo: z.string().max(50).optional().nullable(),
  residencePermitSubmitDate: z.string().max(10).optional().nullable(),
  // Phase 3: 勞動部聘僱許可函
  molReceiptNo: z.string().max(50).optional().nullable(),
  employmentLetterCategory: z.string().max(50).optional().nullable(),
  applicationSubmitDate: z.string().max(10).optional().nullable(),
  issuanceDate: z.string().max(10).optional().nullable(),
  approvalReceiptDate: z.string().max(10).optional().nullable(),
  // Phase 4: 體檢管理
  prevMedicalExamDate: z.string().max(10).optional().nullable(),
  prevMedicalReportKey: z.string().max(300).optional().nullable(),
  entryMedicalExamDate: z.string().max(10).optional().nullable(),
  entryMedicalReportKey: z.string().max(300).optional().nullable(),
  exam6mDate: z.string().max(10).optional().nullable(),
  exam6mReportKey: z.string().max(300).optional().nullable(),
  exam18mDate: z.string().max(10).optional().nullable(),
  exam18mReportKey: z.string().max(300).optional().nullable(),
  exam30mDate: z.string().max(10).optional().nullable(),
  exam30mReportKey: z.string().max(300).optional().nullable(),
  notes: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

const AGENCY_ITEMS_OPTIONS = [
  { value: "none", label: "無" },
  { value: "self", label: "自辦" },
  { value: "agency", label: "仲介代辦" },
];
const POST_INSURANCE_OPTIONS = [
  { value: "none", label: "無" },
  { value: "health", label: "健保待辦" },
  { value: "accident", label: "意外險待辦" },
  { value: "both", label: "健保 + 意外險待辦" },
];
const EMPLOYMENT_STATUS_OPTIONS = [
  { value: "normal", label: "正常" },
  { value: "suspended", label: "暫停" },
  { value: "terminated", label: "終止" },
  { value: "transferred", label: "轉就" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  editingCase?: any;
}

export default function CaseModal({ open, onClose, editingCase }: Props) {
  const utils = trpc.useUtils();
  const { data: customers = [] } = trpc.customers.list.useQuery();
  const { data: managers = [] } = trpc.managers.list.useQuery();
  const { data: workers = [] } = trpc.workers.list.useQuery();

  const [uploadingPermit, setUploadingPermit] = useState(false);
  const [uploadingEmpPermit, setUploadingEmpPermit] = useState(false);
  const [uploadingTermination, setUploadingTermination] = useState(false);
  // Phase 4: 體檢報告上傳狀態
  const [uploadingPrevMedical, setUploadingPrevMedical] = useState(false);
  const [uploadingEntryMedical, setUploadingEntryMedical] = useState(false);
  const [uploading6m, setUploading6m] = useState(false);
  const [uploading18m, setUploading18m] = useState(false);
  const [uploading30m, setUploading30m] = useState(false);

  const {
    register, handleSubmit, reset, setValue, watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      status: "in_progress",
      customerId: 0,
      managerId: 0,
      name: "",
      notes: "",
      caseCondition: "",
      primaryWorkerId: null,
      needsReview: false,
      recruitmentPermitFileKey: null,
      continuousEmploymentDate: null,
      employmentPeriodMonths: null,
      terminationDate: null,
      recruitmentAgencyItems: null,
      employmentAgencyItems: null,
      postEmploymentInsurance: null,
      employmentPermitFileKey: null,
      employmentStatus: null,
      terminationLetterFileKey: null,
      notificationNo: null,
      entryNotificationDate: null,
      certificateNo: null,
      niaCategory: null,
      niaNo: null,
      residencePermitSubmitDate: null,
      molReceiptNo: null,
      employmentLetterCategory: null,
      applicationSubmitDate: null,
      issuanceDate: null,
      approvalReceiptDate: null,
      prevMedicalExamDate: null,
      prevMedicalReportKey: null,
      entryMedicalExamDate: null,
      entryMedicalReportKey: null,
      exam6mDate: null,
      exam6mReportKey: null,
      exam18mDate: null,
      exam18mReportKey: null,
      exam30mDate: null,
      exam30mReportKey: null,
    },
  });

  useEffect(() => {
    if (editingCase) {
      reset({
        customerId: editingCase.customerId,
        name: editingCase.name,
        managerId: editingCase.managerId,
        status: editingCase.status,
        notes: editingCase.notes ?? "",
        caseCondition: editingCase.caseCondition ?? "",
        primaryWorkerId: editingCase.primaryWorkerId ?? null,
        needsReview: editingCase.needsReview === 1 || editingCase.needsReview === true,
        recruitmentPermitFileKey: editingCase.recruitmentPermitFileKey ?? null,
        continuousEmploymentDate: editingCase.continuousEmploymentDate ?? null,
        employmentPeriodMonths: editingCase.employmentPeriodMonths ?? null,
        terminationDate: editingCase.terminationDate ?? null,
        recruitmentAgencyItems: editingCase.recruitmentAgencyItems ?? null,
        employmentAgencyItems: editingCase.employmentAgencyItems ?? null,
        postEmploymentInsurance: editingCase.postEmploymentInsurance ?? null,
        employmentPermitFileKey: editingCase.employmentPermitFileKey ?? null,
        employmentStatus: editingCase.employmentStatus ?? null,
        terminationLetterFileKey: editingCase.terminationLetterFileKey ?? null,
        notificationNo: editingCase.notificationNo ?? null,
        entryNotificationDate: editingCase.entryNotificationDate ?? null,
        certificateNo: editingCase.certificateNo ?? null,
        niaCategory: editingCase.niaCategory ?? null,
        niaNo: editingCase.niaNo ?? null,
        residencePermitSubmitDate: editingCase.residencePermitSubmitDate ?? null,
        molReceiptNo: editingCase.molReceiptNo ?? null,
        employmentLetterCategory: editingCase.employmentLetterCategory ?? null,
        applicationSubmitDate: editingCase.applicationSubmitDate ?? null,
        issuanceDate: editingCase.issuanceDate ?? null,
        approvalReceiptDate: editingCase.approvalReceiptDate ?? null,
        prevMedicalExamDate: editingCase.prevMedicalExamDate ?? null,
        prevMedicalReportKey: editingCase.prevMedicalReportKey ?? null,
        entryMedicalExamDate: editingCase.entryMedicalExamDate ?? null,
        entryMedicalReportKey: editingCase.entryMedicalReportKey ?? null,
        exam6mDate: editingCase.exam6mDate ?? null,
        exam6mReportKey: editingCase.exam6mReportKey ?? null,
        exam18mDate: editingCase.exam18mDate ?? null,
        exam18mReportKey: editingCase.exam18mReportKey ?? null,
        exam30mDate: editingCase.exam30mDate ?? null,
        exam30mReportKey: editingCase.exam30mReportKey ?? null,
      });
    } else {
      reset({
        status: "in_progress",
        customerId: 0,
        managerId: 0,
        name: "",
        notes: "",
        caseCondition: "",
        primaryWorkerId: null,
        needsReview: false,
        recruitmentPermitFileKey: null,
        continuousEmploymentDate: null,
        employmentPeriodMonths: null,
        terminationDate: null,
        recruitmentAgencyItems: null,
        employmentAgencyItems: null,
        postEmploymentInsurance: null,
        employmentPermitFileKey: null,
        employmentStatus: null,
        terminationLetterFileKey: null,
        notificationNo: null,
        entryNotificationDate: null,
        certificateNo: null,
        niaCategory: null,
        niaNo: null,
        residencePermitSubmitDate: null,
        molReceiptNo: null,
        employmentLetterCategory: null,
        applicationSubmitDate: null,
        issuanceDate: null,
        approvalReceiptDate: null,
        prevMedicalExamDate: null,
        prevMedicalReportKey: null,
        entryMedicalExamDate: null,
        entryMedicalReportKey: null,
        exam6mDate: null,
        exam6mReportKey: null,
        exam18mDate: null,
        exam18mReportKey: null,
        exam30mDate: null,
        exam30mReportKey: null,
      });
    }
  }, [editingCase, reset]);

  const createMutation = trpc.cases.create.useMutation({
    onSuccess: (res) => {
      toast.success(`案件已建立（${res.caseNo}）`);
      utils.cases.list.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.cases.update.useMutation({
    onSuccess: () => {
      toast.success("案件已更新");
      utils.cases.list.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const onSubmit = (data: FormValues) => {
    if (editingCase) {
      updateMutation.mutate({ id: editingCase.id, ...data });
    } else {
      createMutation.mutate(data as any);
    }
  };

  const watchedCustomerId = watch("customerId");
  const watchedManagerId = watch("managerId");
  const watchedStatus = watch("status");
  const watchedPrimaryWorkerId = watch("primaryWorkerId");
  const watchedNeedsReview = watch("needsReview");
  const watchedPermitKey = watch("recruitmentPermitFileKey");
  const watchedEmpPermitKey = watch("employmentPermitFileKey");
  const watchedTerminationKey = watch("terminationLetterFileKey");
  const watchedRecruitmentAgency = watch("recruitmentAgencyItems");
  const watchedEmploymentAgency = watch("employmentAgencyItems");
  const watchedPostInsurance = watch("postEmploymentInsurance");
  const watchedEmpStatus = watch("employmentStatus");
  // Phase 4 watched file keys
  const watchedPrevMedicalKey = watch("prevMedicalReportKey");
  const watchedEntryMedicalKey = watch("entryMedicalReportKey");
  const watched6mKey = watch("exam6mReportKey");
  const watched18mKey = watch("exam18mReportKey");
  const watched30mKey = watch("exam30mReportKey");

  const selectedCustomer = customers.find(c => c.id === watchedCustomerId);
  const selectedWorker = workers.find(w => w.id === watchedPrimaryWorkerId);

  // 通用附件上傳 helper
  const handleFileUpload = async (
    file: File,
    folder: string,
    fieldName: keyof FormValues,
    setUploading: (v: boolean) => void,
    successMsg: string,
  ) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", folder);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json() as { key: string };
      setValue(fieldName, data.key as any);
      toast.success(successMsg);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "未知錯誤";
      toast.error("上傳失敗：" + msg);
    } finally {
      setUploading(false);
    }
  };

  // 附件顯示元件
  const FileField = ({
    fileKey,
    uploading,
    fieldName,
    label,
    folder,
    setUploading,
    successMsg,
  }: {
    fileKey: string | null | undefined;
    uploading: boolean;
    fieldName: keyof FormValues;
    label: string;
    folder: string;
    setUploading: (v: boolean) => void;
    successMsg: string;
  }) => (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5">
        <Upload className="w-3.5 h-3.5" />
        {label}
      </Label>
      {fileKey ? (
        <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 border border-border/50">
          <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground flex-1 truncate">{fileKey.split("/").pop()}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setValue(fieldName, null as any)}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      ) : (
        <label className="flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-border/70 cursor-pointer hover:bg-muted/30 transition-colors">
          <Upload className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {uploading ? "上傳中..." : "點擊上傳 PDF 或圖片"}
          </span>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file, folder, fieldName, setUploading, successMsg);
            }}
            disabled={uploading}
          />
        </label>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-primary" />
            {editingCase ? "編輯案件" : "新增案件"}
            {editingCase?.caseNo && (
              <Badge variant="outline" className="ml-2 font-mono text-xs">{editingCase.caseNo}</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-6 py-2">

          {/* ── 基本設定 ─────────────────────────────────────── */}
          <section className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">基本設定</p>

            <div className="space-y-1.5">
              <Label>案件名稱 <span className="text-destructive">*</span></Label>
              <Input {...register("name")} placeholder="例：台灣精密科技 2025 批次" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>負責人 <span className="text-destructive">*</span></Label>
                <Select
                  value={watchedManagerId ? String(watchedManagerId) : ""}
                  onValueChange={v => setValue("managerId", Number(v), { shouldValidate: true })}
                >
                  <SelectTrigger className={errors.managerId ? "border-destructive" : ""}>
                    <SelectValue placeholder="選擇負責人" />
                  </SelectTrigger>
                  <SelectContent>
                    {managers.map(m => (
                      <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.managerId && <p className="text-xs text-destructive">{errors.managerId.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>案件狀態</Label>
                <Select
                  value={watchedStatus}
                  onValueChange={v => setValue("status", v as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CASE_MGMT_STATUS_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>案件情況</Label>
              <Input {...register("caseCondition")} placeholder="例：需先辦居留證展延申請" />
            </div>

            <div className="flex items-center gap-2 py-1">
              <Checkbox
                id="needsReview"
                checked={watchedNeedsReview ?? false}
                onCheckedChange={v => setValue("needsReview", v === true)}
              />
              <Label htmlFor="needsReview" className="flex items-center gap-1.5 cursor-pointer">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                標記為「需檢查」
              </Label>
            </div>
          </section>

          <Separator />

          {/* ── 選擇雇主（自動帶入） ─────────────────────────── */}
          <section className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> 雇主資訊
            </p>

            <div className="space-y-1.5">
              <Label>選擇雇主 <span className="text-destructive">*</span></Label>
              <Select
                value={watchedCustomerId ? String(watchedCustomerId) : ""}
                onValueChange={v => setValue("customerId", Number(v), { shouldValidate: true })}
              >
                <SelectTrigger className={errors.customerId ? "border-destructive" : ""}>
                  <SelectValue placeholder="選擇雇主" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.employerNo ? `${c.employerNo} ` : ""}{c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.customerId && <p className="text-xs text-destructive">{errors.customerId.message}</p>}
            </div>

            {selectedCustomer && (
              <div className="rounded-lg bg-muted/40 border border-border/50 p-3 space-y-2">
                <p className="text-xs text-muted-foreground font-medium">自動帶入（唯讀）</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground text-xs">電話：</span>
                    <span className="font-medium">{selectedCustomer.phone || "—"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Heart className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground text-xs">被照顧者：</span>
                    <span className="font-medium">{(selectedCustomer as any).careReceiverName || "—"}</span>
                  </div>
                  <div className="flex items-start gap-1.5 col-span-2">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <span className="text-muted-foreground text-xs">通訊地址：</span>
                    <span className="font-medium">{selectedCustomer.address || "—"}</span>
                  </div>
                  {(selectedCustomer as any).careReceiverQualification && (
                    <div className="flex items-center gap-1.5 col-span-2">
                      <span className="text-muted-foreground text-xs">被照顧者資格：</span>
                      <Badge variant="secondary" className="text-xs">{(selectedCustomer as any).careReceiverQualification}</Badge>
                    </div>
                  )}
                </div>
              </div>
            )}

            <FileField
              fileKey={watchedPermitKey}
              uploading={uploadingPermit}
              fieldName="recruitmentPermitFileKey"
              label="招募許可函"
              folder="recruitment-permits"
              setUploading={setUploadingPermit}
              successMsg="招募許可函已上傳"
            />
          </section>

          <Separator />

          {/* ── 選擇外國人（自動帶入） ─────────────────────────── */}
          <section className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> 外國人資訊
            </p>

            <div className="space-y-1.5">
              <Label>選擇外國人</Label>
              <Select
                value={watchedPrimaryWorkerId ? String(watchedPrimaryWorkerId) : "__none__"}
                onValueChange={v => setValue("primaryWorkerId", v === "__none__" ? null : Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇外國人（可選）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— 不指定 —</SelectItem>
                  {workers.map(w => (
                    <SelectItem key={w.id} value={String(w.id)}>
                      {w.name}{w.nationality ? ` · ${w.nationality}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedWorker && (
              <div className="rounded-lg bg-muted/40 border border-border/50 p-3 space-y-2">
                <p className="text-xs text-muted-foreground font-medium">自動帶入（唯讀）</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">中文姓名：</span>
                    <span className="font-medium ml-1">{(selectedWorker as any).nameCn || selectedWorker.name || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">英文姓名：</span>
                    <span className="font-medium ml-1">{(selectedWorker as any).nameEn || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">居留證號：</span>
                    <span className="font-medium ml-1 font-mono">{(selectedWorker as any).residentPermitNo || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">居留證效期：</span>
                    <span className="font-medium ml-1">{(selectedWorker as any).residentPermitExpiry || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">護照號碼：</span>
                    <span className="font-medium ml-1 font-mono">{(selectedWorker as any).passportNo || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">護照效期：</span>
                    <span className="font-medium ml-1">{(selectedWorker as any).passportExpiry || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">手機：</span>
                    <span className="font-medium ml-1">{selectedWorker.phone || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">國籍：</span>
                    <span className="font-medium ml-1">{selectedWorker.nationality || "—"}</span>
                  </div>
                </div>
              </div>
            )}
          </section>

          <Separator />

          {/* ── 聘僱資料 ─────────────────────────────────────── */}
          <section className="space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> 聘僱資料
            </p>

            {/* 聘僱時間 */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                <Clock className="w-3 h-3" /> 聘僱時間
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">接續聘僱日期</Label>
                  <Input
                    type="date"
                    {...register("continuousEmploymentDate")}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">期間長度（月）</Label>
                  <Input
                    type="number"
                    min={1}
                    max={36}
                    placeholder="例：24"
                    {...register("employmentPeriodMonths", {
                      setValueAs: (v: string) => v === "" || v === null || v === undefined ? null : Number(v),
                    })}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">終止聘僱日期</Label>
                  <Input
                    type="date"
                    {...register("terminationDate")}
                    className="text-sm"
                  />
                </div>
              </div>
            </div>

            {/* 代辦事項 */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                <FileText className="w-3 h-3" /> 代辦事項
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">招募函代辦事項</Label>
                  <Select
                    value={watchedRecruitmentAgency ?? "__none__"}
                    onValueChange={v => setValue("recruitmentAgencyItems", v === "__none__" ? null : v as any)}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="選擇" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— 未設定 —</SelectItem>
                      {AGENCY_ITEMS_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">聘僱函代辦事項</Label>
                  <Select
                    value={watchedEmploymentAgency ?? "__none__"}
                    onValueChange={v => setValue("employmentAgencyItems", v === "__none__" ? null : v as any)}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="選擇" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— 未設定 —</SelectItem>
                      {AGENCY_ITEMS_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">聘僱後尚未完成保險</Label>
                  <Select
                    value={watchedPostInsurance ?? "__none__"}
                    onValueChange={v => setValue("postEmploymentInsurance", v === "__none__" ? null : v as any)}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="選擇" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— 未設定 —</SelectItem>
                      {POST_INSURANCE_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* 聘僱許可函與情況 */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                <Shield className="w-3 h-3" /> 聘僱許可函與情況
              </p>
              <div className="grid grid-cols-2 gap-3">
                <FileField
                  fileKey={watchedEmpPermitKey}
                  uploading={uploadingEmpPermit}
                  fieldName="employmentPermitFileKey"
                  label="聘僱許可函"
                  folder="employment-permits"
                  setUploading={setUploadingEmpPermit}
                  successMsg="聘僱許可函已上傳"
                />
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5">
                    <Shield className="w-3 h-3" />
                    聘僱情況
                  </Label>
                  <Select
                    value={watchedEmpStatus ?? "__none__"}
                    onValueChange={v => setValue("employmentStatus", v === "__none__" ? null : v as any)}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="選擇聘僱情況" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— 未設定 —</SelectItem>
                      {EMPLOYMENT_STATUS_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <FileField
                fileKey={watchedTerminationKey}
                uploading={uploadingTermination}
                fieldName="terminationLetterFileKey"
                label="終止函"
                folder="termination-letters"
                setUploading={setUploadingTermination}
                successMsg="終止函已上傳"
              />
            </div>
          </section>

          <Separator />

          {/* ── 承接通報/入國通報（3日內） ──────────────────────────── */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-blue-500/10 text-blue-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.1a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l.81-.81a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              </span>
              承接通報 / 入國通報（3日內）
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">通報書序號</Label>
                <Input {...register("notificationNo")} placeholder="例：ABC-001" className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">入國通報申請日</Label>
                <Input {...register("entryNotificationDate")} type="date" className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">證明書序號</Label>
                <Input {...register("certificateNo")} placeholder="例：XYZ-002" className="text-sm" />
              </div>
            </div>
          </section>

          <Separator />

          {/* ── 內政部移民署 ──────────────────────────────────────────── */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-purple-500/10 text-purple-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
              </span>
              內政部移民署
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">一站式類別</Label>
                <Input {...register("niaCategory")} placeholder="例：居留證申請" className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">一站式序號</Label>
                <Input {...register("niaNo")} placeholder="例：NIA-2025-001" className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">居留證申請送審日</Label>
                <Input {...register("residencePermitSubmitDate")} type="date" className="text-sm" />
              </div>
            </div>
          </section>

          <Separator />

          {/* ── 勞動部聘僱許可函 ────────────────────────────────────── */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-amber-500/10 text-amber-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              </span>
              勞動部聘僱許可函
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">收文號</Label>
                <Input {...register("molReceiptNo")} placeholder="例：MOL-2025-001" className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">聘僱函類別</Label>
                <Input {...register("employmentLetterCategory")} placeholder="例：初聘函" className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">申請書送件日</Label>
                <Input {...register("applicationSubmitDate")} type="date" className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">發文日期</Label>
                <Input {...register("issuanceDate")} type="date" className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">核准收件日</Label>
                <Input {...register("approvalReceiptDate")} type="date" className="text-sm" />
              </div>
            </div>
          </section>

          <Separator />

          {/* ── 體檢管理 ──────────────────────────────────────── */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-emerald-500/10 text-emerald-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              </span>
              體檢管理
            </h3>
            {/* 前次體檢 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">前次體檢日期</Label>
                <Input {...register("prevMedicalExamDate")} type="date" className="text-sm" />
              </div>
              <FileField
                fileKey={watchedPrevMedicalKey}
                uploading={uploadingPrevMedical}
                fieldName="prevMedicalReportKey"
                label="前次體檢報告"
                folder="medical"
                setUploading={setUploadingPrevMedical}
                successMsg="前次體檢報告已上傳"
              />
            </div>
            {/* 入境3天體檢 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">入境3天體檢日期</Label>
                <Input {...register("entryMedicalExamDate")} type="date" className="text-sm" />
              </div>
              <FileField
                fileKey={watchedEntryMedicalKey}
                uploading={uploadingEntryMedical}
                fieldName="entryMedicalReportKey"
                label="入境3天體檢報告"
                folder="medical"
                setUploading={setUploadingEntryMedical}
                successMsg="入境3天體檢報告已上傳"
              />
            </div>
            {/* 6/18/30 個月體檢 */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">6個月體檢日期</Label>
                <Input {...register("exam6mDate")} type="date" className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">18個月體檢日期</Label>
                <Input {...register("exam18mDate")} type="date" className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">30個月體檢日期</Label>
                <Input {...register("exam30mDate")} type="date" className="text-sm" />
              </div>
              <FileField
                fileKey={watched6mKey}
                uploading={uploading6m}
                fieldName="exam6mReportKey"
                label="6個月體檢報告"
                folder="medical"
                setUploading={setUploading6m}
                successMsg="6個月體檢報告已上傳"
              />
              <FileField
                fileKey={watched18mKey}
                uploading={uploading18m}
                fieldName="exam18mReportKey"
                label="18個月體檢報告"
                folder="medical"
                setUploading={setUploading18m}
                successMsg="18個月體檢報告已上傳"
              />
              <FileField
                fileKey={watched30mKey}
                uploading={uploading30m}
                fieldName="exam30mReportKey"
                label="30個月體檢報告"
                folder="medical"
                setUploading={setUploading30m}
                successMsg="30個月體檢報告已上傳"
              />
            </div>
          </section>

          <Separator />

          {/* ── 備註 ────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label>備註</Label>
            <Textarea {...register("notes")} placeholder="案件說明、特殊需求..." rows={3} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>取消</Button>
            <Button
              type="submit"
              disabled={isSubmitting || createMutation.isPending || updateMutation.isPending || uploadingPermit || uploadingEmpPermit || uploadingTermination}
            >
              {editingCase ? "儲存變更" : "建立案件"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
