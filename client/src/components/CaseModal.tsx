import { useEffect, useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CASE_MGMT_STATUS_OPTIONS } from "@/lib/constants";
import {
  Building2, User, Phone, MapPin, Heart, Briefcase, AlertTriangle,
  Upload, X, Calendar, Clock, FileText, Shield, Activity,
} from "lucide-react";
import { FormModal } from "@/components/form/FormModal";
import { FormSection } from "@/components/form/FormSection";
import { FormGrid } from "@/components/form/FormGrid";
import { FormField } from "@/components/form/FormField";
import { FileDropzone } from "@/components/form/FileDropzone";

const schema = z.object({
  customerId: z.number().int().positive("請選擇客戶"),
  name: z.string().min(2, "案件名稱至少 2 字").max(100),
  managerId: z.number().int().positive("請選擇負責人"),
  status: z.enum(["in_progress", "completed", "paused", "cancelled"]),
  caseCondition: z.string().max(100).optional(),
  primaryWorkerId: z.number().int().positive().optional().nullable(),
  needsReview: z.boolean().optional(),
  recruitmentPermitFileKey: z.string().max(300).optional().nullable(),
  // 聘僱時間
  continuousEmploymentDate: z.string().max(10).optional().nullable(),
  employmentPeriodMonths: z.number().int().min(1).max(36).optional().nullable(),
  terminationDate: z.string().max(10).optional().nullable(),
  // 代辦事項
  recruitmentAgencyItems: z.enum(["none", "self", "agency"]).optional().nullable(),
  employmentAgencyItems: z.enum(["none", "self", "agency"]).optional().nullable(),
  postEmploymentInsurance: z.enum(["none", "health", "accident", "both"]).optional().nullable(),
  // 聘僱許可函與情況
  employmentPermitFileKey: z.string().max(300).optional().nullable(),
  employmentStatus: z.enum(["normal", "suspended", "terminated", "transferred"]).optional().nullable(),
  terminationLetterFileKey: z.string().max(300).optional().nullable(),
  // 承接通報/入國通報
  notificationNo: z.string().max(50).optional().nullable(),
  entryNotificationDate: z.string().max(10).optional().nullable(),
  certificateNo: z.string().max(50).optional().nullable(),
  // 內政部移民署
  niaCategory: z.string().max(50).optional().nullable(),
  niaNo: z.string().max(50).optional().nullable(),
  residencePermitSubmitDate: z.string().max(10).optional().nullable(),
  // 勞動部聘僱許可函
  molReceiptNo: z.string().max(50).optional().nullable(),
  employmentLetterCategory: z.string().max(50).optional().nullable(),
  applicationSubmitDate: z.string().max(10).optional().nullable(),
  issuanceDate: z.string().max(10).optional().nullable(),
  approvalReceiptDate: z.string().max(10).optional().nullable(),
  // 保險管理
  healthInsurance: z.string().max(200).optional().nullable(),
  healthInsurancePolicyKey: z.string().max(300).optional().nullable(),
  accidentInsurance: z.string().max(200).optional().nullable(),
  accidentInsurancePolicyKey: z.string().max(300).optional().nullable(),
  // 體檢管理
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

const EMPTY_DEFAULTS: FormValues = {
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
  healthInsurance: null,
  healthInsurancePolicyKey: null,
  accidentInsurance: null,
  accidentInsurancePolicyKey: null,
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
};

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  editingCase?: any;
  defaultCustomerId?: number;
  defaultWorkerId?: number;
}

export default function CaseModal({ open, onClose, onSuccess, editingCase, defaultCustomerId, defaultWorkerId }: Props) {
  const utils = trpc.useUtils();
  const { data: customers = [] } = trpc.customers.list.useQuery();
  const { data: managers = [] } = trpc.managers.list.useQuery();
  const { data: workers = [] } = trpc.workers.list.useQuery();

  // ── 附件上傳狀態 ──
  const [uploadingPermit, setUploadingPermit] = useState(false);
  const [uploadingEmpPermit, setUploadingEmpPermit] = useState(false);
  const [uploadingTermination, setUploadingTermination] = useState(false);
  const [uploadingHealthPolicy, setUploadingHealthPolicy] = useState(false);
  const [uploadingAccidentPolicy, setUploadingAccidentPolicy] = useState(false);
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
    defaultValues: EMPTY_DEFAULTS,
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
        healthInsurance: editingCase.healthInsurance ?? null,
        healthInsurancePolicyKey: editingCase.healthInsurancePolicyKey ?? null,
        accidentInsurance: editingCase.accidentInsurance ?? null,
        accidentInsurancePolicyKey: editingCase.accidentInsurancePolicyKey ?? null,
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
        ...EMPTY_DEFAULTS,
        customerId: defaultCustomerId ?? 0,
        primaryWorkerId: defaultWorkerId ?? null,
      });
    }
  }, [editingCase, reset, defaultCustomerId, defaultWorkerId]);

  const createMutation = trpc.cases.create.useMutation({
    onSuccess: (res) => {
      toast.success(`案件已建立（${res.caseNo}）`);
      utils.cases.list.invalidate();
      onSuccess?.();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.cases.update.useMutation({
    onSuccess: () => {
      toast.success("案件已更新");
      utils.cases.list.invalidate();
      onSuccess?.();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const onSubmit: SubmitHandler<FormValues> = (data) => {
    if (editingCase) {
      updateMutation.mutate({ id: editingCase.id, ...data });
    } else {
      createMutation.mutate(data as any);
    }
  };

  // ── watched values ──
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
  const watchedHealthPolicyKey = watch("healthInsurancePolicyKey");
  const watchedAccidentPolicyKey = watch("accidentInsurancePolicyKey");
  const watchedPrevMedicalKey = watch("prevMedicalReportKey");
  const watchedEntryMedicalKey = watch("entryMedicalReportKey");
  const watched6mKey = watch("exam6mReportKey");
  const watched18mKey = watch("exam18mReportKey");
  const watched30mKey = watch("exam30mReportKey");

  const selectedCustomer = customers.find(c => c.id === watchedCustomerId);
  const selectedWorker = workers.find(w => w.id === watchedPrimaryWorkerId);

  const isPending = isSubmitting || createMutation.isPending || updateMutation.isPending;
  const anyUploading = uploadingPermit || uploadingEmpPermit || uploadingTermination;

  // ── Tab 錯誤計數 ──
  // 基本資料 Tab 的必填欄位
  const BASIC_TAB_FIELDS: (keyof FormValues)[] = ["name", "managerId", "customerId"];
  // 行政與保險體檢 Tab 目前全部為選填，待日後新增必填欄位再擴充
  const ADMIN_TAB_FIELDS: (keyof FormValues)[] = [];

  const basicTabErrorCount = BASIC_TAB_FIELDS.filter(f => !!errors[f]).length;
  const adminTabErrorCount = ADMIN_TAB_FIELDS.filter(f => !!errors[f]).length;

  return (
    <FormModal
      open={open}
      onOpenChange={v => !v && onClose()}
      icon={<Briefcase className="w-5 h-5 text-primary" />}
      title={
        <>
          {editingCase ? "編輯案件" : "新增案件"}
          {editingCase?.caseNo && (
            <Badge variant="outline" className="ml-2 font-mono text-xs">{editingCase.caseNo}</Badge>
          )}
        </>
      }

      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>取消</Button>
          <Button
            type="submit"
            form="case-modal-form"
            disabled={isPending || anyUploading}
          >
            {isPending ? "處理中..." : editingCase ? "儲存變更" : "建立案件"}
          </Button>
        </>
      }
    >
      <form id="case-modal-form" onSubmit={handleSubmit(onSubmit as any)}>
        <Tabs defaultValue="basic" className="flex flex-col">
          <TabsList className="grid grid-cols-2 mb-6">
            <TabsTrigger value="basic" className="gap-1.5">
              基本資料
              {basicTabErrorCount > 0 && (
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-none">
                  {basicTabErrorCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="admin" className="gap-1.5">
              行政與保險體檢
              {adminTabErrorCount > 0 && (
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-none">
                  {adminTabErrorCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ═══════ Tab 1：基本資料 ═══════ */}
          <TabsContent value="basic" className="space-y-6 mt-0">

            {/* 基本設定 */}
            <FormSection icon={<Briefcase className="w-3.5 h-3.5" />} title="基本設定">
              <FormGrid cols={1}>
                <FormField label="案件名稱" required error={errors.name?.message}>
                  <Input {...register("name")} placeholder="例：台灣精密科技 2025 批次" />
                </FormField>
              </FormGrid>
              <FormGrid cols={2}>
                <FormField label="負責人" required error={errors.managerId?.message}>
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
                </FormField>
                <FormField label="案件狀態">
                  <Select
                    value={watchedStatus}
                    onValueChange={v => setValue("status", v as any)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CASE_MGMT_STATUS_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </FormGrid>
              <FormGrid cols={1}>
                <FormField label="案件情況">
                  <Input {...register("caseCondition")} placeholder="例：需先辦居留證展延申請" />
                </FormField>
              </FormGrid>
              <div className="flex items-center gap-2 pt-1">
                <Checkbox
                  id="needsReview"
                  checked={watchedNeedsReview ?? false}
                  onCheckedChange={v => setValue("needsReview", v === true)}
                />
                <Label htmlFor="needsReview" className="flex items-center gap-1.5 cursor-pointer text-sm font-medium">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  標記為「需檢查」
                </Label>
              </div>
            </FormSection>

            {/* 雇主資訊 */}
            <FormSection icon={<Building2 className="w-3.5 h-3.5" />} title="雇主資訊">
              <FormGrid cols={1}>
                <FormField label="選擇雇主" required error={errors.customerId?.message}>
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
                </FormField>
              </FormGrid>

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

              <FileDropzone
                label="招募許可函"
                fileKey={watchedPermitKey}
                uploading={uploadingPermit}
                setUploading={setUploadingPermit}
                folder="recruitment-permits"
                onUploaded={key => setValue("recruitmentPermitFileKey", key)}
                onRemove={() => setValue("recruitmentPermitFileKey", null)}
                successMsg="招募許可函已上傳"
              />
            </FormSection>

            {/* 外國人資訊 */}
            <FormSection icon={<User className="w-3.5 h-3.5" />} title="外國人資訊">
              <FormGrid cols={1}>
                <FormField label="選擇外國人">
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
                </FormField>
              </FormGrid>

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
            </FormSection>

          </TabsContent>

          {/* ═══════ Tab 2：行政與保險體檢 ═══════ */}
          <TabsContent value="admin" className="space-y-6 mt-0">

            {/* 聘僱資料 */}
            <FormSection icon={<Calendar className="w-3.5 h-3.5" />} title="聘僱資料">
              {/* 聘僱時間 */}
              <p className="text-[13px] font-medium text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-3 h-3" /> 聘僱時間
              </p>
              <FormGrid cols={3}>
                <FormField label="接續聘僱日期">
                  <Input type="date" {...register("continuousEmploymentDate")} />
                </FormField>
                <FormField label="期間長度（月）">
                  <Input
                    type="number" min={1} max={36} placeholder="例：24"
                    {...register("employmentPeriodMonths", {
                      setValueAs: (v: string) => v === "" || v === null || v === undefined ? null : Number(v),
                    })}
                  />
                </FormField>
                <FormField label="終止聘僱日期">
                  <Input type="date" {...register("terminationDate")} />
                </FormField>
              </FormGrid>

              {/* 代辦事項 */}
              <p className="text-[13px] font-medium text-muted-foreground flex items-center gap-1.5 mt-2">
                <FileText className="w-3 h-3" /> 代辦事項
              </p>
              <FormGrid cols={3}>
                <FormField label="招募函代辦事項">
                  <Select
                    value={watchedRecruitmentAgency ?? "__none__"}
                    onValueChange={v => setValue("recruitmentAgencyItems", v === "__none__" ? null : v as any)}
                  >
                    <SelectTrigger><SelectValue placeholder="選擇" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— 未設定 —</SelectItem>
                      {AGENCY_ITEMS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="聘僱函代辦事項">
                  <Select
                    value={watchedEmploymentAgency ?? "__none__"}
                    onValueChange={v => setValue("employmentAgencyItems", v === "__none__" ? null : v as any)}
                  >
                    <SelectTrigger><SelectValue placeholder="選擇" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— 未設定 —</SelectItem>
                      {AGENCY_ITEMS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="聘僱後尚未完成保險">
                  <Select
                    value={watchedPostInsurance ?? "__none__"}
                    onValueChange={v => setValue("postEmploymentInsurance", v === "__none__" ? null : v as any)}
                  >
                    <SelectTrigger><SelectValue placeholder="選擇" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— 未設定 —</SelectItem>
                      {POST_INSURANCE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormField>
              </FormGrid>
            </FormSection>

            {/* 聘僱許可函與情況（終止類，預設摺疊） */}
            <FormSection icon={<Shield className="w-3.5 h-3.5" />} title="聘僱許可函與情況" defaultCollapsed>
              <FormGrid cols={2}>
                <FormField label="聘僱情況">
                  <Select
                    value={watchedEmpStatus ?? "__none__"}
                    onValueChange={v => setValue("employmentStatus", v === "__none__" ? null : v as any)}
                  >
                    <SelectTrigger><SelectValue placeholder="選擇聘僱情況" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— 未設定 —</SelectItem>
                      {EMPLOYMENT_STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormField>
              </FormGrid>
              <FileDropzone
                label="聘僱許可函"
                fileKey={watchedEmpPermitKey}
                uploading={uploadingEmpPermit}
                setUploading={setUploadingEmpPermit}
                folder="employment-permits"
                onUploaded={key => setValue("employmentPermitFileKey", key)}
                onRemove={() => setValue("employmentPermitFileKey", null)}
                successMsg="聘僱許可函已上傳"
              />
              <FileDropzone
                label="終止函"
                fileKey={watchedTerminationKey}
                uploading={uploadingTermination}
                setUploading={setUploadingTermination}
                folder="termination-letters"
                onUploaded={key => setValue("terminationLetterFileKey", key)}
                onRemove={() => setValue("terminationLetterFileKey", null)}
                successMsg="終止函已上傳"
              />
            </FormSection>

            {/* 承接通報 / 入國通報（3 日內） */}
            <FormSection
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.1a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l.81-.81a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              }
              title="承接通報 / 入國通報（3 日內）"
            >
              <FormGrid cols={3}>
                <FormField label="通報書序號">
                  <Input {...register("notificationNo")} placeholder="例：ABC-001" />
                </FormField>
                <FormField label="入國通報申請日">
                  <Input {...register("entryNotificationDate")} type="date" />
                </FormField>
                <FormField label="證明書序號">
                  <Input {...register("certificateNo")} placeholder="例：XYZ-002" />
                </FormField>
              </FormGrid>
            </FormSection>

            {/* 內政部移民署 */}
            <FormSection
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
              }
              title="內政部移民署"
            >
              <FormGrid cols={3}>
                <FormField label="一站式類別">
                  <Input {...register("niaCategory")} placeholder="例：居留證申請" />
                </FormField>
                <FormField label="一站式序號">
                  <Input {...register("niaNo")} placeholder="例：NIA-2025-001" />
                </FormField>
                <FormField label="居留證申請送審日">
                  <Input {...register("residencePermitSubmitDate")} type="date" />
                </FormField>
              </FormGrid>
            </FormSection>

            {/* 勞動部聘僱許可函 */}
            <FormSection
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              }
              title="勞動部聘僱許可函"
            >
              <FormGrid cols={3}>
                <FormField label="收文號">
                  <Input {...register("molReceiptNo")} placeholder="例：MOL-2025-001" />
                </FormField>
                <FormField label="聘僱函類別">
                  <Input {...register("employmentLetterCategory")} placeholder="例：初聘函" />
                </FormField>
                <FormField label="申請書送件日">
                  <Input {...register("applicationSubmitDate")} type="date" />
                </FormField>
                <FormField label="發文日期">
                  <Input {...register("issuanceDate")} type="date" />
                </FormField>
                <FormField label="核准收件日">
                  <Input {...register("approvalReceiptDate")} type="date" />
                </FormField>
              </FormGrid>
            </FormSection>

            {/* 保險管理 */}
            <FormSection icon={<Shield className="w-3.5 h-3.5" />} title="保險管理">
              <FormGrid cols={2}>
                <FormField label="健保投保（投保單位/編號）">
                  <Input {...register("healthInsurance")} placeholder="例：全民健保局、健保就醫分局" />
                </FormField>
              </FormGrid>
              <FileDropzone
                label="健保保單"
                fileKey={watchedHealthPolicyKey}
                uploading={uploadingHealthPolicy}
                setUploading={setUploadingHealthPolicy}
                folder="insurance"
                onUploaded={key => setValue("healthInsurancePolicyKey", key)}
                onRemove={() => setValue("healthInsurancePolicyKey", null)}
                successMsg="健保保單已上傳"
              />
              <FormGrid cols={2}>
                <FormField label="意外險（投保單位/編號）">
                  <Input {...register("accidentInsurance")} placeholder="例：山山保險、意外險保單編號" />
                </FormField>
              </FormGrid>
              <FileDropzone
                label="意外險保單"
                fileKey={watchedAccidentPolicyKey}
                uploading={uploadingAccidentPolicy}
                setUploading={setUploadingAccidentPolicy}
                folder="insurance"
                onUploaded={key => setValue("accidentInsurancePolicyKey", key)}
                onRemove={() => setValue("accidentInsurancePolicyKey", null)}
                successMsg="意外險保單已上傳"
              />
            </FormSection>

            {/* 體檢管理 */}
            <FormSection icon={<Activity className="w-3.5 h-3.5" />} title="體檢管理">
              {/* 前次體檢 */}
              <FormGrid cols={2}>
                <FormField label="前次體檢日期">
                  <Input {...register("prevMedicalExamDate")} type="date" />
                </FormField>
              </FormGrid>
              <FileDropzone
                label="前次體檢報告"
                fileKey={watchedPrevMedicalKey}
                uploading={uploadingPrevMedical}
                setUploading={setUploadingPrevMedical}
                folder="medical"
                onUploaded={key => setValue("prevMedicalReportKey", key)}
                onRemove={() => setValue("prevMedicalReportKey", null)}
                successMsg="前次體檢報告已上傳"
              />
              {/* 入境 3 天體檢 */}
              <FormGrid cols={2}>
                <FormField label="入境 3 天體檢日期">
                  <Input {...register("entryMedicalExamDate")} type="date" />
                </FormField>
              </FormGrid>
              <FileDropzone
                label="入境 3 天體檢報告"
                fileKey={watchedEntryMedicalKey}
                uploading={uploadingEntryMedical}
                setUploading={setUploadingEntryMedical}
                folder="medical"
                onUploaded={key => setValue("entryMedicalReportKey", key)}
                onRemove={() => setValue("entryMedicalReportKey", null)}
                successMsg="入境 3 天體檢報告已上傳"
              />
              {/* 6 / 18 / 30 個月體檢 */}
              <FormGrid cols={3}>
                <FormField label="6 個月體檢日期">
                  <Input {...register("exam6mDate")} type="date" />
                </FormField>
                <FormField label="18 個月體檢日期">
                  <Input {...register("exam18mDate")} type="date" />
                </FormField>
                <FormField label="30 個月體檢日期">
                  <Input {...register("exam30mDate")} type="date" />
                </FormField>
              </FormGrid>
              <FileDropzone
                label="6 個月體檢報告"
                fileKey={watched6mKey}
                uploading={uploading6m}
                setUploading={setUploading6m}
                folder="medical"
                onUploaded={key => setValue("exam6mReportKey", key)}
                onRemove={() => setValue("exam6mReportKey", null)}
                successMsg="6 個月體檢報告已上傳"
              />
              <FileDropzone
                label="18 個月體檢報告"
                fileKey={watched18mKey}
                uploading={uploading18m}
                setUploading={setUploading18m}
                folder="medical"
                onUploaded={key => setValue("exam18mReportKey", key)}
                onRemove={() => setValue("exam18mReportKey", null)}
                successMsg="18 個月體檢報告已上傳"
              />
              <FileDropzone
                label="30 個月體檢報告"
                fileKey={watched30mKey}
                uploading={uploading30m}
                setUploading={setUploading30m}
                folder="medical"
                onUploaded={key => setValue("exam30mReportKey", key)}
                onRemove={() => setValue("exam30mReportKey", null)}
                successMsg="30 個月體檢報告已上傳"
              />
            </FormSection>

            {/* 備註 */}
            <FormSection icon={<FileText className="w-3.5 h-3.5" />} title="備註">
              <FormGrid cols={1}>
                <FormField label="備註">
                  <Textarea {...register("notes")} placeholder="案件說明、特殊需求..." rows={3} />
                </FormField>
              </FormGrid>
            </FormSection>

          </TabsContent>
        </Tabs>
      </form>
    </FormModal>
  );
}
