"use client";
import {useEffect,useState} from "react";
import Image from "next/image";
import {WorkflowForm} from "@/features/forms/mutation-form";
import {DateInput} from "@/features/forms/date-input";
import {mutateEvent} from "./actions";
import {ApplicationForm} from "@/features/forms/application-form";
import type {Event} from "./repository";
import type {Locale} from "@/lib/preferences";
export function EventForm(props:Omit<Parameters<typeof WorkflowForm>[0],"mutation">){return <WorkflowForm {...props} mutation={mutateEvent}/>;}
export function EventRegistrationForm(props:Parameters<typeof ApplicationForm>[0]){return <ApplicationForm {...props} mutation={mutateEvent}/>;}
export function EventFields({value,templates=[],locale="ar",organization}:{value?:Event;templates?:Array<{id:string;name:string}>;locale?:Locale;organization:string}){
 const frozen=value?.status_code==="Published",en=locale==="en",c=(ar:string,english:string)=>en?english:ar;
 return <>
  <label>{c("عنوان الفعالية","Event title")}<input name="title" required minLength={2} maxLength={120} defaultValue={value?.title}/></label>
  <label>{c("الوصف","Description")}<textarea name="description" maxLength={6000} rows={4} defaultValue={value?.description}/></label>
  <EventPosterField organization={organization} current={Boolean(value?.has_poster)} locale={locale}/>
  <label>{c("طريقة الحضور","Attendance mode")}<select name="locationType" defaultValue={value?.location_type_code??"In_Person"}><option value="In_Person">{c("حضوري","In person")}</option><option value="Online">{c("عن بُعد","Online")}</option><option value="Hybrid">{c("حضوري وعن بُعد","Hybrid")}</option></select></label>
  <label>{c("المكان","Location")}<input name="location" maxLength={500} defaultValue={value?.location_text??""}/></label>
  <label>{c("رابط الحضور HTTPS","Attendance URL (HTTPS)")}<input name="url" type="url" dir="ltr" maxLength={2048} defaultValue={value?.online_url??""}/></label>
  <DateInput name="starts" label={c("بداية الفعالية","Event starts")} required value={value?.starts_at} locale={locale}/>
  <DateInput name="ends" label={c("نهاية الفعالية","Event ends")} required value={value?.ends_at} locale={locale}/>
  <DateInput name="opens" label={c("فتح التسجيل","Registration opens")} required value={value?.registration_opens_at} locale={locale}/>
  <DateInput name="closes" label={c("إغلاق التسجيل","Registration closes")} required value={value?.registration_closes_at} locale={locale}/>
  <label>{c("السعة (فارغة بلا حد)","Capacity (blank for unlimited)")}<input name="capacity" type="number" min={1} max={10000} defaultValue={value?.capacity??""}/></label>
  <label>{c("ساعات حضور أعضاء الجهة","Attendance hours for organization members")}<input name="hours" type="number" min={0} max={1000} step="0.01" required readOnly={frozen} defaultValue={value?.attendance_hours??"0"}/></label>
  {frozen?<input type="hidden" name="template" value={value.registration_form_template_id??""}/>:<label>{c("نموذج أسئلة إضافية","Additional questions form")}<select name="template" defaultValue={value?.registration_form_template_id??""}><option value="">{c("بدون أسئلة إضافية","No additional questions")}</option>{templates.map(t=><option key={t.id} value={t.id} dir="auto">{t.name}</option>)}</select></label>}
  <p className="text-sm leading-7 text-muted">{c("البوستر يظهر للزوار بعد نشر الفعالية. الموعد والمكان قابلان للتعديل مع إشعار المسجلين، وتثبت الساعات والنموذج عند النشر.","The poster becomes public when the event is published. Date and place can be changed with a notice to registrants; hours and the form are fixed on publication.")}</p>
 </>;
}

function EventPosterField({organization,current,locale}:{organization:string;current:boolean;locale:Locale}){
 const [asset,setAsset]=useState(""),[pending,setPending]=useState(false),[error,setError]=useState(""),[preview,setPreview]=useState("");
 const en=locale==="en",c=(ar:string,english:string)=>en?english:ar;
 useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview)},[preview]);
 async function upload(file?:File){
  if(!file)return;setPending(true);setError("");setAsset("");setPreview("");
  try{const body=new FormData();body.set("file",file);body.set("organization",organization);const response=await fetch("/files/upload?purpose=event-poster",{method:"POST",body});const result=await response.json() as {id?:string};if(!response.ok||!result.id)throw new Error();setAsset(result.id);setPreview(URL.createObjectURL(file));}
  catch{setError(c("تعذّر رفع البوستر. استخدم صورة JPEG أو PNG حتى 5 ميجابايت.","Upload failed. Use a JPEG or PNG image up to 5 MB."));}
  finally{setPending(false);}
 }
 return <section className="event-poster-upload" aria-label={c("بوستر الفعالية","Event poster")}>
  <input type="hidden" name="poster" value={asset}/>
  <div className="event-poster-upload-copy"><span className="workspace-section-icon"><span aria-hidden="true">▧</span></span><div><p className="font-semibold">{c("بوستر الفعالية","Event poster")}</p><p className="mt-1 text-sm leading-6 text-muted">{current&&!asset?c("يوجد بوستر حالي؛ اترك الحقل كما هو للاحتفاظ به.","A poster is already attached. Leave this empty to keep it."):c("صورة واضحة تُعرض كاملة في بطاقة الفعالية وصفحتها.","A clear image shown in event cards and on its detail page.")}</p></div></div>
  <label className="mt-4 block">{c("اختر صورة البوستر","Choose poster image")}<input type="file" accept="image/jpeg,image/png" disabled={pending} onChange={event=>void upload(event.target.files?.[0])}/></label>
  {pending&&<p role="status" className="mt-2 text-sm text-muted">{c("جارٍ رفع الصورة…","Uploading image…")}</p>}
  {error&&<p role="alert" className="error-message mt-3">{error}</p>}
  {preview&&<div className="event-poster-preview"><Image src={preview} alt={c("معاينة بوستر الفعالية","Event poster preview")} fill unoptimized sizes="(max-width: 767px) 100vw, 32rem" className="object-cover"/><span>{c("تم رفع البوستر وسيرتبط بالفعالية عند الحفظ.","Poster uploaded. It will be attached when you save the event.")}</span></div>}
 </section>;
}
export function EventAttachment({event,locale="ar"}:{event:string;locale?:Locale}){const [asset,setAsset]=useState("");const [pending,setPending]=useState(false);const [error,setError]=useState("");const en=locale==="en",c=(ar:string,english:string)=>en?english:ar;async function upload(file?:File){if(!file)return;setPending(true);setError("");setAsset("");try{const body=new FormData();body.set("file",file);const response=await fetch("/files/upload",{method:"POST",body});const result=await response.json() as {id?:string};if(!response.ok||!result.id)throw new Error();setAsset(result.id);}catch{setError(c("تعذّر رفع الملف. استخدم PDF أو JPEG أو PNG حتى 5 ميجابايت.","Upload failed. Use a PDF, JPEG or PNG up to 5 MB."));}finally{setPending(false);}}return <EventForm operation="attach" fields={{event,asset}} disabled={pending||!asset} label={c("حفظ مرفق الفعالية","Save event attachment")} locale={locale}><label>{c("نوع الملف","File type")}<select name="kind"><option value="Approval">{c("الموافقة الخارجية","External approval")}</option><option value="Attendance">{c("كشف الحضور","Attendance sheet")}</option><option value="Report">{c("التقرير الختامي","Final report")}</option><option value="Photo">{c("صورة","Photo")}</option></select></label><label>{c("الملف","File")}<input type="file" accept="application/pdf,image/jpeg,image/png" disabled={pending} onChange={e=>void upload(e.target.files?.[0])}/></label>{pending&&<p role="status">{c("جارٍ رفع الملف…","Uploading file…")}</p>}{error&&<p role="alert" className="error-message">{error}</p>}<p className="text-sm text-muted">{c("المرفقات خاصة بمشغّلي الفعالية.","Attachments are visible only to event staff.")}</p></EventForm>;}
