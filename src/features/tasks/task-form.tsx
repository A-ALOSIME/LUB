"use client";
import Link from "next/link";
import {useActionState,useEffect,useRef,useState,startTransition,type ReactNode} from "react";
import {mutateTask,type TaskState} from "./actions";
import type {Locale} from "@/lib/preferences";
import {actionFeedback} from "@/lib/action-feedback";
import {Button} from "@/components/ui/button";
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel} from "@/components/ui/alert-dialog";
import {ManagementActionFooter,useManagementAction} from "@/components/management-action-sheet";
import {useActionToast} from "@/components/action-toast";
export function TaskForm({operation,fields={},label,children,disabled=false,locale="ar",creationActions=false,canSaveTemplate=false,confirmDescription}:{operation:string;fields?:Record<string,string>;label:string;children?:ReactNode;disabled?:boolean;locale?:Locale;creationActions?:boolean;canSaveTemplate?:boolean;confirmDescription?:string}){
 const management=useManagementAction(),en=locale==="en";
 const [state,action,pending]=useActionState<TaskState,FormData>(async(previous,form)=>{const result=await mutateTask(previous,form);if(result.success)management?.close();return result;},{});
 const alert=useRef<HTMLParagraphElement>(null),[staged,setStaged]=useState<{data:FormData;label:string}|null>(null);
 useActionToast(state,locale);useEffect(()=>{if(state.error)alert.current?.focus();},[state]);
 const footer=creationActions?<div className="management-action-footer is-modal-footer flex-wrap">
  <Button type="submit" name="intent" value="publish" disabled={pending||disabled}>{en?"Publish task":"نشر المهمة"}</Button>
  <Button type="submit" name="intent" value="draft" variant="secondary" disabled={pending||disabled}>{en?"Save draft":"حفظ كمسودة"}</Button>
  {canSaveTemplate&&<Button type="submit" name="intent" value="template" variant="outline" disabled={pending||disabled}>{en?"Save template":"حفظ كقالب"}</Button>}
  {management&&<Button type="button" variant="ghost" className="sm:ms-auto" onClick={management.close}>{en?"Cancel":"إلغاء"}</Button>}
 </div>:<ManagementActionFooter label={pending?(en?"Saving…":"جارٍ الحفظ…"):label} pending={pending} disabled={disabled} sticky={!management?.inlineForms} showCancel={!management?.inlineForms}/>;
 const description=confirmDescription||(staged?.data.get("intent")==="publish"?(en?"The task will become available to members in its selected scope.":"ستُنشر المهمة وتصبح متاحة للأعضاء ضمن نطاقها."):staged?.data.get("intent")==="template"?(en?"Save these details as a reusable template without creating a task.":"ستُحفظ التفاصيل كقالب لاستخدامه لاحقًا، دون إنشاء مهمة."):(en?"Save a private draft visible to authorized task managers.":"ستُحفظ مسودة تظهر للمخوّلين بإدارة المهام فقط."));
 return <><form action={action} onSubmit={event=>{
  if(!creationActions&&!confirmDescription)return;
  event.preventDefault();const submitter=(event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null;
  const data=new FormData(event.currentTarget);if(submitter?.name)data.set(submitter.name,submitter.value);
  setStaged({data,label:submitter?.textContent||label});
 }} onReset={event=>event.preventDefault()} className={management&&!management.inlineForms?"workflow-split-form":"flex flex-col gap-4"}>
 <input type="hidden" name="operation" value={operation}/>{Object.entries(fields).map(([key,value])=><input key={key} type="hidden" name={key} value={value}/>)}
 <div className={management&&!management.inlineForms?"workflow-form-body":"flex flex-col gap-4"}><fieldset disabled={pending||disabled} className="flex min-w-0 flex-col gap-4">{children}</fieldset>
 {state.error&&<p ref={alert} role="alert" tabIndex={-1} className="error-message">{actionFeedback(state.error,locale)}</p>}
 {state.success&&<p role="status" className="text-action">{actionFeedback(state.success,locale)}{state.task&&<> <Link className="text-link" href={`/tasks/${state.task}`}>{en?"Open task":"فتح المهمة"}</Link></>}</p>}
 </div>{footer}</form>
 <AlertDialog open={Boolean(staged)} onOpenChange={open=>{if(!open)setStaged(null);}}><AlertDialogContent dir={en?"ltr":"rtl"}><AlertDialogHeader><AlertDialogTitle>{staged?.label}؟</AlertDialogTitle><AlertDialogDescription>{description}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><Button disabled={pending} onClick={()=>{if(staged){startTransition(()=>action(staged.data));setStaged(null);}}}>{en?"Confirm":"تأكيد"}</Button><AlertDialogCancel>{en?"Cancel":"إلغاء"}</AlertDialogCancel></AlertDialogFooter></AlertDialogContent></AlertDialog></>;
}
