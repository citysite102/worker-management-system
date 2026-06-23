import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Pencil } from "lucide-react";
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
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{caseData.name}</h1>
              <StatusBadge status={caseData.status} />
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              <span>客戶：{caseData.customerName}</span>
              <span>·</span>
              <span>負責人：{caseData.managerName}</span>
              {caseData.notes && (
                <>
                  <span>·</span>
                  <span className="max-w-xs truncate">{caseData.notes}</span>
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

      {/* 三 Tab */}
      <Tabs defaultValue="qualifications">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="qualifications">資格管理</TabsTrigger>
          <TabsTrigger value="matching">媒合管理</TabsTrigger>
          <TabsTrigger value="employment">聘僱管理</TabsTrigger>
        </TabsList>

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
