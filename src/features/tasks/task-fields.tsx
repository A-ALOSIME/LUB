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
import { FormField } from "@/components/form-field";
import {InputGroup,InputGroupInput,InputGroupAddon,InputGroupText} from "@/components/ui/input-group";
import { Button } from "@/components/ui/button";
import {EntityImageField} from "@/features/events/event-poster-field";
import type { Task, TaskTemplate } from "./repository";
import type { Locale } from "@/lib/preferences";

type HoursRule = { id: string; name: string; default_hours: string; committee_id: string | null; task_template_id: string | null };

export function TaskTemplatePicker({ templates, selected, locale = "ar" }: { templates: TaskTemplate[]; selected?: string; locale?: Locale }) {
  const router = useRouter();
  const pathname = usePathname();
  const en = locale === "en", c = (ar: string, english: string) => en ? english : ar;
  return <FormField label={c("ابدأ من قالب", "Start from a template")}><NativeSelect value={selected ?? ""} onChange={event => {
    const url = new URL(window.location.href);
    if (event.target.value) url.searchParams.set("template", event.target.value);
    else url.searchParams.delete("template");
    router.replace(`${pathname}?${url.searchParams.toString()}`);
  }}>
    <option value="">{c("بدون قالب", "No template")}</option>
    {templates.filter(template => template.is_active).map(template => <option key={template.id} value={template.id}>{template.name}</option>)}
  </NativeSelect></FormField>;
}

export function TaskFields({ value, template = false, locale = "ar", rules = [], templates = [], selectedTemplate, scopeField, organization, committee, templatePicker }: {
  value?: Partial<Task & TaskTemplate>;
  template?: boolean;
  locale?: Locale;
  rules?: HoursRule[];
  templates?: TaskTemplate[];
  selectedTemplate?: string;
  scopeField?: import("react").ReactNode;
  templatePicker?: import("react").ReactNode;
  organization?:string;committee?:string|null;
}) {
  const fieldId=useId();
  const [hoursMode, setHoursMode] = useState<"manual" | "rule">("manual");
  const [ruleId, setRuleId] = useState("");
  const [manualHours, setManualHours] = useState(value?.default_hours ?? "0");
  const selectedRule = rules.find(rule => rule.id === ruleId);
  const en = locale === "en", c = (ar: string, english: string) => en ? english : ar;
  if(template)return <FieldGroup className="task-template-fields">
    <FormField id={`${fieldId}-title`} label={c("العنوان","Title")} required><Input id={`${fieldId}-title`} name="title" required minLength={2} maxLength={120} defaultValue={value?.title??value?.name??""}/></FormField>
    <FormField id={`${fieldId}-description`} label={c("وصف العمل والمخرج المطلوب","Work description and expected deliverable")} required><Textarea id={`${fieldId}-description`} name="description" required maxLength={6000} rows={5} defaultValue={value?.description??value?.description_template??""}/></FormField>
    <FormField id={`${fieldId}-hours`} label={c("الساعات الافتراضية","Default hours")} required><Input id={`${fieldId}-hours`} name="hours" type="number" min={0} max={1000} step="0.01" required defaultValue={value?.default_hours??"0"}/></FormField>
    <Field><div className="flex items-center gap-3"><Switch id={`${fieldId}-active`} name="active" defaultChecked={value?.is_active??true}/><FieldLabel htmlFor={`${fieldId}-active`}>{c("قالب نشط","Active template")}</FieldLabel></div><FieldDescription>{c("يظهر القالب عند إنشاء مهمة جديدة.","Available when creating a new task.")}</FieldDescription></Field>
  </FieldGroup>;
  return <FieldGroup className="task-fields grid sm:grid-cols-2 [&>div:has(textarea)]:sm:col-span-2">

    <FormField className="sm:col-span-2" label={c("العنوان", "Title")} required><Input name="title" required minLength={2} maxLength={120} defaultValue={value?.title ?? value?.name ?? ""}/></FormField>
    <FormField label={c("وصف العمل والمخرج المطلوب", "Work description and expected deliverable")} required><Textarea name="description" required maxLength={6000} rows={5} defaultValue={value?.description ?? value?.description_template ?? ""}/></FormField>
    {<>
      <FormField label={c("ساعات المهمة", "Task hours")} required>
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1">
            {hoursMode === "rule" ? <NativeSelect name="rule" required value={ruleId} onChange={event => setRuleId(event.target.value)}>
              {rules.map(rule => <option key={rule.id} value={rule.id}>{rule.name} · {formatHours(rule.default_hours,locale)}</option>)}
            </NativeSelect> : <InputGroup><InputGroupInput name="hours" type="number" min={0} max={1000} step="0.01" required value={manualHours} onChange={event => setManualHours(event.target.value)}/><InputGroupAddon align="inline-end"><InputGroupText>{c("ساعة","hours")}</InputGroupText></InputGroupAddon></InputGroup>}
          </div>
          {rules.length > 0 && <Button type="button" variant="outline" size="sm" onClick={() => {
            if (hoursMode === "manual") setRuleId(current => current || rules[0]?.id || "");
            setHoursMode(current => current === "manual" ? "rule" : "manual");
          }}>{hoursMode === "manual" ? c("استخدم قاعدة", "Use a rule") : c("أدخل رقمًا", "Enter a number")}</Button>}
        </div>
        {hoursMode === "rule" && selectedRule ? <><input type="hidden" name="hours" value={selectedRule.default_hours}/></> : null}
        {hoursMode === "manual" && <input type="hidden" name="rule" value=""/>}
      </FormField>
    </>}
    <div><DateRangeInput startName="starts" endName="due" label={c("فترة الانضمام والتسليم", "Joining and due dates")} startValue={value?.starts_at ?? ""} endValue={value?.due_at ?? ""} includeTime locale={locale}/></div>
    {scopeField}
    {templatePicker??(templates.length>0?<TaskTemplatePicker templates={templates} selected={selectedTemplate} locale={locale}/>:null)}
    {organization&&<div className="sm:col-span-2"><EntityImageField organization={organization} committee={committee} locale={locale} purpose="task-image" initialPreview={value?.image_asset_id?`/files/${value.image_asset_id}/preview`:""}/></div>}
  </FieldGroup>;
}
