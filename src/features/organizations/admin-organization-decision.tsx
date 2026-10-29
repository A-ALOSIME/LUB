"use client";
import {createTranslator} from "@/lib/i18n";
import {startTransition,useActionState,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {ManagementActionSheet} from "@/components/management-action-sheet";
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogAction,AlertDialogCancel} from "@/components/ui/alert-dialog";
import {Alert,AlertDescription} from "@/components/ui/alert";
import {Button} from "@/components/ui/button";
import {useActionToast} from "@/components/action-toast";
import {actionFeedback} from "@/lib/action-feedback";
import {mutateOrganization} from "./actions";
import type {MutationState} from "./validation";
import {LeaderEmailSearch} from "./leader-email-search";
import type {AdminOrganizationIdentity} from "./management-repository";
import type {Locale} from "@/lib/preferences";
export function AdminOrganizationDecision({organization,kind,locale,onClose}:{organization:AdminOrganizationIdentity;kind:"leader"|"status"|"remove-leader"|"archive";locale:Locale;onClose:()=>void}) {
 const en=locale==="en",c=createTranslator(en ? "en" : "ar"),router=useRouter(),form=useRef<HTMLFormElement>(null);
 const [submission,setSubmission]=useState<FormData|null>(null),direct=kind!=="leader";
 const [confirm,setConfirm]=useState(direct);
 const title=kind==="archive"?c(`أرشفة ${organization.nameAr}؟`,`Archive ${organization.nameAr}?`):kind==="leader"?c(`تعيين قائد ${organization.nameAr}`,`Assign ${organization.nameAr} leader`):kind==="remove-leader"?c(`حذف قائد ${organization.nameAr}؟`,`Remove ${organization.nameAr} leader?`):organization.statusCode==="Active"?c(`إيقاف ${organization.nameAr}؟`,`Deactivate ${organization.nameAr}?`):c(`تفعيل ${organization.nameAr}؟`,`Activate ${organization.nameAr}?`);
 const [state,action,pending]=useActionState<MutationState,FormData>(async(previous,data)=>{const result=await mutateOrganization(previous,data);if(result.success){onClose();router.refresh();}return result;},{});
 useActionToast(state,locale);
 function execute(){const data=submission??new FormData();data.set("operation",kind==="leader"?"appoint-leader":kind==="remove-leader"?"remove-leader":"org-status");data.set("organizationId",organization.id);data.set("confirmed","on");if(kind==="archive")data.set("status","Archived");if(kind==="status")data.set("status",organization.statusCode==="Active"?"Inactive":"Active");startTransition(()=>action(data));}
 return <>
  {!direct&&<ManagementActionSheet label="" title={title} hideTrigger open locale={locale} onOpenChange={open=>{if(!open&&!pending)onClose();}}>
   <form ref={form} className="flex flex-col gap-5" onSubmit={event=>{event.preventDefault();setSubmission(new FormData(event.currentTarget));setConfirm(true);}}>
    <LeaderEmailSearch locale={locale} required/>
    <div className="management-action-footer"><Button type="submit">{c("تعيين القائد","Assign leader")}</Button><Button variant="ghost" onClick={onClose}>{c("إلغاء","Cancel")}</Button></div>
   </form>
  </ManagementActionSheet>}
  <AlertDialog open={confirm} onOpenChange={open=>{if(!pending){setConfirm(open);if(!open&&direct)onClose();}}}>
   <AlertDialogContent dir={en?"ltr":"rtl"}>
    <AlertDialogHeader><AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription>{kind==="archive"?c("ستُنقل الجهة إلى الأرشيف وتتوقف إجراءاتها الجديدة، مع الاحتفاظ بصفحتها وعضوياتها وسجلها السابق.","Move the organization to the archive and stop new operations while retaining its page, memberships and history."):kind==="leader"?c(`سيُعيّن الحساب ${submission?.get("email")??""} قائدًا، مع الاحتفاظ بتاريخ القائد السابق والعضويات.`,`Appoint ${submission?.get("email")??""} and preserve role and membership history.`):kind==="remove-leader"?c(`ستنتهي صلاحية قيادة ${organization.leaderName??"القائد"}، وتبقى عضويته وسجل دوره محفوظين.`,"End leadership access while retaining membership and role history."):organization.statusCode==="Active"?c("ستتوقف إجراءات الجهة حتى إعادة تفعيلها.","Organization operations will stop until reactivated."):c("ستعود الجهة للعمل بحالتها النشطة.","Restore active organization operations.")}</AlertDialogDescription></AlertDialogHeader>
    {state.error&&<Alert variant="destructive"><AlertDescription>{actionFeedback(state.error,locale)}</AlertDescription></Alert>}
    <AlertDialogFooter><AlertDialogAction disabled={pending} variant={kind==="remove-leader"?"danger-outline":"default"} onClick={execute}>{pending?c("جاري الحفظ…","Saving…"):c("تأكيد","Confirm")}</AlertDialogAction><AlertDialogCancel disabled={pending}>{c("إلغاء","Cancel")}</AlertDialogCancel></AlertDialogFooter>
   </AlertDialogContent>
  </AlertDialog>
 </>;
}
