"use client";

import {useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import {Pencil,Play,Pause,Trash2} from "lucide-react";
import {Button} from "@/components/ui/button";
import {RowAction} from "@/components/row-action";
import {ManagementActionSheet} from "@/components/management-action-sheet";
import {Alert,AlertDescription} from "@/components/ui/alert";
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogAction,AlertDialogCancel} from "@/components/ui/alert-dialog";
import {toast} from "@/components/ui/toast";
import {WorkflowForm} from "./mutation-form";
import {RegistrationRoundFields} from "./registration-round-fields";
import {mutateWorkflow} from "./actions";
import type {Round} from "./repository";
import type {Locale} from "@/lib/preferences";
import {formatCount} from "@/lib/display";

export function RoundForm({organization,templates,locale,value,reopen=false,onSuccess}:{organization:string;templates:Array<{id:string;name:string}>;locale:Locale;value?:Round;reopen?:boolean;onSuccess?:()=>void}){
 const c=(ar:string,en:string)=>locale==="en"?en:ar;
 return <WorkflowForm operation={value?"save-round":"create-round"} fields={{org:organization,...(value?{round:value.id}:{}),...(!value||value.status_code==="Draft"||reopen?{publish:"on"}:{})}} label={value&&value.status_code!=="Draft"&&!reopen?c("حفظ التعديلات","Save changes"):c("نشر الآن","Publish now")} disabled={!templates.length} locale={locale} splitBody onSuccess={onSuccess} secondaryAction={!value||value.status_code==="Draft"?<Button type="submit" variant="outline" name="intent" value="draft" formNoValidate>{c("حفظ كمسودة","Save as draft")}</Button>:undefined}>
  {reopen&&<Alert><AlertDescription>{c("مدّد الفترة قبل إعادة فتح الجولة المنتهية.","Extend the period before reopening this expired round.")}</AlertDescription></Alert>}
  <RegistrationRoundFields templates={templates} locale={locale} value={value} formHref={`/manage/organizations/${organization}/renewals?section=forms${value?`&template=${value.form_template_id}`:""}`}/>
 </WorkflowForm>;
}

export function RoundActions({round,organization,templates,locale}:{round:Round;organization:string;templates:Array<{id:string;name:string}>;locale:Locale}){
 const [edit,setEdit]=useState(false),[reopen,setReopen]=useState(false),[confirmation,setConfirmation]=useState<"delete"|"Open"|"Closed"|null>(null),[pending,start]=useTransition();const router=useRouter();
 const c=(ar:string,en:string)=>locale==="en"?en:ar;
 const title=confirmation==="delete"?c(`حذف جولة «${round.title}»؟`,`Delete “${round.title}”?`):confirmation==="Closed"?c(`إيقاف جولة «${round.title}»؟`,`Pause “${round.title}”?`):c(`إعادة فتح جولة «${round.title}»؟`,`Reopen “${round.title}”?`);
 function perform(){start(async()=>{const data=new FormData();data.set("operation",confirmation==="delete"?"delete-round":"round-status");data.set("round",round.id);data.set("confirm","on");if(confirmation!=="delete"&&confirmation)data.set("status",confirmation);const result=await mutateWorkflow({},data);if(result.error){toast.add({title:result.error,type:"error",timeout:0});return;}setConfirmation(null);router.refresh();toast.add({title:c("تم حفظ التغيير","Change saved"),type:"success",timeout:3000});});}
 return <div className="flex items-center gap-2">
  <RowAction label={c("تعديل الجولة","Edit round")} disabled={round.status_code==="Archived"} onClick={()=>{setReopen(false);setEdit(true);}}><Pencil/></RowAction>
  {round.status_code!=="Archived"&&<RowAction label={round.status_code==="Open"?c("إيقاف","Pause"):c("إعادة فتح","Reopen")} onClick={()=>{if(round.status_code!=="Open"&&(!round.closes_at||!round.form_template_id||Date.parse(round.closes_at)<=Date.now())){setReopen(round.status_code!=="Draft");setEdit(true);}else setConfirmation(round.status_code==="Open"?"Closed":"Open");}}>{round.status_code==="Open"?<Pause/>:<Play/>}</RowAction>}
  <RowAction label={c("حذف الجولة","Delete round")} danger onClick={()=>setConfirmation("delete")}><Trash2/></RowAction>
  <ManagementActionSheet label="" title={c("تعديل جولة التسجيل","Edit registration round")} open={edit} onOpenChange={setEdit} hideTrigger mobileBottomSheet locale={locale}><RoundForm key={`${round.id}-${edit}-${reopen}`} value={round} reopen={reopen} organization={organization} templates={templates} locale={locale} onSuccess={()=>setEdit(false)}/></ManagementActionSheet>
  <AlertDialog open={!!confirmation} onOpenChange={open=>{if(!open)setConfirmation(null);}}><AlertDialogContent dir={locale==="en"?"ltr":"rtl"}><AlertDialogHeader><AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription>{confirmation==="delete"?c(`ستُحذف الجولة وما عليها من طلبات (${formatCount(round.application_count??0,"applications",locale)}). الأعضاء المقبولون يظلون أعضاء. لا يمكن التراجع.`,`The round and its ${formatCount(round.application_count??0,"applications",locale)} will be deleted. Accepted members remain members. This cannot be undone.`):confirmation==="Closed"?c("سيتوقف التقديم مؤقتًا، ويمكن إعادة فتحه لاحقًا.","Applications pause temporarily and can be reopened later."):c("سيعود التقديم خلال الفترة المحددة، بشرط عدم وجود جولة أخرى مفتوحة.","Applications resume during the configured period if no other round is live.")}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogAction variant={confirmation==="delete"?"danger-outline":"default"} disabled={pending} onClick={event=>{event.preventDefault();perform();}}>{pending?c("جارٍ الحفظ…","Saving…"):confirmation==="delete"?c("حذف الجولة","Delete round"):c("تأكيد","Confirm")}</AlertDialogAction><AlertDialogCancel disabled={pending}>{c("إلغاء","Cancel")}</AlertDialogCancel></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </div>;
}
