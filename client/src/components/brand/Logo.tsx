/**
 * Logo 元件 — 燕子剪影（極簡幾何）
 *
 * 品牌色票（Clean SaaS，見 docs/design-system.md）：
 *   主色  #16A34A（brand green）
 *   墨色  #1F2937（slate）
 *
 * Props:
 *   variant  "color" | "white" | "dark"   預設 "color"
 *   size     "xs" | "sm" | "md" | "lg" | "xl"  預設 "md"
 *   showText  boolean  是否顯示文字「移工管理後台」  預設 false
 */

import React from "react";

const BRAND_GREEN = "#16A34A";
const BRAND_DARK = "#1F2937";

type LogoVariant = "color" | "white" | "dark";
type LogoSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_MAP: Record<LogoSize, number> = {
  xs: 20,
  sm: 28,
  md: 36,
  lg: 48,
  xl: 64,
};

interface LogoProps {
  variant?: LogoVariant;
  size?: LogoSize;
  showText?: boolean;
  className?: string;
}

/**
 * 燕子剪影 SVG（極簡幾何）
 * 設計邏輯：
 *   - 主體由兩片翅膀（三角形）+ 尾叉（V 形）構成
 *   - 翅膀展開，尾部分叉，呼應候鳥遷徙意象
 *   - 可縮至 20px 仍清晰可辨
 */
function SwallowIcon({ color, size }: { color: string; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="移工管理後台 Logo — 燕子"
    >
      <title>移工管理後台 Logo — 燕子</title>
      {/* 左翅膀：從身體中心向左延伸的三角形 */}
      <path d="M24 22 L2 10 L14 24 Z" fill={color} opacity="0.95" />
      {/* 右翅膀：從身體中心向右延伸的三角形 */}
      <path d="M24 22 L46 10 L34 24 Z" fill={color} opacity="0.95" />
      {/* 身體：橢圓形核心 */}
      <ellipse cx="24" cy="23" rx="6" ry="4" fill={color} />
      {/* 尾叉左：向左下延伸 */}
      <path d="M20 26 L10 40 L22 30 Z" fill={color} opacity="0.85" />
      {/* 尾叉右：向右下延伸 */}
      <path d="M28 26 L38 40 L26 30 Z" fill={color} opacity="0.85" />
    </svg>
  );
}

export function Logo({
  variant = "color",
  size = "md",
  showText = false,
  className = "",
}: LogoProps) {
  const px = SIZE_MAP[size];

  const iconColor =
    variant === "color"
      ? BRAND_GREEN
      : variant === "white"
        ? "#FFFFFF"
        : BRAND_DARK;

  const textColor =
    variant === "color"
      ? BRAND_DARK
      : variant === "white"
        ? "#FFFFFF"
        : BRAND_DARK;

  const textSizeClass =
    size === "xs"
      ? "text-xs"
      : size === "sm"
        ? "text-sm"
        : size === "md"
          ? "text-base"
          : size === "lg"
            ? "text-lg"
            : "text-xl";

  return (
    <div className={`flex items-center gap-2 ${className}`} role="banner">
      <SwallowIcon color={iconColor} size={px} />
      {showText && (
        <span
          className={`font-semibold tracking-tight ${textSizeClass}`}
          style={{ color: textColor }}
        >
          移工管理後台
        </span>
      )}
    </div>
  );
}

export default Logo;
