"use client";
import {createTranslator} from "@/lib/i18n";
import {useRouter} from "next/navigation";
import {useManagementAction} from "@/components/management-action-sheet";
import {Button} from "@/components/ui/button";
import {EventDraftPreview} from "./draft-preview";
import { NativeSelect } from "@/components/ui/native-select";
import {useId, useState, type ReactNode} from "react";
import {Switch} from "@/components/ui/switch";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {Separator} from "@/components/ui/separator";
import {FieldGroup} from "@/components/ui/field";
import {ValidatedField} from "@/components/validated-field";
import { FilePickerInput } from "@/components/file-picker-input";
import { EventPosterField } from "./event-poster-field";
import {WorkflowForm} from "@/features/forms/mutation-form";
import {DateRangeInput} from "@/features/forms/date-input";
import {mutateEvent} from "./actions";
import {ApplicationForm} from "@/features/forms/application-form";
import type {Event} from "./repository";
import type {Locale} from "@/lib/preferences";
import { FormField } from "@/components/form-field";
export function EventForm(props:Omit<Parameters<typeof WorkflowForm>[0],"mutation">){const router=useRouter();const action=useManagementAction();return <WorkflowForm {...props} mutation={mutateEvent} onSuccess={state=>{action?.close();props.onSuccess?.(state);if(props.operation==="duplicate"&&state.eventId&&props.fields?.org)router.push(`/manage/organizations/${props.fields.org}/events/${state.eventId}`);}}/>;}
export function EventCreateForm({organization,templates,locale}:{organization:string;templates:Array<{id:string;name:string}>;locale:Locale}){const router=useRouter();const c=createTranslator((locale==="en") ? "en" : "ar");return <EventForm operation="save" fields={{org:organization,publish:"on"}} label={c("نشر الآن","Publish now")} locale={locale} splitBody onSuccess={state=>{if(state.eventId)router.push(`/manage/organizations/${organization}/events/${state.eventId}`);}} secondaryAction={<><Button type="submit" name="intent" value="draft" variant="outline" formNoValidate>{c("حفظ المسودة","Save draft")}</Button><EventDraftPreview locale={locale}/></>}><EventFields organization={organization} templates={templates} locale={locale}/></EventForm>;}
export function EventRegistrationForm(props:Parameters<typeof ApplicationForm>[0]){return <ApplicationForm {...props} mutation={mutateEvent}/>;}
export function EventFields({value,templates=[],locale="ar",organization}:{value?:Event;templates?:Array<{id:string;name:string}>;locale?:Locale;organization:string}) {
 const frozen=value?.status_code==="Published",en=locale==="en",c=createTranslator(en ? "en" : "ar"),id=useId();
 const [mode,setMode]=useState(value?.location_type_code??"In_Person");
 const field=(key:string,label:string,control:ReactNode,required=false,hint?:string)=><ValidatedField id={`${id}-${key}`} label={label} required={required} hint={hint} locale={locale}>{control}</ValidatedField>;
 return <div className="event-fields">
  <section><Separator/><h3>{c("الأساسيات","Basics")}</h3><FieldGroup>
   {field("title",c("عنوان الفعالية","Event title"),<Input id={`${id}-title`} name="title" required minLength={2} maxLength={120} defaultValue={value?.title}/>,true)}
   {field("description",c("الوصف","Description"),<Textarea id={`${id}-description`} name="description" maxLength={6000} rows={3} defaultValue={value?.description}/>)}
   <EventPosterField organization={organization} locale={locale} event={value?.id} hasPoster={value?.has_poster}/>
  </FieldGroup></section>
  <section><Separator/><h3>{c("الوقت والمكان","Time and place")}</h3><FieldGroup>
   <DateRangeInput startName="starts" endName="ends" label={c("موعد الفعالية","Event dates")} startValue={value?.starts_at} endValue={value?.ends_at} required includeTime locale={locale}/>
   <div className="event-field-grid">
    {field("mode",c("طريقة الحضور","Attendance mode"),<NativeSelect id={`${id}-mode`} name="locationType" value={mode} onChange={event=>setMode(event.target.value)}><option value="In_Person">{c("حضوري","In person")}</option><option value="Online">{c("عن بُعد","Online")}</option><option value="Hybrid">{c("هجين","Hybrid")}</option></NativeSelect>)}
    {mode!=="Online"&&field("location",c("المكان","Location"),<Input id={`${id}-location`} name="location" required maxLength={500} defaultValue={value?.location_text??""}/>,true)}
    {mode!=="In_Person"&&<div className={mode==="Hybrid"?"event-field-full":""}>{field("url",c("رابط الاجتماع","Meeting link"),<Input id={`${id}-url`} name="url" type="url" required dir="ltr" className={en?"text-left":"text-right"} maxLength={2048} defaultValue={value?.online_url??""}/>,true)}</div>}
   </div>
  </FieldGroup></section>
  <section><Separator/><h3>{c("التسجيل","Registration")}</h3><FieldGroup>
   <DateRangeInput startName="opens" endName="closes" label={c("فترة التسجيل","Registration period")} startValue={value?.registration_opens_at} endValue={value?.registration_closes_at} required includeTime locale={locale}/>
   <div className="event-field-grid">
    {field("capacity",c("السعة","Capacity"),<Input id={`${id}-capacity`} name="capacity" type="number" min={1} max={10000} defaultValue={value?.capacity??""}/>,false,c("اتركها فارغة لعدد غير محدود","Leave blank for unlimited capacity"))}
    {frozen?<input type="hidden" name="template" value={value.registration_form_template_id??""}/>:field("template",c("نموذج الأسئلة","Questions form"),<NativeSelect id={`${id}-template`} className="event-template-select" name="template" defaultValue={value?.registration_form_template_id??""}><option value="">{c("بدون أسئلة إضافية","No additional questions")}</option>{templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</NativeSelect>)}
   </div>
  </FieldGroup></section>
  <FormField label={c("التسجيل يتطلب موافقة","Registration requires approval")} hint={c("عند إيقافه تُقبل التسجيلات الجديدة تلقائيًا. الحضور يُراجع بشكل منفصل.","When off, new registrations are accepted automatically. Attendance is reviewed separately.")}><input type="hidden" name="approval-present" value="on"/><Switch name="approval" value="on" defaultChecked={value?.requires_approval??false} aria-label={c("التسجيل يتطلب موافقة","Registration requires approval")}/></FormField>
  <section><Separator/><h3>{c("الساعات","Hours")}</h3>{field("hours",c("ساعات حضور أعضاء الجهة","Attendance hours for organization members"),<Input id={`${id}-hours`} name="hours" type="number" min={0} max={1000} step="0.01" required readOnly={frozen} defaultValue={value?.attendance_hours??"0"}/>,true)}</section>
 </div>;
}

export function EventAttachment({event,locale="ar"}:{event:string;locale?:Locale}){const [asset,setAsset]=useState("");const [pending,setPending]=useState(false);const [error,setError]=useState("");const en=locale==="en",c=createTranslator(en ? "en" : "ar");async function upload(file?:File){if(!file)return;setPending(true);setError("");setAsset("");try{const body=new FormData();body.set("file",file);const response=await fetch("/files/upload",{method:"POST",body});const result=await response.json() as {id?:string};if(!response.ok||!result.id)throw new Error();setAsset(result.id);}catch{setError(c("تعذّر رفع الملف. استخدم PDF أو JPEG أو PNG حتى 5 ميجابايت.","Upload failed. Use a PDF, JPEG or PNG up to 5 MB."));}finally{setPending(false);}}return <EventForm operation="attach" fields={{event,asset}} disabled={pending||!asset} label={c("حفظ مرفق الفعالية","Save event attachment")} locale={locale}><FormField  label={<>{c("نوع الملف","File type")}</>}><NativeSelect name="kind"><option value="Approval">{c("الموافقة الخارجية","External approval")}</option><option value="Attendance">{c("كشف الحضور","Attendance sheet")}</option><option value="Report">{c("التقرير الختامي","Final report")}</option><option value="Photo">{c("صورة","Photo")}</option></NativeSelect></FormField><div className="grid gap-2"><span className="text-sm font-medium">{c("الملف","File")}</span><FilePickerInput accept="application/pdf,image/jpeg,image/png" disabled={pending} locale={locale} ariaLabel={c("مرفق الفعالية","Event attachment")} onChange={e=>void upload(e.target.files?.[0])}/></div>{pending&&<p role="status">{c("جارٍ رفع الملف…","Uploading file…")}</p>}{error&&<p role="alert" className="error-message">{error}</p>}</EventForm>;}
