/**
 * FormGrid — 響應式欄位網格
 * 窄螢幕自動降為單欄，不破版
 * cols: 最大欄數（1 / 2 / 3），預設 2
 */
import { ReactNode } from "react";

const colsMap: Record<1 | 2 | 3, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
};

interface FormGridProps {
  cols?: 1 | 2 | 3;
  children: ReactNode;
  /** 額外 className（例如 col-span-full 的父層） */
  className?: string;
}

export function FormGrid({ cols = 2, children, className }: FormGridProps) {
  return (
    <div className={`grid ${colsMap[cols]} gap-x-4 gap-y-4 ${className ?? ""}`}>
      {children}
    </div>
  );
}
