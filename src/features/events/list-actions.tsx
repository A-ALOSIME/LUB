"use client";
import {useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import {Pencil,SlidersHorizontal,Copy,Upload,EyeOff} from "lucide-react";
import {RowAction} from "@/components/row-action";
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogAction,AlertDialogCancel} from "@/components/ui/alert-dialog";
import {toast} from "@/components/ui/toast";
import {mutateEvent} from "./actions";
import type {Locale} from "@/lib/preferences";
export function EventListActions({event,locale}:{event:{id:string;title:string;revision:number;status_code:string;organization_id:string};locale:Locale}){
 const [confirm,setConfirm]=useState(false),[pending,start]=useTransition();const router=useRouter();const c=(ar:string,en:string)=>locale==="en"?en:ar;const published=event.status_code==="Published";
 function act(operation:"status"|"duplicate"){start(async()=>{try{const form=new FormData();form.set("operation",operation);form.set("event",event.id);form.set("revision",String(event.revision));form.set("status",published?"Draft":"Published");form.set("confirm","on");const result=await mutateEvent({},form);if(result.error){toast.add({title:result.error,type:"error",timeout:0});return;}setConfirm(false);router.refresh();if(result.eventId&&operation==="duplicate")router.push(`/manage/organizations/${event.organization_id}/events/${result.eventId}`);toast.add({title:c("تم حفظ التغيير","Change saved"),type:"success",timeout:3000});}catch{toast.add({title:c("تعذّر تنفيذ الإجراء. أعد المحاولة.","Action failed. Try again."),type:"error",timeout:0});}});}
 return <div className="relative flex shrink-0 flex-wrap items-center gap-2" onClick={event=>event.stopPropagation()}>
  <RowAction href={`/manage/organizations/${event.organization_id}/events/${event.id}?action=edit`} label={c("تعديل","Edit")}><Pencil/></RowAction>
  <RowAction href={`/manage/organizations/${event.organization_id}/events/${event.id}?action=settings`} label={c("الإعدادات","Settings")}><SlidersHorizontal/></RowAction>
  <RowAction label={published?c("إلغاء النشر","Unpublish"):c("نشر","Publish")} disabled={pending||!["Draft","Published"].includes(event.status_code)} onClick={()=>setConfirm(true)}>{published?<EyeOff/>:<Upload/>}</RowAction>
  <RowAction label={c("تكرار","Duplicate")} disabled={pending} onClick={()=>act("duplicate")}><Copy/></RowAction>
  <AlertDialog open={confirm} onOpenChange={setConfirm}><AlertDialogContent dir={locale==="en"?"ltr":"rtl"}><AlertDialogHeader><AlertDialogTitle>{published?c(`إلغاء نشر «${event.title}»؟`,`Unpublish “${event.title}”?`):c(`نشر «${event.title}»؟`,`Publish “${event.title}”?`)}</AlertDialogTitle><AlertDialogDescription>{published?c("ستختفي من العرض العام ويتوقف التسجيل مع الاحتفاظ بالمسجلين.","The event becomes private and registration pauses; existing registrations remain."):c("ستظهر الفعالية للجميع بعد التحقق من اكتمال بياناتها.","The event becomes public after its required details are validated.")}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogAction disabled={pending} onClick={e=>{e.preventDefault();act("status");}}>{c("تأكيد","Confirm")}</AlertDialogAction><AlertDialogCancel disabled={pending}>{c("إلغاء","Cancel")}</AlertDialogCancel></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </div>;
}
