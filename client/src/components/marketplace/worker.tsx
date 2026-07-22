// ─── 找外籍工作者：卡片 / 匿名頭像 / 分類 icon / 評分（Design System）──────────
// 視覺層次靠「分類 icon + 匿名頭像 + 評分 + 標籤」堆疊，顏色一律走 token
// （accent 藍淡底 / muted 中性 / status-amber 評分星），不硬編色碼。
import type { ComponentType } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import {
  HeartPulse,
  House,
  Factory,
  Sprout,
  HardHat,
  Briefcase,
  Wrench,
  GraduationCap,
  Globe,
  CalendarClock,
  Star,
  User,
  type LucideProps,
} from "lucide-react";
import { SurfaceCard, MetaItem, MetaRow } from "./ui";

/** 職類 → 專屬 icon（各職類有自己的圖示，做視覺區隔）。 */
const CATEGORY_ICON: Record<string, ComponentType<LucideProps>> = {
  caregiver: HeartPulse,
  domestic_helper: House,
  manufacturing: Factory,
  agriculture: Sprout,
  construction: HardHat,
  white_collar: Briefcase,
  intermediate: Wrench,
  overseas_student: GraduationCap,
};

export function categoryIcon(
  jobType: string | null
): ComponentType<LucideProps> {
  return (jobType && CATEGORY_ICON[jobType]) || User;
}

/** 職類分類籤（icon + 文字，藍淡底重點色）。 */
export function CategoryTag({
  jobType,
  label,
}: {
  jobType: string | null;
  label: string;
}) {
  const Icon = categoryIcon(jobType);
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

/**
 * 匿名頭像：以職類 icon 呈現於藍淡底圓形（維持去識別，不露真實人臉）。
 * locked 時模糊，示意「真實照片登入後才顯示」。
 */
export function AnonAvatar({
  jobType,
  size = "md",
  locked = false,
}: {
  jobType: string | null;
  size?: "md" | "lg";
  locked?: boolean;
}) {
  const Icon = locked ? User : categoryIcon(jobType);
  const box = size === "lg" ? "h-20 w-20" : "h-12 w-12";
  const glyph = size === "lg" ? "h-9 w-9" : "h-6 w-6";
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground ${box}`}
    >
      <Icon
        className={`${glyph} ${locked ? "opacity-40 blur-[3px]" : ""}`}
        aria-hidden
      />
    </span>
  );
}

/** 評分星等 + 則數（是否顯示由呼叫端依門檻決定；此元件只負責畫）。 */
export function RatingStars({
  avg,
  count,
  showCount = true,
}: {
  avg: number;
  count: number;
  showCount?: boolean;
}) {
  const { t } = useTranslation();
  const full = Math.round(avg);
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
      <span className="inline-flex" aria-hidden>
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`h-3.5 w-3.5 ${
              i < full
                ? "fill-current text-[var(--color-status-amber)]"
                : "text-border"
            }`}
          />
        ))}
      </span>
      <span>{avg.toFixed(1)}</span>
      {showCount && (
        <span className="text-muted-foreground">
          （{t("findWorkers.ratingCount", { count })}）
        </span>
      )}
    </span>
  );
}

export type WorkerCardData = {
  id: number;
  alias: string;
  headline: string | null;
  nationality: string | null;
  ageRange: string | null;
  jobType: string | null;
  jobTypes: string[];
  category: string | null;
  skills: string[];
  availability: string | null;
  rating: { avg: number; count: number } | null;
};

/** 找外籍工作者列表卡片：頭像 + 分類 icon + 評分 + 分類標籤。 */
export function WorkerCard({
  p,
  index = 0,
}: {
  p: WorkerCardData;
  index?: number;
}) {
  const { t } = useTranslation();
  return (
    <Link
      href={`/find-workers/${p.id}`}
      className="block animate-in fade-in slide-in-from-bottom-2 fill-mode-both"
      style={{ animationDelay: `${Math.min(index, 11) * 45}ms` }}
      data-testid="worker-card"
    >
      <SurfaceCard interactive className="h-full">
        <div className="flex items-start gap-3">
          <AnonAvatar jobType={p.jobType} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="truncate font-semibold">{p.alias}</h3>
              {p.ageRange && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {t("findWorkers.ageRange")} {p.ageRange}
                </span>
              )}
            </div>
            {p.jobTypes.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {p.jobTypes.map(jt => (
                  <CategoryTag
                    key={jt}
                    jobType={jt}
                    label={t(`jobs.jobType.${jt}`)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 評分：達門檻（後端已判斷 rating!=null）才顯示 */}
        {p.rating && (
          <div className="mt-3">
            <RatingStars avg={p.rating.avg} count={p.rating.count} />
          </div>
        )}

        {p.headline && (
          <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
            {p.headline}
          </p>
        )}

        <MetaRow className="mt-3">
          {p.nationality && <MetaItem icon={Globe}>{p.nationality}</MetaItem>}
          {p.availability && (
            <MetaItem icon={CalendarClock}>{p.availability}</MetaItem>
          )}
        </MetaRow>

        {p.skills.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {p.skills.slice(0, 4).map(s => (
              <span
                key={s}
                className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
              >
                {s}
              </span>
            ))}
          </div>
        )}
      </SurfaceCard>
    </Link>
  );
}
