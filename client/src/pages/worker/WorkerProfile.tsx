import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PublicHeader } from "@/components/public/PublicHeader";
import {
  PageHeader,
  SurfaceCard,
  StatusPill,
  Field,
  inputCls,
} from "@/components/marketplace/ui";
import { JOB_TYPE_VALUES, type JobTypeValue } from "@/lib/marketplace";
import { categoryIcon } from "@/components/marketplace/worker";

const EMPLOYER_TYPES = [
  "family_care",
  "institution",
  "manufacturing",
  "agriculture",
  "construction",
  "other",
] as const;
type EmployerType = (typeof EMPLOYER_TYPES)[number];

/** 移工自助：公開履歷 + 自填經歷。 */
export default function WorkerProfile() {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const profileQ = trpc.worker.myProfile.useQuery();
  const expQ = trpc.worker.myExperiences.useQuery();

  const [form, setForm] = useState({
    alias: "",
    headline: "",
    nationality: "",
    yearOfBirth: "",
    skills: "",
    languages: "",
    availability: "",
    selfIntro: "",
  });
  const [jobTypes, setJobTypes] = useState<JobTypeValue[]>([]);
  const set = (k: keyof typeof form, v: string) =>
    setForm(f => ({ ...f, [k]: v }));

  // 期望職類多選：最多 3 個，切換選取。
  const toggleJobType = (v: JobTypeValue) =>
    setJobTypes(prev =>
      prev.includes(v)
        ? prev.filter(x => x !== v)
        : prev.length >= 3
          ? prev
          : [...prev, v]
    );

  useEffect(() => {
    const p = profileQ.data;
    if (p) {
      setForm({
        alias: p.alias ?? "",
        headline: p.headline ?? "",
        nationality: p.nationality ?? "",
        yearOfBirth: p.yearOfBirth != null ? String(p.yearOfBirth) : "",
        skills: (p.skills ?? []).join(", "),
        languages: (p.languages ?? []).join(", "),
        availability: p.availability ?? "",
        selfIntro: p.selfIntro ?? "",
      });
      setJobTypes((p.jobTypes ?? []) as JobTypeValue[]);
    }
  }, [profileQ.data]);

  const upsert = trpc.worker.upsertProfile.useMutation({
    onSuccess: (_r, vars) => {
      toast.success(vars.submit ? t("worker.submitted") : t("worker.saved"));
      void utils.worker.myProfile.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  const toList = (s: string) =>
    s
      .split(/[,，、]/)
      .map(x => x.trim())
      .filter(Boolean);

  const save = (submit: boolean) => {
    upsert.mutate({
      alias: form.alias || undefined,
      headline: form.headline || undefined,
      nationality: form.nationality || undefined,
      yearOfBirth: form.yearOfBirth ? Number(form.yearOfBirth) : undefined,
      jobTypes: jobTypes.length ? jobTypes : undefined,
      skills: toList(form.skills),
      languages: toList(form.languages),
      availability: form.availability || undefined,
      selfIntro: form.selfIntro || undefined,
      submit,
    });
  };

  const p = profileQ.data;
  const modTone =
    p?.moderationStatus === "approved"
      ? "green"
      : p?.moderationStatus === "rejected"
        ? "red"
        : "amber";
  const modLabel = p
    ? p.moderationStatus === "approved"
      ? t("worker.moderationApproved")
      : p.moderationStatus === "rejected"
        ? t("worker.moderationRejected")
        : t("worker.moderationPending")
    : t("worker.draftHint");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <main className="max-w-2xl mx-auto px-6 py-8">
        <PageHeader
          title={t("worker.title")}
          subtitle={t("worker.subtitle")}
          action={
            p ? (
              <StatusPill tone={modTone} data-testid="profile-moderation">
                {modLabel}
              </StatusPill>
            ) : undefined
          }
        />

        {p?.moderationStatus === "rejected" && p.rejectReason && (
          <div className="mb-4 rounded-md border border-border bg-muted/40 p-3 text-sm">
            <span className="font-medium status-red rounded px-1">
              {t("worker.moderationRejected")}
            </span>
            <p className="mt-1 text-muted-foreground">{p.rejectReason}</p>
          </div>
        )}

        {/* Profile form */}
        <SurfaceCard>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("worker.alias")}>
                <input
                  value={form.alias}
                  onChange={e => set("alias", e.target.value)}
                  className={inputCls}
                  data-testid="profile-alias"
                />
              </Field>
              <Field label={t("worker.nationality")}>
                <input
                  value={form.nationality}
                  onChange={e => set("nationality", e.target.value)}
                  className={inputCls}
                  data-testid="profile-nationality"
                />
              </Field>
            </div>
            <Field label={t("worker.headline")}>
              <input
                value={form.headline}
                onChange={e => set("headline", e.target.value)}
                className={inputCls}
                data-testid="profile-headline"
              />
            </Field>
            <Field label={t("worker.yearOfBirth")}>
              <input
                type="number"
                value={form.yearOfBirth}
                onChange={e => set("yearOfBirth", e.target.value)}
                className={inputCls}
                data-testid="profile-year"
              />
            </Field>
            {/* 期望職類：可多選（最多 3 個），切換膠囊 */}
            <Field label={t("worker.jobTypeMulti")}>
              <div
                className="flex flex-wrap gap-1.5"
                data-testid="profile-jobTypes"
              >
                {JOB_TYPE_VALUES.map(v => {
                  const active = jobTypes.includes(v);
                  const Icon = categoryIcon(v);
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => toggleJobType(v)}
                      aria-pressed={active}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                        active
                          ? "border-primary bg-accent text-accent-foreground"
                          : "border-border bg-card text-muted-foreground hover:bg-muted"
                      }`}
                      data-testid={`profile-jobType-${v}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {t(`jobs.jobType.${v}`)}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label={t("worker.skills")}>
              <input
                value={form.skills}
                onChange={e => set("skills", e.target.value)}
                className={inputCls}
                data-testid="profile-skills"
              />
            </Field>
            <Field label={t("worker.languages")}>
              <input
                value={form.languages}
                onChange={e => set("languages", e.target.value)}
                className={inputCls}
                data-testid="profile-languages"
              />
            </Field>
            <Field label={t("worker.availability")}>
              <input
                value={form.availability}
                onChange={e => set("availability", e.target.value)}
                className={inputCls}
                data-testid="profile-availability"
              />
            </Field>
            <Field label={t("worker.selfIntro")}>
              <textarea
                value={form.selfIntro}
                onChange={e => set("selfIntro", e.target.value)}
                rows={3}
                className={inputCls}
                data-testid="profile-selfIntro"
              />
            </Field>
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                disabled={upsert.isPending}
                onClick={() => save(true)}
                className="flex-1 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                data-testid="profile-submit"
              >
                {t("worker.submit")}
              </button>
              <button
                type="button"
                disabled={upsert.isPending}
                onClick={() => save(false)}
                className="rounded-md border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
                data-testid="profile-save-draft"
              >
                {t("worker.saveDraft")}
              </button>
            </div>
          </div>
        </SurfaceCard>

        {/* Experiences */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-3">
            {t("worker.experiences")}
          </h2>
          <ExperiencesSection experiences={expQ.data ?? []} />
        </div>
      </main>
    </div>
  );
}

function ExperiencesSection({
  experiences,
}: {
  experiences: Array<{
    id: number;
    employerType: string;
    role: string;
    startDate: string | null;
    endDate: string | null;
    description: string | null;
    reviewStatus: string;
  }>;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [editing, setEditing] = useState<number | "new" | null>(null);

  const refresh = () => utils.worker.myExperiences.invalidate();
  const addMut = trpc.worker.addExperience.useMutation({
    onSuccess: () => {
      toast.success(t("worker.saved"));
      setEditing(null);
      void refresh();
    },
    onError: e => toast.error(e.message),
  });
  const updateMut = trpc.worker.updateExperience.useMutation({
    onSuccess: () => {
      toast.success(t("worker.saved"));
      setEditing(null);
      void refresh();
    },
    onError: e => toast.error(e.message),
  });
  const deleteMut = trpc.worker.deleteExperience.useMutation({
    onSuccess: () => void refresh(),
    onError: e => toast.error(e.message),
  });

  return (
    <div className="space-y-3" data-testid="experiences-list">
      {experiences.map(e =>
        editing === e.id ? (
          <ExperienceForm
            key={e.id}
            initial={e}
            pending={updateMut.isPending}
            onCancel={() => setEditing(null)}
            onSave={data => updateMut.mutate({ id: e.id, ...data })}
          />
        ) : (
          <SurfaceCard key={e.id} data-testid="experience-row">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{e.role}</h3>
                  <span className="text-xs text-muted-foreground">
                    {t(`worker.employerType.${e.employerType}`)}
                  </span>
                  <StatusPill
                    tone={
                      e.reviewStatus === "approved"
                        ? "green"
                        : e.reviewStatus === "rejected"
                          ? "red"
                          : "amber"
                    }
                  >
                    {t("worker.expSelfReported")}
                  </StatusPill>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {e.startDate || "?"} – {e.endDate || t("findWorkers.present")}
                </p>
                {e.description && (
                  <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                    {e.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditing(e.id)}
                  className="rounded-md border border-border p-1.5 hover:bg-muted"
                  aria-label={t("worker.save")}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => deleteMut.mutate({ id: e.id })}
                  className="rounded-md border border-border p-1.5 text-destructive hover:bg-muted"
                  data-testid={`exp-delete-${e.id}`}
                  aria-label={t("worker.delete")}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </SurfaceCard>
        )
      )}

      {experiences.length === 0 && editing !== "new" && (
        <div className="text-sm text-muted-foreground py-2">
          {t("worker.expEmpty")}
        </div>
      )}

      {editing === "new" ? (
        <ExperienceForm
          pending={addMut.isPending}
          onCancel={() => setEditing(null)}
          onSave={data => addMut.mutate(data)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
          data-testid="add-experience"
        >
          <Plus className="w-4 h-4" />
          {t("worker.addExperience")}
        </button>
      )}
    </div>
  );
}

type ExperienceData = {
  employerType: EmployerType;
  role: string;
  startDate?: string;
  endDate?: string;
  description?: string;
};

function ExperienceForm({
  initial,
  pending,
  onCancel,
  onSave,
}: {
  initial?: {
    employerType: string;
    role: string;
    startDate: string | null;
    endDate: string | null;
    description: string | null;
  };
  pending: boolean;
  onCancel: () => void;
  onSave: (data: ExperienceData) => void;
}) {
  const { t } = useTranslation();
  const [f, setF] = useState({
    employerType: (initial?.employerType as EmployerType) ?? "family_care",
    role: initial?.role ?? "",
    startDate: initial?.startDate ?? "",
    endDate: initial?.endDate ?? "",
    description: initial?.description ?? "",
  });
  const submit = () => {
    if (!f.role.trim()) {
      toast.error(t("worker.expRole"));
      return;
    }
    onSave({
      employerType: f.employerType,
      role: f.role,
      startDate: f.startDate || undefined,
      endDate: f.endDate || undefined,
      description: f.description || undefined,
    });
  };
  return (
    <SurfaceCard className="space-y-3" data-testid="experience-form">
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("worker.expEmployerType")}>
          <select
            value={f.employerType}
            onChange={e =>
              setF(s => ({
                ...s,
                employerType: e.target.value as EmployerType,
              }))
            }
            className={inputCls}
            data-testid="exp-employerType"
          >
            {EMPLOYER_TYPES.map(v => (
              <option key={v} value={v}>
                {t(`worker.employerType.${v}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("worker.expRole")}>
          <input
            value={f.role}
            onChange={e => setF(s => ({ ...s, role: e.target.value }))}
            className={inputCls}
            data-testid="exp-role"
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("worker.expStart")}>
          <input
            value={f.startDate}
            onChange={e => setF(s => ({ ...s, startDate: e.target.value }))}
            placeholder="YYYY-MM"
            className={inputCls}
          />
        </Field>
        <Field label={t("worker.expEnd")}>
          <input
            value={f.endDate}
            onChange={e => setF(s => ({ ...s, endDate: e.target.value }))}
            placeholder="YYYY-MM"
            className={inputCls}
          />
        </Field>
      </div>
      <Field label={t("worker.expDesc")}>
        <textarea
          value={f.description}
          onChange={e => setF(s => ({ ...s, description: e.target.value }))}
          rows={2}
          className={inputCls}
        />
      </Field>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          data-testid="exp-save"
        >
          {t("worker.save")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          {t("worker.cancel")}
        </button>
      </div>
    </SurfaceCard>
  );
}
