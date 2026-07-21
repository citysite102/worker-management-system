/**
 * Mascot 元件 — 吉祥物（扁平向量角色）
 *
 * 品牌色票：
 *   身體   #86C79E（soft green）
 *   表情線 #1F2937（slate）
 *   點綴   #1D4ED8（brand green，道具用）
 *
 * Pose 清單：
 *   "thumbsup"   比讚  — 空狀態（無資料、初始化）
 *   "wave"       揮手  — 登入、歡迎、onboarding
 *   "review"     文件審閱 — loading、處理中、等待
 *   "celebrate"  慶祝  — 成功、完成
 *   "confused"   疑惑  — 404、錯誤、無權限（缺漏姿態，已繪製）
 *   "search"     搜尋  — 搜尋無結果（缺漏姿態，已繪製）
 *
 * 設計規範：
 *   - 扁平向量、實心單色身體、無外框
 *   - 麵條手腳（細長圓角矩形）
 *   - 深灰點眼 + 簡單笑臉
 *   - 不帶任何國籍/膚色/服裝刻板特徵
 */

import React from "react";

// ── 品牌色常數 ──────────────────────────────────────────
const BODY = "#86C79E"; // 吉祥物身體（soft green）
const LINE = "#1F2937"; // 表情線（slate）
const ACCENT = "#1D4ED8"; // 點綴色（暖橘）
const TEAL = "#1D4ED8"; // brand blue（道具用）

// ── 尺寸對照 ────────────────────────────────────────────
type MascotPose =
  | "thumbsup"
  | "wave"
  | "review"
  | "celebrate"
  | "confused"
  | "search";

type MascotSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_MAP: Record<MascotSize, number> = {
  xs: 40,
  sm: 64,
  md: 96,
  lg: 128,
  xl: 192,
};

const POSE_LABELS: Record<MascotPose, string> = {
  thumbsup: "吉祥物比讚",
  wave: "吉祥物揮手",
  review: "吉祥物審閱文件",
  celebrate: "吉祥物慶祝",
  confused: "吉祥物疑惑",
  search: "吉祥物搜尋",
};

// ── 共用：頭部 + 臉部表情 ─────────────────────────────────
function Head({
  cx = 60,
  cy = 28,
  r = 20,
  expression = "smile",
}: {
  cx?: number;
  cy?: number;
  r?: number;
  expression?: "smile" | "open" | "surprised" | "worried";
}) {
  const eyeY = cy - 4;
  const mouthY = cy + 7;

  return (
    <g>
      {/* 頭部圓形 */}
      <circle cx={cx} cy={cy} r={r} fill={BODY} />
      {/* 左眼 */}
      <circle cx={cx - 7} cy={eyeY} r={2.5} fill={LINE} />
      {/* 右眼 */}
      <circle cx={cx + 7} cy={eyeY} r={2.5} fill={LINE} />
      {/* 表情 */}
      {expression === "smile" && (
        <path
          d={`M${cx - 7} ${mouthY} Q${cx} ${mouthY + 6} ${cx + 7} ${mouthY}`}
          stroke={LINE}
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
      )}
      {expression === "open" && (
        <ellipse cx={cx} cy={mouthY + 2} rx={6} ry={4} fill={LINE} />
      )}
      {expression === "surprised" && (
        <>
          {/* 驚訝：眼睛稍大 + 嘴巴O形 */}
          <circle cx={cx - 7} cy={eyeY} r={3.5} fill={LINE} />
          <circle cx={cx + 7} cy={eyeY} r={3.5} fill={LINE} />
          <ellipse cx={cx} cy={mouthY + 2} rx={5} ry={5} fill={LINE} />
        </>
      )}
      {expression === "worried" && (
        <path
          d={`M${cx - 7} ${mouthY + 4} Q${cx} ${mouthY - 2} ${cx + 7} ${mouthY + 4}`}
          stroke={LINE}
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
      )}
    </g>
  );
}

// ── 共用：身體 ───────────────────────────────────────────
function Body({
  x = 40,
  y = 48,
  width = 40,
  height = 36,
}: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}) {
  return <rect x={x} y={y} width={width} height={height} rx={12} fill={BODY} />;
}

// ── 共用：麵條腳 ─────────────────────────────────────────
function Legs({
  bodyBottom = 84,
  cx = 60,
}: {
  bodyBottom?: number;
  cx?: number;
}) {
  return (
    <g>
      {/* 左腳 */}
      <rect
        x={cx - 14}
        y={bodyBottom}
        width={8}
        height={20}
        rx={4}
        fill={BODY}
      />
      {/* 右腳 */}
      <rect
        x={cx + 6}
        y={bodyBottom}
        width={8}
        height={20}
        rx={4}
        fill={BODY}
      />
    </g>
  );
}

// ── 姿態：比讚 ───────────────────────────────────────────
function ThumbsUp() {
  return (
    <g>
      <Head cx={60} cy={28} expression="smile" />
      <Body x={40} y={48} width={40} height={36} />
      <Legs bodyBottom={84} cx={60} />
      {/* 左手（麵條臂）向下 */}
      <rect x={28} y={52} width={12} height={8} rx={4} fill={BODY} />
      {/* 右手（麵條臂）舉起 */}
      <rect x={80} y={38} width={8} height={22} rx={4} fill={BODY} />
      {/* 大拇指（暖橘色道具） */}
      <g transform="translate(82, 28)">
        {/* 拇指主體 */}
        <rect x={0} y={0} width={10} height={14} rx={5} fill={ACCENT} />
        {/* 拇指底座 */}
        <rect x={-3} y={10} width={16} height={8} rx={3} fill={ACCENT} />
      </g>
    </g>
  );
}

// ── 姿態：揮手 ───────────────────────────────────────────
function Wave() {
  return (
    <g>
      <Head cx={60} cy={28} expression="open" />
      <Body x={40} y={48} width={40} height={36} />
      <Legs bodyBottom={84} cx={60} />
      {/* 左手（麵條臂）向下 */}
      <rect x={28} y={52} width={12} height={8} rx={4} fill={BODY} />
      {/* 右手（麵條臂）高舉揮動 */}
      <rect
        x={80}
        y={30}
        width={8}
        height={26}
        rx={4}
        fill={BODY}
        transform="rotate(-30 84 43)"
      />
      {/* 手掌（五指張開，簡化為扇形） */}
      <ellipse
        cx={96}
        cy={22}
        rx={9}
        ry={7}
        fill={BODY}
        transform="rotate(-20 96 22)"
      />
      {/* 手指線條 */}
      {[0, 1, 2, 3, 4].map(i => (
        <line
          key={i}
          x1={88 + i * 4}
          y1={20}
          x2={86 + i * 4}
          y2={12}
          stroke={LINE}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      ))}
    </g>
  );
}

// ── 姿態：文件審閱 ──────────────────────────────────────
function Review() {
  return (
    <g>
      <Head cx={60} cy={26} expression="smile" />
      <Body x={38} y={46} width={44} height={36} />
      <Legs bodyBottom={82} cx={60} />
      {/* 雙手托著文件 */}
      {/* 左臂 */}
      <rect x={22} y={56} width={18} height={8} rx={4} fill={BODY} />
      {/* 右臂 */}
      <rect x={80} y={56} width={18} height={8} rx={4} fill={BODY} />
      {/* 文件主體（白色） */}
      <rect x={28} y={46} width={44} height={32} rx={4} fill="#FFFFFF" />
      {/* 文件邊框 */}
      <rect
        x={28}
        y={46}
        width={44}
        height={32}
        rx={4}
        fill="none"
        stroke={TEAL}
        strokeWidth="1.5"
      />
      {/* 文件標題線 */}
      <rect x={34} y={53} width={32} height={3} rx={1.5} fill={TEAL} />
      {/* 文件內容線 */}
      <rect
        x={34}
        y={60}
        width={24}
        height={2}
        rx={1}
        fill={LINE}
        opacity="0.3"
      />
      <rect
        x={34}
        y={65}
        width={28}
        height={2}
        rx={1}
        fill={LINE}
        opacity="0.3"
      />
      <rect
        x={34}
        y={70}
        width={20}
        height={2}
        rx={1}
        fill={LINE}
        opacity="0.3"
      />
    </g>
  );
}

// ── 姿態：慶祝 ──────────────────────────────────────────
function Celebrate() {
  return (
    <g>
      <Head cx={60} cy={26} expression="open" />
      <Body x={40} y={46} width={40} height={34} />
      <Legs bodyBottom={80} cx={60} />
      {/* 左手高舉 */}
      <rect
        x={24}
        y={30}
        width={8}
        height={24}
        rx={4}
        fill={BODY}
        transform="rotate(20 28 42)"
      />
      {/* 右手高舉 */}
      <rect
        x={88}
        y={30}
        width={8}
        height={24}
        rx={4}
        fill={BODY}
        transform="rotate(-20 92 42)"
      />
      {/* 彩帶/星星（暖橘點綴） */}
      <circle cx={18} cy={18} r={4} fill={ACCENT} />
      <circle cx={102} cy={16} r={3} fill={ACCENT} />
      <circle cx={28} cy={8} r={2.5} fill={TEAL} />
      <circle cx={92} cy={10} r={2.5} fill={TEAL} />
      {/* 星形 */}
      <polygon
        points="60,4 62,10 68,10 63,14 65,20 60,16 55,20 57,14 52,10 58,10"
        fill={ACCENT}
        opacity="0.9"
      />
    </g>
  );
}

// ── 姿態：疑惑（缺漏姿態，用於 404/錯誤/無權限） ───────
function Confused() {
  return (
    <g>
      <Head cx={60} cy={28} expression="worried" />
      <Body x={40} y={48} width={40} height={36} />
      <Legs bodyBottom={84} cx={60} />
      {/* 左手（麵條臂）向下 */}
      <rect x={28} y={52} width={12} height={8} rx={4} fill={BODY} />
      {/* 右手（麵條臂）摸頭 */}
      <rect
        x={80}
        y={36}
        width={8}
        height={20}
        rx={4}
        fill={BODY}
        transform="rotate(-15 84 46)"
      />
      {/* 問號 */}
      <text
        x={90}
        y={20}
        fontSize="18"
        fontWeight="bold"
        fill={ACCENT}
        fontFamily="sans-serif"
      >
        ?
      </text>
      {/* 頭上的汗水 */}
      <ellipse cx={76} cy={18} rx={3} ry={5} fill={TEAL} opacity="0.7" />
    </g>
  );
}

// ── 姿態：搜尋（缺漏姿態，用於搜尋無結果） ────────────
function Search() {
  return (
    <g>
      <Head cx={60} cy={28} expression="smile" />
      <Body x={40} y={48} width={40} height={36} />
      <Legs bodyBottom={84} cx={60} />
      {/* 左手（麵條臂）向下 */}
      <rect x={28} y={52} width={12} height={8} rx={4} fill={BODY} />
      {/* 右手（麵條臂）舉起放大鏡 */}
      <rect x={80} y={42} width={8} height={20} rx={4} fill={BODY} />
      {/* 放大鏡（暖橘色） */}
      <circle
        cx={96}
        cy={34}
        r={10}
        fill="none"
        stroke={ACCENT}
        strokeWidth="3.5"
      />
      <line
        x1={103}
        y1={41}
        x2={110}
        y2={48}
        stroke={ACCENT}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </g>
  );
}

// ── 主元件 ───────────────────────────────────────────────
interface MascotProps {
  pose?: MascotPose;
  size?: MascotSize;
  className?: string;
}

export function Mascot({
  pose = "wave",
  size = "md",
  className = "",
}: MascotProps) {
  const px = SIZE_MAP[size];
  const label = POSE_LABELS[pose];

  const PoseComponent = {
    thumbsup: ThumbsUp,
    wave: Wave,
    review: Review,
    celebrate: Celebrate,
    confused: Confused,
    search: Search,
  }[pose];

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 120 110"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={label}
      className={className}
    >
      <title>{label}</title>
      <PoseComponent />
    </svg>
  );
}

export type { MascotPose, MascotSize };
export default Mascot;
