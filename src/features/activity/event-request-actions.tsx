"use client";
import {useOriginHref} from "@/components/origin-link";
import {useState} from "react";
import {Eye,LogOut,Send} from "lucide-react";
import {RowAction} from "@/components/row-action";
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription} from "@/components/ui/alert-dialog";
import {ManagementActionProvider} from "@/components/management-action-sheet";
import {EventForm} from "@/features/events/form";
import {createTranslator} from "@/lib/i18n";
import type {Locale} from "@/lib/preferences";
export function EventRequestActions({event,locale}:{event:{id:string;title:string;registration_id?:string;registration:string;canWithdraw?:boolean;canReapply?:boolean};locale:Locale}){
 const originHref=useOriginHref();
 const [action,setAction]=useState<"cancel"|"reapply"|null>(null),t=createTranslator(locale);
 const label=action==="reapply"?t("إعادة التقديم","Reapply"):t("الانسحاب","Withdraw");
 return <><div className="flex flex-nowrap items-center gap-1"><RowAction label={t("عرض التفاصيل","View details")} href={originHref(`/events/${event.id}`)}><Eye/></RowAction><RowAction label={t("الانسحاب","Withdraw")} danger disabled={!event.registration_id||!event.canWithdraw} hint={t("يمكن سحب تسجيل منتظر أو مقبول قبل بدء الفعالية فقط","Only pending or accepted registrations can be withdrawn before the event starts")} onClick={()=>setAction("cancel")}><LogOut/></RowAction>{event.registration==="Cancelled"&&<RowAction label={t("إعادة التقديم","Reapply")} disabled={!event.registration_id||!event.canReapply} hint={t("إعادة التقديم متاحة أثناء التسجيل وقبل بدء الفعالية فقط","Reapplication is available only during registration and before the event starts")} onClick={()=>setAction("reapply")}><Send/></RowAction>}</div><AlertDialog open={action!==null} onOpenChange={open=>{if(!open)setAction(null);}}><AlertDialogContent dir={locale==="ar"?"rtl":"ltr"}><AlertDialogHeader><AlertDialogTitle>{label} · {event.title}؟</AlertDialogTitle><AlertDialogDescription>{action==="reapply"?t("سيعود طلبك إلى بانتظار الموافقة دون إنشاء تسجيل نشط مكرر.","Your request will return to pending approval without creating a duplicate active registration."):t("سيبقى طلبك في القائمة بحالة مسحوب، ويمكنك إعادة التقديم أثناء فترة التسجيل.","Your request will remain listed as withdrawn. You can reapply while registration is open.")}</AlertDialogDescription></AlertDialogHeader><ManagementActionProvider locale={locale} close={()=>setAction(null)}><EventForm operation={action??"cancel"} fields={{event:event.id,registration:event.registration_id??"",confirm:"on"}} label={label} locale={locale}/></ManagementActionProvider></AlertDialogContent></AlertDialog></>;
}
