import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Pencil, ExternalLink, FileText, Image as ImageIcon, Calendar, User, Phone, Mail, Globe, Briefcase, Shield, AlertTriangle, Building2, Plus } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { getStatusLabel } from "@/lib/constants";
import { WorkerModal } from "@/components/WorkerModal";
import CaseModal from "@/components/CaseModal";

function daysLabel(days: number | null | undefined): { text: string; color: string } {
  if (days == null) return { text: "—", color: "text-muted-foreground" };
  if (days < 0) return { text: `已過期 ${Math.abs(days)} 天`, color: "text-destructive font-medium" };
  if (days <= 30) return { text: `剩 ${days} 天`, color: "text-destructive font-medium" };
  if (days <= 90) return { text: `剩 ${days} 天`, color: "text-amber-600 font-medium" };
  return { text: `剩 ${days} 天`, color: "text-muted-foreground" };
}

function InfoRow({ label, value, className }: { label: string; value?: string | null; className?: string }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm ${className ?? ""}`}>{value}</span>
    </div>
  );
}

function AttachmentItem({ label, fileKey }: { label: string; fileKey?: string | null }) {
  if (!fileKey) return null;
  const url = `/manus-storage/${fileKey.split("/").pop()}`;
  const isPdf = fileKey.toLowerCase().endsWith(".pdf");
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-3 py-2 rounded-md border bg-muted/30 hover:bg-muted/60 transition-colors text-sm"
    >
      {isPdf ? <FileText className="w-4 h-4 text-muted-foreground shrink-0" /> : <ImageIcon className="w-4 h-4 text-muted-foreground shrink-0" />}
      <span className="truncate">{label}</span>
      <ExternalLink className="w-3 h-3 text-muted-foreground ml-auto shrink-0" />
    </a>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 mt-6 first:mt-0">
      {children}
    </h3>
  );
}

export default function WorkerDetail() {
  const params = useParams<{ id: string }>();
  const workerId = Number(params.id);
  const [, navigate] = useLocation();
  const [showEdit, setShowEdit] = useState(false);
  const [showCaseModal, setShowCaseModal] = useState(false);

  const utils = trpc.useUtils();
  const { data: worker, isLoading, refetch } = trpc.workers.getById.useQuery(
    { id: workerId },
    {
      // 列表快取中若已有資料，先顯示它，不等待 getById 回應
      initialData: () => utils.workers.list.getData()?.find(w => w.id === workerId),
      initialDataUpdatedAt: 0, // 列表快取資料視為旧資料，使用後會在背景重新取得最新資料
    }
  );
  const { data: involvements, refetch: refetchCases } = trpc.caseAssignments.workerInvolvements.useQuery({});

  const workerCases = involvements?.filter(i => i.workerId === workerId) ?? [];

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  if (!worker) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p>找不到此移工</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/workers")}>
          返回移工列表
        </Button>
      </div>
    );
  }

  const permitDays = daysLabel(worker.residentPermitDaysLeft);
  const passportDays = daysLabel(worker.passportDaysLeft);
  const medicalDays = daysLabel(worker.nextMedicalExamDaysLeft);

  const hasAnyAttachment = worker.photoKey || worker.ktpKey || worker.residentPermitFrontKey ||
    worker.residentPermitBackKey || worker.passportKey || worker.passportEntryKey || worker.medicalReportKey;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-0">
      {/* 頁首 */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/workers")} className="mt-0.5 shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight">
                {worker.nameCn || worker.nameEn || worker.name}
              </h1>
              {(worker.nameCn && worker.nameEn) && (
                <span className="text-muted-foreground text-base">{worker.nameEn}</span>
              )}
              <StatusBadge status={worker.lifecycleStatus} />
              <StatusBadge status={worker.documentStatus} />
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
              {worker.nationality && <span className="flex items-center gap-1"><Globe className="w-3.5 h-3.5" />{worker.nationality}</span>}
              {worker.managerId && <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />負責人 {(worker as any).managerName ?? worker.managerId}</span>}
              {worker.externalLink && (
                <a href={worker.externalLink} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-600 hover:underline">
                  <ExternalLink className="w-3.5 h-3.5" />外部連結
                </a>
              )}
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => setShowEdit(true)}>
          <Pencil className="w-3.5 h-3.5" />編輯
        </Button>
      </div>

      {/* 證件到期警示列 */}
      {(worker.residentPermitDaysLeft != null && worker.residentPermitDaysLeft <= 90) ||
       (worker.passportDaysLeft != null && worker.passportDaysLeft <= 90) ||
       (worker.nextMedicalExamDaysLeft != null && worker.nextMedicalExamDaysLeft <= 30) ? (
        <div className="flex flex-wrap gap-2 mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex flex-wrap gap-2">
            {worker.residentPermitDaysLeft != null && worker.residentPermitDaysLeft <= 90 && (
              <span className={`text-xs ${permitDays.color}`}>居留證 {permitDays.text}</span>
            )}
            {worker.passportDaysLeft != null && worker.passportDaysLeft <= 90 && (
              <span className={`text-xs ${passportDays.color}`}>護照 {passportDays.text}</span>
            )}
            {worker.nextMedicalExamDaysLeft != null && worker.nextMedicalExamDaysLeft <= 30 && (
              <span className={`text-xs ${medicalDays.color}`}>體檢 {medicalDays.text}</span>
            )}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左欄：基本資料 */}
        <div className="lg:col-span-2 space-y-0">
          <SectionTitle>基本資料</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
            <InfoRow label="中文姓名" value={worker.nameCn} />
            <InfoRow label="英文姓名" value={worker.nameEn} />
            <InfoRow label="國籍" value={worker.nationality} />
            <InfoRow label="出生日期" value={worker.birthDate} />
            <InfoRow label="性別" value={worker.gender === "male" ? "男" : worker.gender === "female" ? "女" : worker.gender} />
            <InfoRow label="出生地點" value={worker.birthPlace} />
            <InfoRow label="職業" value={worker.occupation} />
            <InfoRow label="入境日期" value={worker.entryDate} />
            <InfoRow label="備註" value={worker.notes} className="col-span-2" />
          </div>

          <Separator className="my-5" />
          <SectionTitle>證件資料</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
            <InfoRow label="統一證碼（居留證）" value={worker.residentPermitNo} />
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">居留證有效日期</span>
              <span className={`text-sm ${permitDays.color}`}>
                {worker.residentPermitExpiry ?? "—"}
                {worker.residentPermitExpiry && <span className="ml-1.5 text-xs">({permitDays.text})</span>}
              </span>
            </div>
            <InfoRow label="護照號碼" value={worker.passportNo} />
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">護照有效日期</span>
              <span className={`text-sm ${passportDays.color}`}>
                {worker.passportExpiry ?? "—"}
                {worker.passportExpiry && <span className="ml-1.5 text-xs">({passportDays.text})</span>}
              </span>
            </div>
          </div>

          <Separator className="my-5" />
          <SectionTitle>聯絡資料</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
            <InfoRow label="手機號碼" value={worker.phone} />
            <InfoRow label="電子信箱" value={worker.email} />
          </div>

          <Separator className="my-5" />
          <SectionTitle>體檢資料</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
            <InfoRow label="最近一次體檢日期" value={worker.lastMedicalExamDate} />
            <InfoRow label="下次體檢類型" value={worker.nextMedicalExamType} />
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">下次體檢日期</span>
              <span className={`text-sm ${medicalDays.color}`}>
                {worker.nextMedicalExamDate ?? "—"}
                {worker.nextMedicalExamDate && <span className="ml-1.5 text-xs">({medicalDays.text})</span>}
              </span>
            </div>
          </div>

          {hasAnyAttachment && (
            <>
              <Separator className="my-5" />
              <SectionTitle>附件</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <AttachmentItem label="大頭照" fileKey={worker.photoKey} />
                <AttachmentItem label="母國身分證 (KTP)" fileKey={worker.ktpKey} />
                <AttachmentItem label="居留證正面" fileKey={worker.residentPermitFrontKey} />
                <AttachmentItem label="居留證背面" fileKey={worker.residentPermitBackKey} />
                <AttachmentItem label="護照" fileKey={worker.passportKey} />
                <AttachmentItem label="護照入境頁" fileKey={worker.passportEntryKey} />
                <AttachmentItem label="體檢報告" fileKey={worker.medicalReportKey} />
              </div>
            </>
          )}
        </div>

        {/* 右欄：關聯案件 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <SectionTitle>關聯案件</SectionTitle>
            <button
              onClick={() => setShowCaseModal(true)}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors px-2 py-1 rounded-md hover:bg-primary/10"
            >
              <Plus className="w-3.5 h-3.5" />
              新增案件
            </button>
          </div>
          {workerCases.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              尚無關聯案件
            </div>
          ) : (
            <div className="space-y-2">
              {workerCases.map((c, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border bg-card p-3 space-y-2"
                >
                  {/* 案件名稱 → 跳轉案件詳情 */}
                  <button
                    onClick={() => navigate(`/cases/${c.caseId}`)}
                    className="w-full text-left group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate group-hover:underline">{c.caseName}</span>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {c.stage === "employed" ? "在職" : c.stage === "departed" ? "已離境" : c.stage === "confirmed" ? "已確認" : c.stage === "upcoming" ? "即將聘僱" : c.stage === "candidate" ? "人選評估" : c.stage}
                      </Badge>
                    </div>
                  </button>
                  {/* 客戶名稱 → 跳轉客戶詳情 */}
                  {c.customerName && c.customerId > 0 && (
                    <button
                      onClick={() => navigate(`/customers/${c.customerId}`)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group"
                    >
                      <Building2 className="w-3 h-3 shrink-0" />
                      <span className="truncate group-hover:underline">{c.customerName}</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 編輯 Modal */}
      {showEdit && (
        <WorkerModal
          open={showEdit}
          onClose={() => { setShowEdit(false); refetch(); }}
          onSuccess={() => { setShowEdit(false); refetch(); }}
          editId={workerId}
        />
      )}

      {/* 新增案件 Modal（預填移工） */}
      {showCaseModal && (
        <CaseModal
          open={showCaseModal}
          onClose={() => setShowCaseModal(false)}
          onSuccess={() => { setShowCaseModal(false); refetchCases(); }}
          defaultWorkerId={workerId}
        />
      )}
    </div>
  );
}
