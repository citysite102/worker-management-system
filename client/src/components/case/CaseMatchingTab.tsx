import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Plus,
  Pencil,
  Trash2,
  UserPlus,
  AlertTriangle,
  Users,
  Eye,
  EyeOff,
} from "lucide-react";
import { TW_CITIES } from "@/lib/marketplace";
import { StatusBadge } from "@/components/StatusBadge";
import {
  getStatusLabel,
  DEMAND_STATUS_OPTIONS,
  QUAL_TYPE_OPTIONS,
  ASSIGNMENT_STAGE_OPTIONS,
} from "@/lib/constants";

interface Props {
  caseId: number;
}

export default function CaseMatchingTab({ caseId }: Props) {
  const utils = trpc.useUtils();

  // ── 需求管理 ──────────────────────────────────────────────────────────────
  const [showDemandModal, setShowDemandModal] = useState(false);
  const [editingDemand, setEditingDemand] = useState<any>(null);
  const [deletingDemand, setDeletingDemand] = useState<any>(null);
  type QualType =
    | "manufacturing"
    | "construction"
    | "agriculture"
    | "caregiver"
    | "domestic_helper"
    | "white_collar"
    | "intermediate"
    | "overseas_student";
  type DemandStatus = "open" | "filling" | "fulfilled" | "closed";
  const [demandForm, setDemandForm] = useState<{
    label: string;
    qualType: QualType;
    neededCount: number;
    status: DemandStatus;
    notes: string;
    // 需求單 P1 職缺欄位
    district: string;
    employmentType: "" | "live_in" | "live_out" | "institution" | "other";
    salaryMin: string;
    salaryMax: string; // 以字串存表單，送出轉 number|undefined
    expectedStartDate: string;
    actualExpectedStartDate: string;
    requirements: string;
    publicDescription: string;
    notesForSeeker: string;
    notesForApplicant: string;
  }>({
    label: "",
    qualType: "manufacturing",
    neededCount: 1,
    status: "open",
    notes: "",
    district: "",
    employmentType: "",
    salaryMin: "",
    salaryMax: "",
    expectedStartDate: "",
    actualExpectedStartDate: "",
    requirements: "",
    publicDescription: "",
    notesForSeeker: "",
    notesForApplicant: "",
  });

  // ── 配對管理 ──────────────────────────────────────────────────────────────
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedDemandId, setSelectedDemandId] = useState<number | undefined>(
    undefined
  );
  const [workerSearch, setWorkerSearch] = useState("");
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<Set<number>>(
    new Set()
  );
  const [assignNote, setAssignNote] = useState("");
  const [deletingAssignment, setDeletingAssignment] = useState<any>(null);

  const { data: demands = [], isLoading: demandsLoading } =
    trpc.caseDemands.listByCase.useQuery({ caseId });
  const { data: assignments = [], isLoading: assignmentsLoading } =
    trpc.caseAssignments.listByCase.useQuery({ caseId });
  const { data: quals = [] } = trpc.caseQualifications.listByCase.useQuery({
    caseId,
  });
  // 延遲載入：只有「加入人員 modal」開啟時才載入全量移工和跨案件資料
  const { data: allWorkers = [] } = trpc.workers.list.useQuery(undefined, {
    enabled: showAssignModal,
  });
  const { data: involvements = [] } =
    trpc.caseAssignments.workerInvolvements.useQuery(
      { excludeCaseId: caseId },
      { enabled: showAssignModal }
    );

  // 跨案件提醒：哪些移工在其他案件有活躍配對
  const involvedWorkerIds = useMemo(
    () => new Set(involvements.map(i => i.workerId)),
    [involvements]
  );
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
    return allWorkers.filter(
      w =>
        !q ||
        w.name.toLowerCase().includes(q) ||
        (w.nameEn ?? "").toLowerCase().includes(q) ||
        (w.residentPermitNo ?? "").toLowerCase().includes(q) ||
        (w.passportNo ?? "").toLowerCase().includes(q)
    );
  }, [allWorkers, workerSearch]);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createDemandMutation = trpc.caseDemands.create.useMutation({
    onSuccess: () => {
      toast.success("需求已建立");
      utils.caseDemands.listByCase.invalidate({ caseId });
      utils.cases.getById.invalidate({ id: caseId });
      closeDemandModal();
    },
    onError: e => toast.error(e.message),
  });
  const updateDemandMutation = trpc.caseDemands.update.useMutation({
    onSuccess: () => {
      toast.success("需求已更新");
      utils.caseDemands.listByCase.invalidate({ caseId });
      closeDemandModal();
    },
    onError: e => toast.error(e.message),
  });
  const deleteDemandMutation = trpc.caseDemands.delete.useMutation({
    onSuccess: () => {
      toast.success("需求已刪除");
      utils.caseDemands.listByCase.invalidate({ caseId });
      utils.cases.getById.invalidate({ id: caseId });
      setDeletingDemand(null);
    },
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
    onSuccess: () => {
      toast.success("配對已刪除");
      utils.caseAssignments.listByCase.invalidate({ caseId });
      utils.cases.getById.invalidate({ id: caseId });
      setDeletingAssignment(null);
    },
    onError: e => toast.error(e.message),
  });
  const updateMemberStageMutation =
    trpc.caseAssignments.updateMemberStage.useMutation({
      onSuccess: () => {
        utils.caseAssignments.listByCase.invalidate({ caseId });
        utils.cases.getById.invalidate({ id: caseId });
      },
      onError: e => toast.error(e.message),
    });
  const removeMemberMutation = trpc.caseAssignments.removeWorker.useMutation({
    onSuccess: () => {
      toast.success("已移除人員");
      utils.caseAssignments.listByCase.invalidate({ caseId });
      utils.cases.getById.invalidate({ id: caseId });
    },
    onError: e => toast.error(e.message),
  });

  // ── 公開站曝光（P1）：既有需求單在「找工作」頁的縣市與逐筆隱藏 ──────────────
  const { data: caseData } = trpc.cases.getById.useQuery({ id: caseId });
  const [publicCity, setPublicCityInput] = useState<string>("");
  useEffect(() => {
    setPublicCityInput(caseData?.publicCity ?? "");
  }, [caseData?.publicCity]);
  const setPublicCityMutation = trpc.cases.setPublicCity.useMutation({
    onSuccess: () => {
      toast.success("已更新公開縣市");
      utils.cases.getById.invalidate({ id: caseId });
    },
    onError: e => toast.error(e.message),
  });
  const setPublicHiddenMutation = trpc.caseDemands.setPublicHidden.useMutation({
    onSuccess: () => {
      utils.caseDemands.listByCase.invalidate({ caseId });
    },
    onError: e => toast.error(e.message),
  });

  // ── 需求 Modal ──────────────────────────────────────────────────────────────
  const emptyDemandForm = {
    label: "",
    qualType: "manufacturing" as QualType,
    neededCount: 1,
    status: "open" as DemandStatus,
    notes: "",
    district: "",
    employmentType: "" as const,
    salaryMin: "",
    salaryMax: "",
    expectedStartDate: "",
    actualExpectedStartDate: "",
    requirements: "",
    publicDescription: "",
    notesForSeeker: "",
    notesForApplicant: "",
  };
  const openAddDemand = () => {
    setEditingDemand(null);
    setDemandForm(emptyDemandForm);
    setShowDemandModal(true);
  };
  const openEditDemand = (d: any) => {
    setEditingDemand(d);
    setDemandForm({
      label: d.label,
      qualType: d.qualType as QualType,
      neededCount: d.neededCount,
      status: d.status as DemandStatus,
      notes: d.notes ?? "",
      district: d.district ?? "",
      employmentType: d.employmentType ?? "",
      salaryMin: d.salaryMin != null ? String(d.salaryMin) : "",
      salaryMax: d.salaryMax != null ? String(d.salaryMax) : "",
      expectedStartDate: d.expectedStartDate ?? "",
      actualExpectedStartDate: d.actualExpectedStartDate ?? "",
      requirements: d.requirements ?? "",
      publicDescription: d.publicDescription ?? "",
      notesForSeeker: d.notesForSeeker ?? "",
      notesForApplicant: d.notesForApplicant ?? "",
    });
    setShowDemandModal(true);
  };
  const closeDemandModal = () => {
    setShowDemandModal(false);
    setEditingDemand(null);
  };
  const submitDemand = () => {
    if (!demandForm.label.trim()) return toast.error("請填寫需求標籤");
    // employmentType 空字串→undefined（enum 不接受空）；薪資字串→number|undefined。
    const { salaryMin, salaryMax, employmentType, ...rest } = demandForm;
    const payload = {
      ...rest,
      neededCount: Number(demandForm.neededCount),
      employmentType: employmentType || undefined,
      salaryMin: salaryMin === "" ? undefined : Number(salaryMin),
      salaryMax: salaryMax === "" ? undefined : Number(salaryMax),
    };
    if (editingDemand) {
      updateDemandMutation.mutate({ id: editingDemand.id, ...payload });
    } else {
      createDemandMutation.mutate({ caseId, ...payload });
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
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={openAddDemand}
          >
            <Plus className="w-3.5 h-3.5" />
            新增需求
          </Button>
        </div>
        {/* 公開站曝光：設定此案件在「找工作」頁顯示的縣市（去識別地點）。 */}
        <div className="flex items-end gap-2 rounded-lg border border-dashed bg-muted/20 p-3">
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">
              公開站顯示縣市
            </Label>
            <Select
              value={publicCity || "none"}
              onValueChange={v => setPublicCityInput(v === "none" ? "" : v)}
            >
              <SelectTrigger
                className="mt-1 h-9"
                data-testid="public-city-select"
              >
                <SelectValue placeholder="未設定（顯示面議）" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">未設定（顯示面議）</SelectItem>
                {TW_CITIES.map(c => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={
              setPublicCityMutation.isPending ||
              (publicCity ?? "") === (caseData?.publicCity ?? "")
            }
            onClick={() =>
              setPublicCityMutation.mutate({
                id: caseId,
                city: publicCity || undefined,
              })
            }
            data-testid="public-city-save"
          >
            儲存
          </Button>
        </div>
        {demandsLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : demands.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            尚無需求
          </div>
        ) : (
          <div className="space-y-2">
            {demands.map(d => (
              <div key={d.id} className="rounded-lg border bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{d.label}</span>
                      <StatusBadge status={d.status} />
                      <span className="text-xs text-muted-foreground">
                        {getStatusLabel(d.qualType, "qualType")}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          已媒合 {d.matchedCount} / 需求 {d.neededCount}
                        </span>
                        <span>{d.progress}%</span>
                      </div>
                      <Progress value={d.progress} className="h-1.5" />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {(d.status === "open" || d.status === "filling") && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title={
                          d.publicHidden
                            ? "目前於公開站隱藏，點擊顯示"
                            : "目前於公開站顯示，點擊隱藏"
                        }
                        onClick={() =>
                          setPublicHiddenMutation.mutate({
                            id: d.id,
                            hidden: !d.publicHidden,
                          })
                        }
                        data-testid={`toggle-public-${d.id}`}
                      >
                        {d.publicHidden ? (
                          <EyeOff className="w-3 h-3 text-muted-foreground" />
                        ) : (
                          <Eye className="w-3 h-3 text-primary" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEditDemand(d)}
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeletingDemand(d)}
                    >
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
            <UserPlus className="w-3.5 h-3.5" />
            加入人員
          </Button>
        </div>
        {assignmentsLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : assignments.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            尚無配對人員
          </div>
        ) : (
          <div className="space-y-3">
            {assignments.map(a => (
              <div key={a.id} className="rounded-lg border bg-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {a.batchNote || `配對批次 #${a.id}`}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {a.members.length} 人
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => setDeletingAssignment(a)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {a.members.map((m: any) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/30"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {m.workerName}
                        </span>
                        {m.workerNameEn && (
                          <span className="text-xs text-muted-foreground">
                            {m.workerNameEn}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {m.workerNationality}
                        </span>
                        <StatusBadge
                          status={m.stage}
                          domain="assignmentStage"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Select
                          value={m.stage}
                          onValueChange={v =>
                            updateMemberStageMutation.mutate({
                              memberId: m.id,
                              stage: v as any,
                            })
                          }
                        >
                          <SelectTrigger className="h-7 w-28 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ASSIGNMENT_STAGE_OPTIONS.map(o => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() =>
                            removeMemberMutation.mutate({ memberId: m.id })
                          }
                        >
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
      <Dialog
        open={showDemandModal}
        onOpenChange={v => !v && closeDemandModal()}
      >
        <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDemand ? "編輯需求" : "新增需求"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>
                需求標籤／對外職稱 <span className="text-destructive">*</span>
              </Label>
              <Input
                value={demandForm.label}
                onChange={e =>
                  setDemandForm(f => ({ ...f, label: e.target.value }))
                }
                placeholder="例：住家看護（會煮飯）"
              />
              <p className="text-xs text-muted-foreground">
                此標籤即公開站顯示的職稱。
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>資格類型</Label>
                <Select
                  value={demandForm.qualType}
                  onValueChange={v =>
                    setDemandForm(f => ({ ...f, qualType: v as QualType }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUAL_TYPE_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>需求人數</Label>
                <Input
                  type="number"
                  min={1}
                  value={demandForm.neededCount}
                  onChange={e =>
                    setDemandForm(f => ({
                      ...f,
                      neededCount: Number(e.target.value),
                    }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>狀態</Label>
              <Select
                value={demandForm.status}
                onValueChange={v =>
                  setDemandForm(f => ({ ...f, status: v as DemandStatus }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEMAND_STATUS_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ── 公開職缺資訊（對外顯示）───────────────────────────────── */}
            <div className="pt-2 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                公開職缺資訊（顯示於公開媒合站）
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>聘僱型態</Label>
                  <Select
                    value={demandForm.employmentType || "none"}
                    onValueChange={v =>
                      setDemandForm(f => ({
                        ...f,
                        employmentType:
                          v === "none" ? "" : (v as typeof f.employmentType),
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="未設定" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">未設定</SelectItem>
                      <SelectItem value="live_in">住家（同住）</SelectItem>
                      <SelectItem value="live_out">不住家</SelectItem>
                      <SelectItem value="institution">機構</SelectItem>
                      <SelectItem value="other">其他</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>工作區（選填）</Label>
                  <Input
                    value={demandForm.district}
                    onChange={e =>
                      setDemandForm(f => ({ ...f, district: e.target.value }))
                    }
                    placeholder="例：大安區"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="space-y-1.5">
                  <Label>薪資下限（選填）</Label>
                  <Input
                    type="number"
                    min={0}
                    value={demandForm.salaryMin}
                    onChange={e =>
                      setDemandForm(f => ({ ...f, salaryMin: e.target.value }))
                    }
                    placeholder="28000"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>薪資上限（選填）</Label>
                  <Input
                    type="number"
                    min={0}
                    value={demandForm.salaryMax}
                    onChange={e =>
                      setDemandForm(f => ({ ...f, salaryMax: e.target.value }))
                    }
                    placeholder="32000"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="space-y-1.5">
                  <Label>期望上工日</Label>
                  <Input
                    type="date"
                    value={demandForm.expectedStartDate}
                    onChange={e =>
                      setDemandForm(f => ({
                        ...f,
                        expectedStartDate: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>
                    實際預計上工日{" "}
                    <span className="text-xs text-muted-foreground">
                      （僅後台）
                    </span>
                  </Label>
                  <Input
                    type="date"
                    value={demandForm.actualExpectedStartDate}
                    onChange={e =>
                      setDemandForm(f => ({
                        ...f,
                        actualExpectedStartDate: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5 mt-3">
                <Label>條件要求</Label>
                <Textarea
                  value={demandForm.requirements}
                  onChange={e =>
                    setDemandForm(f => ({ ...f, requirements: e.target.value }))
                  }
                  rows={2}
                  placeholder="語言、經驗等（受法遵限制）"
                />
              </div>
              <div className="space-y-1.5 mt-3">
                <Label>公開說明</Label>
                <Textarea
                  value={demandForm.publicDescription}
                  onChange={e =>
                    setDemandForm(f => ({
                      ...f,
                      publicDescription: e.target.value,
                    }))
                  }
                  rows={2}
                  placeholder="對外公開的職缺說明"
                />
              </div>
            </div>

            {/* ── 備註（分受眾）─────────────────────────────────────────── */}
            <div className="pt-2 border-t border-border space-y-3">
              <div className="space-y-1.5">
                <Label>
                  內部備註（密）
                  <span className="text-xs text-muted-foreground">
                    （僅後台）
                  </span>
                </Label>
                <Textarea
                  value={demandForm.notes}
                  onChange={e =>
                    setDemandForm(f => ({ ...f, notes: e.target.value }))
                  }
                  rows={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  求職者用備註{" "}
                  <span className="text-xs text-muted-foreground">
                    （登入求職者可見）
                  </span>
                </Label>
                <Textarea
                  value={demandForm.notesForSeeker}
                  onChange={e =>
                    setDemandForm(f => ({
                      ...f,
                      notesForSeeker: e.target.value,
                    }))
                  }
                  rows={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  應徵者用備註{" "}
                  <span className="text-xs text-muted-foreground">
                    （僅配對應徵者，P3 啟用）
                  </span>
                </Label>
                <Textarea
                  value={demandForm.notesForApplicant}
                  onChange={e =>
                    setDemandForm(f => ({
                      ...f,
                      notesForApplicant: e.target.value,
                    }))
                  }
                  rows={2}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDemandModal}>
              取消
            </Button>
            <Button
              onClick={submitDemand}
              disabled={
                createDemandMutation.isPending || updateDemandMutation.isPending
              }
            >
              {editingDemand ? "儲存" : "建立"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 配對 Modal */}
      <Dialog
        open={showAssignModal}
        onOpenChange={v => !v && setShowAssignModal(false)}
      >
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>加入配對人員</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 flex-1 overflow-y-auto">
            <div className="space-y-1.5">
              <Label>關聯需求（選填）</Label>
              <Select
                value={selectedDemandId ? String(selectedDemandId) : "__none__"}
                onValueChange={v =>
                  setSelectedDemandId(v === "__none__" ? undefined : Number(v))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="不指定需求" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">不指定需求</SelectItem>
                  {demands.map(d => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>批次備註</Label>
              <Input
                value={assignNote}
                onChange={e => setAssignNote(e.target.value)}
                placeholder="例：第一批候選人"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>選擇移工</Label>
                <span className="text-xs text-muted-foreground">
                  已選 {selectedWorkerIds.size} 人
                </span>
              </div>
              <Input
                placeholder="搜尋姓名、證號..."
                value={workerSearch}
                onChange={e => setWorkerSearch(e.target.value)}
              />
              <div className="rounded-lg border max-h-56 overflow-y-auto divide-y">
                {filteredWorkers.length === 0 ? (
                  <p className="p-4 text-sm text-center text-muted-foreground">
                    無符合移工
                  </p>
                ) : (
                  filteredWorkers.map(w => {
                    const isInvolved = involvedWorkerIds.has(w.id);
                    const involvementList = involvedMap.get(w.id) ?? [];
                    return (
                      <div
                        key={w.id}
                        className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors ${selectedWorkerIds.has(w.id) ? "bg-muted/50" : ""}`}
                        onClick={() => toggleWorker(w.id)}
                      >
                        <Checkbox
                          checked={selectedWorkerIds.has(w.id)}
                          onCheckedChange={() => toggleWorker(w.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium">
                              {w.name}
                            </span>
                            {w.nameEn && (
                              <span className="text-xs text-muted-foreground">
                                {w.nameEn}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {w.nationality}
                            </span>
                          </div>
                          {isInvolved && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <AlertTriangle className="w-3 h-3 text-amber-500" />
                              <span className="text-xs text-amber-600">
                                已在其他案件配對中：
                                {involvementList
                                  .map(i => i.caseName)
                                  .join("、")}
                              </span>
                            </div>
                          )}
                        </div>
                        <StatusBadge
                          status={w.lifecycleStatus}
                          domain="lifecycle"
                        />
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignModal(false)}>
              取消
            </Button>
            <Button
              onClick={submitAssignment}
              disabled={
                createAssignmentMutation.isPending ||
                selectedWorkerIds.size === 0
              }
            >
              加入{" "}
              {selectedWorkerIds.size > 0 ? `${selectedWorkerIds.size} 人` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 刪除需求確認 */}
      <AlertDialog
        open={!!deletingDemand}
        onOpenChange={open => !open && setDeletingDemand(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除需求</AlertDialogTitle>
            <AlertDialogDescription>
              即將刪除「{deletingDemand?.label}」，此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                deleteDemandMutation.mutate({ id: deletingDemand.id })
              }
            >
              確認刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 刪除配對確認 */}
      <AlertDialog
        open={!!deletingAssignment}
        onOpenChange={open => !open && setDeletingAssignment(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除配對</AlertDialogTitle>
            <AlertDialogDescription>
              即將刪除此配對批次及其所有人員，此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                deleteAssignmentMutation.mutate({ id: deletingAssignment.id })
              }
            >
              確認刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
