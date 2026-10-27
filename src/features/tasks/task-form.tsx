"use client";
import Link from "next/link";
import {useActionState,useEffect,useRef,useState,startTransition,type ReactNode} from "react";
import {mutateTask,type TaskState} from "./actions";
import type {Locale} from "@/lib/preferences";
import {actionFeedback} from "@/lib/action-feedback";
import {Button} from "@/components/ui/button";
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel} from "@/components/ui/alert-dialog";
import { ManagementActionFooter,useManagementAction } from "@/components/management-action-sheet";
import { useActionToast } from "@/components/action-toast";
export function TaskForm({operation,fields={},label,children,disabled=false,locale="ar",creationActions=false,canSaveTemplate=false,confirmDescription}:{operation:string;fields?:Record<string,string>;label:string;children?:ReactNode;disabled?:boolean;locale?:Locale;creationActions?:boolean;canSaveTemplate?:boolean;confirmDescription?:string}){
 const [state,action,pending]=useActionState<TaskState,FormData>(mutateTask,{});const alert=useRef<HTMLParagraphElement>(null);
 const management=useManagementAction();const handled=useRef<TaskState|null>(null);const [staged,setStaged]=useState<{data:FormData;label:string}|null>(null);const en=locale==="en";
 useActionToast(state, locale);
 useEffect(()=>{if(state.success&&handled.current!==state){handled.current=state;management?.close();}},[state,management]);
 useEffect(()=>{if(state.error)alert.current?.focus();},[state]);
 return <><form action={action} onSubmit={event=>{
  if(!creationActions&&!confirmDescription)return;
  event.preventDefault();const submitter=(event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null;
  const data=new FormData(event.currentTarget);if(submitter?.name)data.set(submitter.name,submitter.value);
  setStaged({data,label:submitter?.textContent||label});
 }} onReset={e=>e.preventDefault()} className="space-y-4"><input type="hidden" name="operation" value={operation}/>{Object.entries(fields).map(([k,v])=><input key={k} type="hidden" name={k} value={v}/>)}
 <fieldset disabled={pending||disabled} className="min-w-0 space-y-4">{children}{creationActions?<div className="management-action-footer is-modal-footer flex-wrap">
 <Button type="submit" name="intent" value="publish" disabled={pending}>{en?"Publish task":"نشر المهمة"}</Button>
 <Button type="submit" name="intent" value="draft" variant="secondary" disabled={pending}>{en?"Save draft":"حفظ كمسودة"}</Button>
 {canSaveTemplate&&<Button type="submit" name="intent" value="template" variant="outline" disabled={pending}>{en?"Save template":"حفظ كقالب"}</Button>}
 {management&&<Button type="button" variant="ghost" className="sm:ms-auto" onClick={management.close}>{en?"Cancel":"إلغاء"}</Button>}
 </div>:<ManagementActionFooter label={pending?locale==="en"?"Saving…":"جارٍ الحفظ…":label} pending={pending} disabled={disabled}/>}</fieldset>
 {state.error&&<p ref={alert} role="alert" tabIndex={-1} className="error-message">{actionFeedback(state.error,locale)}</p>}{state.success&&<p role="status" className="text-action">{actionFeedback(state.success,locale)}{state.task&&<> <Link className="text-link" href={`/tasks/${state.task}`}>{locale==="en"?"Open task":"فتح المهمة"}</Link></>}</p>}</form><AlertDialog open={Boolean(staged)} onOpenChange={open=>{if(!open)setStaged(null);}}><AlertDialogContent dir={en?"ltr":"rtl"}><AlertDialogHeader><AlertDialogTitle>{staged?.label}؟</AlertDialogTitle><AlertDialogDescription>{confirmDescription||(staged?.data.get("intent")==="publish"?(en?"The task will become available to members in its selected scope.":"ستُنشر المهمة وتصبح متاحة للأعضاء ضمن نطاقها."):staged?.data.get("intent")==="template"?(en?"Save these details as a reusable template without creating a task.":"ستُحفظ التفاصيل كقالب لاستخدامه لاحقًا، دون إنشاء مهمة."):(en?"Save a private draft visible to authorized task managers.":"ستُحفظ مسودة تظهر للمخوّلين بإدارة المهام فقط."))}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><Button disabled={pending} onClick={()=>{if(staged){startTransition(()=>action(staged.data));setStaged(null);}}}>{en?"Confirm":"تأكيد"}</Button><AlertDialogCancel>{en?"Cancel":"إلغاء"}</AlertDialogCancel></AlertDialogFooter></AlertDialogContent></AlertDialog></>;
}
