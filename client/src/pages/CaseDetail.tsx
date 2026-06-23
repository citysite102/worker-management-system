import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Pencil, Building2, User, Phone, MapPin, Heart, FileText, AlertTriangle, Paperclip, ExternalLink } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { getStatusLabel } from "@/lib/constants";
import CaseModal from "@/components/CaseModal";
import CaseQualificationsTab from "@/components/case/CaseQualificationsTab";
import CaseMatchingTab from "@/components/case/CaseMatchingTab";
import CaseEmploymentTab from "@/components/case/CaseEmploymentTab";

export default function CaseDetail() {
  const params = useParams<{ id: string }>();
  const caseId = Number(params.id);
  const [, navigate] = useLocation();
  const [showEdit, setShowEdit] = useState(false);

  const { data: caseData, isLoading } = trpc.cases.getById.useQuery({ id: caseId });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
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
              <StatusBadge status={caseData.status} />
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
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowEdit(true)}>
          <Pencil className="w-3.5 h-3.5" />編輯案件
        </Button>
      </div>

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
                {(caseData as any).careReceiverName && (
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground w-20 shrink-0">被照顧者</span>
                    <span className="font-medium">{(caseData as any).careReceiverName}</span>
                  </div>
                )}
                {(caseData as any).careReceiverQualification && (
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground w-20 shrink-0">申請資格</span>
                    <Badge variant="secondary" className="text-xs">{(caseData as any).careReceiverQualification}</Badge>
                  </div>
                )}
              </div>
              {/* 招募許可函連結 */}
              {(caseData as any).recruitmentPermitFileKey && (
                <div className="pt-2 border-t border-border/50">
                  <a
                    href={`/manus-storage/${(caseData as any).recruitmentPermitFileKey}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                  >
                    <Paperclip className="w-3.5 h-3.5" />招募許可函
                  </a>
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
