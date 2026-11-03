"use client";
import {SearchFilterToolbar} from "@/components/search-filter-toolbar";
import {EventFilter} from "./event-filter";
import {createTranslator} from "@/lib/i18n";
import {arabicSearchKey} from "@/features/talent/skill-normalization";
import {Search} from "lucide-react";
import {InputGroup,InputGroupInput,InputGroupAddon} from "@/components/ui/input-group";

import {FilterTabs} from "@/components/ui/filter-tabs";
import {Button} from "@/components/ui/button";
import {ListEmpty} from "@/components/list-empty";
import {UsersRound} from "lucide-react";
import {EventRegistrationReview} from "./registration-review";
import type {OrganizationEventsSnapshot} from "./management-cache";
import type {Locale} from "@/lib/preferences";
export function EventRegistrantBrowser({data,search,locale,onChange,organization,serverPaged=false}:{organization?:string;serverPaged?:boolean;data:OrganizationEventsSnapshot["registrations"];search:Record<string,string|undefined>;locale:Locale;onChange:(values:Record<string,string|null>,replace?:boolean)=>void}){
 const c=createTranslator(locale),q=(search.q??"").slice(0,120),event=data.options.some(e=>e.id===search.eventFilter)?search.eventFilter??"":"",status=["Pending","Accepted","Rejected"].find(s=>s===search.review)??"";
 const base=data.items.filter(r=>(!event||r.event_id===event)&&arabicSearchKey(r.name).includes(arabicSearchKey(q))),rows=base.filter(r=>!status||r.review_status_code===status),page=serverPaged?Math.max(0,Math.floor(Number(search.registrationPage)||0)):Math.min(Math.max(0,Math.floor((rows.length-1)/25)),Math.max(0,Math.floor(Number(search.registrationPage)||0)));
 const filter=(values:Record<string,string|null>,replace=false)=>onChange({...values,registrationPage:null},replace);
 return <section className="flex min-w-0 flex-col gap-4" aria-label={c("المسجلون في الفعاليات","Event registrants")}>
 <form onSubmit={e=>e.preventDefault()} className="min-w-0"><SearchFilterToolbar search={<InputGroup><InputGroupAddon><Search/></InputGroupAddon><InputGroupInput name="q" type="search" value={q} onChange={e=>filter({q:e.target.value},true)} maxLength={120} placeholder={c("ابحث باسم الطالب","Search student name")} aria-label={c("البحث باسم الطالب","Search by student name")}/></InputGroup>}><EventFilter options={data.options} value={event} onChange={value=>filter({eventFilter:value})} locale={locale}/>
 <FilterTabs value={status||"all"} ariaLabel={c("تصفية تسجيلات الفعاليات","Filter event registrations")} dir={locale==="ar"?"rtl":"ltr"} size="sm" activeTone="primary" options={[{value:"all",label:c("الكل","All")},{value:"Pending",label:c("بانتظار","Pending")},{value:"Accepted",label:c("مقبول","Accepted")},{value:"Rejected",label:c("مرفوض","Rejected")}].map(o=>({...o,count:serverPaged?(o.value==="all"?data.pending+data.accepted+data.rejected:o.value==="Pending"?data.pending:o.value==="Accepted"?data.accepted:data.rejected):base.filter(r=>o.value==="all"||r.review_status_code===o.value).length||undefined}))} onValueChange={value=>filter({review:value==="all"?null:value})}/>
 </SearchFilterToolbar></form>
 {rows.length?<EventRegistrationReview organization={organization} items={serverPaged?rows.slice(0,25):rows.slice(page*25,page*25+25)} locale={locale}/>:<ListEmpty filtered={Boolean(q||event||status)} clear={()=>filter({q:null,eventFilter:null,review:null})} icon={UsersRound} title={c("لا يوجد مسجلون بعد","No registrations yet")} description={c("تظهر التسجيلات بعد فتح التسجيل للفعاليات.","Registrations appear when event registration opens.")}/>}
 {(page>0||rows.length>(serverPaged?25:(page+1)*25))&&<nav className="flex gap-4">{page>0&&<Button variant="link" onClick={()=>onChange({registrationPage:String(page-1)})}>{c("السابق","Previous")}</Button>}{rows.length>(serverPaged?25:(page+1)*25)&&<Button variant="link" onClick={()=>onChange({registrationPage:String(page+1)})}>{c("التالي","Next")}</Button>}</nav>}
 </section>;
}
