"use client";

import {ContentText} from "@/components/content-text";
import {formatNumber,t as translateUi} from "@/lib/i18n";
import { NativeSelect } from "@/components/ui/native-select";
import { useState } from "react";
import { visibleFields, type Answers, type FormDefinition } from "./definition";
import { WorkflowForm } from "./mutation-form";
import { FilePickerInput } from "@/components/file-picker-input";
import { PhoneInput } from "@/components/phone-input";
import type { Locale } from "@/lib/preferences";

export function ApplicationForm({
  round,
  version,
  definition,
  initial = {},
  application,
  revision,
  committees,
  event,
  mutation,
  locale = "ar",
}: {
  round: string;
  version: string;
  definition: FormDefinition;
  initial?: Answers;
  application?: string;
  revision?: number;
  committees: Array<{ id: string; name: string }>;
  event?: string;
  mutation?: Parameters<typeof WorkflowForm>[0]["mutation"];
  locale?: Locale;
}) {
  const en = locale === "en";
  const [answers, setAnswers] = useState(() => ({
    ...Object.fromEntries(
      definition.sections
        .flatMap((s) => s.fields)
        .filter((f) => f.type === "Checkbox")
        .map((f) => [f.id, false]),
    ),
    ...initial,
  }));
  const [step, setStep] = useState(0);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const visible = visibleFields(definition, answers);
  const set = (id: string, value: Answers[string]) =>
    setAnswers((a) => ({ ...a, [id]: value }));
  async function upload(id: string, file?: File) {
    if (!file) return;
    setUploading(id);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/files/upload", {
        method: "POST",
        body: form,
      });
      const result = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !result.id) throw new Error(result.error);
      set(id, result.id);
    } catch {
      setError(
        translateUi((en) ? "en" : "ar", "تعذّر رفع المرفق. اختر PDF أو JPEG أو PNG حتى 5 ميجابايت.", "Could not upload the file. Choose a PDF, JPEG, or PNG up to 5 MB."),
      );
    } finally {
      setUploading(null);
    }
  }
  return (
    <WorkflowForm
      mutation={mutation}
      disabled={uploading !== null}
      operation={event ? "register" : "submit"}
      fields={{
        round,
        version,
        answers: JSON.stringify(answers),
        ...(event ? { event, revision: String(revision ?? "") } : {}),
        ...(application ? { application, revision: String(revision) } : {}),
      }}
      label={
        en
          ? event
            ? revision
              ? "Save registration answers"
              : "Register for event"
            : application
              ? "Save application changes"
              : "Submit application"
          : event
            ? revision
              ? "حفظ إجابات التسجيل"
              : "تسجيل في الفعالية"
            : application
              ? "حفظ تعديل الطلب"
              : "إرسال طلب الانضمام"
      }
      locale={locale}
    >
      {definition.sections.map((section, index) => (
        <fieldset
          hidden={definition.layout === "Progressive" && step !== index}
          key={section.id}
          className="space-y-5"
        >
          <legend
            dir={en ? "ltr" : "rtl"}
            className="mb-4 text-xl font-semibold"
          >
            <ContentText value={section.title}/>
          </legend>
          <p dir={en ? "ltr" : "rtl"} className="text-muted leading-8">
            <ContentText value={section.description}/>
          </p>
          {section.fields
            .filter((f) => visible.has(f.id))
            .map((f) => (
              <div key={f.id}>
                <label htmlFor={f.id} dir={en ? "ltr" : "rtl"}>
                  <ContentText value={f.label}/>
                  {f.required ? " *" : translateUi((en) ? "en" : "ar", " (اختياري)", " (optional)")}
                </label>
                {f.help && (
                  <p
                    id={`${f.id}-help`}
                    dir={en ? "ltr" : "rtl"}
                    className="mb-2 text-sm leading-7 text-muted"
                  >
                    {f.help}
                  </p>
                )}
                {f.type === "ShortText" &&
                /جوال|هاتف|\b(phone|mobile|telephone)\b/i.test(f.label) ? (
                  <PhoneInput
                    id={f.id}
                    value={String(answers[f.id] ?? "")}
                    locale={locale}
                    onChange={(value) => set(f.id, value)}
                    required={f.required}
                  />
                ) : f.type === "LongText" ? (
                  <textarea
                    id={f.id}
                    dir={en ? "ltr" : "rtl"}
                    value={String(answers[f.id] ?? "")}
                    maxLength={f.maxLength}
                    onChange={(e) => set(f.id, e.target.value)}
                  />
                ) : f.type === "Committee" ? (
                  <NativeSelect
                    id={f.id}
                    required={f.required}
                    value={String(answers[f.id] ?? "")}
                    onChange={(e) => set(f.id, e.target.value)}
                  >
                    <option value="">
                      {translateUi((en) ? "en" : "ar", "اختر اللجنة", "Choose a committee")}
                    </option>
                    {committees.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </NativeSelect>
                ) : ["Select", "Radio"].includes(f.type) ? (
                  <NativeSelect
                    id={f.id}
                    value={String(answers[f.id] ?? "")}
                    onChange={(e) => set(f.id, e.target.value)}
                  >
                    <option value="">
                      {translateUi((en) ? "en" : "ar", "اختر الإجابة", "Choose an answer")}
                    </option>
                    {f.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        <ContentText value={o.label}/>
                      </option>
                    ))}
                  </NativeSelect>
                ) : f.type === "MultiSelect" ? (
                  <fieldset id={f.id} className="space-y-2">
                    <legend className="sr-only"><ContentText value={f.label}/></legend>
                    {f.options.map((o) => (
                      <label key={o.value} className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          className="size-5"
                          checked={
                            Array.isArray(answers[f.id]) &&
                            (answers[f.id] as string[]).includes(o.value)
                          }
                          onChange={(e) => {
                            const old = Array.isArray(answers[f.id])
                              ? (answers[f.id] as string[])
                              : [];
                            set(
                              f.id,
                              e.target.checked
                                ? [...old, o.value]
                                : old.filter((x) => x !== o.value),
                            );
                          }}
                        />
                        <ContentText value={o.label}/>
                      </label>
                    ))}
                  </fieldset>
                ) : f.type === "Checkbox" ? (
                  <input
                    id={f.id}
                    type="checkbox"
                    className="size-5"
                    checked={answers[f.id] === true}
                    onChange={(e) => set(f.id, e.target.checked)}
                  />
                ) : f.type === "File" ? (
                  <>
                    <FilePickerInput
                      id={f.id}
                      ariaLabel={f.label}
                      accept="application/pdf,image/jpeg,image/png"
                      locale={locale}
                      disabled={uploading !== null}
                      onChange={(e) => void upload(f.id, e.target.files?.[0])}
                    />
                    <p role="status" className="mt-2 text-sm text-muted">
                      {en
                        ? uploading === f.id
                          ? "Uploading…"
                          : "PDF, JPEG, or PNG, up to 5 MB."
                        : uploading === f.id
                          ? "جارٍ رفع المرفق…"
                          : "PDF أو JPEG أو PNG، حتى 5 ميجابايت."}
                    </p>
                    {answers[f.id] && (
                      <a className="text-link" href={`/files/${answers[f.id]}`}>
                        {translateUi((en) ? "en" : "ar", "تنزيل المرفق الحالي", "Download current attachment")}
                      </a>
                    )}
                  </>
                ) : (
                  <input
                    id={f.id}
                    dir={f.type === "Email" ? "ltr" : en ? "ltr" : "rtl"}
                    type={
                      f.type === "Number"
                        ? "number"
                        : f.type === "Email"
                          ? "email"
                          : f.type === "Date"
                            ? "date"
                            : "text"
                    }
                    min={f.min}
                    max={f.max}
                    step={f.type === "Number" ? "any" : undefined}
                    maxLength={f.maxLength}
                    value={String(answers[f.id] ?? "")}
                    onChange={(e) => set(f.id, e.target.value)}
                  />
                )}
              </div>
            ))}
        </fieldset>
      ))}
      {definition.layout === "Progressive" && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="button button-secondary"
            disabled={!step}
            onClick={() => setStep(step - 1)}
          >
            {translateUi((en) ? "en" : "ar", "السابق", "Previous")}
          </button>
          <p>
            {translateUi((en) ? "en" : "ar", `القسم ${formatNumber(step + 1,locale)} من ${formatNumber(definition.sections.length,locale)}`, `Section ${step + 1} of ${definition.sections.length}`)}
          </p>
          <button
            type="button"
            className="button button-secondary"
            disabled={step === definition.sections.length - 1}
            onClick={() => setStep(step + 1)}
          >
            {translateUi((en) ? "en" : "ar", "التالي", "Next")}
          </button>
        </div>
      )}

      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {definition.sections.some((s) => s.fields.length > 0) && (
        <p className="text-sm leading-7 text-muted">
          {translateUi((en) ? "en" : "ar", "الأسئلة ذات العلامة * مطلوبة. ", "Questions marked * are required. ")}
          {en
            ? event
              ? "You can edit your answers until registration closes."
              : "You can edit your application while it is under review or in interview, if the round is open."
            : event
              ? "تقدر تعدّل إجاباتك قبل إغلاق التسجيل."
              : "تقدر تعدّل طلبك وهو قيد المراجعة أو المقابلة إذا الجولة مفتوحة."}{" "}
          {translateUi((en) ? "en" : "ar", "انتظر اكتمال رفع الملفات قبل الإرسال.", "Wait for uploads to finish before submitting.")}
        </p>
      )}
    </WorkflowForm>
  );
}
