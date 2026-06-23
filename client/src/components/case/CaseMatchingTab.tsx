import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Plus, Pencil, Trash2, UserPlus, AlertTriangle, Users } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { getStatusLabel, DEMAND_STATUS_OPTIONS, QUAL_TYPE_OPTIONS, ASSIGNMENT_STAGE_OPTIONS } from "@/lib/constants";

interface Props { caseId: number; }

export default function CaseMatchingTab({ caseId }: Props) {
  const utils = trpc.useUtils();

  // ── 需求管理 ──────────────────────────────────────────────────────────────
  const [showDemandModal, setShowDemandModal] = useState(false);
  const [editingDemand, setEditingDemand] = useState<any>(null);
  const [deletingDemand, setDeletingDemand] = useState<any>(null);
  type QualType = "manufacturing" | "construction" | "agriculture" | "caregiver" | "domestic_helper" | "white_collar" | "intermediate" | "overseas_student";
  type DemandStatus = "open" | "filling" | "fulfilled" | "closed";
  const [demandForm, setDemandForm] = useState<{
    label: string; qualType: QualType; neededCount: number; status: DemandStatus; notes: string;
  }>({
    label: "", qualType: "manufacturing", neededCount: 1,
    status: "open", notes: "",
  });

  // ── 配對管理 ──────────────────────────────────────────────────────────────
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedDemandId, setSelectedDemandId] = useState<number | undefined>(undefined);
  const [workerSearch, setWorkerSearch] = useState("");
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<Set<number>>(new Set());
  const [assignNote, setAssignNote] = useState("");
  const [deletingAssignment, setDeletingAssignment] = useState<any>(null);

  const { data: demands = [], isLoading: demandsLoading } = trpc.caseDemands.listByCase.useQuery({ caseId });
  const { data: assignments = [], isLoading: assignmentsLoading } = trpc.caseAssignments.listByCase.useQuery({ caseId });
  const { data: allWorkers = [] } = trpc.workers.list.useQuery();
  const { data: involvements = [] } = trpc.caseAssignments.workerInvolvements.useQuery({ excludeCaseId: caseId });
  const { data: quals = [] } = trpc.caseQualifications.listByCase.useQuery({ caseId });

  // 跨案件提醒：哪些移工在其他案件有活躍配對
  const involvedWorkerIds = useMemo(() => new Set(involvements.map(i => i.workerId)), [involvements]);
  const involvedMap = useMemo(() => {
    const m = new Map<number, typeof involvements>();
    involvements.forEach(i => {
      if (!m.has(i.workerId)) m.set(i.workerId, []);
      m.get(i.workerId)!.push(i);
    });
    return m;
  }, [involvements]);

  // 篩選移工
  const filteredWorkers = useMemo(() => {
    const q = workerSearch.toLowerCase();
    return allWorkers.filter(w =>
      !q || w.name.toLowerCase().includes(q) || (w.nameEn ?? "").toLowerCase().includes(q) ||
      (w.residentPermitNo ?? "").toLowerCase().includes(q) || (w.passportNo ?? "").toLowerCase().includes(q)
    );
  }, [allWorkers, workerSearch]);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createDemandMutation = trpc.caseDemands.create.useMutation({
    onSuccess: () => { toast.success("需求已建立"); utils.caseDemands.listByCase.invalidate({ caseId }); utils.cases.getById.invalidate({ id: caseId }); closeDemandModal(); },
    onError: e => toast.error(e.message),
  });
  const updateDemandMutation = trpc.caseDemands.update.useMutation({
    onSuccess: () => { toast.success("需求已更新"); utils.caseDemands.listByCase.invalidate({ caseId }); closeDemandModal(); },
    onError: e => toast.error(e.message),
  });
  const deleteDemandMutation = trpc.caseDemands.delete.useMutation({
    onSuccess: () => { toast.success("需求已刪除"); utils.caseDemands.listByCase.invalidate({ caseId }); utils.cases.getById.invalidate({ id: caseId }); setDeletingDemand(null); },
    onError: e => toast.error(e.message),
  });
  const createAssignmentMutation = trpc.caseAssignments.create.useMutation({
    onSuccess: () => {
      toast.success("配對已建立");
      utils.caseAssignments.listByCase.invalidate({ caseId });
      utils.cases.getById.invalidate({ id: caseId });
      setShowAssignModal(false);
      setSelectedWorkerIds(new Set());
      setAssignNote("");
    },
    onError: e => toast.error(e.message),
  });
  const deleteAssignmentMutation = trpc.caseAssignments.delete.useMutation({
    onSuccess: () => { toast.success("配對已刪除"); utils.caseAssignments.listByCase.invalidate({ caseId }); utils.cases.getById.invalidate({ id: caseId }); setDeletingAssignment(null); },
    onError: e => toast.error(e.message),
  });
  const updateMemberStageMutation = trpc.caseAssignments.updateMemberStage.useMutation({
    onSuccess: () => { utils.caseAssignments.listByCase.invalidate({ caseId }); utils.cases.getById.invalidate({ id: caseId }); },
    onError: e => toast.error(e.message),
  });
  const removeMemberMutation = trpc.caseAssignments.removeWorker.useMutation({
    onSuccess: () => { toast.success("已移除人員"); utils.caseAssignments.listByCase.invalidate({ caseId }); utils.cases.getById.invalidate({ id: caseId }); },
    onError: e => toast.error(e.message),
  });

  // ── 需求 Modal ──────────────────────────────────────────────────────────────
  const openAddDemand = () => {
    setEditingDemand(null);
    setDemandForm({ label: "", qualType: "manufacturing", neededCount: 1, status: "open", notes: "" });
    setShowDemandModal(true);
  };
  const openEditDemand = (d: any) => {
    setEditingDemand(d);
    setDemandForm({ label: d.label, qualType: d.qualType as QualType, neededCount: d.neededCount, status: d.status as DemandStatus, notes: d.notes ?? "" });
    setShowDemandModal(true);
  };
  const closeDemandModal = () => { setShowDemandModal(false); setEditingDemand(null); };
  const submitDemand = () => {
    if (!demandForm.label.trim()) return toast.error("請填寫需求標籤");
    if (editingDemand) {
      updateDemandMutation.mutate({ id: editingDemand.id, ...demandForm, neededCount: Number(demandForm.neededCount) });
    } else {
      createDemandMutation.mutate({ caseId, ...demandForm, neededCount: Number(demandForm.neededCount) });
    }
  };

  // ── 配對 Modal ──────────────────────────────────────────────────────────────
  const openAssignModal = () => {
    setSelectedWorkerIds(new Set());
    setWorkerSearch("");
    setAssignNote("");
    setSelectedDemandId(undefined);
    setShowAssignModal(true);
  };
  const toggleWorker = (id: number) => {
    setSelectedWorkerIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const submitAssignment = () => {
    if (selectedWorkerIds.size === 0) return toast.error("請至少選擇一位移工");
    createAssignmentMutation.mutate({
      caseId,
      demandId: selectedDemandId,
      workerIds: Array.from(selectedWorkerIds),
      batchNote: assignNote || undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* ── 需求管理 ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">媒合需求</h3>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={openAddDemand}>
            <Plus className="w-3.5 h-3.5" />新增需求
          </Button>
        </div>
        {demandsLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : demands.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">尚無需求</div>
        ) : (
          <div className="space-y-2">
            {demands.map(d => (
              <div key={d.id} className="rounded-lg border bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{d.label}</span>
                      <StatusBadge status={d.status} />
                      <span className="text-xs text-muted-foreground">{getStatusLabel(d.qualType)}</span>
                    </div>
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>已媒合 {d.matchedCount} / 需求 {d.neededCount}</span>
                        <span>{d.progress}%</span>
                      </div>
                      <Progress value={d.progress} className="h-1.5" />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDemand(d)}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeletingDemand(d)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 配對管理 ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">配對人員</h3>
          <Button size="sm" className="gap-1.5" onClick={openAssignModal}>
            <UserPlus className="w-3.5 h-3.5" />加入人員
          </Button>
        </div>
        {assignmentsLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : assignments.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">尚無配對人員</div>
        ) : (
          <div className="space-y-3">
            {assignments.map(a => (
              <div key={a.id} className="rounded-lg border bg-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{a.batchNote || `配對批次 #${a.id}`}</span>
                    <span className="text-xs text-muted-foreground">{a.members.length} 人</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeletingAssignment(a)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {a.members.map((m: any) => (
                    <div key={m.id} className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/30">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{m.workerName}</span>
                        {m.workerNameEn && <span className="text-xs text-muted-foreground">{m.workerNameEn}</span>}
                        <span className="text-xs text-muted-foreground">{m.workerNationality}</span>
                        <StatusBadge status={m.stage} />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Select value={m.stage} onValueChange={v => updateMemberStageMutation.mutate({ memberId: m.id, stage: v as any })}>
                          <SelectTrigger className="h-7 w-28 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ASSIGNMENT_STAGE_OPTIONS.map(o => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeMemberMutation.mutate({ memberId: m.id })}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 需求 Modal */}
      <Dialog open={showDemandModal} onOpenChange={v => !v && closeDemandModal()}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingDemand ? "編輯需求" : "新增需求"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>需求標籤 <span className="text-destructive">*</span></Label>
              <Input value={demandForm.label} onChange={e => setDemandForm(f => ({ ...f, label: e.target.value }))} placeholder="例：製造業看護 5 名" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>資格類型</Label>
                <Select value={demandForm.qualType} onValueChange={v => setDemandForm(f => ({ ...f, qualType: v as QualType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{QUAL_TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>需求人數</Label>
                <Input type="number" min={1} value={demandForm.neededCount} onChange={e => setDemandForm(f => ({ ...f, neededCount: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>狀態</Label>
              <Select value={demandForm.status} onValueChange={v => setDemandForm(f => ({ ...f, status: v as DemandStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DEMAND_STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </div>
            <div className="space-y-1.5">
              <Label>備註</Label>
              <Textarea value={demandForm.notes} onChange={e => setDemandForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDemandModal}>取消</Button>
            <Button onClick={submitDemand} disabled={createDemandMutation.isPending || updateDemandMutation.isPending}>
              {editingDemand ? "儲存" : "建立"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 配對 Modal */}
      <Dialog open={showAssignModal} onOpenChange={v => !v && setShowAssignModal(false)}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>加入配對人員</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 flex-1 overflow-y-auto">
            <div className="space-y-1.5">
              <Label>關聯需求（選填）</Label>
              <Select value={selectedDemandId ? String(selectedDemandId) : ""} onValueChange={v => setSelectedDemandId(v ? Number(v) : undefined)}>
                <SelectTrigger><SelectValue placeholder="不指定需求" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">不指定需求</SelectItem>
                  {demands.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>批次備註</Label>
              <Input value={assignNote} onChange={e => setAssignNote(e.target.value)} placeholder="例：第一批候選人" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>選擇移工</Label>
                <span className="text-xs text-muted-foreground">已選 {selectedWorkerIds.size} 人</span>
              </div>
              <Input
                placeholder="搜尋姓名、證號..."
                value={workerSearch}
                onChange={e => setWorkerSearch(e.target.value)}
              />
              <div className="rounded-lg border max-h-56 overflow-y-auto divide-y">
                {filteredWorkers.length === 0 ? (
                  <p className="p-4 text-sm text-center text-muted-foreground">無符合移工</p>
                ) : filteredWorkers.map(w => {
                  const isInvolved = involvedWorkerIds.has(w.id);
                  const involvementList = involvedMap.get(w.id) ?? [];
                  return (
                    <div
                      key={w.id}
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors ${selectedWorkerIds.has(w.id) ? "bg-muted/50" : ""}`}
                      onClick={() => toggleWorker(w.id)}
                    >
                      <Checkbox checked={selectedWorkerIds.has(w.id)} onCheckedChange={() => toggleWorker(w.id)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium">{w.name}</span>
                          {w.nameEn && <span className="text-xs text-muted-foreground">{w.nameEn}</span>}
                          <span className="text-xs text-muted-foreground">{w.nationality}</span>
                        </div>
                        {isInvolved && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <AlertTriangle className="w-3 h-3 text-amber-500" />
                            <span className="text-xs text-amber-600">
                              已在其他案件配對中：{involvementList.map(i => i.caseName).join("、")}
                            </span>
                          </div>
                        )}
                      </div>
                      <StatusBadge status={w.lifecycleStatus} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignModal(false)}>取消</Button>
            <Button onClick={submitAssignment} disabled={createAssignmentMutation.isPending || selectedWorkerIds.size === 0}>
              加入 {selectedWorkerIds.size > 0 ? `${selectedWorkerIds.size} 人` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 刪除需求確認 */}
      <AlertDialog open={!!deletingDemand} onOpenChange={open => !open && setDeletingDemand(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除需求</AlertDialogTitle>
            <AlertDialogDescription>即將刪除「{deletingDemand?.label}」，此操作無法復原。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteDemandMutation.mutate({ id: deletingDemand.id })}>確認刪除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 刪除配對確認 */}
      <AlertDialog open={!!deletingAssignment} onOpenChange={open => !open && setDeletingAssignment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除配對</AlertDialogTitle>
            <AlertDialogDescription>即將刪除此配對批次及其所有人員，此操作無法復原。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteAssignmentMutation.mutate({ id: deletingAssignment.id })}>確認刪除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
