"use client";
import {useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import {Eye,Check,X,RefreshCw} from "lucide-react";
import {DataTable,DataTableTitle} from "@/components/data-table";
import {RowAction} from "@/components/row-action";
import {ManagementActionSheet} from "@/components/management-action-sheet";
import {OrganizationStatusBadge} from "@/features/organizations/organization-status-badge";
import {WorkspaceEmptyState} from "@/components/workspace-empty-state";
import {toast} from "@/components/ui/toast";
import {useOptimisticRows} from "@/lib/optimistic-rows";
import {createTranslator} from "@/lib/i18n";
import {formatRiyadhDate,formatRiyadhTime} from "@/lib/datetime";
import {mutateHours} from "@/features/hours/actions";
import type {PersonalRenewals} from "./repository";
import type {Locale} from "@/lib/preferences";
export function PersonalRenewalsView({data,page,locale="ar"}:{data:PersonalRenewals;page:number;locale?:Locale}){
 const c=createTranslator(locale),router=useRouter(),[selected,setSelected]=useState<string|null>(null),[pending,start]=useTransition(),projection=useOptimisticRows(data.items.map(row=>({...row,id:row.response.id})),row=>row.id),detail=projection.items.find(row=>row.id===selected);
 const status=(value:string)=>value==="Renewed"?c("تم التجديد","Renewed"):value==="Declined"?c("اعتذار","Declined"):value==="No_Response"?c("لم يُرد","No response"):c("بانتظار ردك","Awaiting your response");
 function respond(id:string,decision:"Renewed"|"Declined"){start(async()=>{const undo=projection.change(id,row=>({...row,response:{...row.response,response_code:decision,canRespond:false}}));try{const form=new FormData();form.set("operation","respond");form.set("response",id);form.set("decision",decision);const result=await mutateHours({},form);if(result.error)throw new Error();setSelected(null);toast.add({title:c("تم حفظ ردك","Your response was saved"),type:"success",timeout:3000});router.refresh();}catch{undo();toast.add({title:c("تعذّر حفظ ردك. حاول مجددًا.","Your response could not be saved. Try again."),type:"error",timeout:0});}});}
 return <><DataTable tableKey="personalRenewals" locale={locale} items={projection.items.slice(0,25)} label={c("طلبات تجديد العضوية","Membership renewal invitations")} onOpen={row=>setSelected(row.id)} pagination={{page,more:data.items.length>25,onChange:value=>router.push(`/applications?tab=renewals&page=${value}`)}} empty={<WorkspaceEmptyState icon={RefreshCw} title={c("ما فيه حملات تجديد مفتوحة الحين","No open renewal campaigns right now")} description={c("ستظهر هنا عند فتح حملة تجديد من إحدى الجهات.","Renewal campaigns will appear here when an organization opens one.")}/>} columns={[
  {id:"name",label:c("الجهة","Organization"),render:row=><div className="min-w-0"><DataTableTitle>{row.campaign.org_name}</DataTableTitle><p className="text-sm text-muted-foreground">{row.campaign.name}</p></div>},
  {id:"status",label:c("الحالة","Status"),className:"w-36",render:row=><OrganizationStatusBadge status={row.response.response_code==="Renewed"?"accepted":row.response.response_code==="Pending"?"review":"inactive"}>{status(row.response.response_code)}</OrganizationStatusBadge>},
  {id:"date",label:c("التاريخ","Date"),className:"w-40",render:row=><><time>{formatRiyadhDate(row.response.responded_at??row.campaign.created_at,locale)}</time><p className="text-sm text-muted-foreground"><bdi>{formatRiyadhTime(row.response.responded_at??row.campaign.created_at,locale)}</bdi></p></>},
  {id:"actions",label:c("الإجراءات","Actions"),className:"w-36",render:row=><div className="flex items-center gap-1"><RowAction label={c("عرض التفاصيل","View details")} onClick={()=>setSelected(row.id)}><Eye/></RowAction><RowAction label={c("تجديد العضوية","Renew membership")} disabled={pending||!row.response.canRespond} hint={c("لا يمكن الرد بعد انتهاء الفترة أو تسجيل الرد","Responses are closed after the deadline or an existing response")} onClick={()=>respond(row.id,"Renewed")}><Check/></RowAction><RowAction danger label={c("الاعتذار عن التجديد","Decline renewal")} disabled={pending||!row.response.canRespond} hint={c("لا يمكن الرد بعد انتهاء الفترة أو تسجيل الرد","Responses are closed after the deadline or an existing response")} onClick={()=>respond(row.id,"Declined")}><X/></RowAction></div>}
 ]}/><ManagementActionSheet hideTrigger label="" title={detail?.campaign.org_name??c("طلب التجديد","Renewal invitation")} locale={locale} open={Boolean(selected)} onOpenChange={open=>{if(!open)setSelected(null);}}>{detail&&<div className="flex flex-col gap-3"><p>{detail.campaign.name}</p><p>{status(detail.response.response_code)}</p><p className="text-sm text-muted-foreground">{c("فترة الرد","Response period")}: {formatRiyadhDate(detail.campaign.opens_at,locale)} · {formatRiyadhDate(detail.campaign.closes_at,locale)}</p></div>}</ManagementActionSheet></>;
}
