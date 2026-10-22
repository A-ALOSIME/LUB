"use client";
import { NativeSelect } from "@/components/ui/native-select";
import {useState} from "react";
import { FilePickerInput } from "@/components/file-picker-input";
import { EventPosterField } from "./event-poster-field";
import {WorkflowForm} from "@/features/forms/mutation-form";
import {DateRangeInput} from "@/features/forms/date-input";
import {mutateEvent} from "./actions";
import {ApplicationForm} from "@/features/forms/application-form";
import type {Event} from "./repository";
import type {Locale} from "@/lib/preferences";
export function EventForm(props:Omit<Parameters<typeof WorkflowForm>[0],"mutation">){return <WorkflowForm {...props} mutation={mutateEvent}/>;}
export function EventRegistrationForm(props:Parameters<typeof ApplicationForm>[0]){return <ApplicationForm {...props} mutation={mutateEvent}/>;}
export function EventFields({value,templates=[],locale="ar",organization}:{value?:Event;templates?:Array<{id:string;name:string}>;locale?:Locale;organization:string}){
 const frozen=value?.status_code==="Published",en=locale==="en",c=(ar:string,english:string)=>en?english:ar;
 const [mode,setMode]=useState(value?.location_type_code??"In_Person");
 return <>
  <section className="grid gap-3"><h3 className="text-sm font-semibold">{c("الأساسيات","Basics")}</h3>
  <label>{c("عنوان الفعالية","Event title")}<input name="title" required minLength={2} maxLength={120} defaultValue={value?.title}/></label>
  <label>{c("الوصف","Description")}<textarea name="description" maxLength={6000} rows={4} defaultValue={value?.description}/></label>
  <EventPosterField organization={organization} locale={locale}/>
  </section>
  <section className="grid gap-3"><h3 className="text-sm font-semibold">{c("الوقت والمكان","Time and place")}</h3>
  <DateRangeInput startName="starts" endName="ends" label={c("موعد الفعالية","Event dates")} startValue={value?.starts_at} endValue={value?.ends_at} required includeTime locale={locale}/>
  <label>{c("طريقة الحضور","Attendance mode")}<NativeSelect name="locationType" value={mode} onChange={event=>setMode(event.target.value)}><option value="In_Person">{c("حضوري","In person")}</option><option value="Online">{c("عن بُعد","Online")}</option><option value="Hybrid">{c("حضوري وعن بُعد","Hybrid")}</option></NativeSelect></label>
  {(mode==="In_Person"||mode==="Hybrid")&&<label>{c("المكان","Location")}<input name="location" required maxLength={500} defaultValue={value?.location_text??""}/></label>}
  {(mode==="Online"||mode==="Hybrid")&&<label>{c("رابط الحضور HTTPS","Attendance URL (HTTPS)")}<input name="url" type="url" required dir="ltr" maxLength={2048} defaultValue={value?.online_url??""}/></label>}
  </section>
  <section className="grid gap-3"><h3 className="text-sm font-semibold">{c("التسجيل","Registration")}</h3>
  <DateRangeInput startName="opens" endName="closes" label={c("فترة التسجيل","Registration period")} startValue={value?.registration_opens_at} endValue={value?.registration_closes_at} required includeTime locale={locale}/>
  <label>{c("السعة (فارغة بلا حد)","Capacity (blank for unlimited)")}<input name="capacity" type="number" min={1} max={10000} defaultValue={value?.capacity??""}/></label>
  {frozen?<input type="hidden" name="template" value={value.registration_form_template_id??""}/>:<label>{c("نموذج أسئلة إضافية","Additional questions form")}<NativeSelect name="template" defaultValue={value?.registration_form_template_id??""}><option value="">{c("بدون أسئلة إضافية","No additional questions")}</option>{templates.map(t=><option key={t.id} value={t.id} dir="auto">{t.name}</option>)}</NativeSelect></label>}
  </section>
  <section className="grid gap-3"><h3 className="text-sm font-semibold">{c("الساعات","Hours")}</h3>
  <label>{c("ساعات حضور أعضاء الجهة","Attendance hours for organization members")}<input name="hours" type="number" min={0} max={1000} step="0.01" required readOnly={frozen} defaultValue={value?.attendance_hours??"0"}/></label>
  </section>
 </>;
}

export function EventAttachment({event,locale="ar"}:{event:string;locale?:Locale}){const [asset,setAsset]=useState("");const [pending,setPending]=useState(false);const [error,setError]=useState("");const en=locale==="en",c=(ar:string,english:string)=>en?english:ar;async function upload(file?:File){if(!file)return;setPending(true);setError("");setAsset("");try{const body=new FormData();body.set("file",file);const response=await fetch("/files/upload",{method:"POST",body});const result=await response.json() as {id?:string};if(!response.ok||!result.id)throw new Error();setAsset(result.id);}catch{setError(c("تعذّر رفع الملف. استخدم PDF أو JPEG أو PNG حتى 5 ميجابايت.","Upload failed. Use a PDF, JPEG or PNG up to 5 MB."));}finally{setPending(false);}}return <EventForm operation="attach" fields={{event,asset}} disabled={pending||!asset} label={c("حفظ مرفق الفعالية","Save event attachment")} locale={locale}><label>{c("نوع الملف","File type")}<NativeSelect name="kind"><option value="Approval">{c("الموافقة الخارجية","External approval")}</option><option value="Attendance">{c("كشف الحضور","Attendance sheet")}</option><option value="Report">{c("التقرير الختامي","Final report")}</option><option value="Photo">{c("صورة","Photo")}</option></NativeSelect></label><div className="grid gap-2"><span className="text-sm font-medium">{c("الملف","File")}</span><FilePickerInput accept="application/pdf,image/jpeg,image/png" disabled={pending} locale={locale} ariaLabel={c("مرفق الفعالية","Event attachment")} onChange={e=>void upload(e.target.files?.[0])}/></div>{pending&&<p role="status">{c("جارٍ رفع الملف…","Uploading file…")}</p>}{error&&<p role="alert" className="error-message">{error}</p>}</EventForm>;}
