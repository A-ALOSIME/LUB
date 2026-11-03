"use client";
import {useState,useTransition,type ReactNode} from "react";
import {useRouter} from "next/navigation";
import {Eye,Pencil,Upload,Pause,Play,Lock,Archive,Trash2,ClipboardList} from "lucide-react";
import {RowAction} from "@/components/row-action";
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogAction,AlertDialogCancel} from "@/components/ui/alert-dialog";
import {ManagementActionSheet} from "@/components/management-action-sheet";
import {toast} from "@/components/ui/toast";
import {createTranslator} from "@/lib/i18n";
import type {Locale} from "@/lib/preferences";
import {transitionCampaign} from "./lifecycle-actions";
type Operation="publish"|"pause"|"resume"|"close"|"archive"|"delete";
export function CampaignLifecycleControls({kind,id,title,status,organization,locale,allowed,editForm,optimistic}:{optimistic?:(status:string,remove?:boolean)=>()=>void;kind:"round"|"renewal";id:string;title:string;status:string;organization:string;locale:Locale;allowed:boolean;editForm:ReactNode}){
 const [edit,setEdit]=useState(false),[operation,setOperation]=useState<Operation|null>(null),[pending,start]=useTransition(),router=useRouter(),c=createTranslator(locale);
 const labels:Record<Operation,string>={publish:c("نشر","Publish"),pause:c("إيقاف مؤقت","Pause"),resume:c("استئناف","Resume"),close:c("إغلاق","Close"),archive:c("أرشفة","Archive"),delete:c("حذف المسودة","Delete draft")};
 const available:Record<Operation,boolean>={publish:status==="Draft",pause:status==="Open",resume:status==="Paused",close:status==="Open"||status==="Paused",archive:status==="Closed",delete:status==="Draft"};
 const icons={publish:Upload,pause:Pause,resume:Play,close:Lock,archive:Archive,delete:Trash2};
 const reasons:Record<Operation,string>={publish:c("النشر متاح للمسودات فقط","Only drafts can be published"),pause:c("الإيقاف متاح للحملة المفتوحة فقط","Only open campaigns can be paused"),resume:c("الاستئناف متاح للحملة المتوقفة فقط","Only paused campaigns can resume"),close:c("الإغلاق متاح للحملة المفتوحة أو المتوقفة","Only open or paused campaigns can close"),archive:c("أغلق الحملة قبل أرشفتها","Close the campaign before archiving"),delete:c("الحذف متاح للمسودات فقط","Only drafts can be deleted")};
 const descriptions:Record<Operation,string>={publish:c("ستُفتح الحملة خلال الفترة المحددة.","The campaign opens for the configured period."),pause:c("سيتوقف استقبال الردود مؤقتًا مع حفظ الردود الحالية.","New responses pause; existing responses are preserved."),resume:c("سيُستأنف استقبال الردود دون تغيير الردود السابقة.","Responses resume without changing existing replies."),close:c("سينتهي استقبال الردود في هذه الحملة.","The campaign will stop accepting responses."),archive:c("ستنتقل الحملة إلى الأرشيف مع بقاء سجلها.","The campaign moves to the archive with its history retained."),delete:c("ستُحذف المسودة غير المستخدمة فقط.","Only the unused draft will be deleted.")};
 function perform(){if(!operation)return;start(async()=>{const undo=optimistic?.(({publish:"Open",pause:"Paused",resume:"Open",close:"Closed",archive:"Archived",delete:status})[operation],operation==="delete");let result;try{result=await transitionCampaign({kind,id,operation,expected:status});}catch{result={error:true};}if(result.error){undo?.();toast.add({title:c("تعذّر حفظ التغيير. تحقق من حالة الحملة وصلاحياتك.","Could not save. Check the campaign status and your permissions."),type:"error",timeout:0});return;}setOperation(null);window.dispatchEvent(new CustomEvent("campaigns-changed",{detail:{organization}}));router.refresh();toast.add({title:c("تم الحفظ","Saved"),type:"success",timeout:3000});});}
 return <div className="flex items-center gap-1">
 <RowAction href={kind==="renewal"?`/registration/renewal/${id}`:`/apply/${id}`} label={c("عرض التفاصيل","View details")}><Eye/></RowAction>
 {kind==="round"&&<RowAction label={c("تكميل التحرير","Continue editing")} disabled={!allowed||status!=="Draft"} hint={c("التحرير متاح للمسودات وبصلاحية إدارة الحملات","Editing requires a draft and campaign management permission")} onClick={()=>setEdit(true)}><Pencil/></RowAction>}
 {kind==="round"&&<RowAction href={`/manage/organizations/${organization}/members?section=applications&round=${id}`} label={c("طلبات الانضمام","Applications")}><ClipboardList/></RowAction>}
 {(Object.keys(icons) as Operation[]).map(key=>{const Icon=icons[key];return <RowAction key={key} label={labels[key]} disabled={pending||!allowed||!available[key]} hint={!allowed?c("لا تملك صلاحية إدارة هذه الحملة","You cannot manage this campaign"):available[key]?undefined:reasons[key]} danger={key==="delete"} onClick={()=>setOperation(key)}><Icon/></RowAction>;})}
 <ManagementActionSheet label="" title={title} locale={locale} open={edit} onOpenChange={setEdit} hideTrigger>{editForm}</ManagementActionSheet>
 <AlertDialog open={!!operation} onOpenChange={value=>{if(!value)setOperation(null);}}><AlertDialogContent dir={locale==="ar"?"rtl":"ltr"}><AlertDialogHeader><AlertDialogTitle>{operation&&labels[operation]}: {title}؟</AlertDialogTitle><AlertDialogDescription>{operation&&descriptions[operation]}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogAction variant={operation==="delete"?"danger-outline":"default"} disabled={pending} onClick={event=>{event.preventDefault();perform();}}>{c("تأكيد","Confirm")}</AlertDialogAction><AlertDialogCancel disabled={pending}>{c("إلغاء","Cancel")}</AlertDialogCancel></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </div>;
}
