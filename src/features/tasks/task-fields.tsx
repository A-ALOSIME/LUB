"use client";
import { formatHours } from "@/lib/display";

import { useId, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DateRangeInput } from "@/features/forms/date-input";
import { NativeSelect } from "@/components/ui/native-select";
import {Switch} from "@/components/ui/switch";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {Field,FieldGroup,FieldLabel,FieldDescription} from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import type { Task, TaskTemplate } from "./repository";
import type { Locale } from "@/lib/preferences";

type HoursRule = { id: string; name: string; default_hours: string; committee_id: string | null; task_template_id: string | null };

export function TaskTemplatePicker({ templates, selected, locale = "ar" }: { templates: TaskTemplate[]; selected?: string; locale?: Locale }) {
  const router = useRouter();
  const pathname = usePathname();
  const en = locale === "en", c = (ar: string, english: string) => en ? english : ar;
  return <label>{c("ابدأ من قالب", "Start from a template")}<NativeSelect value={selected ?? ""} onChange={event => {
    const url = new URL(window.location.href);
    if (event.target.value) url.searchParams.set("template", event.target.value);
    else url.searchParams.delete("template");
    router.replace(`${pathname}?${url.searchParams.toString()}`);
  }}>
    <option value="">{c("بدون قالب", "No template")}</option>
    {templates.filter(template => template.is_active).map(template => <option key={template.id} value={template.id}>{template.name}</option>)}
  </NativeSelect></label>;
}

export function TaskFields({ value, template = false, locale = "ar", rules = [], templates = [], selectedTemplate, canSaveTemplate = false }: {
  value?: Partial<Task & TaskTemplate>;
  template?: boolean;
  locale?: Locale;
  rules?: HoursRule[];
  templates?: TaskTemplate[];
  selectedTemplate?: string;
  canSaveTemplate?: boolean;
}) {
  const fieldId=useId();
  const [hoursMode, setHoursMode] = useState<"manual" | "rule">("manual");
  const [ruleId, setRuleId] = useState("");
  const [manualHours, setManualHours] = useState(value?.default_hours ?? "0");
  const selectedRule = rules.find(rule => rule.id === ruleId);
  const en = locale === "en", c = (ar: string, english: string) => en ? english : ar;
  if(template)return <FieldGroup className="task-template-fields">
    <Field><FieldLabel htmlFor={`${fieldId}-title`}>{c("العنوان","Title")}</FieldLabel><Input id={`${fieldId}-title`} name="title" required minLength={2} maxLength={120} defaultValue={value?.title??value?.name??""}/></Field>
    <Field><FieldLabel htmlFor={`${fieldId}-description`}>{c("وصف العمل والمخرج المطلوب","Work description and expected deliverable")}</FieldLabel><Textarea id={`${fieldId}-description`} name="description" required maxLength={6000} rows={5} defaultValue={value?.description??value?.description_template??""}/></Field>
    <Field><FieldLabel htmlFor={`${fieldId}-hours`}>{c("الساعات الافتراضية","Default hours")}</FieldLabel><Input id={`${fieldId}-hours`} name="hours" type="number" min={0} max={1000} step="0.01" required defaultValue={value?.default_hours??"0"}/></Field>
    <Field><div className="flex items-center gap-3"><Switch id={`${fieldId}-active`} name="active" defaultChecked={value?.is_active??true}/><FieldLabel htmlFor={`${fieldId}-active`}>{c("قالب نشط","Active template")}</FieldLabel></div><FieldDescription>{c("يظهر القالب عند إنشاء مهمة جديدة.","Available when creating a new task.")}</FieldDescription></Field>
  </FieldGroup>;
  return <>
    {!template && <TaskTemplatePicker templates={templates} selected={selectedTemplate} locale={locale} />}
    <label>{c("العنوان", "Title")}<input name="title" required minLength={2} maxLength={120} defaultValue={value?.title ?? value?.name ?? ""}/></label>
    <label>{c("وصف العمل والمخرج المطلوب", "Work description and expected deliverable")}<textarea name="description" required maxLength={6000} rows={5} defaultValue={value?.description ?? value?.description_template ?? ""}/></label>
    {<>
      <label>{c("ساعات المهمة", "Task hours")}
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1">
            {hoursMode === "rule" ? <NativeSelect name="rule" required value={ruleId} onChange={event => setRuleId(event.target.value)}>
              {rules.map(rule => <option key={rule.id} value={rule.id}>{rule.name} · {formatHours(rule.default_hours,locale)}</option>)}
            </NativeSelect> : <input name="hours" type="number" min={0} max={1000} step="0.01" required value={manualHours} onChange={event => setManualHours(event.target.value)}/>}
          </div>
          {rules.length > 0 && <Button type="button" variant="outline" size="sm" onClick={() => {
            if (hoursMode === "manual") setRuleId(current => current || rules[0]?.id || "");
            setHoursMode(current => current === "manual" ? "rule" : "manual");
          }}>{hoursMode === "manual" ? c("استخدم قاعدة", "Use a rule") : c("أدخل رقمًا", "Enter a number")}</Button>}
        </div>
        {hoursMode === "rule" && selectedRule ? <><input type="hidden" name="hours" value={selectedRule.default_hours}/></> : null}
        {hoursMode === "manual" && <input type="hidden" name="rule" value=""/>}
      </label>
    </>}
    {<>
      {canSaveTemplate && <label className="flex items-center gap-2"><input name="saveTemplate" type="checkbox" className="size-4"/>{c("احفظها كقالب", "Save as a template")}</label>}
      <details className="rounded-lg border border-border/70 px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium">{c("خيارات إضافية", "Additional options")}</summary>
        <div className="mt-3 grid gap-3">
          <DateRangeInput startName="starts" endName="due" label={c("فترة الانضمام والتسليم (اختيارية)", "Joining and due dates (optional)")} startValue={value?.starts_at ?? ""} endValue={value?.due_at ?? ""} includeTime locale={locale}/>
        </div>
      </details>
    </>}
  </>;
}
