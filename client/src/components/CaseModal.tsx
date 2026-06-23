import { useEffect } from "react";
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CASE_MGMT_STATUS_OPTIONS } from "@/lib/constants";

const schema = z.object({
  customerId: z.number().int().positive("請選擇客戶"),
  name: z.string().min(2, "案件名稱至少 2 字").max(100),
  managerId: z.number().int().positive("請選擇負責人"),
  status: z.enum(["in_progress", "completed", "paused", "cancelled"]),
  notes: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  editingCase?: any;
}

export default function CaseModal({ open, onClose, editingCase }: Props) {
  const utils = trpc.useUtils();
  const { data: customers = [] } = trpc.customers.list.useQuery();
  const { data: managers = [] } = trpc.managers.list.useQuery();

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
      });
    } else {
      reset({ status: "in_progress", customerId: 0, managerId: 0, name: "", notes: "" });
    }
  }, [editingCase, reset]);

  const createMutation = trpc.cases.create.useMutation({
    onSuccess: () => {
      toast.success("案件已建立");
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
      createMutation.mutate(data);
    }
  };

  const watchedCustomerId = watch("customerId");
  const watchedManagerId = watch("managerId");
  const watchedStatus = watch("status");

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingCase ? "編輯案件" : "新增案件"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-4 py-2">
          {/* 客戶 */}
          <div className="space-y-1.5">
            <Label>客戶 <span className="text-destructive">*</span></Label>
            <Select
              value={watchedCustomerId ? String(watchedCustomerId) : ""}
              onValueChange={v => setValue("customerId", Number(v), { shouldValidate: true })}
            >
              <SelectTrigger className={errors.customerId ? "border-destructive" : ""}>
                <SelectValue placeholder="選擇客戶" />
              </SelectTrigger>
              <SelectContent>
                {customers.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.customerId && <p className="text-xs text-destructive">{errors.customerId.message}</p>}
          </div>

          {/* 案件名稱 */}
          <div className="space-y-1.5">
            <Label>案件名稱 <span className="text-destructive">*</span></Label>
            <Input {...register("name")} placeholder="例：台灣精密科技 2025 批次" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          {/* 負責人 + 狀態 */}
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

          {/* 備註 */}
          <div className="space-y-1.5">
            <Label>備註</Label>
            <Textarea {...register("notes")} placeholder="案件說明、特殊需求..." rows={3} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>取消</Button>
            <Button type="submit" disabled={isSubmitting || createMutation.isPending || updateMutation.isPending}>
              {editingCase ? "儲存變更" : "建立案件"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
