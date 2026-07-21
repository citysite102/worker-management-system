import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { PublicHeader } from "@/components/public/PublicHeader";
import {
  TW_CITIES,
  JOB_TYPE_VALUES,
  EMPLOYMENT_TYPE_VALUES,
  type JobTypeValue,
  type EmploymentTypeValue,
} from "@/lib/marketplace";

type FormState = {
  jobType: JobTypeValue;
  city: string;
  district: string;
  headcount: number;
  employmentType: EmploymentTypeValue;
  requirements: string;
  publicDescription: string;
  salaryMin: string;
  salaryMax: string;
  expectedStartDate: string;
};

const EMPTY: FormState = {
  jobType: "caregiver",
  city: "",
  district: "",
  headcount: 1,
  employmentType: "live_in",
  requirements: "",
  publicDescription: "",
  salaryMin: "",
  salaryMax: "",
  expectedStartDate: "",
};

/** 雇主專區：張貼 / 編輯需求單。 */
export default function PostingForm() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const params = useParams<{ id?: string }>();
  const editId = params.id ? Number(params.id) : undefined;
  const isEdit = editId != null && Number.isFinite(editId);
  const utils = trpc.useUtils();

  const [form, setForm] = useState<FormState>(EMPTY);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const existing = trpc.employer.getPosting.useQuery(
    { id: editId as number },
    { enabled: isEdit, retry: false }
  );

  useEffect(() => {
    if (existing.data) {
      const p = existing.data;
      setForm({
        jobType: p.jobType,
        city: p.city,
        district: p.district ?? "",
        headcount: p.headcount,
        employmentType: p.employmentType,
        requirements: p.requirements ?? "",
        publicDescription: p.publicDescription ?? "",
        salaryMin: p.salaryMin != null ? String(p.salaryMin) : "",
        salaryMax: p.salaryMax != null ? String(p.salaryMax) : "",
        expectedStartDate: p.expectedStartDate ?? "",
      });
    }
  }, [existing.data]);

  const afterSave = async () => {
    await utils.employer.myPostings.invalidate();
    navigate("/employer");
  };

  const createMut = trpc.employer.createPosting.useMutation({
    onSuccess: (_r, vars) => {
      toast.success(
        vars.submit
          ? t("employer.form.submitted")
          : t("employer.form.savedDraft")
      );
      void afterSave();
    },
    onError: e => toast.error(e.message),
  });
  const updateMut = trpc.employer.updatePosting.useMutation({
    onSuccess: (_r, vars) => {
      toast.success(
        vars.submit
          ? t("employer.form.submitted")
          : t("employer.form.savedDraft")
      );
      void afterSave();
    },
    onError: e => toast.error(e.message),
  });

  const pending = createMut.isPending || updateMut.isPending;

  const payload = () => ({
    jobType: form.jobType,
    city: form.city,
    district: form.district || undefined,
    headcount: Number(form.headcount) || 1,
    employmentType: form.employmentType,
    requirements: form.requirements || undefined,
    publicDescription: form.publicDescription || undefined,
    salaryMin: form.salaryMin ? Number(form.salaryMin) : undefined,
    salaryMax: form.salaryMax ? Number(form.salaryMax) : undefined,
    expectedStartDate: form.expectedStartDate || undefined,
  });

  const submit = (doSubmit: boolean) => {
    if (!form.city) {
      toast.error(t("employer.form.selectCity"));
      return;
    }
    if (isEdit)
      updateMut.mutate({
        id: editId as number,
        ...payload(),
        submit: doSubmit,
      });
    else createMut.mutate({ ...payload(), submit: doSubmit });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <main className="max-w-2xl mx-auto px-6 py-8">
        <Link
          href="/employer"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {t("employer.backToList")}
        </Link>
        <h1 className="mt-3 mb-6 text-2xl font-bold tracking-tight">
          {isEdit ? t("employer.editPosting") : t("employer.newPosting")}
        </h1>

        <form
          onSubmit={e => {
            e.preventDefault();
            submit(true);
          }}
          className="space-y-4 rounded-lg border border-border bg-card p-6"
        >
          <Field label={`${t("employer.form.jobType")} *`}>
            <select
              value={form.jobType}
              onChange={e => set("jobType", e.target.value as JobTypeValue)}
              className={inputCls}
              data-testid="form-jobType"
            >
              {JOB_TYPE_VALUES.map(v => (
                <option key={v} value={v}>
                  {t(`jobs.jobType.${v}`)}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={`${t("employer.form.city")} *`}>
              <select
                value={form.city}
                onChange={e => set("city", e.target.value)}
                className={inputCls}
                required
                data-testid="form-city"
              >
                <option value="">{t("employer.form.selectCity")}</option>
                {TW_CITIES.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("employer.form.district")}>
              <input
                value={form.district}
                onChange={e => set("district", e.target.value)}
                className={inputCls}
                data-testid="form-district"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={`${t("employer.form.headcount")} *`}>
              <input
                type="number"
                min={1}
                max={99}
                value={form.headcount}
                onChange={e => set("headcount", Number(e.target.value))}
                className={inputCls}
                data-testid="form-headcount"
              />
            </Field>
            <Field label={`${t("employer.form.employmentType")} *`}>
              <select
                value={form.employmentType}
                onChange={e =>
                  set("employmentType", e.target.value as EmploymentTypeValue)
                }
                className={inputCls}
                data-testid="form-employmentType"
              >
                {EMPLOYMENT_TYPE_VALUES.map(v => (
                  <option key={v} value={v}>
                    {t(`jobs.employmentType.${v}`)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("employer.form.salaryMin")}>
              <input
                type="number"
                min={0}
                value={form.salaryMin}
                onChange={e => set("salaryMin", e.target.value)}
                className={inputCls}
                data-testid="form-salaryMin"
              />
            </Field>
            <Field label={t("employer.form.salaryMax")}>
              <input
                type="number"
                min={0}
                value={form.salaryMax}
                onChange={e => set("salaryMax", e.target.value)}
                className={inputCls}
                data-testid="form-salaryMax"
              />
            </Field>
          </div>

          <Field label={t("employer.form.expectedStart")}>
            <input
              type="date"
              value={form.expectedStartDate}
              onChange={e => set("expectedStartDate", e.target.value)}
              className={inputCls}
              data-testid="form-expectedStart"
            />
          </Field>

          <Field label={t("employer.form.requirements")}>
            <textarea
              value={form.requirements}
              onChange={e => set("requirements", e.target.value)}
              rows={2}
              className={inputCls}
              data-testid="form-requirements"
            />
          </Field>

          <Field label={t("employer.form.description")}>
            <textarea
              value={form.publicDescription}
              onChange={e => set("publicDescription", e.target.value)}
              rows={3}
              className={inputCls}
              data-testid="form-description"
            />
          </Field>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={pending}
              className="flex-1 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
              data-testid="form-submit"
            >
              {t("employer.form.submit")}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => submit(false)}
              className="rounded-md border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
              data-testid="form-save-draft"
            >
              {t("employer.form.saveDraft")}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-accent";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1.5">{label}</span>
      {children}
    </label>
  );
}
