"use client";
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
 return <HoursForm operation="term" label={en?"Create term":"تعريف الفصل"} locale={locale} disabled={!starts||!ends||reversed}>
  <FieldGroup className="grid gap-6 sm:grid-cols-2">
   <FormField label={en?"Academic year":"السنة الأكاديمية"} required locale={locale}><Input name="year" required minLength={2} maxLength={20} placeholder="2026-2027" dir="ltr"/></FormField>
   <FormField label={en?"Term code":"رمز الفصل"} required locale={locale}><Input name="code" required maxLength={20} placeholder="T1" dir="ltr"/></FormField>
   <FormField label={en?"Term name":"اسم الفصل"} required locale={locale} className="sm:col-span-2"><Input name="name" required minLength={2} maxLength={120} placeholder={en?"First semester":"الفصل الدراسي الأول"}/></FormField>
   <DatePickerField name="starts" label={en?"Start":"البداية"} required locale={locale} onValueChange={setStarts}/>
   <DatePickerField name="ends" label={en?"End":"النهاية"} required locale={locale} onValueChange={setEnds} error={reversed?(en?"The end date must be on or after the start date.":"يجب أن تكون نهاية الفصل في تاريخ البداية أو بعده."):undefined}/>
  </FieldGroup>
 </HoursForm>;
}
