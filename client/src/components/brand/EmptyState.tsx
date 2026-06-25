/**
 * EmptyState 元件 — 帶吉祥物插畫的空狀態容器
 *
 * 用於：列表無資料、搜尋無結果、無權限、404 等場景
 *
 * Props:
 *   illustration  MascotPose  吉祥物姿態  預設 "thumbsup"
 *   title         string      主標題（必填）
 *   description   string      說明文字（選填）
 *   action        ReactNode   行動按鈕（選填）
 *   size          "sm" | "md" | "lg"  預設 "md"
 */

import React from "react";
import { Mascot, type MascotPose } from "./Mascot";

type EmptyStateSize = "sm" | "md" | "lg";

interface EmptyStateProps {
  illustration?: MascotPose;
  title: string;
  description?: string;
  action?: React.ReactNode;
  size?: EmptyStateSize;
  className?: string;
}

const SIZE_CONFIG = {
  sm: {
    mascotSize: "sm" as const,
    titleClass: "text-sm font-medium",
    descClass: "text-xs",
    padding: "py-8",
  },
  md: {
    mascotSize: "md" as const,
    titleClass: "text-base font-semibold",
    descClass: "text-sm",
    padding: "py-12",
  },
  lg: {
    mascotSize: "lg" as const,
    titleClass: "text-lg font-semibold",
    descClass: "text-base",
    padding: "py-16",
  },
};

export function EmptyState({
  illustration = "thumbsup",
  title,
  description,
  action,
  size = "md",
  className = "",
}: EmptyStateProps) {
  const config = SIZE_CONFIG[size];

  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${config.padding} ${className}`}
      role="status"
      aria-label={title}
    >
      <Mascot
        pose={illustration}
        size={config.mascotSize}
        className="mb-4 opacity-90"
      />
      <p className={`${config.titleClass} text-foreground mb-1`}>{title}</p>
      {description && (
        <p className={`${config.descClass} text-muted-foreground max-w-xs mb-4`}>
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export default EmptyState;
