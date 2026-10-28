"use client";
import {useState,useActionState} from "react";
import {Send,Lock,Trash2,LogOut} from "lucide-react";
import {RowAction} from "@/components/row-action";
import {Button} from "@/components/ui/button";
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel} from "@/components/ui/alert-dialog";
import {useManagementAction} from "@/components/management-action-sheet";
import {useActionToast} from "@/components/action-toast";
import {mutateTask,type TaskState} from "./actions";
import type {Locale} from "@/lib/preferences";
export function TaskDecision({kind,task,revision,participant,title,locale="ar",full=false,status="Completed"}:{kind:"publish"|"close"|"delete"|"withdraw";task:string;revision:number;participant?:string;title:string;locale?:Locale;full?:boolean;status?:"Completed"|"Cancelled"}){
 const management=useManagementAction();
 const [open,setOpen]=useState(false),[state,action,pending]=useActionState<TaskState,FormData>(async(previous,form)=>{const result=await mutateTask(previous,form);if(result.success){setOpen(false);management?.close();}return result;},{});useActionToast(state,locale);
 const en=locale==="en",labels={publish:en?"Publish task":"نشر المهمة",close:en?"Close task":"إغلاق المهمة",delete:en?"Delete task":"حذف المهمة",withdraw:en?"Withdraw":"الانسحاب"},label=labels[kind],Icon={publish:Send,close:Lock,delete:Trash2,withdraw:LogOut}[kind];
 const description=kind==="publish"?(en?"Members in the selected scope can join this task.":"ستتاح المهمة لأعضاء نطاقها للانضمام."):kind==="withdraw"?(en?"Your participation will close. Existing submissions will remain in your record.":"ستُغلق مشاركتك وتبقى تسليماتك السابقة في السجل."):(en?"New participation and submissions will stop. Existing submissions and hours remain preserved.":"سيتوقف الانضمام والتسليم الجديد مع حفظ التسليمات والساعات والسجل السابق.");
 return <><>{full?<Button type="button" variant={kind==="publish"?"default":"outline"} onClick={()=>setOpen(true)}><Icon/>{label}</Button>:<RowAction label={label} danger={kind==="delete"||kind==="withdraw"} onClick={()=>setOpen(true)}><Icon/></RowAction>}</><AlertDialog open={open} onOpenChange={setOpen}><AlertDialogContent dir={en?"ltr":"rtl"}><AlertDialogHeader><AlertDialogTitle>{label}: {title}؟</AlertDialogTitle><AlertDialogDescription>{description}</AlertDialogDescription></AlertDialogHeader><form action={action}><input type="hidden" name="operation" value={kind==="delete"?"delete":kind==="withdraw"?"withdraw":"status"}/><input type="hidden" name="task" value={task}/><input type="hidden" name="revision" value={revision}/><input type="hidden" name="participant" value={participant??""}/><input type="hidden" name="status" value={kind==="publish"?"Open":status}/><input type="hidden" name="confirm" value="on"/><AlertDialogFooter><Button type="submit" variant={kind==="delete"||kind==="withdraw"?"destructive":"default"} disabled={pending}>{pending?(en?"Saving…":"جارٍ الحفظ…"):label}</Button><AlertDialogCancel disabled={pending}>{en?"Cancel":"إلغاء"}</AlertDialogCancel></AlertDialogFooter>{state.error&&<p role="alert" className="error-message">{state.error}</p>}</form></AlertDialogContent></AlertDialog></>;
}
