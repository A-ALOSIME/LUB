"use client";
import {t as translateUi} from "@/lib/i18n";
import {useState} from "react";
import {FormField} from "@/components/form-field";
import {FieldGroup} from "@/components/ui/field";
import {Input} from "@/components/ui/input";
import {DatePickerField} from "@/features/forms/date-input";
import {HoursForm} from "./form";
import type {Locale} from "@/lib/preferences";

export function TermForm({locale}:{locale:Locale}){
 const en=locale==="en",[starts,setStarts]=useState(""),[ends,setEnds]=useState("");
 const reversed=!!(starts&&ends&&ends<starts);
 return <HoursForm operation="term" label={translateUi((en) ? "en" : "ar", "تعريف الفصل", "Create term")} locale={locale} disabled={!starts||!ends||reversed}>
  <FieldGroup className="grid gap-6 sm:grid-cols-2">
   <FormField label={translateUi((en) ? "en" : "ar", "السنة الأكاديمية", "Academic year")} required locale={locale}><Input name="year" required minLength={2} maxLength={20} placeholder="2026-2027" dir="ltr"/></FormField>
   <FormField label={translateUi((en) ? "en" : "ar", "رمز الفصل", "Term code")} required locale={locale}><Input name="code" required maxLength={20} placeholder="T1" dir="ltr"/></FormField>
   <FormField label={translateUi((en) ? "en" : "ar", "اسم الفصل", "Term name")} required locale={locale} className="sm:col-span-2"><Input name="name" required minLength={2} maxLength={120} placeholder={translateUi((en) ? "en" : "ar", "الفصل الدراسي الأول", "First semester")}/></FormField>
   <DatePickerField name="starts" label={translateUi((en) ? "en" : "ar", "البداية", "Start")} required locale={locale} onValueChange={setStarts}/>
   <DatePickerField name="ends" label={translateUi((en) ? "en" : "ar", "النهاية", "End")} required locale={locale} onValueChange={setEnds} error={reversed?(translateUi((en) ? "en" : "ar", "يجب أن تكون نهاية الفصل في تاريخ البداية أو بعده.", "The end date must be on or after the start date.")):undefined}/>
  </FieldGroup>
 </HoursForm>;
}
