/**
 * FormField — label + 控制項 + 間距 + 錯誤訊息
 * 統一節奏：space-y-1.5（label → 控制項）
 */
import { ReactNode } from "react";
import { Label } from "@/components/ui/label";

interface FormFieldProps {
  /** 欄位標籤文字 */
  label: ReactNode;
  /** 是否必填（顯示紅色星號） */
  required?: boolean;
  /** 錯誤訊息 */
  error?: string;
  /** 控制項（Input / Select / Textarea 等） */
  children: ReactNode;
  /** 額外 className（例如 col-span-full） */
  className?: string;
  /** htmlFor — 對應 input id */
  htmlFor?: string;
}

export function FormField({
  label,
  required,
  error,
  children,
  className,
  htmlFor,
}: FormFieldProps) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label
        htmlFor={htmlFor}
        className="text-sm font-medium text-foreground"
      >
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
