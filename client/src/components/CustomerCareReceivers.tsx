import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, FileText, Image as ImageIcon } from "lucide-react";
import { AttachmentPreviewModal } from "@/components/AttachmentPreviewModal";
import { toast } from "sonner";

type CareReceiver = {
  id: number;
  customerId: number;
  careReceiverNo?: string | null;
  careReceiverName?: string | null;
  careReceiverBirthDate?: string | null;
  careReceiverIdNo?: string | null;
  careReceiverAddress?: string | null;
  careReceiverQualification?: string | null;
  careReceiverRelation?: string | null;
  careReceiverIdFrontKey?: string | null;
  careReceiverIdBackKey?: string | null;
  notes?: string | null;
};

type FormState = Omit<CareReceiver, "id" | "customerId">;

const EMPTY_FORM: FormState = {
  careReceiverNo: "",
  careReceiverName: "",
  careReceiverBirthDate: "",
  careReceiverIdNo: "",
  careReceiverAddress: "",
  careReceiverQualification: "",
  careReceiverRelation: "",
  careReceiverIdFrontKey: "",
  careReceiverIdBackKey: "",
  notes: "",
};

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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-md border bg-muted/30 hover:bg-muted/60 transition-colors text-sm w-full text-left"
      >
        {isPdf ? <FileText className="w-4 h-4 text-muted-foreground shrink-0" /> : <ImageIcon className="w-4 h-4 text-muted-foreground shrink-0" />}
        <span className="truncate flex-1">{label}</span>
        <span className="text-xs text-muted-foreground shrink-0">點擊預覽</span>
      </button>
      <AttachmentPreviewModal open={open} onClose={() => setOpen(false)} label={label} fileKey={fileKey} />
    </>
  );
}

interface Props {
  customerId: number;
}

export function CustomerCareReceivers({ customerId }: Props) {
  const utils = trpc.useUtils();
  const { data: items = [], isLoading } = trpc.customers.careReceivers.listByCustomer.useQuery({ customerId });

  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<CareReceiver | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const createMutation = trpc.customers.careReceivers.create.useMutation({
    onSuccess: () => {
      utils.customers.careReceivers.listByCustomer.invalidate({ customerId });
      setShowModal(false);
      toast.success("被照顧者已新增");
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.customers.careReceivers.update.useMutation({
    onSuccess: () => {
      utils.customers.careReceivers.listByCustomer.invalidate({ customerId });
      setShowModal(false);
      toast.success("被照顧者已更新");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.customers.careReceivers.delete.useMutation({
    onSuccess: () => {
      utils.customers.careReceivers.listByCustomer.invalidate({ customerId });
      setDeleteConfirmId(null);
      toast.success("被照顧者已刪除");
    },
    onError: (e) => toast.error(e.message),
  });

  function openCreate() {
    setEditItem(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }
  function openEdit(item: CareReceiver) {
    setEditItem(item);
    setForm({
      careReceiverNo: item.careReceiverNo ?? "",
      careReceiverName: item.careReceiverName ?? "",
      careReceiverBirthDate: item.careReceiverBirthDate ?? "",
      careReceiverIdNo: item.careReceiverIdNo ?? "",
      careReceiverAddress: item.careReceiverAddress ?? "",
      careReceiverQualification: item.careReceiverQualification ?? "",
      careReceiverRelation: item.careReceiverRelation ?? "",
      careReceiverIdFrontKey: item.careReceiverIdFrontKey ?? "",
      careReceiverIdBackKey: item.careReceiverIdBackKey ?? "",
      notes: item.notes ?? "",
    });
    setShowModal(true);
  }
  function handleSave() {
    const payload = {
      careReceiverNo: form.careReceiverNo || null,
      careReceiverName: form.careReceiverName || null,
      careReceiverBirthDate: form.careReceiverBirthDate || null,
      careReceiverIdNo: form.careReceiverIdNo || null,
      careReceiverAddress: form.careReceiverAddress || null,
      careReceiverQualification: form.careReceiverQualification || null,
      careReceiverRelation: form.careReceiverRelation || null,
      careReceiverIdFrontKey: form.careReceiverIdFrontKey || null,
      careReceiverIdBackKey: form.careReceiverIdBackKey || null,
      notes: form.notes || null,
    };
    if (editItem) {
      updateMutation.mutate({ id: editItem.id, ...payload });
    } else {
      createMutation.mutate({ customerId, ...payload });
    }
  }

  const isBusy = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">被照顧者</h3>
        <button
          onClick={openCreate}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors px-2 py-1 rounded-md hover:bg-primary/10"
        >
          <Plus className="w-3.5 h-3.5" />新增被照顧者
        </button>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">載入中…</div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">尚無被照顧者資料</div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const isExpanded = expandedId === item.id;
            const title = item.careReceiverName || `被照顧者 #${item.id}`;
            return (
              <div key={item.id} className="rounded-lg border bg-card overflow-hidden">
                {/* 卡片標題列 */}
                <div className="flex items-center justify-between px-4 py-3">
                  <button
                    type="button"
                    className="flex items-center gap-2 flex-1 text-left group"
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  >
                    <span className="text-sm font-medium group-hover:underline">{title}</span>
                    {item.careReceiverNo && (
                      <span className="text-xs text-muted-foreground font-mono">#{item.careReceiverNo}</span>
                    )}
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground ml-auto" /> : <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto" />}
                  </button>
                  <div className="flex items-center gap-1 ml-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      className="p-1.5 rounded-md hover:bg-muted transition-colors"
                      title="編輯"
                    >
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(item.id)}
                      className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors"
                      title="刪除"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                </div>
                {/* 展開詳情 */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-border/50">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 mt-4">
                      <InfoRow label="被看護者編號" value={item.careReceiverNo} />
                      <InfoRow label="被照顧者姓名" value={item.careReceiverName} />
                      <InfoRow label="出生年月日" value={item.careReceiverBirthDate} />
                      <InfoRow label="身分證字號" value={item.careReceiverIdNo} />
                      <InfoRow label="戶籍地址" value={item.careReceiverAddress} />
                      <InfoRow label="申請資格" value={item.careReceiverQualification} />
                      <InfoRow label="與被看護者關係" value={item.careReceiverRelation} />
                      <InfoRow label="備註" value={item.notes} />
                    </div>
                    {(item.careReceiverIdFrontKey || item.careReceiverIdBackKey) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                        <AttachmentBtn label="被看護者身分證正面" fileKey={item.careReceiverIdFrontKey} />
                        <AttachmentBtn label="被看護者身分證反面" fileKey={item.careReceiverIdBackKey} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 新增 / 編輯 Modal */}
      <Dialog open={showModal} onOpenChange={(v) => { if (!v) setShowModal(false); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editItem ? "編輯被照顧者" : "新增被照顧者"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5">
              <Label>被看護者編號</Label>
              <Input value={form.careReceiverNo ?? ""} onChange={e => setForm(f => ({ ...f, careReceiverNo: e.target.value }))} placeholder="例：001" />
            </div>
            <div className="space-y-1.5">
              <Label>被照顧者姓名</Label>
              <Input value={form.careReceiverName ?? ""} onChange={e => setForm(f => ({ ...f, careReceiverName: e.target.value }))} placeholder="姓名" />
            </div>
            <div className="space-y-1.5">
              <Label>出生年月日</Label>
              <Input type="date" value={form.careReceiverBirthDate ?? ""} onChange={e => setForm(f => ({ ...f, careReceiverBirthDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>身分證字號</Label>
              <Input value={form.careReceiverIdNo ?? ""} onChange={e => setForm(f => ({ ...f, careReceiverIdNo: e.target.value }))} placeholder="A123456789" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>戶籍地址</Label>
              <Input value={form.careReceiverAddress ?? ""} onChange={e => setForm(f => ({ ...f, careReceiverAddress: e.target.value }))} placeholder="地址" />
            </div>
            <div className="space-y-1.5">
              <Label>申請資格</Label>
              <Input value={form.careReceiverQualification ?? ""} onChange={e => setForm(f => ({ ...f, careReceiverQualification: e.target.value }))} placeholder="例：重度失能" />
            </div>
            <div className="space-y-1.5">
              <Label>與被看護者關係</Label>
              <Input value={form.careReceiverRelation ?? ""} onChange={e => setForm(f => ({ ...f, careReceiverRelation: e.target.value }))} placeholder="例：子女" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>備註</Label>
              <Input value={form.notes ?? ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="備註" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)} disabled={isBusy}>取消</Button>
            <Button onClick={handleSave} disabled={isBusy}>{isBusy ? "儲存中…" : "儲存"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 刪除確認 Dialog */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={(v) => { if (!v) setDeleteConfirmId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>確認刪除</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">此操作無法復原，確定要刪除這筆被照顧者資料嗎？</p>
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
