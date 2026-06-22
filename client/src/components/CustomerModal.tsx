import { useEffect, useRef, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  CONTRACT_STATUS_OPTIONS, PRICING_TIER_OPTIONS, EMPLOYER_TYPE_OPTIONS,
  CASE_STATUS_OPTIONS, JOB_SEEKER_TYPE_OPTIONS,
  RECRUITMENT_LETTER_TYPE_OPTIONS, EMPLOYMENT_LETTER_TYPE_OPTIONS,
} from "@/lib/constants";
import { validateTwPhone, validateTaxId } from "@/lib/validation";
import { useFormEnterNav } from "@/hooks/useFormEnterNav";
import { Paperclip, X, Loader2, FileText, Image } from "lucide-react";

// ─── 型別 ─────────────────────────────────────────────────────────────────────
interface CustomerFormData {
  employerType: string;
  // 基本資料
  name: string;
  employerNo: string;
  phone: string;
  landline: string;
  address: string;
  registeredAddress: string;
  referrer: string;
  // 個人雇主
  idNo: string;
  preCourseNo: string;
  // 被照顧者
  careReceiverNo: string;
  careReceiverName: string;
  careReceiverBirthDate: string;
  careReceiverIdNo: string;
  careReceiverAddress: string;
  careReceiverQualification: string;
  careReceiverRelation: string;
  // 公司行號
  taxId: string;
  industry: string;
  contactName: string;
  contactPhone: string;
  // 媒合案件
  caseNo: string;
  caseStatus: string;
  // 申請資格
  jobSeekerType: string;
  jobSeekerDate: string;
  recruitmentLetterType: string;
  recruitmentLetterDate: string;
  recruitmentPermitNote: string;
  recruitmentPermitDays: string;
  previousWorkerDepartureDate: string;
  // 聘僱函
  employmentLetterType: string;
  employmentLetterDate: string;
  approvedStartDate: string;
  approvedPeriod: string;
  approvedEndDate: string;
  // 系統
  contractStatus: string;
  pricingTier: string;
  managerId: string;
  notes: string;
}

// 附件 key 欄位
type AttachmentKey =
  | "idFrontKey" | "idBackKey"
  | "careReceiverIdFrontKey" | "careReceiverIdBackKey"
  | "jobSeekerFileKey" | "recruitmentLetterFileKey" | "employmentLetterFileKey";

interface AttachmentState {
  key: string | null;
  uploading: boolean;
  filename: string | null;
}

type AttachmentsState = Record<AttachmentKey, AttachmentState>;

const ATTACHMENT_LABELS: Record<AttachmentKey, { label: string; accept: string; isImage: boolean }> = {
  idFrontKey: { label: "雇主身分證正面", accept: "image/*", isImage: true },
  idBackKey: { label: "雇主身分證反面", accept: "image/*", isImage: true },
  careReceiverIdFrontKey: { label: "被看護者身分證正面", accept: "image/*", isImage: true },
  careReceiverIdBackKey: { label: "被看護者身分證反面", accept: "image/*", isImage: true },
  jobSeekerFileKey: { label: "求才資格檔案", accept: ".pdf,image/*", isImage: false },
  recruitmentLetterFileKey: { label: "招募函許可檔案", accept: ".pdf,image/*", isImage: false },
  employmentLetterFileKey: { label: "聘僱函檔案", accept: ".pdf,image/*", isImage: false },
};

const emptyAttachments = (): AttachmentsState =>
  Object.fromEntries(
    (Object.keys(ATTACHMENT_LABELS) as AttachmentKey[]).map(k => [k, { key: null, uploading: false, filename: null }])
  ) as AttachmentsState;

interface CustomerModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editId?: number | null;
}

// ─── 區段標題元件 ─────────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-2 pb-1">
      <div className="h-px flex-1 bg-border" />
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">{children}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

// ─── 附件上傳元件 ─────────────────────────────────────────────────────────────
function AttachmentUploader({
  fieldKey,
  state,
  onUpload,
  onRemove,
}: {
  fieldKey: AttachmentKey;
  state: AttachmentState;
  onUpload: (key: AttachmentKey, file: File) => void;
  onRemove: (key: AttachmentKey) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const meta = ATTACHMENT_LABELS[fieldKey];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // 圖片欄位只允許圖片
    if (meta.isImage && !file.type.startsWith("image/")) {
      toast.error(`「${meta.label}」只接受圖片格式（JPG / PNG / WEBP）`);
      e.target.value = "";
      return;
    }
    onUpload(fieldKey, file);
    e.target.value = "";
  };

  return (
    <div>
      <Label className="text-sm">{meta.label}</Label>
      <div className="mt-1.5 flex items-center gap-2">
        {state.key ? (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted text-sm flex-1 min-w-0">
            {meta.isImage ? <Image className="w-3.5 h-3.5 shrink-0 text-blue-500" /> : <FileText className="w-3.5 h-3.5 shrink-0 text-amber-500" />}
            <span className="truncate text-xs text-muted-foreground">{state.filename || "已上傳"}</span>
            <button
              type="button"
              onClick={() => onRemove(fieldKey)}
              className="ml-auto shrink-0 text-muted-foreground hover:text-destructive transition-colors"
              aria-label="移除附件"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={state.uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-dashed border-border text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {state.uploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Paperclip className="w-3.5 h-3.5" />
            )}
            {state.uploading ? "上傳中..." : "選擇檔案"}
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={meta.accept}
          className="hidden"
          onChange={handleChange}
        />
      </div>
    </div>
  );
}

// ─── 主元件 ───────────────────────────────────────────────────────────────────
export function CustomerModal({ open, onClose, onSuccess, editId }: CustomerModalProps) {
  const isEdit = !!editId;
  const utils = trpc.useUtils();
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [pendingData, setPendingData] = useState<CustomerFormData | null>(null);
  const [attachments, setAttachments] = useState<AttachmentsState>(emptyAttachments);
  const formRef = useRef<HTMLFormElement>(null);
  const firstInputRef = useRef<HTMLInputElement | null>(null);
  const handleEnterNav = useFormEnterNav(formRef);

  const { data: managers } = trpc.managers.list.useQuery();
  const { data: existingCustomer } = trpc.customers.getById.useQuery(
    { id: editId! },
    { enabled: !!editId }
  );

  const {
    register, handleSubmit, setValue, watch, reset,
    formState: { errors }, setError, clearErrors,
  } = useForm<CustomerFormData>({
    defaultValues: {
      employerType: "company",
      name: "", employerNo: "", phone: "", landline: "",
      address: "", registeredAddress: "", referrer: "",
      idNo: "", preCourseNo: "",
      careReceiverNo: "", careReceiverName: "", careReceiverBirthDate: "",
      careReceiverIdNo: "", careReceiverAddress: "", careReceiverQualification: "", careReceiverRelation: "",
      taxId: "", industry: "", contactName: "", contactPhone: "",
      caseNo: "", caseStatus: "",
      jobSeekerType: "", jobSeekerDate: "",
      recruitmentLetterType: "", recruitmentLetterDate: "",
      recruitmentPermitNote: "", recruitmentPermitDays: "", previousWorkerDepartureDate: "",
      employmentLetterType: "", employmentLetterDate: "",
      approvedStartDate: "", approvedPeriod: "", approvedEndDate: "",
      contractStatus: "", pricingTier: "", managerId: "", notes: "",
    },
  });

  const employerType = watch("employerType");
  const isIndividual = employerType === "individual";

  // Dual-ref for first input
  const nameRegister = register("name");
  const nameRefCallback = (el: HTMLInputElement | null) => {
    nameRegister.ref(el);
    firstInputRef.current = el;
  };

  useEffect(() => {
    if (open) setTimeout(() => firstInputRef.current?.focus(), 80);
  }, [open]);

  useEffect(() => {
    if (open && existingCustomer) {
      const c = existingCustomer as any;
      reset({
        employerType: c.employerType ?? "company",
        name: c.name ?? "",
        employerNo: c.employerNo ?? "",
        phone: c.phone ?? "",
        landline: c.landline ?? "",
        address: c.address ?? "",
        registeredAddress: c.registeredAddress ?? "",
        referrer: c.referrer ?? "",
        idNo: c.idNo ?? "",
        preCourseNo: c.preCourseNo ?? "",
        careReceiverNo: c.careReceiverNo ?? "",
        careReceiverName: c.careReceiverName ?? "",
        careReceiverBirthDate: c.careReceiverBirthDate ?? "",
        careReceiverIdNo: c.careReceiverIdNo ?? "",
        careReceiverAddress: c.careReceiverAddress ?? "",
        careReceiverQualification: c.careReceiverQualification ?? "",
        careReceiverRelation: c.careReceiverRelation ?? "",
        taxId: c.taxId ?? "",
        industry: c.industry ?? "",
        contactName: c.contactName ?? "",
        contactPhone: c.contactPhone ?? "",
        caseNo: c.caseNo ?? "",
        caseStatus: c.caseStatus ?? "",
        jobSeekerType: c.jobSeekerType ?? "",
        jobSeekerDate: c.jobSeekerDate ?? "",
        recruitmentLetterType: c.recruitmentLetterType ?? "",
        recruitmentLetterDate: c.recruitmentLetterDate ?? "",
        recruitmentPermitNote: c.recruitmentPermitNote ?? "",
        recruitmentPermitDays: c.recruitmentPermitDays != null ? String(c.recruitmentPermitDays) : "",
        previousWorkerDepartureDate: c.previousWorkerDepartureDate ?? "",
        employmentLetterType: c.employmentLetterType ?? "",
        employmentLetterDate: c.employmentLetterDate ?? "",
        approvedStartDate: c.approvedStartDate ?? "",
        approvedPeriod: c.approvedPeriod ?? "",
        approvedEndDate: c.approvedEndDate ?? "",
        contractStatus: c.contractStatus ?? "",
        pricingTier: c.pricingTier ?? "",
        managerId: String(c.managerId),
        notes: c.notes ?? "",
      });
      // 還原附件
      const newAttachments = emptyAttachments();
      (Object.keys(ATTACHMENT_LABELS) as AttachmentKey[]).forEach(k => {
        const v = c[k];
        if (v) newAttachments[k] = { key: v, uploading: false, filename: v.split("/").pop() ?? null };
      });
      setAttachments(newAttachments);
    } else if (open && !editId) {
      reset({
        employerType: "company",
        name: "", employerNo: "", phone: "", landline: "",
        address: "", registeredAddress: "", referrer: "",
        idNo: "", preCourseNo: "",
        careReceiverNo: "", careReceiverName: "", careReceiverBirthDate: "",
        careReceiverIdNo: "", careReceiverAddress: "", careReceiverQualification: "", careReceiverRelation: "",
        taxId: "", industry: "", contactName: "", contactPhone: "",
        caseNo: "", caseStatus: "",
        jobSeekerType: "", jobSeekerDate: "",
        recruitmentLetterType: "", recruitmentLetterDate: "",
        recruitmentPermitNote: "", recruitmentPermitDays: "", previousWorkerDepartureDate: "",
        employmentLetterType: "", employmentLetterDate: "",
        approvedStartDate: "", approvedPeriod: "", approvedEndDate: "",
        contractStatus: "", pricingTier: "", managerId: "", notes: "",
      });
      setAttachments(emptyAttachments());
      setShowDuplicateWarning(false);
      setPendingData(null);
    }
  }, [open, existingCustomer, editId, reset]);

  // ─── S3 上傳 ──────────────────────────────────────────────────────────────
  const uploadMutation = trpc.customers.uploadFile.useMutation();

  const handleUpload = useCallback(async (fieldKey: AttachmentKey, file: File) => {
    setAttachments(prev => ({ ...prev, [fieldKey]: { ...prev[fieldKey], uploading: true } }));
    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
      const safeFileName = `file_${Date.now()}.${ext}`;
      const result = await uploadMutation.mutateAsync({
        fieldName: fieldKey,
        fileName: safeFileName,
        fileBase64: base64,
        mimeType: file.type || "application/octet-stream",
      });
      setAttachments(prev => ({ ...prev, [fieldKey]: { key: result.key, uploading: false, filename: file.name } }));
      toast.success(`${ATTACHMENT_LABELS[fieldKey].label} 上傳成功`);
    } catch (err: any) {
      toast.error(`上傳失敗：${err?.message ?? "未知錯誤"}`);
      setAttachments(prev => ({ ...prev, [fieldKey]: { ...prev[fieldKey], uploading: false } }));
    }
  }, [uploadMutation]);

  const handleRemove = useCallback((fieldKey: AttachmentKey) => {
    setAttachments(prev => ({ ...prev, [fieldKey]: { key: null, uploading: false, filename: null } }));
  }, []);

  // ─── Mutations ────────────────────────────────────────────────────────────
  const createMutation = trpc.customers.create.useMutation({
    onSuccess: () => {
      utils.customers.list.invalidate();
      toast.success("雇主已新增");
      onSuccess();
      onClose();
    },
    onError: (err) => {
      if (err.message.startsWith("DUPLICATE_NAME:")) {
        setShowDuplicateWarning(true);
      } else {
        toast.error(err.message);
      }
    },
  });

  const updateMutation = trpc.customers.update.useMutation({
    onSuccess: () => {
      utils.customers.list.invalidate();
      toast.success("雇主資料已更新");
      onSuccess();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const buildPayload = (data: CustomerFormData, forceCreate = false) => ({
    employerType: data.employerType as "individual" | "company",
    name: data.name.trim(),
    employerNo: data.employerNo.trim() || undefined,
    phone: data.phone.trim() || undefined,
    landline: data.landline.trim() || undefined,
    address: data.address.trim() || undefined,
    registeredAddress: data.registeredAddress.trim() || undefined,
    referrer: data.referrer.trim() || undefined,
    idNo: data.idNo.trim() || undefined,
    preCourseNo: data.preCourseNo.trim() || undefined,
    idFrontKey: attachments.idFrontKey.key || undefined,
    idBackKey: attachments.idBackKey.key || undefined,
    careReceiverNo: data.careReceiverNo.trim() || undefined,
    careReceiverName: data.careReceiverName.trim() || undefined,
    careReceiverBirthDate: data.careReceiverBirthDate.trim() || undefined,
    careReceiverIdNo: data.careReceiverIdNo.trim() || undefined,
    careReceiverAddress: data.careReceiverAddress.trim() || undefined,
    careReceiverQualification: data.careReceiverQualification.trim() || undefined,
    careReceiverRelation: data.careReceiverRelation.trim() || undefined,
    careReceiverIdFrontKey: attachments.careReceiverIdFrontKey.key || undefined,
    careReceiverIdBackKey: attachments.careReceiverIdBackKey.key || undefined,
    taxId: data.taxId.trim() || undefined,
    industry: data.industry.trim() || undefined,
    contactName: data.contactName.trim() || undefined,
    contactPhone: data.contactPhone.trim() || undefined,
    caseNo: data.caseNo.trim() || undefined,
    caseStatus: (data.caseStatus || undefined) as any,
    jobSeekerType: (data.jobSeekerType || undefined) as any,
    jobSeekerDate: data.jobSeekerDate.trim() || undefined,
    jobSeekerFileKey: attachments.jobSeekerFileKey.key || undefined,
    recruitmentLetterType: (data.recruitmentLetterType || undefined) as any,
    recruitmentLetterDate: data.recruitmentLetterDate.trim() || undefined,
    recruitmentLetterFileKey: attachments.recruitmentLetterFileKey.key || undefined,
    recruitmentPermitNote: data.recruitmentPermitNote.trim() || undefined,
    recruitmentPermitDays: data.recruitmentPermitDays ? parseInt(data.recruitmentPermitDays) : undefined,
    previousWorkerDepartureDate: data.previousWorkerDepartureDate.trim() || undefined,
    employmentLetterType: (data.employmentLetterType || undefined) as any,
    employmentLetterDate: data.employmentLetterDate.trim() || undefined,
    employmentLetterFileKey: attachments.employmentLetterFileKey.key || undefined,
    approvedStartDate: data.approvedStartDate.trim() || undefined,
    approvedPeriod: data.approvedPeriod.trim() || undefined,
    approvedEndDate: data.approvedEndDate.trim() || undefined,
    contractStatus: data.contractStatus as any,
    pricingTier: data.pricingTier as any,
    managerId: parseInt(data.managerId),
    notes: data.notes.trim() || undefined,
    forceCreate,
  });

  const onSubmit = (data: CustomerFormData) => {
    let hasError = false;

    if (!data.name.trim() || data.name.trim().length < 2) {
      setError("name", { message: "名稱至少 2 字" }); hasError = true;
    }
    if (data.taxId && !validateTaxId(data.taxId.trim())) {
      setError("taxId", { message: "統一編號格式不正確" }); hasError = true;
    }
    if (!data.contractStatus) {
      setError("contractStatus", { message: "此欄位為必填" }); hasError = true;
    }
    if (!data.pricingTier) {
      setError("pricingTier", { message: "此欄位為必填" }); hasError = true;
    }
    if (!data.managerId) {
      setError("managerId", { message: "此欄位為必填" }); hasError = true;
    }
    if (data.contactPhone && !validateTwPhone(data.contactPhone)) {
      setError("contactPhone", { message: "電話格式不正確" }); hasError = true;
    }
    if (data.phone && !validateTwPhone(data.phone)) {
      setError("phone", { message: "電話格式不正確" }); hasError = true;
    }

    if (hasError) {
      setTimeout(() => {
        const firstError = document.querySelector("[data-field-error]");
        firstError?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
      return;
    }

    setPendingData(data);
    if (isEdit) {
      updateMutation.mutate({ id: editId!, ...buildPayload(data) });
    } else {
      createMutation.mutate(buildPayload(data, false));
    }
  };

  const handleForceCreate = () => {
    if (!pendingData) return;
    setShowDuplicateWarning(false);
    createMutation.mutate(buildPayload(pendingData, true));
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const enterProps = { onKeyDown: handleEnterNav };

  // ─── 選擇器輔助 ───────────────────────────────────────────────────────────
  const SelectField = ({
    id, label, fieldName, options, required, placeholder = "請選擇",
  }: {
    id: string; label: string; fieldName: keyof CustomerFormData;
    options: readonly { value: string; label: string }[];
    required?: boolean; placeholder?: string;
  }) => (
    <div>
      <Label htmlFor={id}>{label}{required && <span className="text-destructive ml-1">*</span>}</Label>
      <Select
        value={watch(fieldName) || ""}
        onValueChange={(v) => { setValue(fieldName, v); clearErrors(fieldName as any); }}
      >
        <SelectTrigger id={id} className="mt-2">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {(errors as any)[fieldName] && (
        <p className="field-error" data-field-error>{(errors as any)[fieldName].message}</p>
      )}
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEdit ? "編輯雇主資料" : "新增雇主"}</DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              按 <kbd className="kbd">Tab</kbd> 切換欄位，<kbd className="kbd">Enter</kbd> 跳至下一欄
            </p>
          </DialogHeader>

          <form ref={formRef} onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">

            {/* ── 雇主類型 ─────────────────────────────────────────────────── */}
            <div>
              <Label>雇主類型 <span className="text-destructive">*</span></Label>
              <div className="flex gap-3 mt-2">
                {EMPLOYER_TYPE_OPTIONS.map(o => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setValue("employerType", o.value)}
                    className={`flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-all ${
                      watch("employerType") === o.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── 申請人基本資料 ───────────────────────────────────────────── */}
            <SectionTitle>申請人基本資料</SectionTitle>

            {/* 姓名 / 雇主編號 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="c-name">
                  {isIndividual ? "雇主姓名" : "公司名稱"} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="c-name"
                  {...nameRegister}
                  ref={nameRefCallback}
                  {...enterProps}
                  placeholder={isIndividual ? "請輸入雇主姓名" : "請輸入公司名稱"}
                  className="mt-2"
                  autoComplete="off"
                />
                {errors.name && <p className="field-error" data-field-error>{errors.name.message}</p>}
              </div>
              <div>
                <Label htmlFor="c-employerNo">雇主編號</Label>
                <Input
                  id="c-employerNo"
                  {...register("employerNo")}
                  {...enterProps}
                  placeholder="例：00033"
                  className="mt-2 font-mono"
                />
              </div>
            </div>

            {/* 行動電話 / 市內電話 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="c-phone">行動電話</Label>
                <Input
                  id="c-phone"
                  {...register("phone")}
                  {...enterProps}
                  placeholder="0912-345-678"
                  className="mt-2"
                  inputMode="tel"
                />
                {errors.phone && <p className="field-error" data-field-error>{errors.phone.message}</p>}
              </div>
              <div>
                <Label htmlFor="c-landline">市內電話</Label>
                <Input
                  id="c-landline"
                  {...register("landline")}
                  {...enterProps}
                  placeholder="02-1234-5678"
                  className="mt-2"
                  inputMode="tel"
                />
              </div>
            </div>

            {/* 通訊地址 */}
            <div>
              <Label htmlFor="c-address">通訊地址</Label>
              <Input id="c-address" {...register("address")} {...enterProps} placeholder="請輸入通訊地址" className="mt-2" autoComplete="off" />
            </div>

            {/* 戶籍地址 / 介紹人 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="c-registeredAddress">{isIndividual ? "戶籍地址" : "登記地址"}</Label>
                <Input id="c-registeredAddress" {...register("registeredAddress")} {...enterProps} placeholder="請輸入地址" className="mt-2" autoComplete="off" />
              </div>
              <div>
                <Label htmlFor="c-referrer">介紹人</Label>
                <Input id="c-referrer" {...register("referrer")} {...enterProps} placeholder="介紹人姓名" className="mt-2" autoComplete="off" />
              </div>
            </div>

            {/* 個人雇主專屬 */}
            {isIndividual && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="c-idNo">雇主國民身分證字號</Label>
                    <Input id="c-idNo" {...register("idNo")} {...enterProps} placeholder="A123456789" className="mt-2 font-mono" maxLength={10} />
                  </div>
                  <div>
                    <Label htmlFor="c-preCourseNo">聘前講習證明序號</Label>
                    <Input id="c-preCourseNo" {...register("preCourseNo")} {...enterProps} placeholder="請輸入序號" className="mt-2 font-mono" />
                  </div>
                </div>
                {/* 身分證附件 */}
                <div className="grid grid-cols-2 gap-4">
                  <AttachmentUploader fieldKey="idFrontKey" state={attachments.idFrontKey} onUpload={handleUpload} onRemove={handleRemove} />
                  <AttachmentUploader fieldKey="idBackKey" state={attachments.idBackKey} onUpload={handleUpload} onRemove={handleRemove} />
                </div>
              </>
            )}

            {/* 公司行號專屬 */}
            {!isIndividual && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="c-taxId">統一編號</Label>
                    <Input id="c-taxId" {...register("taxId")} {...enterProps} placeholder="8 碼數字" maxLength={8} className="mt-2 font-mono" inputMode="numeric" />
                    {errors.taxId && <p className="field-error" data-field-error>{errors.taxId.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="c-industry">產業</Label>
                    <Input id="c-industry" {...register("industry")} {...enterProps} placeholder="例：製造業、農業" className="mt-2" autoComplete="off" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="c-contactName">聯絡窗口姓名</Label>
                    <Input id="c-contactName" {...register("contactName")} {...enterProps} placeholder="姓名" className="mt-2" autoComplete="off" />
                  </div>
                  <div>
                    <Label htmlFor="c-contactPhone">聯絡窗口電話</Label>
                    <Input id="c-contactPhone" {...register("contactPhone")} {...enterProps} placeholder="0912-345-678" className="mt-2" inputMode="tel" />
                    {errors.contactPhone && <p className="field-error" data-field-error>{errors.contactPhone.message}</p>}
                  </div>
                </div>
              </>
            )}

            {/* ── 被照顧者基本資料（個人雇主） ──────────────────────────── */}
            {isIndividual && (
              <>
                <SectionTitle>被照顧者基本資料</SectionTitle>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="c-careReceiverNo">被看護者編號</Label>
                    <Input id="c-careReceiverNo" {...register("careReceiverNo")} {...enterProps} placeholder="例：00033" className="mt-2 font-mono" />
                  </div>
                  <div>
                    <Label htmlFor="c-careReceiverName">被照顧者姓名</Label>
                    <Input id="c-careReceiverName" {...register("careReceiverName")} {...enterProps} placeholder="請輸入姓名" className="mt-2" autoComplete="off" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="c-careReceiverBirthDate">出生年月日</Label>
                    <Input id="c-careReceiverBirthDate" {...register("careReceiverBirthDate")} {...enterProps} type="date" className="mt-2" />
                  </div>
                  <div>
                    <Label htmlFor="c-careReceiverIdNo">國民身分證字號</Label>
                    <Input id="c-careReceiverIdNo" {...register("careReceiverIdNo")} {...enterProps} placeholder="A123456789" className="mt-2 font-mono" maxLength={10} />
                  </div>
                  <div>
                    <Label htmlFor="c-careReceiverQualification">被照顧者申請資格</Label>
                    <Input id="c-careReceiverQualification" {...register("careReceiverQualification")} {...enterProps} placeholder="請輸入申請資格" className="mt-2" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="c-careReceiverAddress">被照顧者戶籍地址</Label>
                    <Input id="c-careReceiverAddress" {...register("careReceiverAddress")} {...enterProps} placeholder="請輸入戶籍地址" className="mt-2" autoComplete="off" />
                  </div>
                  <div>
                    <Label htmlFor="c-careReceiverRelation">聘前講習上課者與被看護者關係</Label>
                    <Input id="c-careReceiverRelation" {...register("careReceiverRelation")} {...enterProps} placeholder="例：子女、配偶" className="mt-2" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <AttachmentUploader fieldKey="careReceiverIdFrontKey" state={attachments.careReceiverIdFrontKey} onUpload={handleUpload} onRemove={handleRemove} />
                  <AttachmentUploader fieldKey="careReceiverIdBackKey" state={attachments.careReceiverIdBackKey} onUpload={handleUpload} onRemove={handleRemove} />
                </div>
              </>
            )}

            {/* ── 媒合案件 ─────────────────────────────────────────────────── */}
            <SectionTitle>媒合案件</SectionTitle>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="c-caseNo">媒合案件編號</Label>
                <Input id="c-caseNo" {...register("caseNo")} {...enterProps} placeholder="例：00033" className="mt-2 font-mono" />
              </div>
              <SelectField id="c-caseStatus" label="管理狀態" fieldName="caseStatus" options={CASE_STATUS_OPTIONS} />
              <div>
                <Label>管理負責人 <span className="text-destructive">*</span></Label>
                <Select
                  value={watch("managerId") || ""}
                  onValueChange={(v) => { setValue("managerId", v); clearErrors("managerId"); }}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="請選擇負責人" />
                  </SelectTrigger>
                  <SelectContent>
                    {managers?.map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.managerId && <p className="field-error" data-field-error>{errors.managerId.message}</p>}
              </div>
            </div>

            {/* ── 申請資格 ─────────────────────────────────────────────────── */}
            <SectionTitle>申請資格</SectionTitle>
            <div className="grid grid-cols-3 gap-4">
              <SelectField id="c-jobSeekerType" label="求才類別" fieldName="jobSeekerType" options={JOB_SEEKER_TYPE_OPTIONS} />
              <div>
                <Label htmlFor="c-jobSeekerDate">求才日期</Label>
                <Input id="c-jobSeekerDate" {...register("jobSeekerDate")} type="date" className="mt-2" />
              </div>
              <AttachmentUploader fieldKey="jobSeekerFileKey" state={attachments.jobSeekerFileKey} onUpload={handleUpload} onRemove={handleRemove} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <SelectField id="c-recruitmentLetterType" label="招募函類別" fieldName="recruitmentLetterType" options={RECRUITMENT_LETTER_TYPE_OPTIONS} />
              <div>
                <Label htmlFor="c-recruitmentLetterDate">招募函申請日期</Label>
                <Input id="c-recruitmentLetterDate" {...register("recruitmentLetterDate")} type="date" className="mt-2" />
              </div>
              <AttachmentUploader fieldKey="recruitmentLetterFileKey" state={attachments.recruitmentLetterFileKey} onUpload={handleUpload} onRemove={handleRemove} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Label htmlFor="c-recruitmentPermitNote">招募許可情況說明</Label>
                <Input id="c-recruitmentPermitNote" {...register("recruitmentPermitNote")} {...enterProps} placeholder="請輸入說明" className="mt-2" />
              </div>
              <div>
                <Label htmlFor="c-recruitmentPermitDays">許可天數</Label>
                <Input id="c-recruitmentPermitDays" {...register("recruitmentPermitDays")} {...enterProps} type="number" min={0} placeholder="天數" className="mt-2" inputMode="numeric" />
              </div>
            </div>
            <div>
              <Label htmlFor="c-previousWorkerDepartureDate">舊工離境日期</Label>
              <Input id="c-previousWorkerDepartureDate" {...register("previousWorkerDepartureDate")} type="date" className="mt-2 max-w-[200px]" />
            </div>

            {/* ── 聘僱函 ───────────────────────────────────────────────────── */}
            <SectionTitle>聘僱函</SectionTitle>
            <div className="grid grid-cols-3 gap-4">
              <SelectField id="c-employmentLetterType" label="聘僱函類別" fieldName="employmentLetterType" options={EMPLOYMENT_LETTER_TYPE_OPTIONS} />
              <div>
                <Label htmlFor="c-employmentLetterDate">聘僱函申請日期</Label>
                <Input id="c-employmentLetterDate" {...register("employmentLetterDate")} type="date" className="mt-2" />
              </div>
              <AttachmentUploader fieldKey="employmentLetterFileKey" state={attachments.employmentLetterFileKey} onUpload={handleUpload} onRemove={handleRemove} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="c-approvedStartDate">核准聘僱起始日</Label>
                <Input id="c-approvedStartDate" {...register("approvedStartDate")} type="date" className="mt-2" />
              </div>
              <div>
                <Label htmlFor="c-approvedPeriod">核准聘僱期限</Label>
                <Input id="c-approvedPeriod" {...register("approvedPeriod")} {...enterProps} placeholder="例：3年" className="mt-2" />
              </div>
              <div>
                <Label htmlFor="c-approvedEndDate">核准聘僱截止日</Label>
                <Input id="c-approvedEndDate" {...register("approvedEndDate")} type="date" className="mt-2" />
              </div>
            </div>

            {/* ── 系統管理 ─────────────────────────────────────────────────── */}
            <SectionTitle>系統管理</SectionTitle>
            <div className="grid grid-cols-2 gap-4">
              <SelectField id="c-contractStatus" label="合約狀態" fieldName="contractStatus" options={CONTRACT_STATUS_OPTIONS} required />
              <SelectField id="c-pricingTier" label="定價級距" fieldName="pricingTier" options={PRICING_TIER_OPTIONS} required />
            </div>

            {/* 備註 */}
            <div>
              <Label htmlFor="c-notes">備註</Label>
              <Textarea id="c-notes" {...register("notes")} placeholder="備註說明（Enter 換行）" className="mt-2 resize-none" rows={3} />
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>取消</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "儲存中..." : isEdit ? "儲存變更" : "新增雇主"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 同名警告 Dialog */}
      <Dialog open={showDuplicateWarning} onOpenChange={setShowDuplicateWarning}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>同名雇主警告</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">系統中已存在同名雇主，確定要繼續建立嗎？</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDuplicateWarning(false)}>取消</Button>
            <Button onClick={handleForceCreate} disabled={isPending}>確定建立</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
