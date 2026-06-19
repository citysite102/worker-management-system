import { getStatusColor, getStatusLabel } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const color = getStatusColor(status);
  const label = getStatusLabel(status);

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
        color === "green" && "status-green",
        color === "amber" && "status-amber",
        color === "red" && "status-red",
        color === "gray" && "status-gray",
        className
      )}
    >
      {label}
    </span>
  );
}
