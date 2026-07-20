import {
  getStatusColor,
  getStatusLabel,
  type LabelDomain,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  /**
   * 顯示的欄位屬於哪個領域。有些代碼跨領域重複（例如 `employed` 在移工生命週期
   * 是「在職中」、在配對階段是「聘僱中」），指定領域才會拿到正確的標籤。
   */
  domain?: LabelDomain;
  className?: string;
}

export function StatusBadge({ status, domain, className }: StatusBadgeProps) {
  const color = getStatusColor(status);
  const label = getStatusLabel(status, domain);

  return (
    <span
      data-testid="status-badge"
      data-status={status}
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
        color === "green" && "status-green",
        color === "amber" && "status-amber",
        color === "red" && "status-red",
        // blue 原本漏掉了，導致「進行中」「待業中（在母國）」等狀態渲染成
        // 沒有任何背景色的裸標籤。CSS 的 .status-blue 一直都在，只是沒被套用。
        color === "blue" && "status-blue",
        color === "gray" && "status-gray",
        className
      )}
    >
      {label}
    </span>
  );
}
