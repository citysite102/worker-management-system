import { useState } from "react";
import { toast } from "sonner";
import { Link2, Link2Off, Search, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  PageHeader,
  SurfaceCard,
  StatusPill,
  MetaRow,
} from "@/components/marketplace/ui";

const JOB_TYPE_LABEL: Record<string, string> = {
  caregiver: "看護",
  domestic_helper: "幫傭",
  manufacturing: "製造業",
  agriculture: "農業",
  construction: "營造業",
  white_collar: "白領",
  intermediate: "中階技術",
  overseas_student: "僑外生",
};

/** 內部後台：帳號勾稽（自助移工帳號 ↔ 既有名冊）。 */
export default function Reconcile() {
  const utils = trpc.useUtils();
  const q = trpc.reconcile.profiles.useQuery();
  const refresh = () => utils.reconcile.profiles.invalidate();

  const unlinkMut = trpc.reconcile.unlink.useMutation({
    onSuccess: () => {
      toast.success("已解除連結");
      void refresh();
    },
    onError: e => toast.error(e.message),
  });

  const rows = q.data ?? [];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="帳號勾稽"
        subtitle="把自助移工帳號的公開履歷連到既有名冊，連結後找移工才會帶出平台可信工作紀錄。"
      />

      {q.isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          載入中…
        </div>
      ) : rows.length === 0 ? (
        <div
          className="py-16 text-center text-sm text-muted-foreground"
          data-testid="reconcile-empty"
        >
          目前沒有自助移工履歷
        </div>
      ) : (
        <div className="space-y-3" data-testid="reconcile-list">
          {rows.map(p => (
            <SurfaceCard key={p.id} data-testid="reconcile-row">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">
                      {p.alias || `移工 #${p.id}`}
                    </h3>
                    {p.jobType && (
                      <span className="text-xs text-muted-foreground">
                        {JOB_TYPE_LABEL[p.jobType] ?? p.jobType}
                      </span>
                    )}
                    {p.workerId ? (
                      <StatusPill tone="green">已勾稽</StatusPill>
                    ) : (
                      <StatusPill tone="gray">未勾稽</StatusPill>
                    )}
                  </div>
                  <MetaRow>
                    <span className="text-sm text-muted-foreground">
                      國籍：{p.nationality || "—"}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      帳號：{p.accountName || p.accountEmail || "—"}
                    </span>
                  </MetaRow>
                  {p.workerId && (
                    <p className="mt-2 flex items-center gap-1.5 text-sm">
                      <ShieldCheck className="w-4 h-4 text-primary" />
                      已連結名冊：
                      <span className="font-medium">{p.linkedWorkerName}</span>
                      （{p.recordCount} 筆平台紀錄）
                    </p>
                  )}
                </div>
                <div className="shrink-0">
                  {p.workerId ? (
                    <button
                      type="button"
                      onClick={() => unlinkMut.mutate({ profileId: p.id })}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
                      data-testid={`reconcile-unlink-${p.id}`}
                    >
                      <Link2Off className="w-3.5 h-3.5" />
                      解除
                    </button>
                  ) : null}
                </div>
              </div>
              {!p.workerId && (
                <LinkSearch profileId={p.id} onLinked={() => void refresh()} />
              )}
            </SurfaceCard>
          ))}
        </div>
      )}
    </div>
  );
}

function LinkSearch({
  profileId,
  onLinked,
}: {
  profileId: number;
  onLinked: () => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState("");
  const results = trpc.reconcile.searchWorkers.useQuery(
    { query: active },
    { enabled: active.length > 0 }
  );
  const linkMut = trpc.reconcile.link.useMutation({
    onSuccess: () => {
      toast.success("已勾稽");
      onLinked();
    },
    onError: e => toast.error(e.message),
  });

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex items-center gap-2">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") setActive(query.trim());
          }}
          placeholder="搜尋名冊：姓名 / 居留證 / 護照號"
          className="h-9 flex-1 rounded-md border border-border bg-card px-3 text-sm"
          data-testid={`reconcile-search-input-${profileId}`}
        />
        <button
          type="button"
          onClick={() => setActive(query.trim())}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
          data-testid={`reconcile-search-btn-${profileId}`}
        >
          <Search className="w-3.5 h-3.5" />
          搜尋
        </button>
      </div>

      {active && (
        <div
          className="mt-2 space-y-1"
          data-testid={`reconcile-results-${profileId}`}
        >
          {results.isLoading ? (
            <p className="text-sm text-muted-foreground">搜尋中…</p>
          ) : (results.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">查無符合的移工</p>
          ) : (
            (results.data ?? []).map(w => (
              <div
                key={w.id}
                className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2"
              >
                <span className="text-sm">
                  {w.nameCn || w.nameEn || w.name}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {w.nationality || ""}{" "}
                    {w.residentPermitNo || w.passportNo || ""}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={linkMut.isPending}
                  onClick={() => linkMut.mutate({ profileId, workerId: w.id })}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  data-testid={`reconcile-link-${profileId}-${w.id}`}
                >
                  <Link2 className="w-3.5 h-3.5" />
                  連結
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
