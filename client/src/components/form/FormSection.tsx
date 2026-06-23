/**
 * FormSection — 卡片式區塊
 * 包含：圓角邊框卡片容器、區塊標題（icon + 文字）、內容 slot
 */
import { ReactNode } from "react";

interface FormSectionProps {
  /** 區塊標題左側小 icon（建議 w-3.5 h-3.5） */
  icon?: ReactNode;
  /** 區塊標題文字 */
  title: string;
  /** 卡片內容 */
  children: ReactNode;
  /** 是否預設摺疊（用於「終止/離職」等次要區塊） */
  defaultCollapsed?: boolean;
}

export function FormSection({ icon, title, children, defaultCollapsed }: FormSectionProps) {
  if (defaultCollapsed) {
    return (
      <details className="group rounded-lg border border-border bg-muted/30">
        <summary className="flex cursor-pointer select-none items-center gap-1.5 px-4 py-3 text-[13px] font-medium text-muted-foreground list-none">
          {icon}
          {title}
          <svg
            className="ml-auto w-3.5 h-3.5 transition-transform group-open:rotate-180"
            xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </summary>
        <div className="px-4 pb-4 pt-0 space-y-4">
          {children}
        </div>
      </details>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <p className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground mb-3">
        {icon}
        {title}
      </p>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}
