import React, { useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageSkeleton } from "@/components/LoadingStates";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Pencil, ExternalLink, FileText, Image as ImageIcon, Building2, User, Users, Plus } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { getStatusLabel } from "@/lib/constants";
import { CustomerModal } from "@/components/CustomerModal";
import CaseModal from "@/components/CaseModal";
import { AttachmentPreviewModal } from "@/components/AttachmentPreviewModal";

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
  const [previewOpen, setPreviewOpen] = React.useState(false);
  if (!fileKey) return null;
  const ext = fileKey.split(".").pop()?.toLowerCase() ?? "";
  const isPdf = ext === "pdf";
  return (
    <>
      <button
        type="button"
        onClick={() => setPreviewOpen(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-md border bg-muted/30 hover:bg-muted/60 transition-colors text-sm w-full text-left"
      >
        {isPdf
          ? <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
          : <ImageIcon className="w-4 h-4 text-muted-foreground shrink-0" />}
        <span className="truncate flex-1">{label}</span>
        <span className="text-xs text-muted-foreground shrink-0">點擊預覽</span>
      </button>
      <AttachmentPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        label={label}
        fileKey={fileKey}
      />
    </>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 mt-6 first:mt-0">
      {children}
    </h3>
  );
}

const JOB_SEEKER_TYPE_LABEL: Record<string, string> = {
  new_hire: "新聘", renewal: "續聘", transfer: "轉換雇主", supplement: "補件",
};
const RECRUITMENT_LETTER_TYPE_LABEL: Record<string, string> = {
  domestic: "國內招募", overseas: "國外招募", both: "國內外",
};
const EMPLOYMENT_LETTER_TYPE_LABEL: Record<string, string> = {
  initial: "初次聘僱", renewal: "續聘", transfer: "轉換",
};

export default function CustomerDetail() {
  const params = useParams<{ id: string }>();
  const customerId = Number(params.id);
  const [, navigate] = useLocation();
  const [showEdit, setShowEdit] = useState(false);
  const [showCaseModal, setShowCaseModal] = useState(false);

  const utils = trpc.useUtils();
  const { data: customer, isLoading, refetch } = trpc.customers.getById.useQuery(
    { id: customerId },
    {
      initialData: () => utils.customers.list.getData()?.find(c => c.id === customerId),
      initialDataUpdatedAt: 0,
    }
  );
  const { data: allCases, refetch: refetchCases } = trpc.cases.list.useQuery({});
  const { data: allInvolvements } = trpc.caseAssignments.workerInvolvements.useQuery({});

  const customerCases = allCases?.filter(c => c.customerId === customerId) ?? [];
  // 每個案件下的移工（依 caseId 分組）
  const workersByCaseId = (allInvolvements ?? []).reduce<Record<number, typeof allInvolvements>>((acc, inv) => {
    if (!acc[inv.caseId]) acc[inv.caseId] = [];
    acc[inv.caseId]!.push(inv);
    return acc;
  }, {});
  const isPersonal = customer?.employerType === "individual";

  if (isLoading) {
    return <PageSkeleton cardRows={2} />;
  }

  if (!customer) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p>找不到此客戶</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/customers")}>
          返回客戶列表
        </Button>
      </div>
    );
  }

  const hasIdAttachment = customer.idFrontKey || customer.idBackKey;
  const hasCareReceiverAttachment = customer.careReceiverIdFrontKey || customer.careReceiverIdBackKey;
  const hasDocAttachment = customer.jobSeekerFileKey || customer.recruitmentLetterFileKey || customer.employmentLetterFileKey;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-0">
      {/* 頁首 */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/customers")} className="mt-0.5 shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight">{customer.name}</h1>
              <Badge variant="outline" className="text-xs font-mono">
                {isPersonal ? "個人" : "公司"}
              </Badge>
              {customer.contractStatus && <StatusBadge status={customer.contractStatus} />}
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
              {customer.employerNo && <span>編號 {customer.employerNo}</span>}
              {!isPersonal && customer.taxId && <span>統編 {customer.taxId}</span>}
              {!isPersonal && customer.industry && <span>{customer.industry}</span>}
              {customer.managerId && <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />負責人 {(customer as any).managerName ?? customer.managerId}</span>}
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => setShowEdit(true)}>
          <Pencil className="w-3.5 h-3.5" />編輯
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左欄：主要資料 */}
        <div className="lg:col-span-2 space-y-0">
          <SectionTitle>申請人基本資料</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
            <InfoRow label="雇主姓名 / 公司名稱" value={customer.name} />
            <InfoRow label="行動電話" value={customer.phone} />
            <InfoRow label="市內電話" value={customer.landline} />
            <InfoRow label="通訊地址" value={customer.address} />
            <InfoRow label="戶籍 / 登記地址" value={customer.registeredAddress} />
            <InfoRow label="介紹人" value={customer.referrer} />
            {isPersonal && <InfoRow label="身分證字號" value={customer.idNo} />}
            {isPersonal && <InfoRow label="聘前講習證明序號" value={customer.preCourseNo} />}
            {!isPersonal && <InfoRow label="統一編號" value={customer.taxId} />}
            {!isPersonal && <InfoRow label="產業" value={customer.industry} />}
            {!isPersonal && <InfoRow label="聯絡窗口" value={customer.contactName} />}
            {!isPersonal && <InfoRow label="聯絡窗口電話" value={customer.contactPhone} />}
          </div>

          {hasIdAttachment && (
            <>
              <Separator className="my-5" />
              <SectionTitle>身分證附件</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <AttachmentItem label="雇主身分證正面" fileKey={customer.idFrontKey} />
                <AttachmentItem label="雇主身分證反面" fileKey={customer.idBackKey} />
              </div>
            </>
          )}

          {/* 被照顧者（個人雇主） */}
          {isPersonal && (customer.careReceiverName || customer.careReceiverIdNo || hasCareReceiverAttachment) && (
            <>
              <Separator className="my-5" />
              <SectionTitle>被照顧者基本資料</SectionTitle>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
                <InfoRow label="被看護者編號" value={customer.careReceiverNo} />
                <InfoRow label="被照顧者姓名" value={customer.careReceiverName} />
                <InfoRow label="出生年月日" value={customer.careReceiverBirthDate} />
                <InfoRow label="身分證字號" value={customer.careReceiverIdNo} />
                <InfoRow label="戶籍地址" value={customer.careReceiverAddress} />
                <InfoRow label="申請資格" value={customer.careReceiverQualification} />
                <InfoRow label="與被看護者關係" value={customer.careReceiverRelation} />
              </div>
              {hasCareReceiverAttachment && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                  <AttachmentItem label="被看護者身分證正面" fileKey={customer.careReceiverIdFrontKey} />
                  <AttachmentItem label="被看護者身分證反面" fileKey={customer.careReceiverIdBackKey} />
                </div>
              )}
            </>
          )}

          {/* 申請資格 */}
          {(customer.jobSeekerType || customer.jobSeekerDate || customer.recruitmentLetterType) && (
            <>
              <Separator className="my-5" />
              <SectionTitle>申請資格</SectionTitle>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
                <InfoRow label="求才類別" value={customer.jobSeekerType ? JOB_SEEKER_TYPE_LABEL[customer.jobSeekerType] : null} />
                <InfoRow label="求才日期" value={customer.jobSeekerDate} />
                <InfoRow label="招募函類別" value={customer.recruitmentLetterType ? RECRUITMENT_LETTER_TYPE_LABEL[customer.recruitmentLetterType] : null} />
                <InfoRow label="招募函申請日期" value={customer.recruitmentLetterDate} />
                <InfoRow label="招募許可情況說明" value={customer.recruitmentPermitNote} />
                <InfoRow label="許可天數" value={customer.recruitmentPermitDays?.toString()} />
                <InfoRow label="舊工離境日期" value={customer.previousWorkerDepartureDate} />
              </div>
            </>
          )}

          {/* 聘僱函 */}
          {(customer.employmentLetterType || customer.approvedStartDate) && (
            <>
              <Separator className="my-5" />
              <SectionTitle>聘僱函</SectionTitle>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
                <InfoRow label="聘僱函類別" value={customer.employmentLetterType ? EMPLOYMENT_LETTER_TYPE_LABEL[customer.employmentLetterType] : null} />
                <InfoRow label="聘僱函申請日期" value={customer.employmentLetterDate} />
                <InfoRow label="核准聘僱起始日" value={customer.approvedStartDate} />
                <InfoRow label="核准聘僱期限" value={customer.approvedPeriod} />
                <InfoRow label="核准聘僱截止日" value={customer.approvedEndDate} />
              </div>
            </>
          )}

          {hasDocAttachment && (
            <>
              <Separator className="my-5" />
              <SectionTitle>文件附件</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <AttachmentItem label="求才資格檔案" fileKey={customer.jobSeekerFileKey} />
                <AttachmentItem label="招募函許可檔案" fileKey={customer.recruitmentLetterFileKey} />
                <AttachmentItem label="聘僱函檔案" fileKey={customer.employmentLetterFileKey} />
              </div>
            </>
          )}
        </div>

        {/* 右欄：媒合案件 + 關聯案件 */}
        <div className="space-y-6">
          {/* 媒合案件狀態 */}
          {(customer.caseNo || customer.caseStatus) && (
            <div>
              <SectionTitle>媒合案件</SectionTitle>
              <div className="rounded-lg border bg-card p-4 space-y-2">
                {customer.caseNo && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">案件編號</span>
                    <span className="font-mono">{customer.caseNo}</span>
                  </div>
                )}
                {customer.caseStatus && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">管理狀態</span>
                    <StatusBadge status={customer.caseStatus} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 關聯案件 */}
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
            {customerCases.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                尚無關聯案件
              </div>
            ) : (
              <div className="space-y-2">
                {customerCases.map(c => {
                  const caseWorkers = workersByCaseId[c.id] ?? [];
                  const activeWorkers = caseWorkers.filter(
                    inv => inv && ["employed", "confirmed", "upcoming", "candidate"].includes(inv.stage)
                  );
                  return (
                    <div key={c.id} className="rounded-lg border bg-card p-3 space-y-2">
                      {/* 案件名稱 → 跳轉案件詳情 */}
                      <button
                        onClick={() => navigate(`/cases/${c.id}`)}
                        className="w-full text-left group"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium truncate group-hover:underline">{c.name}</span>
                          <StatusBadge status={c.status} />
                        </div>
                      </button>
                      {/* 移工名单 → 可點擊跳轉移工詳情 */}
                      {activeWorkers.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/50 items-start">
                          <Users className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
                          {activeWorkers.map((inv, i) => inv && (
                            <button
                              key={i}
                              onClick={() => navigate(`/workers/${inv.workerId}`)}
                              className="text-xs text-muted-foreground hover:text-foreground transition-colors hover:underline font-medium"
                            >
                              {inv.workerName || `移工#${inv.workerId}`}{i < activeWorkers.length - 1 ? "、" : ""}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 編輯 Modal */}
      {showEdit && (
        <CustomerModal
          open={showEdit}
          onClose={() => { setShowEdit(false); refetch(); }}
          onSuccess={() => { setShowEdit(false); refetch(); }}
          editId={customerId}
        />
      )}

      {/* 新增案件 Modal（預填客戶） */}
      {showCaseModal && (
        <CaseModal
          open={showCaseModal}
          onClose={() => setShowCaseModal(false)}
          onSuccess={() => { setShowCaseModal(false); refetchCases(); }}
          defaultCustomerId={customerId}
        />
      )}
    </div>
  );
}
