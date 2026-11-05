"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {useQuery,useQueryClient,queryOptions} from "@tanstack/react-query";
import {MicVocal,Presentation,HandHelping} from "lucide-react";
import {useQueryActor} from "@/components/private-query-provider";
import {privateJson} from "@/lib/private-query";
import {ManagementActionSheet} from "@/components/management-action-sheet";
import {RowAction} from "@/components/row-action";
import {ContentText} from "@/components/content-text";

import {Textarea} from "@/components/ui/textarea";

import {FormField} from "@/components/form-field";
import {RequestReviewTable,type ReviewDecision} from "@/features/forms/request-review-table";
import {RequestStatusBadge} from "@/features/forms/request-status-badge";
import {formatRiyadhDateTime} from "@/lib/datetime";

import {createTranslator} from "@/lib/i18n";
import {EventForm} from "./form";
import {RemoveEventRegistration} from "./remove-registration";
import {mutateEvent} from "./actions";
import type {EventRegistrant} from "./review-repository";
import type {Locale} from "@/lib/preferences";
export function EventRegistrationReview({items,locale,organization,pagination}:{pagination?:import("@/components/data-table").DataTablePagination;organization?:string;items:EventRegistrant[];locale:Locale}){
 const [selected,setSelected]=useState<string|null>(null),[contribution,setContribution]=useState<{row:EventRegistrant;kind:string}|null>(null),router=useRouter(),c=createTranslator(locale),actor=useQueryActor(),client=useQueryClient();
 const options=(id:string|null)=>queryOptions({queryKey:["event-registrant",actor,organization,id],queryFn:({signal})=>privateJson<EventRegistrant>(`/api/organizations/${organization}/registrants/${id}`,signal)});
 const result=useQuery({...options(selected),enabled:!!selected&&!!organization}),detail=result.data??items.find(row=>row.id===selected);
 const changed=()=>{void client.invalidateQueries({queryKey:["event-registrant",actor,organization]});setSelected(null);setContribution(null);window.dispatchEvent(new CustomEvent("organization-events-changed",{detail:{organization}}));window.dispatchEvent(new Event("activity-changed"));router.refresh();};
 async function decide(ids:string[],status:ReviewDecision,message:string){const form=new FormData();form.set("operation","review");form.set("status",status);form.set("message",message);form.set("confirm","on");if(organization)form.set("org",organization);ids.forEach(id=>form.append("selected",id));const result=await mutateEvent({},form);if(result.success)changed();return result;}
 const kinds=[{kind:"Presenter",label:c("مقدم","Presenter"),Icon:MicVocal},{kind:"Trainer",label:c("مدرب","Trainer"),Icon:Presentation},{kind:"Core_Contributor",label:c("مساهم أساسي","Core contributor"),Icon:HandHelping}];
 const contributionActions=(row:EventRegistrant)=><div className="flex flex-wrap items-center gap-1"><span role="separator" aria-orientation="vertical" className="mx-1 h-5 border-s border-border"/>{kinds.map(({kind,label,Icon})=><RowAction key={kind} label={c("إثبات مساهمة: ","Record contribution: ")+label} disabled={!row.canContribute||row.review_status_code!=="Accepted"||row.has_contribution} hint={!row.canContribute?c("تحتاج صلاحية إثبات المساهمات","Contribution verification permission is required"):c("يجب قبول التسجيل قبل إثبات المساهمة","Accept the registration before recording a contribution")} onClick={()=>{setSelected(null);setContribution({row,kind});}}><Icon/></RowAction>)}<RemoveEventRegistration organization={organization} id={row.id} name={row.name} allowed={row.canReview} locale={locale} onSuccess={changed}/></div>;
 return <><RequestReviewTable pagination={pagination} locale={locale} actionsClassName="w-80" decisionSlots={["Accepted","Rejected"]} rows={items.slice(0,25).map(row=>({id:row.id,name:row.name,subtitle:"",status:row.has_contribution&&row.review_status_code==="Accepted"?"Recorded":row.review_status_code,createdAt:row.created_at,selectable:row.canReview&&row.review_status_code==="Pending",decisions:row.canReview?(row.review_status_code==="Pending"?["Accepted","Rejected"]:[]):[],completedDecisions:row.review_status_code==="Accepted"?["Accepted"]:[],extraAction:contributionActions(row)}))} onOpen={setSelected} onPrefetch={id=>{if(organization)void client.prefetchQuery(options(id));}} onDecision={decide} bulkDecisions={items.some(row=>row.canReview)?["Accepted","Rejected"]:[]}>
 {()=> <ManagementActionSheet label="" hideTrigger title={detail?.name??c("تفاصيل التسجيل","Registration details")} locale={locale} open={Boolean(selected)} onOpenChange={open=>{if(!open)setSelected(null);}}>
  {detail&&<div className="flex flex-col gap-5"><p className="text-sm text-muted-foreground"><ContentText value={detail.title}/> · {formatRiyadhDateTime(detail.created_at,locale)}</p>
  {result.isError&&<p role="alert">{c("تعذّر تحديث التفاصيل. أغلق النافذة وحاول مجددًا.","Details could not be refreshed. Close and try again.")}</p>}
  <dl className="space-y-5">{detail.definition?.sections.flatMap(section=>section.fields).filter(field=>detail.answers?.[field.id]!==undefined).map(field=><div key={field.id}><dt className="text-sm text-muted-foreground"><ContentText value={field.label}/></dt><dd className="mt-1 whitespace-pre-wrap break-words">{field.type==="File"?<a className="text-primary" href={`/files/${detail.answers?.[field.id]}`} target="_blank" rel="noopener noreferrer">{c("تنزيل المرفق","Download attachment")}</a>:field.options.length?(Array.isArray(detail.answers?.[field.id])?detail.answers![field.id] as string[]:[String(detail.answers?.[field.id])]).map(value=>field.options.find(option=>option.value===value)?.label??value).join("، "):String(detail.answers?.[field.id])}</dd></div>)}</dl>
  {!detail.definition&&<p className="text-sm text-muted-foreground">{c("لا توجد أسئلة إضافية لهذا التسجيل.","No additional registration questions.")}</p>}
  {detail.review_note&&<section><h3 className="text-sm text-muted-foreground">{c("سبب القرار — يظهر للطالب","Decision reason — visible to the student")}</h3><p className="whitespace-pre-wrap">{detail.review_note}</p></section>}
  {!!detail.contributions?.length&&<section><h3 className="mb-2 font-medium">{c("المساهمات المرصودة","Recorded contributions")}</h3>{detail.contributions.map(item=><p key={item.kind}>{kinds.find(kind=>kind.kind===item.kind)?.label} · {item.title}</p>)}</section>}
  <section><h3 className="mb-3 font-medium">{c("سجل الطلب","Request history")}</h3><ol className="space-y-4 border-s border-border ps-4">{[...detail.history].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)).map((event,index)=><li key={index} className="relative"><span className="absolute -start-5 top-2 size-2 rounded-full bg-muted-foreground"/><RequestStatusBadge status={event.status_code} locale={locale}/><p className="text-sm text-muted-foreground">{formatRiyadhDateTime(event.created_at,locale)}</p>{event.reason&&<p className="whitespace-pre-wrap">{event.reason}</p>}</li>)}</ol></section>
</div>}
 </ManagementActionSheet>}
 </RequestReviewTable>
 <ManagementActionSheet hideTrigger label="" title={c("إثبات المساهمة","Record contribution")} locale={locale} open={Boolean(contribution)} onOpenChange={open=>{if(!open)setContribution(null);}}>{contribution&&<EventForm operation="contribution" fields={{registration:contribution.row.id,kind:contribution.kind,...(organization?{org:organization}:{})}} label={c("إثبات المساهمة","Record contribution")} locale={locale} onSuccess={changed}><p>{contribution.row.name} · {kinds.find(kind=>kind.kind===contribution.kind)?.label}</p><FormField label={c("وصف المساهمة","Contribution description")} required><Textarea name="title" required minLength={2} maxLength={120} defaultValue={contribution.row.contributions?.find(item=>item.kind===contribution.kind)?.title??""}/></FormField></EventForm>}</ManagementActionSheet>
 </>;
}
