"use client";
import {ContentText} from "@/components/content-text";
import {createTranslator} from "@/lib/i18n";
import {arabicSearchKey} from "@/features/talent/skill-normalization";
import {Search} from "lucide-react";
import {InputGroup,InputGroupInput,InputGroupAddon} from "@/components/ui/input-group";
import {NativeSelect} from "@/components/ui/native-select";
import {FilterTabs} from "@/components/ui/filter-tabs";
import {Button} from "@/components/ui/button";
import {EventRegistrationReview} from "./registration-review";
import type {OrganizationEventsSnapshot} from "./management-cache";
import type {Locale} from "@/lib/preferences";
export function EventRegistrantBrowser({data,search,locale,onChange}:{data:OrganizationEventsSnapshot["registrations"];search:Record<string,string|undefined>;locale:Locale;onChange:(values:Record<string,string|null>,replace?:boolean)=>void}){
 const c=createTranslator(locale),q=(search.q??"").slice(0,120),event=data.options.some(e=>e.id===search.eventFilter)?search.eventFilter??"":"",status=["Pending","Accepted","Rejected"].find(s=>s===search.review)??"";
 const base=data.items.filter(r=>(!event||r.event_id===event)&&arabicSearchKey(r.name).includes(arabicSearchKey(q))),rows=base.filter(r=>!status||r.review_status_code===status),page=Math.min(Math.max(0,Math.floor((rows.length-1)/25)),Math.max(0,Math.floor(Number(search.registrationPage)||0)));
 const filter=(values:Record<string,string|null>,replace=false)=>onChange({...values,registrationPage:null},replace);
 return <section className="flex min-w-0 flex-col gap-4" aria-label={c("المسجلون في الفعاليات","Event registrants")}>
 <form onSubmit={e=>e.preventDefault()} className="flex flex-wrap items-center gap-3"><InputGroup className="min-w-48 flex-1"><InputGroupAddon><Search/></InputGroupAddon><InputGroupInput name="q" type="search" value={q} onChange={e=>filter({q:e.target.value},true)} maxLength={120} placeholder={c("ابحث باسم الطالب","Search student name")} aria-label={c("البحث باسم الطالب","Search by student name")}/></InputGroup><NativeSelect name="eventFilter" value={event} onChange={e=>filter({eventFilter:e.target.value})} aria-label={c("الفعالية","Event")}><option value="">{c("كل الفعاليات","All events")}</option>{data.options.map(e=><option key={e.id} value={e.id}><ContentText value={e.title}/></option>)}</NativeSelect></form>
 <FilterTabs value={status||"all"} ariaLabel={c("تصفية تسجيلات الفعاليات","Filter event registrations")} dir={locale==="ar"?"rtl":"ltr"} size="sm" activeTone="primary" options={[{value:"all",label:c("الكل","All")},{value:"Pending",label:c("بانتظار","Pending")},{value:"Accepted",label:c("مقبول","Accepted")},{value:"Rejected",label:c("مرفوض","Rejected")}].map(o=>({...o,count:base.filter(r=>o.value==="all"||r.review_status_code===o.value).length||undefined}))} onValueChange={value=>filter({review:value==="all"?null:value})}/>
 <EventRegistrationReview items={rows.slice(page*25,page*25+25)} locale={locale}/>
 {(page>0||rows.length>(page+1)*25)&&<nav className="flex gap-4">{page>0&&<Button variant="link" onClick={()=>onChange({registrationPage:String(page-1)})}>{c("السابق","Previous")}</Button>}{rows.length>(page+1)*25&&<Button variant="link" onClick={()=>onChange({registrationPage:String(page+1)})}>{c("التالي","Next")}</Button>}</nav>}
 </section>;
}
