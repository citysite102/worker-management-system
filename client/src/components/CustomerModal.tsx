import { useEffect, useRef, useState } from "react";
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
import { CONTRACT_STATUS_OPTIONS, PRICING_TIER_OPTIONS } from "@/lib/constants";
import { validateTwPhone, validateTaxId } from "@/lib/validation";
import { useFormEnterNav } from "@/hooks/useFormEnterNav";

interface CustomerFormData {
  name: string;
  taxId: string;
  industry: string;
  contractStatus: string;
  pricingTier: string;
  managerId: string;
  contactName: string;
  contactPhone: string;
  notes: string;
}

interface CustomerModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editId?: number | null;
}

export function CustomerModal({ open, onClose, onSuccess, editId }: CustomerModalProps) {
  const isEdit = !!editId;
  const utils = trpc.useUtils();
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [pendingData, setPendingData] = useState<CustomerFormData | null>(null);
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
      name: "", taxId: "", industry: "", contractStatus: "", pricingTier: "",
      managerId: "", contactName: "", contactPhone: "", notes: "",
    },
  });

  // Dual-ref for first input
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

  useEffect(() => {
    if (open && existingCustomer) {
      reset({
        name: existingCustomer.name ?? "",
        taxId: existingCustomer.taxId ?? "",
        industry: existingCustomer.industry ?? "",
        contractStatus: existingCustomer.contractStatus,
        pricingTier: existingCustomer.pricingTier,
        managerId: String(existingCustomer.managerId),
        contactName: existingCustomer.contactName ?? "",
        contactPhone: existingCustomer.contactPhone ?? "",
        notes: existingCustomer.notes ?? "",
      });
    } else if (open && !editId) {
      reset({
        name: "", taxId: "", industry: "", contractStatus: "", pricingTier: "",
        managerId: "", contactName: "", contactPhone: "", notes: "",
      });
      setShowDuplicateWarning(false);
      setPendingData(null);
    }
  }, [open, existingCustomer, editId, reset]);

  const createMutation = trpc.customers.create.useMutation({
    onSuccess: () => {
      utils.customers.list.invalidate();
      toast.success("客戶已新增");
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
      toast.success("客戶資料已更新");
      onSuccess();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const buildPayload = (data: CustomerFormData, forceCreate = false) => ({
    name: data.name.trim(),
    taxId: data.taxId.trim() || undefined,
    industry: data.industry.trim() || undefined,
    contractStatus: data.contractStatus as any,
    pricingTier: data.pricingTier as any,
    managerId: parseInt(data.managerId),
    contactName: data.contactName.trim() || undefined,
    contactPhone: data.contactPhone.trim() || undefined,
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
      setError("contactPhone", { message: "電話格式不正確（手機 09 開頭 10 碼，或市話格式）" }); hasError = true;
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

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEdit ? "編輯客戶" : "新增客戶"}</DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              按 <kbd className="kbd">Tab</kbd> 切換欄位，<kbd className="kbd">Enter</kbd> 跳至下一欄
            </p>
          </DialogHeader>

          <form ref={formRef} onSubmit={handleSubmit(onSubmit)} className="space-y-5 py-2">

            {/* 名稱 */}
            <div>
              <Label htmlFor="c-name">
                名稱 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="c-name"
                {...nameRegister}
                ref={nameRefCallback}
                {...enterProps}
                placeholder="請輸入客戶名稱"
                className="mt-2"
                autoComplete="off"
              />
              {errors.name && (
                <p className="field-error" data-field-error>{errors.name.message}</p>
              )}
            </div>

            {/* 統一編號 */}
            <div>
              <Label htmlFor="c-taxId">統一編號</Label>
              <Input
                id="c-taxId"
                {...register("taxId")}
                {...enterProps}
                placeholder="8 碼數字"
                maxLength={8}
                className="mt-2 font-mono"
                inputMode="numeric"
              />
              {errors.taxId && (
                <p className="field-error" data-field-error>{errors.taxId.message}</p>
              )}
            </div>

            {/* 產業 */}
            <div>
              <Label htmlFor="c-industry">產業</Label>
              <Input
                id="c-industry"
                {...register("industry")}
                {...enterProps}
                placeholder="例：製造業、服務業、農業"
                className="mt-2"
                autoComplete="off"
              />
            </div>

            {/* 合約狀態 + 定價級距 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>
                  合約狀態 <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={watch("contractStatus")}
                  onValueChange={(v) => { setValue("contractStatus", v); clearErrors("contractStatus"); }}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="請選擇" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTRACT_STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.contractStatus && (
                  <p className="field-error" data-field-error>{errors.contractStatus.message}</p>
                )}
              </div>
              <div>
                <Label>
                  定價級距 <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={watch("pricingTier")}
                  onValueChange={(v) => { setValue("pricingTier", v); clearErrors("pricingTier"); }}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="請選擇" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRICING_TIER_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.pricingTier && (
                  <p className="field-error" data-field-error>{errors.pricingTier.message}</p>
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
              {errors.managerId && (
                <p className="field-error" data-field-error>{errors.managerId.message}</p>
              )}
            </div>

            {/* 聯絡窗口 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="c-contactName">聯絡窗口姓名</Label>
                <Input
                  id="c-contactName"
                  {...register("contactName")}
                  {...enterProps}
                  placeholder="姓名"
                  className="mt-2"
                  autoComplete="off"
                />
              </div>
              <div>
                <Label htmlFor="c-contactPhone">聯絡窗口電話</Label>
                <Input
                  id="c-contactPhone"
                  {...register("contactPhone")}
                  {...enterProps}
                  placeholder="0912-345-678"
                  className="mt-2"
                  inputMode="tel"
                />
                {errors.contactPhone && (
                  <p className="field-error" data-field-error>{errors.contactPhone.message}</p>
                )}
              </div>
            </div>

            {/* 備註 — Textarea: Enter = newline */}
            <div>
              <Label htmlFor="c-notes">備註</Label>
              <Textarea
                id="c-notes"
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
                {isPending ? "儲存中..." : isEdit ? "儲存變更" : "新增客戶"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 同名警告 Dialog */}
      <Dialog open={showDuplicateWarning} onOpenChange={setShowDuplicateWarning}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>同名客戶警告</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            系統中已存在同名客戶，確定要繼續建立嗎？
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDuplicateWarning(false)}>取消</Button>
            <Button onClick={handleForceCreate} disabled={isPending}>確定建立</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
