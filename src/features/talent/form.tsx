"use client";

import {t as translateUi} from "@/lib/i18n";
import { useId, useState } from "react";
import { WorkflowForm } from "@/features/forms/mutation-form";
import { Field, FieldContent, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { mutateTalent } from "./actions";
import type { Locale } from "@/lib/preferences";

export function TalentForm(props: Omit<Parameters<typeof WorkflowForm>[0], "mutation">) {
  return <WorkflowForm {...props} mutation={mutateTalent} />;
}

export function HiddenSwitch({ id, name, label, defaultChecked = false }: { id?: string; name: string; label: string; defaultChecked?: boolean }) {
  const [checked, setChecked] = useState(defaultChecked);
  return <>
    <input type="hidden" name={name} value={checked ? "true" : "false"} readOnly />
    <Switch id={id} checked={checked} onCheckedChange={setChecked} aria-label={label} />
  </>;
}

export function ProjectFields({ locale = "ar", namePrefix = "", value }: { locale?: Locale; namePrefix?: string; value?: { display_title: string; display_description: string; is_featured: boolean } }) {
  const en = locale === "en";
  const id = useId();
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;
  const featuredLabel = translateUi((en) ? "en" : "ar", "إبراز الإنجاز في أعلى الملف", "Feature this achievement");

  return <FieldGroup className="min-w-0 gap-3">
    <Field>
      <FieldLabel htmlFor={titleId}>{translateUi((en) ? "en" : "ar", "عنوان الإنجاز العام", "Public achievement title")}</FieldLabel>
      <Input id={titleId} name={`${namePrefix}title`} required minLength={2} maxLength={120} defaultValue={value?.display_title} />
    </Field>
    <Field>
      <FieldLabel htmlFor={descriptionId}>{translateUi((en) ? "en" : "ar", "ملخص الإنجاز", "Achievement summary")}</FieldLabel>
      <Textarea id={descriptionId} name={`${namePrefix}description`} maxLength={1000} rows={3} defaultValue={value?.display_description} />
    </Field>
    <Field orientation="horizontal" className="justify-between gap-4 py-1">
      <FieldContent className="min-w-0">
        <FieldLabel htmlFor={`${id}-featured`}>{featuredLabel}</FieldLabel>
      </FieldContent>
      <HiddenSwitch id={`${id}-featured`} name={`${namePrefix}featured`} label={featuredLabel} defaultChecked={value?.is_featured ?? false} />
    </Field>
    <p className="text-xs leading-5 text-muted-foreground">
      {translateUi((en) ? "en" : "ar", "يظهر الملخص فقط، وتبقى ملفات المهمة وملاحظاتها الداخلية خاصة.", "The summary is public while task files and internal notes remain private.")}
    </p>
  </FieldGroup>;
}

export function NewProject({ sources, locale = "ar", onSuccess }: { sources: Array<{ id: string; kind: string; title: string }>; locale?: Locale; onSuccess?: () => void }) {
  const [selected, setSelected] = useState(sources[0]?.id ?? "");
  const source = sources.find((item) => item.id === selected);
  const en = locale === "en";
  const sourceId = "talent-verified-activity";

  return <TalentForm
    operation="project"
    fields={{ ...(source?.kind === "Task" ? { participant: selected } : { contribution: selected }) }}
    label={translateUi((en) ? "en" : "ar", "إضافة الإنجاز", "Add achievement")}
    buttonClassName="button button-compact w-fit"
    formClassName="flex flex-col gap-4"
    locale={locale}
    onSuccess={onSuccess}
  >
    <Field>
      <FieldLabel htmlFor={sourceId}>{translateUi((en) ? "en" : "ar", "النشاط الموثق", "Verified activity")}</FieldLabel>
      <NativeSelect id={sourceId} required value={selected} onChange={(event) => setSelected(event.currentTarget.value)}>
        {sources.map((item) => <NativeSelectOption key={item.id} value={item.id} dir="auto">
          {item.kind === "Task" ? translateUi((en) ? "en" : "ar", "مهمة", "Task") : translateUi((en) ? "en" : "ar", "مساهمة", "Contribution")} · {item.title}
        </NativeSelectOption>)}
      </NativeSelect>
    </Field>
    <ProjectFields locale={locale} />
  </TalentForm>;
}
