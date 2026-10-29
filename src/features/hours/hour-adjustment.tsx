"use client";
import {NumberText} from "@/components/number-text";
import {createTranslator} from "@/lib/i18n";
import {useState} from "react";
import {Field,FieldLabel,FieldDescription,FieldError,FieldGroup} from "@/components/ui/field";
import {InputGroup,InputGroupInput,InputGroupAddon,InputGroupText} from "@/components/ui/input-group";
import {Textarea} from "@/components/ui/textarea";
import {ToggleGroup,ToggleGroupItem} from "@/components/ui/toggle-group";
import {Alert,AlertDescription} from "@/components/ui/alert";
import {HoursForm} from "./form";
import type {HourRecord} from "./repository";
import type {Locale} from "@/lib/preferences";
import { FormField } from "@/components/form-field";

export function HourAdjustment({record,locale,onSuccess}:{record:HourRecord;locale:Locale;onSuccess:()=>void}) {
 const [direction,setDirection]=useState("increase"),[amount,setAmount]=useState(""),[note,setNote]=useState("");
 const en=locale==="en",c=createTranslator(en ? "en" : "ar");
 const numeric=Number(amount),delta=numeric*(direction==="increase"?1:-1),next=Math.round((Number(record.hours)+delta)*100)/100;
 const valid=!!amount&&/^\d+(?:\.\d{1,2})?$/.test(amount)&&numeric>0&&Number.isFinite(next)&&next>=0&&next<=1000;
 const invalid=!!amount&&!valid;
 return <HoursForm operation="adjust" fields={{record:record.id,expected:record.hours,delta:valid?String(delta):"0",note}} label={c("حفظ التعديل","Save adjustment")} locale={locale} disabled={!valid} onSuccess={onSuccess}>
  <FieldGroup className="hour-adjustment-fields">
   <Field><FieldLabel>{c("نوع التعديل","Adjustment")}</FieldLabel><ToggleGroup multiple={false} variant="outline" value={[direction]} onValueChange={values=>{if(values[0])setDirection(values[0]);}} className="hours-adjust-direction"><ToggleGroupItem value="increase">{c("زيادة","Increase")}</ToggleGroupItem><ToggleGroupItem value="decrease">{c("نقص","Decrease")}</ToggleGroupItem></ToggleGroup></Field>
   <Field data-invalid={invalid||undefined}><FieldLabel htmlFor={`hour-amount-${record.id}`}>{c("عدد الساعات","Hours")}</FieldLabel><InputGroup><InputGroupInput id={`hour-amount-${record.id}`} type="number" inputMode="decimal" min="0.01" max={direction==="decrease"?record.hours:1000-Number(record.hours)} step="0.01" required value={amount} aria-invalid={invalid} onChange={event=>setAmount(event.target.value)}/><InputGroupAddon align="inline-end"><InputGroupText>{c("ساعة","hours")}</InputGroupText></InputGroupAddon></InputGroup>{invalid&&<FieldError role="alert">{next<0?c("لا يمكن نقص أكثر من ساعات السجل أو النزول عن صفر.","Hours cannot be reduced below zero."):c("أدخل عددًا صالحًا ضمن الحد المتاح.","Enter a valid amount within the available range.")}</FieldError>}</Field>
   <FormField  id={`hour-note-${record.id}`} label={<>{c("سبب التعديل","Adjustment reason")} <span className="font-normal text-muted-foreground">{c("(اختياري)","(optional)")}</span></>}><Textarea id={`hour-note-${record.id}`} rows={2} maxLength={1000} value={note} onChange={event=>setNote(event.target.value)}/><FieldDescription><bdi><NumberText value={note.length}/> / 1000</bdi></FieldDescription></FormField>
   {valid&&<Alert className="hour-adjustment-preview" role="status"><AlertDescription><bdi dir="ltr"><NumberText value={Number(record.hours)}/> ← <NumberText value={next}/></bdi> {c("ساعة","hours")}</AlertDescription></Alert>}
  </FieldGroup>
 </HoursForm>;
}
