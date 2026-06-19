import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  LIFECYCLE_STATUS_OPTIONS, DOCUMENT_STATUS_OPTIONS, ID_TYPE_OPTIONS,
} from "@/lib/constants";
import { validateTwPhone, validateResidentPermit, validatePassport, validateNotFutureDate } from "@/lib/validation";

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
  const firstErrorRef = useRef<HTMLDivElement>(null);

  const { data: managers } = trpc.managers.list.useQuery();
  const { data: existingWorker } = trpc.workers.getById.useQuery(
    { id: editId! },
    { enabled: !!editId }
  );

  const { register, handleSubmit, setValue, watch, reset, formState: { errors }, setError, clearErrors } = useForm<WorkerFormData>({
    defaultValues: {
      name: "", nationality: "", idType: "resident_permit", idNumber: "",
      lifecycleStatus: "", documentStatus: "", managerId: "",
      phone: "", entryDate: "", notes: "",
    },
  });

  const idType = watch("idType");
  const lifecycleStatus = watch("lifecycleStatus");

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
        notes: existingWorker.notes ?? "",
      });
    } else if (open && !editId) {
      reset({
        name: "", nationality: "", idType: "resident_permit", idNumber: "",
        lifecycleStatus: "", documentStatus: "", managerId: "",
        phone: "", entryDate: "", notes: "",
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
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const updateMutation = trpc.workers.update.useMutation({
    onSuccess: () => {
      utils.workers.list.invalidate();
      toast.success("移工資料已更新");
      onSuccess();
      onClose();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const onSubmit = (data: WorkerFormData) => {
    // 前端驗證
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
      setError("entryDate", { message: "入境日期不可晚於今天" }); hasError = true;
    }
    // 跨欄位邏輯
    if (data.lifecycleStatus === "employed" && (data.documentStatus === "not_started" || data.documentStatus === "pending_supplement")) {
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
      notes: data.notes.trim() || undefined,
    };

    if (isEdit) {
      updateMutation.mutate({ id: editId!, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "編輯移工" : "新增移工"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          {/* 姓名 */}
          <div>
            <Label htmlFor="name">姓名 <span className="text-destructive">*</span></Label>
            <Input id="name" {...register("name")} placeholder="請輸入姓名" className="mt-1" />
            {errors.name && <p className="field-error" data-field-error>{errors.name.message}</p>}
          </div>

          {/* 國籍 */}
          <div>
            <Label htmlFor="nationality">國籍</Label>
            <Input id="nationality" {...register("nationality")} placeholder="例：越南、印尼" className="mt-1" />
          </div>

          {/* 證件類型 + 號碼 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>證件類型 <span className="text-destructive">*</span></Label>
              <Select value={idType} onValueChange={(v) => { setValue("idType", v as any); clearErrors("idNumber"); }}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ID_TYPE_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="idNumber">證號 <span className="text-destructive">*</span></Label>
              <Input
                id="idNumber"
                {...register("idNumber")}
                placeholder={idType === "resident_permit" ? "例：A123456789" : "例：AB1234567"}
                className="mt-1"
              />
              {errors.idNumber && <p className="field-error" data-field-error>{errors.idNumber.message}</p>}
            </div>
          </div>

          {/* 生命週期狀態 + 文件狀態 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>生命週期狀態 <span className="text-destructive">*</span></Label>
              <Select value={lifecycleStatus} onValueChange={(v) => { setValue("lifecycleStatus", v); clearErrors("lifecycleStatus"); }}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="請選擇" />
                </SelectTrigger>
                <SelectContent>
                  {LIFECYCLE_STATUS_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.lifecycleStatus && <p className="field-error" data-field-error>{errors.lifecycleStatus.message}</p>}
            </div>
            <div>
              <Label>文件狀態 <span className="text-destructive">*</span></Label>
              <Select value={watch("documentStatus")} onValueChange={(v) => { setValue("documentStatus", v); clearErrors("documentStatus"); }}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="請選擇" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_STATUS_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.documentStatus && <p className="field-error" data-field-error>{errors.documentStatus.message}</p>}
            </div>
          </div>

          {/* 負責人 */}
          <div>
            <Label>負責人 <span className="text-destructive">*</span></Label>
            <Select value={watch("managerId")} onValueChange={(v) => { setValue("managerId", v); clearErrors("managerId"); }}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="請選擇負責人" />
              </SelectTrigger>
              <SelectContent>
                {managers?.map(m => (
                  <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.managerId && <p className="field-error" data-field-error>{errors.managerId.message}</p>}
          </div>

          {/* 聯絡電話 */}
          <div>
            <Label htmlFor="phone">聯絡電話</Label>
            <Input id="phone" {...register("phone")} placeholder="例：0912-345-678" className="mt-1" />
            {errors.phone && <p className="field-error" data-field-error>{errors.phone.message}</p>}
          </div>

          {/* 入境日期 */}
          <div>
            <Label htmlFor="entryDate">入境日期</Label>
            <Input id="entryDate" type="date" {...register("entryDate")} className="mt-1" max={new Date().toISOString().split("T")[0]} />
            {errors.entryDate && <p className="field-error" data-field-error>{errors.entryDate.message}</p>}
          </div>

          {/* 備註 */}
          <div>
            <Label htmlFor="notes">備註</Label>
            <Textarea id="notes" {...register("notes")} placeholder="備註說明" className="mt-1 resize-none" rows={3} />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>取消</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "儲存中..." : isEdit ? "儲存變更" : "新增移工"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
