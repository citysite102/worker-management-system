// ─── 公開媒合平台共用 UI 元件（Design System）──────────────────────────────────
// 把散落在各頁的「卡片 / 頁首 / 狀態徽章 / 職缺卡 / meta 列 / 篩選鈕」收斂成一組
// 取用 token 的共用元件，確保介面一致。所有顏色一律走 index.css 的 token 與
// .status-* class，禁止硬編色碼（見 docs/design-system.md）。
import { useState, type ComponentType, type ReactNode } from "react";
import { ImageIcon, type LucideProps } from "lucide-react";
import { useTranslation } from "react-i18next";

/** 品牌感圖片 fallback 底（照片就緒；放圖後由 Figure 顯示真圖）。 */
const FIGURE_FALLBACK_BG: React.CSSProperties = {
  backgroundImage:
    "radial-gradient(600px 300px at 20% 0%, rgba(255,255,255,0.18), transparent 60%)," +
    "linear-gradient(135deg, var(--color-primary) 0%, var(--color-brand-dark) 100%)",
};

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
      className={`rounded-lg border border-border bg-card p-5 shadow-xs ${
        interactive
          ? "transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-primary hover:shadow-sm"
          : ""
      } ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

/** 行銷大標的襯線字（Fraunces）只給拉丁語系；中文維持粗黑（設計系統 §3）。 */
export function useDisplay(): string {
  const { i18n } = useTranslation();
  return i18n.language.startsWith("zh") ? "" : "font-display";
}

/** 區塊節奏容器（A8）：一致的縱向留白 + 可選頂部 hairline 分隔，讓各段落有呼吸感。 */
export function Section({
  children,
  divider = false,
  className = "",
  ...rest
}: {
  children: ReactNode;
  divider?: boolean;
  className?: string;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={`py-16 sm:py-20 ${divider ? "border-t border-border" : ""} ${className}`}
      {...rest}
    >
      {children}
    </section>
  );
}

/** 公開頁行銷式頁首（A9）：eyebrow + 襯線大標(拉丁) + 副標，取代後台風 PageHeader。 */
export function PageHero({
  eyebrow,
  title,
  subtitle,
  className = "",
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  className?: string;
}) {
  const display = useDisplay();
  return (
    <div className={`mb-8 border-b border-border pb-8 ${className}`}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h1
        className={`mt-2 text-3xl font-bold tracking-tight text-balance sm:text-4xl ${display}`}
      >
        {title}
      </h1>
      {subtitle && (
        <p className="mt-3 max-w-2xl text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
}

/**
 * 圖片框（照片就緒，B4）：有 src 就顯示真圖（object-cover、lazy、404 自動退回），
 * 沒有就顯示品牌漸層底 —— 空的時候也像刻意色塊，不是破圖。放圖只要傳入 src。
 * 真人照片務必已去識別／取得肖像同意／授權（見 docs/design-system.md）。
 */
export function Figure({
  src,
  alt,
  aspect = "4 / 3",
  className = "",
}: {
  src?: string | null;
  alt: string;
  aspect?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImg = src && !failed;
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-border ${className}`}
      style={{ aspectRatio: aspect }}
    >
      {showImg ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          role="img"
          aria-label={alt}
          className="flex h-full w-full items-center justify-center"
          style={FIGURE_FALLBACK_BG}
        >
          <ImageIcon className="h-8 w-8 text-white/50" aria-hidden />
        </div>
      )}
    </div>
  );
}

/** 區塊小標（eyebrow）：品牌藍、小字；uppercase/tracking 只對拉丁語系有意義。 */
export function Eyebrow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const { i18n } = useTranslation();
  const latin = !i18n.language.startsWith("zh");
  return (
    <span
      className={`text-xs font-semibold text-primary ${
        latin ? "uppercase tracking-wide" : ""
      } ${className}`}
    >
      {children}
    </span>
  );
}

/** 載入骨架卡（對應 WorkerCard/JobCard 的版型）：比一顆「…」更有質感。 */
export function SkeletonCard() {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-xs">
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-3 w-full animate-pulse rounded bg-muted" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
      </div>
      <div className="mt-4 flex gap-1.5">
        <div className="h-5 w-14 animate-pulse rounded-full bg-muted" />
        <div className="h-5 w-14 animate-pulse rounded-full bg-muted" />
      </div>
    </div>
  );
}

/** 一格骨架網格（多欄列表載入用）。 */
export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      data-testid="skeleton-grid"
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/**
 * 空狀態：icon + 訊息（+ 可選動作）。取代各頁一行灰字，讀起來更明確、更一致，
 * 並可引導下一步（action）。data-testid 等 props 透傳，維持既有測試選取。
 */
export function EmptyState({
  icon: Icon,
  children,
  action,
  className = "",
  ...rest
}: {
  icon?: ComponentType<LucideProps>;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex flex-col items-center py-16 text-center ${className}`}
      {...rest}
    >
      {Icon && (
        <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="h-5 w-5" />
        </span>
      )}
      <p className="max-w-sm text-sm text-muted-foreground">{children}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** 單欄清單載入骨架（我的意向／雇主需求單等單欄頁）；取代臨時的「…」佔位。 */
export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3" data-testid="skeleton-list">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
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

/** 表單輸入框共用樣式（input/select/textarea 一致的邊框、內距、focus 藍環）。 */
export const inputCls =
  "w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-accent";

/** 表單欄位：label 在上、控制項在下（各表單頁一致的欄位節奏）。 */
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
    </label>
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
