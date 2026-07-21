import React, { useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageSkeleton } from "@/components/LoadingStates";
import { ArrowLeft, Pencil, Building2, User, Phone, MapPin, Heart, FileText, AlertTriangle, Paperclip, ExternalLink, Calendar, Clock, Shield } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { getStatusLabel } from "@/lib/constants";
import CaseModal from "@/components/CaseModal";
import { AttachmentPreviewModal } from "@/components/AttachmentPreviewModal";
import CaseQualificationsTab from "@/components/case/CaseQualificationsTab";
import CaseMatchingTab from "@/components/case/CaseMatchingTab";
import CaseEmploymentTab from "@/components/case/CaseEmploymentTab";

/** 合規狀態 → 徽章樣式 */
const COMPLIANCE_BADGE: Record<string, string> = {
  overdue: "status-red",
  due_now: "status-amber",
  upcoming: "status-gray",
};

/** 小型附件預覽按鈕（內嵌於各卡片中） */
function AttachmentLink({ label, fileKey, className }: { label: string; fileKey?: string | null; className?: string }) {
  const [open, setOpen] = React.useState(false);
  if (!fileKey) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className ?? "flex items-center gap-1 text-xs text-primary hover:underline"}
      >
        <Paperclip className="w-3 h-3" />{label}
      </button>
      <AttachmentPreviewModal open={open} onClose={() => setOpen(false)} label={label} fileKey={fileKey} />
    </>
  );
}

export default function CaseDetail() {
  const params = useParams<{ id: string }>();
  const caseId = Number(params.id);
  const [, navigate] = useLocation();
  const [showEdit, setShowEdit] = useState(false);

  const utils = trpc.useUtils();
  // 法定合規（健檢 6/18/30 個月 + 聘僱許可續聘）：與鈴鐺/儀表板同一來源，篩出本案
  const { data: compliance } = trpc.dashboard.compliance.useQuery();
  const caseAlerts = (compliance?.alerts ?? []).filter(a => a.caseId === caseId);
  const examAlertByMilestone = new Map(
    caseAlerts.filter(a => a.kind === "health_check").map(a => [a.milestone, a] as const),
  );
  const { data: caseData, isLoading } = trpc.cases.getById.useQuery(
    { id: caseId },
    {
      initialData: () => {
        const cached = utils.cases.list.getData();
        return cached?.find((c: any) => c.id === caseId) as any;
      },
    }
  );

  // 被照顧者：從新子表讀取
  const careReceiverId = (caseData as any)?.careReceiverId;
  const customerId = (caseData as any)?.customerId;
  const { data: careReceivers = [] } = trpc.customers.careReceivers.listByCustomer.useQuery(
    { customerId: customerId ?? 0 },
    { enabled: !!customerId }
  );
  const linkedCareReceiver = careReceiverId
    ? careReceivers.find((cr: any) => cr.id === careReceiverId) ?? null
    : null;

  if (isLoading) {
    return <PageSkeleton cardRows={3} />;
  }

  if (!caseData) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p>找不到此案件</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/cases")}>
          返回案件列表
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* 頁首 */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/cases")} className="mt-0.5">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight">{caseData.name}</h1>
              <StatusBadge status={caseData.status} domain="caseMgmtStatus" />
              {(caseData as any).caseNo && (
                <Badge variant="outline" className="font-mono text-xs">{(caseData as any).caseNo}</Badge>
              )}
              {(caseData as any).needsReview === 1 && (
                <Badge variant="destructive" className="gap-1 text-xs">
                  <AlertTriangle className="w-3 h-3" />需檢查
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              <span>客戶：{caseData.customerName}</span>
              <span>·</span>
              <span>負責人：{caseData.managerName}</span>
              {(caseData as any).caseCondition && (
                <>
                  <span>·</span>
                  <span className="text-amber-600 font-medium">{(caseData as any).caseCondition}</span>
                </>
              )}
              {caseData.createdAt && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />建立 {new Date(caseData.createdAt).toLocaleString("zh-TW")}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowEdit(true)}>
          <Pencil className="w-3.5 h-3.5" />編輯案件
        </Button>
      </div>

      {/* 法定合規提醒 Banner（本案的健檢 / 聘僱許可到期） */}
      {caseAlerts.length > 0 && (() => {
        const hasOverdue = caseAlerts.some(a => a.status === "overdue");
        return (
          <div
            data-testid="case-compliance-banner"
            className={`rounded-lg border p-4 space-y-2 ${hasOverdue ? "border-red-200 bg-red-50/60" : "border-amber-200 bg-amber-50/60"}`}
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className={`w-4 h-4 ${hasOverdue ? "text-red-500" : "text-amber-500"}`} />
              法定合規提醒
              <span className="text-xs font-normal text-muted-foreground">（{caseAlerts.length} 項待處理）</span>
            </div>
            <ul className="space-y-1.5">
              {caseAlerts.map(a => {
                const isHealth = a.kind === "health_check";
                const badgeText = a.status === "overdue"
                  ? `逾期 ${Math.abs(a.daysToDeadline)} 天`
                  : isHealth
                    ? `應於 ${a.windowEnd} 前完成`
                    : `${a.daysToDeadline} 天後到期`;
                return (
                  <li
                    key={isHealth ? `hc-${a.milestone}` : "ep"}
                    data-testid="case-compliance-item"
                    data-kind={a.kind}
                    data-status={a.status}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span className="font-medium">{a.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {isHealth ? `基準日 ${a.dueDate}` : `截止日 ${a.dueDate}`}
                    </span>
                    <span className={`ml-auto inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${COMPLIANCE_BADGE[a.status] ?? "status-gray"}`}>
                      {badgeText}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })()}

      {/* 三維度進度匯總 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">資格申請</p>
          <p className="text-2xl font-bold tabular-nums">{(caseData as any).qualCount ?? 0}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            已核准 {(caseData as any).approvedQualCount ?? 0}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">媒合需求</p>
          <p className="text-2xl font-bold tabular-nums">{(caseData as any).demandCount ?? 0}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            需求人數 {(caseData as any).totalNeeded ?? 0}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">配對人員</p>
          <p className="text-2xl font-bold tabular-nums">{(caseData as any).memberCount ?? 0}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            在職 {(caseData as any).employedCount ?? 0}
          </p>
        </div>
      </div>

      {/* 四 Tab */}
      <Tabs defaultValue="overview">
        <TabsList className="grid w-full grid-cols-4 max-w-xl">
          <TabsTrigger value="overview">基本資料</TabsTrigger>
          <TabsTrigger value="qualifications">資格管理</TabsTrigger>
          <TabsTrigger value="matching">媒合管理</TabsTrigger>
          <TabsTrigger value="employment">聘僱管理</TabsTrigger>
        </TabsList>

        {/* 基本資料 Tab */}
        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* 雇主資訊卡 */}
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Building2 className="w-4 h-4 text-primary" />雇主資訊
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground w-20 shrink-0">雇主名稱</span>
                  <a
                    href={`/customers/${caseData.customerId}`}
                    className="font-medium text-primary hover:underline flex items-center gap-1"
                    onClick={e => { e.stopPropagation(); navigate(`/customers/${caseData.customerId}`); e.preventDefault(); }}
                  >
                    {caseData.customerName || "—"}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground w-20 shrink-0">雇主電話</span>
                  <span className="font-medium">{(caseData as any).customerPhone || "—"}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground w-20 shrink-0">通訊地址</span>
                  <span className="font-medium">{(caseData as any).customerAddress || "—"}</span>
                </div>
                {linkedCareReceiver ? (
                  <>
                    <div className="flex items-start gap-2">
                      <span className="text-muted-foreground w-20 shrink-0">被照顧者</span>
                      <span className="font-medium">{linkedCareReceiver.careReceiverName || "—"}</span>
                    </div>
                    {linkedCareReceiver.careReceiverRelation && (
                      <div className="flex items-start gap-2">
                        <span className="text-muted-foreground w-20 shrink-0">關係</span>
                        <span className="font-medium">{linkedCareReceiver.careReceiverRelation}</span>
                      </div>
                    )}
                    {linkedCareReceiver.careReceiverQualification && (
                      <div className="flex items-start gap-2">
                        <span className="text-muted-foreground w-20 shrink-0">申請資格</span>
                        <Badge variant="secondary" className="text-xs">{linkedCareReceiver.careReceiverQualification}</Badge>
                      </div>
                    )}
                    {linkedCareReceiver.careReceiverIdNo && (
                      <div className="flex items-start gap-2">
                        <span className="text-muted-foreground w-20 shrink-0">身分證</span>
                        <span className="font-medium font-mono text-xs">{linkedCareReceiver.careReceiverIdNo}</span>
                      </div>
                    )}
                  </>
                ) : careReceiverId ? (
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground w-20 shrink-0">被照顧者</span>
                    <span className="text-xs text-muted-foreground">載入中...</span>
                  </div>
                ) : null}
              </div>
              {/* 招募許可函連結 */}
              {(caseData as any).recruitmentPermitFileKey && (
                <div className="pt-2 border-t border-border/50">
                  <AttachmentLink
                    label="招募許可函"
                    fileKey={(caseData as any).recruitmentPermitFileKey}
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                  />
                </div>
              )}
            </div>

            {/* 移工資訊卡 */}
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <User className="w-4 h-4 text-primary" />外國人資訊
              </div>
              {(caseData as any).primaryWorkerId ? (
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground w-20 shrink-0">中文姓名</span>
                    <a
                      href={`/workers/${(caseData as any).primaryWorkerId}`}
                      className="font-medium text-primary hover:underline flex items-center gap-1"
                      onClick={e => { e.stopPropagation(); navigate(`/workers/${(caseData as any).primaryWorkerId}`); e.preventDefault(); }}
                    >
                      {(caseData as any).workerNameCn || "—"}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground w-20 shrink-0">英文姓名</span>
                    <span className="font-medium font-mono">{(caseData as any).workerNameEn || "—"}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground w-20 shrink-0">居留證號</span>
                    <span className="font-medium font-mono">{(caseData as any).workerResidentPermitNo || "—"}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground w-20 shrink-0">居留證效期</span>
                    <span className="font-medium">{(caseData as any).workerResidentPermitExpiry || "—"}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground w-20 shrink-0">護照號碼</span>
                    <span className="font-medium font-mono">{(caseData as any).workerPassportNo || "—"}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground w-20 shrink-0">護照效期</span>
                    <span className="font-medium">{(caseData as any).workerPassportExpiry || "—"}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground w-20 shrink-0">手機號碼</span>
                    <span className="font-medium">{(caseData as any).workerPhone || "—"}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground w-20 shrink-0">國籍</span>
                    <span className="font-medium">{(caseData as any).workerNationality || "—"}</span>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground py-4 text-center">
                  尚未指定主要外國人
                </div>
              )}
            </div>

            {/* 聘僱時間與代辦事項卡片 */}
            {((caseData as any).continuousEmploymentDate ||
              (caseData as any).employmentPeriodMonths ||
              (caseData as any).terminationDate ||
              (caseData as any).recruitmentAgencyItems ||
              (caseData as any).employmentAgencyItems ||
              (caseData as any).postEmploymentInsurance ||
              (caseData as any).employmentPermitFileKey ||
              (caseData as any).employmentStatus ||
              (caseData as any).terminationLetterFileKey) && (
              <div className="rounded-lg border bg-card p-4 space-y-4 md:col-span-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Calendar className="w-4 h-4 text-primary" />聘僱資料
                </div>

                {/* 聘僱時間 */}
                {((caseData as any).continuousEmploymentDate || (caseData as any).employmentPeriodMonths || (caseData as any).terminationDate) && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3" /> 聘僱時間
                    </p>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">接續聘僱日期</p>
                        <p className="font-medium">{(caseData as any).continuousEmploymentDate || "—"}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">期間長度</p>
                        <p className="font-medium">
                          {(caseData as any).employmentPeriodMonths
                            ? `${(caseData as any).employmentPeriodMonths} 個月`
                            : "—"}
                        </p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">終止聘僱日期</p>
                        <p className="font-medium text-destructive">{(caseData as any).terminationDate || "—"}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 代辦事項 */}
                {((caseData as any).recruitmentAgencyItems || (caseData as any).employmentAgencyItems || (caseData as any).postEmploymentInsurance) && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                      <FileText className="w-3 h-3" /> 代辦事項
                    </p>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">招募函代辦事項</p>
                        <p className="font-medium">{{
                          none: "無", self: "自辦", agency: "仲介代辦",
                        }[(caseData as any).recruitmentAgencyItems as string] || "—"}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">聘僱函代辦事項</p>
                        <p className="font-medium">{{
                          none: "無", self: "自辦", agency: "仲介代辦",
                        }[(caseData as any).employmentAgencyItems as string] || "—"}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">聘僱後尚未完成保險</p>
                        <p className="font-medium">{{
                          none: "無",
                          health: "健保待辦",
                          accident: "意外險待辦",
                          both: "健保 + 意外險待辦",
                        }[(caseData as any).postEmploymentInsurance as string] || "—"}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 聘僱許可函與情況 */}
                {((caseData as any).employmentPermitFileKey || (caseData as any).employmentStatus || (caseData as any).terminationLetterFileKey) && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                      <Shield className="w-3 h-3" /> 聘僱許可函與情況
                    </p>
                    <div className="flex flex-wrap gap-4 text-sm">
                      {(caseData as any).employmentStatus && (
                        <div className="space-y-0.5">
                          <p className="text-xs text-muted-foreground">聘僱情況</p>
                          <Badge variant={{
                            normal: "default", suspended: "secondary",
                            terminated: "destructive", transferred: "outline",
                          }[(caseData as any).employmentStatus as string] as any || "secondary"}>
                            {{
                              normal: "正常", suspended: "暫停",
                              terminated: "終止", transferred: "轉就",
                            }[(caseData as any).employmentStatus as string] || (caseData as any).employmentStatus}
                          </Badge>
                        </div>
                      )}
                      {(caseData as any).employmentPermitFileKey && (
                        <div className="space-y-0.5">
                          <p className="text-xs text-muted-foreground">聆僱許可函</p>
                          <AttachmentLink label="檢視附件" fileKey={(caseData as any).employmentPermitFileKey} />
                        </div>
                      )}
                      {(caseData as any).terminationLetterFileKey && (
                        <div className="space-y-0.5">
                          <p className="text-xs text-muted-foreground">終止函</p>
                          <AttachmentLink label="檢視附件" fileKey={(caseData as any).terminationLetterFileKey} />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 承接通報/入國通報卡片 */}
            {((caseData as any).notificationNo || (caseData as any).entryNotificationDate || (caseData as any).certificateNo) && (
              <div className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.1a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l.81-.81a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  承接通報 / 入國通報（3 日內）
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">通報書序號</p>
                    <p className="font-medium font-mono">{(caseData as any).notificationNo || "—"}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">入國通報申請日</p>
                    <p className="font-medium">{(caseData as any).entryNotificationDate || "—"}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">證明書序號</p>
                    <p className="font-medium font-mono">{(caseData as any).certificateNo || "—"}</p>
                  </div>
                </div>
              </div>
            )}

            {/* 內政部移民署卡片 */}
            {((caseData as any).niaCategory || (caseData as any).niaNo || (caseData as any).residencePermitSubmitDate) && (
              <div className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-purple-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                  內政部移民署
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">一站式類別</p>
                    <p className="font-medium">{(caseData as any).niaCategory || "—"}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">一站式序號</p>
                    <p className="font-medium font-mono">{(caseData as any).niaNo || "—"}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">居留證申請送審日</p>
                    <p className="font-medium">{(caseData as any).residencePermitSubmitDate || "—"}</p>
                  </div>
                </div>
              </div>
            )}

            {/* 勞動部聘僱許可函卡片 */}
            {((caseData as any).molReceiptNo || (caseData as any).employmentLetterCategory || (caseData as any).applicationSubmitDate || (caseData as any).issuanceDate || (caseData as any).approvalReceiptDate) && (
              <div className="rounded-lg border bg-card p-4 space-y-3 md:col-span-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                  勞動部聘僱許可函
                </div>
                <div className="grid grid-cols-5 gap-4 text-sm">
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">收文號</p>
                    <p className="font-medium font-mono">{(caseData as any).molReceiptNo || "—"}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">聘僱函類別</p>
                    <p className="font-medium">{(caseData as any).employmentLetterCategory || "—"}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">申請書送件日</p>
                    <p className="font-medium">{(caseData as any).applicationSubmitDate || "—"}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">發文日期</p>
                    <p className="font-medium">{(caseData as any).issuanceDate || "—"}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">核准收件日</p>
                    <p className="font-medium">{(caseData as any).approvalReceiptDate || "—"}</p>
                  </div>
                </div>
              </div>
            )}

            {/* 體檢管理卡片 */}
            {((caseData as any).prevMedicalExamDate || (caseData as any).prevMedicalReportKey ||
              (caseData as any).entryMedicalExamDate || (caseData as any).entryMedicalReportKey ||
              (caseData as any).exam6mDate || (caseData as any).exam6mReportKey ||
              (caseData as any).exam18mDate || (caseData as any).exam18mReportKey ||
              (caseData as any).exam30mDate || (caseData as any).exam30mReportKey) && (
              <div className="rounded-lg border bg-card p-4 space-y-3 md:col-span-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                  體檢管理
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {/* 前次體檢 */}
                  {(caseData as any).prevMedicalExamDate && (
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">前次體檢日期</p>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{(caseData as any).prevMedicalExamDate}</p>
                        {(caseData as any).prevMedicalReportKey && (
                          <AttachmentLink label="報告" fileKey={(caseData as any).prevMedicalReportKey} />
                        )}
                      </div>
                    </div>
                  )}
                  {/* 入境 3 天體檢 */}
                  {(caseData as any).entryMedicalExamDate && (
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">入境 3 天體檢日期</p>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{(caseData as any).entryMedicalExamDate}</p>
                        {(caseData as any).entryMedicalReportKey && (
                          <AttachmentLink label="報告" fileKey={(caseData as any).entryMedicalReportKey} />
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {/* 6/18/30 個月體檢 */}
                {((caseData as any).exam6mDate || (caseData as any).exam18mDate || (caseData as any).exam30mDate) && (
                  <div className="grid grid-cols-3 gap-4 text-sm pt-2 border-t border-border/50">
                    {[{label: "6 個月體檢", dateKey: "exam6mDate", reportKey: "exam6mReportKey", milestone: 6 as const},
                      {label: "18 個月體檢", dateKey: "exam18mDate", reportKey: "exam18mReportKey", milestone: 18 as const},
                      {label: "30 個月體檢", dateKey: "exam30mDate", reportKey: "exam30mReportKey", milestone: 30 as const}]
                      .map(({ label, dateKey, reportKey, milestone }) => {
                        const alert = examAlertByMilestone.get(milestone);
                        return (
                        <div key={dateKey} className="space-y-0.5">
                          <p className="text-xs text-muted-foreground">{label}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium">{(caseData as any)[dateKey] || "—"}</p>
                            {(caseData as any)[reportKey] && (
                              <AttachmentLink label="報告" fileKey={(caseData as any)[reportKey]} />
                            )}
                            {alert && (
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium ${COMPLIANCE_BADGE[alert.status] ?? "status-gray"}`}>
                                {alert.status === "overdue"
                                  ? `逾期 ${Math.abs(alert.daysToDeadline)} 天`
                                  : alert.status === "due_now"
                                    ? "辦理中"
                                    : `${alert.daysToDeadline} 天後屆滿`}
                              </span>
                            )}
                          </div>
                        </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}

            {/* 保險管理卡片 */}
            {((caseData as any).healthInsurance || (caseData as any).healthInsurancePolicyKey ||
              (caseData as any).accidentInsurance || (caseData as any).accidentInsurancePolicyKey) && (
              <div className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-teal-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                  保險管理
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {/* 健保 */}
                  {((caseData as any).healthInsurance || (caseData as any).healthInsurancePolicyKey) && (
                    <div>
                      <p className="text-xs text-muted-foreground">健保投保</p>
                      <div className="flex items-center gap-2">
                        {(caseData as any).healthInsurance && (
                          <p className="font-medium">{(caseData as any).healthInsurance}</p>
                        )}
                        {(caseData as any).healthInsurancePolicyKey && (
                          <AttachmentLink label="保單" fileKey={(caseData as any).healthInsurancePolicyKey} />
                        )}
                      </div>
                    </div>
                  )}
                  {/* 意外險 */}
                  {((caseData as any).accidentInsurance || (caseData as any).accidentInsurancePolicyKey) && (
                    <div>
                      <p className="text-xs text-muted-foreground">意外險投保</p>
                      <div className="flex items-center gap-2">
                        {(caseData as any).accidentInsurance && (
                          <p className="font-medium">{(caseData as any).accidentInsurance}</p>
                        )}
                        {(caseData as any).accidentInsurancePolicyKey && (
                          <AttachmentLink label="保單" fileKey={(caseData as any).accidentInsurancePolicyKey} />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 案件備註 */}
            {caseData.notes && (
              <div className="rounded-lg border bg-card p-4 space-y-2 md:col-span-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <FileText className="w-4 h-4 text-primary" />案件備註
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{caseData.notes}</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="qualifications" className="mt-4">
          <CaseQualificationsTab caseId={caseId} />
        </TabsContent>

        <TabsContent value="matching" className="mt-4">
          <CaseMatchingTab caseId={caseId} />
        </TabsContent>

        <TabsContent value="employment" className="mt-4">
          <CaseEmploymentTab caseId={caseId} />
        </TabsContent>
      </Tabs>

      {/* 編輯 Modal */}
      {showEdit && (
        <CaseModal
          open={showEdit}
          onClose={() => setShowEdit(false)}
          editingCase={caseData}
        />
      )}
    </div>
  );
}
