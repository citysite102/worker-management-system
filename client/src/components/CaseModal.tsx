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
import { CASE_MGMT_STATUS_OPTIONS } from "@/lib/constants";
import { Building2, User, Phone, MapPin, Heart, Briefcase, AlertTriangle, Upload, X } from "lucide-react";

const schema = z.object({
  customerId: z.number().int().positive("請選擇客戶"),
  name: z.string().min(2, "案件名稱至少 2 字").max(100),
  managerId: z.number().int().positive("請選擇負責人"),
  status: z.enum(["in_progress", "completed", "paused", "cancelled"]),
  caseCondition: z.string().max(100).optional(),
  primaryWorkerId: z.number().int().positive().optional().nullable(),
  needsReview: z.boolean().optional(),
  recruitmentPermitFileKey: z.string().max(300).optional().nullable(),
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
  const { data: workers = [] } = trpc.workers.list.useQuery();

  const [uploadingPermit, setUploadingPermit] = useState(false);

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

  // 自動帶入：雇主資訊
  const selectedCustomer = customers.find(c => c.id === watchedCustomerId);
  // 自動帶入：移工資訊
  const selectedWorker = workers.find(w => w.id === watchedPrimaryWorkerId);

  const handlePermitUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPermit(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "recruitment-permits");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json() as { key: string };
      setValue("recruitmentPermitFileKey", data.key);
      toast.success("招募許可函已上傳");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "未知錯誤";
      toast.error("上傳失敗：" + msg);
    } finally {
      setUploadingPermit(false);
    }
  };

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

        <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-5 py-2">

          {/* ── 基本設定 ─────────────────────────────────────── */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">基本設定</p>

            {/* 案件名稱 */}
            <div className="space-y-1.5">
              <Label>案件名稱 <span className="text-destructive">*</span></Label>
              <Input {...register("name")} placeholder="例：台灣精密科技 2025 批次" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            {/* 負責人 + 狀態 + 案件情況 */}
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

            {/* 需檢查標記 */}
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
          </div>

          {/* ── 選擇雇主（自動帶入） ─────────────────────────── */}
          <div className="space-y-3">
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

            {/* 自動帶入：雇主資訊唯讀顯示 */}
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

            {/* 招募許可函 */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                招募許可函
              </Label>
              {watchedPermitKey ? (
                <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 border border-border/50">
                  <span className="text-xs text-muted-foreground flex-1 truncate">{watchedPermitKey.split("/").pop()}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => setValue("recruitmentPermitFileKey", null)}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <label className="flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-border/70 cursor-pointer hover:bg-muted/30 transition-colors">
                  <Upload className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {uploadingPermit ? "上傳中..." : "點擊上傳 PDF 或圖片"}
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={handlePermitUpload}
                    disabled={uploadingPermit}
                  />
                </label>
              )}
            </div>
          </div>

          {/* ── 選擇外國人（自動帶入） ─────────────────────────── */}
          <div className="space-y-3">
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

            {/* 自動帶入：移工資訊唯讀顯示 */}
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
          </div>

          {/* ── 備註 ─────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label>備註</Label>
            <Textarea {...register("notes")} placeholder="案件說明、特殊需求..." rows={3} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>取消</Button>
            <Button
              type="submit"
              disabled={isSubmitting || createMutation.isPending || updateMutation.isPending || uploadingPermit}
            >
              {editingCase ? "儲存變更" : "建立案件"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
