import { useEffect, useRef } from "react";
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
  LIFECYCLE_STATUS_OPTIONS, DOCUMENT_STATUS_OPTIONS, ID_TYPE_OPTIONS,
} from "@/lib/constants";
import {
  validateTwPhone, validateResidentPermit, validatePassport, validateNotFutureDate,
} from "@/lib/validation";
import { useFormEnterNav } from "@/hooks/useFormEnterNav";
import { ExternalLink } from "lucide-react";

interface WorkerFormData {
  name: string;
  nationality: string;
  idType: "resident_permit" | "passport";
  idNumber: string;
  lifecycleStatus: string;
  documentStatus: string;
  managerId: string;
  phone: string;
  entryDate: string;
  idExpiryDate: string;
  externalLink: string;
  notes: string;
}

interface WorkerModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editId?: number | null;
}

export function WorkerModal({ open, onClose, onSuccess, editId }: WorkerModalProps) {
  const isEdit = !!editId;
  const utils = trpc.useUtils();
  const formRef = useRef<HTMLFormElement>(null);
  const firstInputRef = useRef<HTMLInputElement | null>(null);
  const handleEnterNav = useFormEnterNav(formRef);

  const { data: managers } = trpc.managers.list.useQuery();
  const { data: existingWorker } = trpc.workers.getById.useQuery(
    { id: editId! },
    { enabled: !!editId }
  );

  const {
    register, handleSubmit, setValue, watch, reset,
    formState: { errors }, setError, clearErrors,
  } = useForm<WorkerFormData>({
    defaultValues: {
      name: "", nationality: "", idType: "resident_permit", idNumber: "",
      lifecycleStatus: "", documentStatus: "", managerId: "",
      phone: "", entryDate: "", idExpiryDate: "", externalLink: "", notes: "",
    },
  });

  const idType = watch("idType");
  const lifecycleStatus = watch("lifecycleStatus");

  // Dual-ref: wire react-hook-form register AND firstInputRef to the same element
  const nameRegister = register("name");
  const nameRefCallback = (el: HTMLInputElement | null) => {
    nameRegister.ref(el);
    firstInputRef.current = el;
  };

  // Auto-focus first field when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => firstInputRef.current?.focus(), 80);
    }
  }, [open]);

  // Populate form when editing
  useEffect(() => {
    if (open && existingWorker) {
      reset({
        name: existingWorker.name ?? "",
        nationality: existingWorker.nationality ?? "",
        idType: existingWorker.idType,
        idNumber: existingWorker.idNumber,
        lifecycleStatus: existingWorker.lifecycleStatus,
        documentStatus: existingWorker.documentStatus,
        managerId: String(existingWorker.managerId),
        phone: existingWorker.phone ?? "",
        entryDate: existingWorker.entryDate ?? "",
        idExpiryDate: existingWorker.idExpiryDate ?? "",
        externalLink: existingWorker.externalLink ?? "",
        notes: existingWorker.notes ?? "",
      });
    } else if (open && !editId) {
      reset({
        name: "", nationality: "", idType: "resident_permit", idNumber: "",
        lifecycleStatus: "", documentStatus: "", managerId: "",
        phone: "", entryDate: "", idExpiryDate: "", externalLink: "", notes: "",
      });
    }
  }, [open, existingWorker, editId, reset]);

  const createMutation = trpc.workers.create.useMutation({
    onSuccess: () => {
      utils.workers.list.invalidate();
      toast.success("移工已新增");
      onSuccess();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.workers.update.useMutation({
    onSuccess: () => {
      utils.workers.list.invalidate();
      toast.success("移工資料已更新");
      onSuccess();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const onSubmit = (data: WorkerFormData) => {
    let hasError = false;

    if (!data.name.trim() || data.name.trim().length < 2) {
      setError("name", { message: "姓名至少 2 字" }); hasError = true;
    }
    if (!data.idNumber.trim()) {
      setError("idNumber", { message: "此欄位為必填" }); hasError = true;
    } else if (data.idType === "resident_permit" && !validateResidentPermit(data.idNumber)) {
      setError("idNumber", { message: "居留證格式不正確（1 英文字母 + 1 或 2 + 8 位數字）" }); hasError = true;
    } else if (data.idType === "passport" && !validatePassport(data.idNumber)) {
      setError("idNumber", { message: "護照號碼格式不正確（6-9 碼英數字）" }); hasError = true;
    }
    if (!data.lifecycleStatus) {
      setError("lifecycleStatus", { message: "此欄位為必填" }); hasError = true;
    }
    if (!data.documentStatus) {
      setError("documentStatus", { message: "此欄位為必填" }); hasError = true;
    }
    if (!data.managerId) {
      setError("managerId", { message: "此欄位為必填" }); hasError = true;
    }
    if (data.phone && !validateTwPhone(data.phone)) {
      setError("phone", { message: "電話格式不正確（手機 09 開頭 10 碼，或市話格式）" }); hasError = true;
    }
    if (data.entryDate && !validateNotFutureDate(data.entryDate)) {
      setError("entryDate", { message: "入境日期不可晒於今天" }); hasError = true;
    }
    if (data.externalLink.trim()) {
      try {
        const url = new URL(data.externalLink.trim());
        if (!['http:', 'https:'].includes(url.protocol)) {
          setError("externalLink", { message: "連結必須以 http:// 或 https:// 開頭" }); hasError = true;
        }
      } catch {
        setError("externalLink", { message: "連結格式不正確，請輸入完整 URL（例：https://drive.google.com/...）" }); hasError = true;
      }
    }
    if (
      data.lifecycleStatus === "employed" &&
      (data.documentStatus === "not_started" || data.documentStatus === "pending_supplement")
    ) {
      setError("documentStatus", { message: "在職移工的文件狀態不應為未完成，請確認" }); hasError = true;
    }

    if (hasError) {
      setTimeout(() => {
        const firstError = document.querySelector("[data-field-error]");
        firstError?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
      return;
    }

    const payload = {
      name: data.name.trim(),
      nationality: data.nationality.trim() || undefined,
      idType: data.idType,
      idNumber: data.idNumber.trim(),
      lifecycleStatus: data.lifecycleStatus as any,
      documentStatus: data.documentStatus as any,
      managerId: parseInt(data.managerId),
      phone: data.phone.trim() || undefined,
      entryDate: data.entryDate || undefined,
      idExpiryDate: data.idExpiryDate || undefined,
      externalLink: data.externalLink.trim() || undefined,
      notes: data.notes.trim() || undefined,
    };

    if (isEdit) {
      updateMutation.mutate({ id: editId!, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  // Shared Enter handler for text inputs (IME-safe via useFormEnterNav)
  const enterProps = { onKeyDown: handleEnterNav };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "編輯移工" : "新增移工"}</DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            按 <kbd className="kbd">Tab</kbd> 切換欄位，<kbd className="kbd">Enter</kbd> 跳至下一欄
          </p>
        </DialogHeader>

        <form ref={formRef} onSubmit={handleSubmit(onSubmit)} className="space-y-5 py-2">

          {/* 姓名 */}
          <div>
            <Label htmlFor="w-name">
              姓名 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="w-name"
              {...nameRegister}
              ref={nameRefCallback}
              {...enterProps}
              placeholder="請輸入姓名"
              className="mt-2"
              autoComplete="off"
            />
            {errors.name && (
              <p className="field-error" data-field-error>{errors.name.message}</p>
            )}
          </div>

          {/* 國籍 */}
          <div>
            <Label htmlFor="w-nationality">國籍</Label>
            <Input
              id="w-nationality"
              {...register("nationality")}
              {...enterProps}
              placeholder="例：越南、印尼、泰國"
              className="mt-2"
              autoComplete="off"
            />
          </div>

          {/* 證件類型 + 號碼 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>
                證件類型 <span className="text-destructive">*</span>
              </Label>
              {/* Select is keyboard-navigable via Tab/Arrow; no Enter-nav needed */}
              <Select
                value={idType}
                onValueChange={(v) => {
                  setValue("idType", v as any);
                  clearErrors("idNumber");
                }}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ID_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="w-idNumber">
                證號 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="w-idNumber"
                {...register("idNumber")}
                {...enterProps}
                placeholder={idType === "resident_permit" ? "例：A123456789" : "例：AB1234567"}
                className="mt-2 font-mono"
                autoComplete="off"
                autoCapitalize="characters"
              />
              {errors.idNumber && (
                <p className="field-error" data-field-error>{errors.idNumber.message}</p>
              )}
            </div>
          </div>

          {/* 生命週期狀態 + 文件狀態 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>
                生命週期狀態 <span className="text-destructive">*</span>
              </Label>
              <Select
                value={lifecycleStatus}
                onValueChange={(v) => {
                  setValue("lifecycleStatus", v);
                  clearErrors("lifecycleStatus");
                }}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="請選擇" />
                </SelectTrigger>
                <SelectContent>
                  {LIFECYCLE_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.lifecycleStatus && (
                <p className="field-error" data-field-error>{errors.lifecycleStatus.message}</p>
              )}
            </div>
            <div>
              <Label>
                文件狀態 <span className="text-destructive">*</span>
              </Label>
              <Select
                value={watch("documentStatus")}
                onValueChange={(v) => {
                  setValue("documentStatus", v);
                  clearErrors("documentStatus");
                }}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="請選擇" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.documentStatus && (
                <p className="field-error" data-field-error>{errors.documentStatus.message}</p>
              )}
            </div>
          </div>

          {/* 負責人 */}
          <div>
            <Label>
              負責人 <span className="text-destructive">*</span>
            </Label>
            <Select
              value={watch("managerId")}
              onValueChange={(v) => {
                setValue("managerId", v);
                clearErrors("managerId");
              }}
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
            {errors.managerId && (
              <p className="field-error" data-field-error>{errors.managerId.message}</p>
            )}
          </div>

          {/* 聯絡電話 */}
          <div>
            <Label htmlFor="w-phone">聯絡電話</Label>
            <Input
              id="w-phone"
              {...register("phone")}
              {...enterProps}
              placeholder="例：0912-345-678"
              className="mt-2"
              inputMode="tel"
            />
            {errors.phone && (
              <p className="field-error" data-field-error>{errors.phone.message}</p>
            )}
          </div>

          {/* 入境日期 + 證件到期日 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="w-entryDate">入境日期</Label>
              <Input
                id="w-entryDate"
                type="date"
                {...register("entryDate")}
                {...enterProps}
                className="mt-2"
                max={new Date().toISOString().split("T")[0]}
              />
              {errors.entryDate && (
                <p className="field-error" data-field-error>{errors.entryDate.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="w-idExpiryDate">
                證件到期日
                <span className="ml-1 text-[10px] text-amber-500 font-medium">（到期提醒）</span>
              </Label>
              <Input
                id="w-idExpiryDate"
                type="date"
                {...register("idExpiryDate")}
                {...enterProps}
                className="mt-2"
              />
              {errors.idExpiryDate && (
                <p className="field-error" data-field-error>{errors.idExpiryDate.message}</p>
              )}
            </div>
          </div>

          {/* 外部連結 */}
          <div>
            <Label htmlFor="w-externalLink">
              連結
              <span className="ml-1 text-[10px] text-muted-foreground font-normal">（Google Drive / Sheets 等外部連結）</span>
            </Label>
            <div className="flex gap-2 mt-2">
              <Input
                id="w-externalLink"
                {...register("externalLink")}
                {...enterProps}
                placeholder="https://drive.google.com/..."
                className="flex-1 font-mono text-sm"
                autoComplete="off"
                inputMode="url"
              />
              {watch("externalLink")?.trim() && (
                <a
                  href={watch("externalLink").trim()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs border border-border rounded-md bg-background hover:bg-accent text-foreground transition-colors shrink-0"
                  tabIndex={-1}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  開啟
                </a>
              )}
            </div>
            {errors.externalLink && (
              <p className="field-error" data-field-error>{errors.externalLink.message}</p>
            )}
          </div>

          {/* 備註 — Textarea: Enter = newline, Shift+Enter also fine */}
          <div>
            <Label htmlFor="w-notes">備註</Label>
            <Textarea
              id="w-notes"
              {...register("notes")}
              placeholder="備註說明（Enter 換行）"
              className="mt-2 resize-none"
              rows={3}
            />
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
            >
              取消
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "儲存中..." : isEdit ? "儲存變更" : "新增移工"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
