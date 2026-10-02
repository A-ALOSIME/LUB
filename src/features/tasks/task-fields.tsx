import {DateInput} from "@/features/forms/date-input";
import type {Task,TaskTemplate} from "./repository";
import type {Locale} from "@/lib/preferences";
export function TaskFields({value,template=false,locale="ar"}:{value?:Partial<Task & TaskTemplate>;template?:boolean;locale?:Locale}){
 const en=locale==="en",c=(ar:string,english:string)=>en?english:ar;
 return <><label>{c("العنوان","Title")}<input name="title" required minLength={2} maxLength={120} defaultValue={value?.title??value?.name??""}/></label>
 <label>{c("وصف العمل والمخرج المطلوب","Work description and expected deliverable")}<textarea name="description" required maxLength={6000} rows={5} defaultValue={value?.description??value?.description_template??""}/></label>
 <label>{c("الساعات المقترحة","Suggested hours")}<input name="hours" type="number" min={0} max={1000} step="0.01" required defaultValue={value?.default_hours??"0"}/></label>
 <p className="text-sm leading-7 text-muted">{c("الساعات تثبت على نسخة التسليم. الاعتماد ينشئ سجلًا للفصل الأكاديمي، ويحتاج صلاحية اعتماد الساعات لإضافته للرصيد.","Hours are fixed for each submission version. Approval creates a term record; adding it to the balance requires hours approval permission.")}</p>
 {template?<label className="flex items-center gap-3"><input name="active" type="checkbox" defaultChecked={value?.is_active??true} className="size-5"/>{c("قالب نشط","Active template")}</label>:<div className="grid gap-4 sm:grid-cols-2"><DateInput name="starts" label={c("بداية الانضمام (اختياري)","Joining starts (optional)")} value={value?.starts_at??undefined} locale={locale}/><DateInput name="due" label={c("موعد التسليم (اختياري)","Due date (optional)")} value={value?.due_at??undefined} locale={locale}/></div>}</>;
}
