"use client";
import {ActivitySkillField} from "@/features/talent/activity-skill-field";
import {createTranslator} from "@/lib/i18n";

import { useState } from "react";
import { DateRangeInput } from "@/features/forms/date-input";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {FieldGroup} from "@/components/ui/field";
import { FormField } from "@/components/form-field";
import {InputGroup,InputGroupInput,InputGroupAddon,InputGroupText} from "@/components/ui/input-group";
import {EntityImageField} from "@/features/events/event-poster-field";
import type { Task } from "./repository";
import type { Locale } from "@/lib/preferences";


export function TaskFields({ value, locale = "ar", scopeField, organization, committee }: {
  value?: Partial<Task>;
  locale?: Locale;
  scopeField?: import("react").ReactNode;
  organization?:string;committee?:string|null;
}) {
  const [manualHours, setManualHours] = useState(value?.default_hours ?? "0");
  const en = locale === "en", c = createTranslator(en ? "en" : "ar");
  return <FieldGroup className="task-fields grid sm:grid-cols-2 [&>div:has(textarea)]:sm:col-span-2">

    <FormField className="sm:col-span-2" label={c("العنوان", "Title")} required><Input name="title" required minLength={2} maxLength={120} defaultValue={value?.title ?? ""}/></FormField>
    <FormField label={c("وصف العمل والمخرج المطلوب", "Work description and expected deliverable")} required><Textarea name="description" required maxLength={6000} rows={5} defaultValue={value?.description ?? ""}/></FormField>
    <ActivitySkillField kind="Task" initialSkills={value?.skills} locale={locale} className="sm:col-span-2"/>
    <FormField label={c("ساعات المهمة", "Task hours")} required>
      <InputGroup><InputGroupInput name="hours" type="number" min={0} max={1000} step="0.01" required value={manualHours} onChange={event=>setManualHours(event.target.value)}/><InputGroupAddon align="inline-end"><InputGroupText>{c("ساعة","hours")}</InputGroupText></InputGroupAddon></InputGroup>
    </FormField>
    <div><DateRangeInput startName="starts" endName="due" label={c("فترة الانضمام والتسليم", "Joining and due dates")} startValue={value?.starts_at ?? ""} endValue={value?.due_at ?? ""} includeTime locale={locale}/></div>
    {scopeField}
    {organization&&<div className="sm:col-span-2"><EntityImageField organization={organization} committee={committee} locale={locale} purpose="task-image" initialPreview={value?.image_asset_id?`/files/${value.image_asset_id}/preview`:""}/></div>}
  </FieldGroup>;
}
