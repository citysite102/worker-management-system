/**
 * LoadingStates — 全站統一 Loading 元件
 *
 * PageSkeleton    → 詳情頁（標題 + 副標題 + 卡片群）
 * TableRowSkeleton → 列表頁表格 tbody（n 列 × m 欄 Skeleton rows）
 * InlineLoader    → 小區塊（spinner + 文字，用於 Settings 等）
 */
import { Skeleton } from "@/components/ui/skeleton";

/* ─────────────────────────────────────────
   PageSkeleton
   用途：詳情頁整頁 Loading（WorkerDetail / CustomerDetail / CaseDetail）
   ───────────────────────────────────────── */
interface PageSkeletonProps {
  /** 頂部 breadcrumb/back 按鈕高度佔位（預設 true） */
  showBreadcrumb?: boolean;
  /** 卡片列數（預設 2）*/
  cardRows?: number;
}

export function PageSkeleton({ showBreadcrumb = true, cardRows = 2 }: PageSkeletonProps) {
  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto animate-in fade-in duration-300">
      {/* Breadcrumb / back */}
      {showBreadcrumb && <Skeleton className="h-4 w-32" />}

      {/* 頁面標題區 */}
      <div className="flex items-start gap-4">
        <Skeleton className="h-10 w-10 rounded-full shrink-0" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-80" />
        </div>
      </div>

      {/* Tab 列（模擬 Tab 切換列）*/}
      <div className="flex gap-2 border-b pb-0">
        <Skeleton className="h-9 w-24 rounded-t-md" />
        <Skeleton className="h-9 w-24 rounded-t-md" />
        <Skeleton className="h-9 w-24 rounded-t-md" />
      </div>

      {/* 卡片群 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: cardRows * 2 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border p-4 space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   TableRowSkeleton
   用途：列表頁表格 tbody（Workers / Customers / Cases）
   ───────────────────────────────────────── */
interface TableRowSkeletonProps {
  /** 欄數 */
  cols: number;
  /** 列數（預設 6）*/
  rows?: number;
}

export function TableRowSkeleton({ cols, rows = 6 }: TableRowSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-border animate-in fade-in duration-300" style={{ animationDelay: `${i * 40}ms` }}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-4 py-3.5">
              <Skeleton
                className={`h-4 ${j === 0 ? "w-24" : j === cols - 1 ? "w-12" : "w-full"}`}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/* ─────────────────────────────────────────
   InlineLoader
   用途：小區塊 Loading（Settings 等）——使用 Skeleton 與全站一致
   ───────────────────────────────────────── */
interface InlineLoaderProps {
  /** 要顯示的行數（預設 3）*/
  rows?: number;
  className?: string;
}

export function InlineLoader({ rows = 3, className = "" }: InlineLoaderProps) {
  return (
    <div className={`px-4 py-4 space-y-3 animate-in fade-in duration-300 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2">
          <Skeleton className="h-7 w-7 rounded-full shrink-0" />
          <Skeleton className={`h-4 ${i % 2 === 0 ? "w-32" : "w-24"}`} />
        </div>
      ))}
    </div>
  );
}
