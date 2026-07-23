import { useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { PublicHeader } from "@/components/public/PublicHeader";
import { TW_CITIES } from "@/lib/marketplace";
import {
  PageHero,
  SurfaceCard,
  Field,
  inputCls,
} from "@/components/marketplace/ui";

const CATEGORY_VALUES = [
  "caregiver",
  "domestic_helper",
  "other",
  "unsure",
] as const;
type InquiryCategory = (typeof CATEGORY_VALUES)[number];

const CHANNEL_VALUES = ["phone", "line", "whatsapp", "zalo", "email"] as const;
const TIME_VALUES = ["anytime", "daytime", "evening", "weekend"] as const;

/**
 * 公開站：開放諮詢入口（§8 lead-pipeline）。無標的的上游意圖，送出建立
 * general_inquiry 媒合意向交客服接手。表單開放瀏覽，送出需登入（§15-1）。
 */
export default function Inquiry() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [location, navigate] = useLocation();
  const utils = trpc.useUtils();

  const [category, setCategory] = useState<InquiryCategory>("unsure");
  const [city, setCity] = useState("");
  const [note, setNote] = useState("");
  const [channel, setChannel] = useState("");
  const [time, setTime] = useState("");
  const [done, setDone] = useState(false);

  const mut = trpc.publicJobs.submitInquiry.useMutation({
    onSuccess: async res => {
      setDone(true);
      toast.success(
        res.alreadySent ? t("inquiry.alreadySent") : t("inquiry.sent")
      );
      await utils.publicJobs.myInterests.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  const categoryLabel = (c: InquiryCategory) =>
    c === "unsure" ? t("inquiry.categoryUnsure") : t(`jobs.category.${c}`);

  const submit = () => {
    if (!isAuthenticated) {
      navigate(`/login?next=${encodeURIComponent(location)}`);
      return;
    }
    mut.mutate({
      inquiryCategory: category,
      inquiryCity: city || undefined,
      note: note.trim() || undefined,
      preferredChannel: channel
        ? (channel as (typeof CHANNEL_VALUES)[number])
        : undefined,
      preferredTime: time ? (time as (typeof TIME_VALUES)[number]) : undefined,
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <main className="mx-auto max-w-2xl px-6 py-8">
        <PageHero
          eyebrow={t("inquiry.nav")}
          title={t("inquiry.title")}
          subtitle={t("inquiry.subtitle")}
        />

        {done ? (
          <SurfaceCard data-testid="inquiry-done">
            <p className="text-sm">
              {mut.data?.alreadySent
                ? t("inquiry.alreadySent")
                : t("inquiry.sent")}
            </p>
            <button
              type="button"
              onClick={() => navigate("/my-interests")}
              className="mt-4 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              data-testid="inquiry-view-mine"
            >
              {t("jobs.myNav")}
            </button>
          </SurfaceCard>
        ) : (
          <SurfaceCard>
            <form
              className="space-y-4"
              onSubmit={e => {
                e.preventDefault();
                submit();
              }}
            >
              <Field label={t("inquiry.category")}>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value as InquiryCategory)}
                  className={inputCls}
                  data-testid="inquiry-category"
                >
                  {CATEGORY_VALUES.map(c => (
                    <option key={c} value={c}>
                      {categoryLabel(c)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={t("inquiry.city")}>
                <select
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  className={inputCls}
                  data-testid="inquiry-city"
                >
                  <option value="">{t("jobs.any")}</option>
                  {TW_CITIES.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label={t("inquiry.channel")}>
                  <select
                    value={channel}
                    onChange={e => setChannel(e.target.value)}
                    className={inputCls}
                    data-testid="inquiry-channel"
                  >
                    <option value="">{t("jobs.any")}</option>
                    {CHANNEL_VALUES.map(c => (
                      <option key={c} value={c}>
                        {t(`inquiry.channelOpt.${c}`)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("inquiry.time")}>
                  <select
                    value={time}
                    onChange={e => setTime(e.target.value)}
                    className={inputCls}
                    data-testid="inquiry-time"
                  >
                    <option value="">{t("jobs.any")}</option>
                    {TIME_VALUES.map(v => (
                      <option key={v} value={v}>
                        {t(`inquiry.timeOpt.${v}`)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label={t("inquiry.note")}>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={4}
                  maxLength={500}
                  placeholder={t("inquiry.notePlaceholder")}
                  className={inputCls}
                  data-testid="inquiry-note"
                />
              </Field>

              <button
                type="submit"
                disabled={mut.isPending}
                className="w-full rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                data-testid="inquiry-submit"
              >
                {t("inquiry.submit")}
              </button>
              <p className="text-center text-xs text-muted-foreground">
                {t("inquiry.viaAgency")}
              </p>
            </form>
          </SurfaceCard>
        )}
      </main>
    </div>
  );
}
