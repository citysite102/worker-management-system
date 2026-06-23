/**
 * FormModal — 統一 Modal 框架
 * header 固定 / body 可捲動 / footer 固定
 * 寬度：max-w-2xl（表單型預設），可透過 className 覆寫
 */
import { ReactNode } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

interface FormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Modal 標題列左側 icon */
  icon?: ReactNode;
  /** Modal 標題文字 */
  title: ReactNode;
  /** Footer 內容（取消 + 送出按鈕） */
  footer: ReactNode;
  /** body 內容 */
  children: ReactNode;
  /** 覆寫 DialogContent 的 className（例如加寬：max-w-3xl） */
  className?: string;
}

export function FormModal({
  open,
  onOpenChange,
  icon,
  title,
  footer,
  children,
  className,
}: FormModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`max-w-2xl max-h-[85vh] flex flex-col overflow-hidden ${className ?? ""}`}
      >
        {/* ── Header（固定） */}
        <DialogHeader className="shrink-0 px-6 pt-5 pb-0">
          <DialogTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            {icon}
            {title}
          </DialogTitle>
        </DialogHeader>

        {/* ── Body（可捲動） */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-6">
          {children}
        </div>

        {/* ── Footer（固定） */}
        <DialogFooter className="shrink-0 px-6 pt-4 pb-5 border-t flex justify-end gap-2">
          {footer}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
