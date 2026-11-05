"use client";
import {useState,useTransition} from "react";
import {Check,X,Eye} from "lucide-react";
import {ItemTable,ItemTitle} from "@/components/item-table";
import {RowAction} from "@/components/row-action";
import {OrganizationLogo} from "@/components/organization-logo";
import {ContentText} from "@/components/content-text";
import {ManagementActionSheet} from "@/components/management-action-sheet";
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogAction,AlertDialogCancel} from "@/components/ui/alert-dialog";
import {Textarea} from "@/components/ui/textarea";
import {FormField} from "@/components/form-field";
import {toast} from "@/components/ui/toast";
import {RequestStatusBadge} from "@/features/forms/request-status-badge";
import {mutateOpeningRequest} from "@/features/organization-requests/actions";
import type {OpeningRequest} from "@/features/organization-requests/repository";
import {createTranslator} from "@/lib/i18n";
import {actionFeedback} from "@/lib/action-feedback";
import {formatRiyadhDateTime} from "@/lib/datetime";
import type {Locale} from "@/lib/preferences";
export function AdminOpeningRequests({items,locale,onChanged}:{items:OpeningRequest[];locale:Locale;onChanged:()=>void}){
 const t=createTranslator(locale),[selected,setSelected]=useState<OpeningRequest|null>(null),[decision,setDecision]=useState<{item:OpeningRequest;status:"Accepted"|"Rejected"}|null>(null),[note,setNote]=useState(""),[error,setError]=useState(""),[pending,start]=useTransition();
 const logo=(item:OpeningRequest)=><OrganizationLogo name={item.name_ar} src={item.has_logo?`/organization-requests/${item.id}/logo`:null} size="lg"/>;
 function decide(){if(!decision)return;start(async()=>{try{const f=new FormData();f.set("request",decision.item.id);f.set("operation",decision.status);f.set("note",note);const result=await mutateOpeningRequest({},f);if(result.error){setError(actionFeedback(result.error,locale)??result.error);return;}setDecision(null);setNote("");onChanged();toast.add({title:t("تم حفظ القرار","Decision saved"),type:"success"});}catch{setError(t("تعذّر حفظ القرار. حاول مجددًا.","Could not save the decision. Try again."));}});}
 return <><ItemTable compact tableKey="admin-requests" items={items} label={t("عرض تفاصيل الطلب","View request details")} locale={locale} onOpen={setSelected} columns={[
 {id:"name",label:t("الجهة","Organization"),render:row=><span className="flex min-w-0 items-center gap-3">{logo(row)}<ItemTitle><ContentText value={row.name_ar}/></ItemTitle></span>},
 {id:"type",label:t("النوع","Type"),render:row=>row.type_code==="Club"?t("نادي","Club"):t("مجلس","Council")},
 {id:"applicant",label:t("مقدم الطلب","Applicant"),render:row=><ContentText value={row.applicant_name??""}/>},
 {id:"date",label:t("تاريخ التقديم","Submitted on"),render:row=>formatRiyadhDateTime(row.created_at,locale)},
 {id:"state",label:t("الحالة","Status"),render:row=><RequestStatusBadge status={row.status_code} locale={locale}/>},
 {id:"actions",label:t("الإجراءات","Actions"),render:row=><div className="flex flex-nowrap items-center gap-1">{(["Accepted","Rejected"] as const).map(state=><RowAction key={state} label={state==="Accepted"?t("قبول","Accept"):t("رفض","Reject")} danger={state==="Rejected"} disabled={row.status_code!=="Pending"} hint={t("تم اتخاذ قرار في هذا الطلب","This request has already been decided")} onClick={()=>{setNote("");setError("");setDecision({item:row,status:state});}}>{state==="Accepted"?<Check/>:<X/>}</RowAction>)}<RowAction label={t("عرض التفاصيل","View details")} onClick={()=>setSelected(row)}><Eye/></RowAction></div>}
 ]}/>
 {selected&&<ManagementActionSheet label="" title={selected.name_ar} locale={locale} presentation="sheet" open hideTrigger onOpenChange={open=>{if(!open)setSelected(null);}}><div className="flex flex-col gap-5">{logo(selected)}<RequestStatusBadge status={selected.status_code} locale={locale}/><dl className="flex flex-col gap-4">{[[t("النوع","Type"),selected.type_code==="Club"?t("نادي","Club"):t("مجلس","Council")],[t("مقدم الطلب","Applicant"),selected.applicant_name??""],[t("تاريخ التقديم","Submitted on"),formatRiyadhDateTime(selected.created_at,locale)],[t("النبذة","About"),selected.summary],[t("الرسالة والأهداف","Mission and objectives"),selected.mission],[t("مجالات الاهتمام","Interests"),selected.interests.join("، ")]].map(([label,value])=><div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="whitespace-pre-wrap break-words"><ContentText value={value}/></dd></div>)}</dl></div></ManagementActionSheet>}
 <AlertDialog open={!!decision} onOpenChange={open=>{if(!open&&!pending)setDecision(null);}}><AlertDialogContent dir={locale==="ar"?"rtl":"ltr"}><AlertDialogHeader><AlertDialogTitle>{decision?.status==="Accepted"?t("قبول الطلب؟","Accept request?"):t("رفض الطلب؟","Reject request?")}</AlertDialogTitle><AlertDialogDescription>{decision?.status==="Accepted"?t("سيُنشئ القبول الجهة ويُعيّن مقدم الطلب قائدًا لها، مع الاحتفاظ بالطلب في قائمة المقبولة.","Acceptance creates the organization and appoints the applicant as its leader. The request remains in the accepted list."):t("سيُحفظ سبب الرفض ويظهر لمقدم الطلب.","The rejection reason will be saved and shown to the applicant.")}</AlertDialogDescription></AlertDialogHeader>{decision?.status==="Rejected"&&<FormField label={t("سبب الرفض","Rejection reason")} required><Textarea required value={note} maxLength={1000} onChange={event=>setNote(event.target.value)}/></FormField>}{error&&<p role="alert">{error}</p>}<AlertDialogFooter><AlertDialogAction disabled={pending||(decision?.status==="Rejected"&&!note.trim())} variant={decision?.status==="Rejected"?"danger-outline":"default"} onClick={event=>{event.preventDefault();decide();}}>{pending?t("جارٍ الحفظ…","Saving…"):t("تأكيد","Confirm")}</AlertDialogAction><AlertDialogCancel disabled={pending}>{t("إلغاء","Cancel")}</AlertDialogCancel></AlertDialogFooter></AlertDialogContent></AlertDialog></>;
}
