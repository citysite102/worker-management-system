// ─── 公開媒合平台共用 UI 元件（Design System）──────────────────────────────────
// 把散落在各頁的「卡片 / 頁首 / 狀態徽章 / 職缺卡 / meta 列 / 篩選鈕」收斂成一組
// 取用 token 的共用元件，確保介面一致。所有顏色一律走 index.css 的 token 與
// .status-* class，禁止硬編色碼（見 docs/design-system.md）。
import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";

// ── 語義狀態色調 ──────────────────────────────────────────────────────────────
export type Tone = "green" | "amber" | "red" | "gray";
const TONE_CLASS: Record<Tone, string> = {
  green: "status-green",
  amber: "status-amber",
  red: "status-red",
  gray: "status-gray",
};

/** 需求單狀態 → 語義色調。 */
export function postingStatusTone(status: string): Tone {
  switch (status) {
    case "approved":
    case "filled":
      return "green";
    case "pending_review":
      return "amber";
    case "rejected":
      return "red";
    default:
      return "gray"; // draft / paused / closed
  }
}

/** 媒合意向狀態 → 語義色調。 */
export function matchStatusTone(status: string): Tone {
  switch (status) {
    case "matched":
      return "green";
    case "staff_handling":
    case "introduced":
      return "amber";
    default:
      return "gray"; // new / closed
  }
}

/** 狀態藥丸（統一 pill 樣式 + .status-* 語義色）。 */
export function StatusPill({
  tone,
  children,
  className = "",
  ...rest
}: {
  tone: Tone;
  children: ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASS[tone]} ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}

/** 職類分類籤（藍淡底重點色）。 */
export function CategoryChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
      {children}
    </span>
  );
}

/** 頁首：標題 + 副標 + 右側動作區（各頁一致的標題節奏）。 */
export function PageHeader({
  title,
  subtitle,
  action,
  className = "",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-6 flex items-start justify-between gap-4 ${className}`}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** 標準表面卡片（白底、淺灰邊、10px 圓角）；interactive 時 hover 邊框轉藍。 */
export function SurfaceCard({
  children,
  interactive = false,
  className = "",
  ...rest
}: {
  children: ReactNode;
  interactive?: boolean;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-lg border border-border bg-card p-5 ${
        interactive ? "hover:border-primary transition-colors" : ""
      } ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

/** icon + 文字的 meta 列（地點/人數/聯絡…），統一次要文字色與間距。 */
export function MetaItem({
  icon: Icon,
  children,
}: {
  icon: ComponentType<LucideProps>;
  children: ReactNode;
}) {
  return (
    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Icon className="w-4 h-4 shrink-0" />
      {children}
    </span>
  );
}

/** 一排 meta 列的容器（自動換行、一致間距）。 */
export function MetaRow({
  children,
  className = "mt-2",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap gap-x-4 gap-y-1 ${className}`}>
      {children}
    </div>
  );
}

/** 篩選膠囊鈕（找工作/媒合意向的分類篩選共用）。 */
export function FilterChip({
  active,
  children,
  className = "",
  ...rest
}: {
  active: boolean;
  children: ReactNode;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "border-primary bg-accent text-accent-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-muted"
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
