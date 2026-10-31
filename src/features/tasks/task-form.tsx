"use client";

import {ContentText} from "@/components/content-text";
import {t as translateUi} from "@/lib/i18n";
import Link from "next/link";
import {useActionState,useEffect,useMemo,useRef,useState,startTransition,type ReactNode} from "react";
import {mutateTask,type TaskState} from "./actions";
import type {Locale} from "@/lib/preferences";
import {actionFeedback} from "@/lib/action-feedback";
import {TriangleAlert} from "lucide-react";
import {Alert,AlertDescription} from "@/components/ui/alert";
import {submissionErrorMessage,type SubmissionErrorCode} from "./submission-errors";
import {Button} from "@/components/ui/button";
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel} from "@/components/ui/alert-dialog";
import {ManagementActionFooter,useManagementAction} from "@/components/management-action-sheet";
import {useActionToast} from "@/components/action-toast";
export function TaskForm({operation,fields={},label,children,disabled=false,locale="ar",creationActions=false,canSaveTemplate=false,confirmDescription,onSubmitStart,uploadError,beforeAction,onSuccess}:{operation:string;fields?:Record<string,string>;label:string;children?:ReactNode;disabled?:boolean;locale?:Locale;creationActions?:boolean;canSaveTemplate?:boolean;confirmDescription?:string;onSubmitStart?:()=>void;uploadError?:SubmissionErrorCode;beforeAction?:(data:FormData)=>Promise<SubmissionErrorCode|undefined>;onSuccess?:()=>void}){
 const management=useManagementAction(),en=locale==="en";
 const [state,action,pending]=useActionState<TaskState,FormData>(async(previous,form)=>{let result:TaskState;try{const error=await beforeAction?.(form);result=error?{error:submissionErrorMessage(error,locale),submissionError:error}:await mutateTask(previous,form);}catch(error){if(operation!=="submit")throw error;result={error:submissionErrorMessage("service",locale),submissionError:"service"};}if(result.success){onSuccess?.();window.dispatchEvent(new Event("activity-changed"));if(management?.inlineForms)await management.refresh?.();else management?.close();}return result;},{});
 const alert=useRef<HTMLDivElement>(null),[staged,setStaged]=useState<{data:FormData;label:string}|null>(null);
 const toastState=useMemo(()=>operation==="submit"?{success:state.success}:state,[operation,state]);
 useActionToast(toastState,locale);useEffect(()=>{if(state.error||uploadError)alert.current?.focus();},[state,uploadError]);
 const footer=creationActions?<div className="management-action-footer is-modal-footer flex-wrap">
  <Button type="submit" name="intent" value="publish" disabled={pending||disabled}>{translateUi((en) ? "en" : "ar", "نشر المهمة", "Publish task")}</Button>
  <Button type="submit" name="intent" value="draft" variant="secondary" disabled={pending||disabled}>{translateUi((en) ? "en" : "ar", "حفظ كمسودة", "Save draft")}</Button>
  {canSaveTemplate&&<Button type="submit" name="intent" value="template" variant="outline" disabled={pending||disabled}>{translateUi((en) ? "en" : "ar", "حفظ كقالب", "Save template")}</Button>}
  {management&&<Button type="button" variant="ghost" className="sm:ms-auto" onClick={management.close}>{translateUi((en) ? "en" : "ar", "إلغاء", "Cancel")}</Button>}
 </div>:<ManagementActionFooter label={pending?(translateUi((en) ? "en" : "ar", "جارٍ الحفظ…", "Saving…")):label} pending={pending} disabled={disabled} sticky={!management?.inlineForms} showCancel={!management?.inlineForms}/>;
 const description=confirmDescription||(staged?.data.get("intent")==="publish"?(translateUi((en) ? "en" : "ar", "ستُنشر المهمة وتصبح متاحة للأعضاء ضمن نطاقها.", "The task will become available to members in its selected scope.")):staged?.data.get("intent")==="template"?(translateUi((en) ? "en" : "ar", "ستُحفظ التفاصيل كقالب لاستخدامه لاحقًا، دون إنشاء مهمة.", "Save these details as a reusable template without creating a task.")):(translateUi((en) ? "en" : "ar", "ستُحفظ مسودة تظهر للمخوّلين بإدارة المهام فقط.", "Save a private draft visible to authorized task managers.")));
 return <><form action={action} onSubmit={event=>{
  onSubmitStart?.();
  if(!creationActions&&!confirmDescription)return;
  event.preventDefault();const submitter=(event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null;
  const data=new FormData(event.currentTarget);if(submitter?.name)data.set(submitter.name,submitter.value);
  setStaged({data,label:submitter?.textContent||label});
 }} onReset={event=>event.preventDefault()} className={management&&!management.inlineForms?"workflow-split-form":"flex flex-col gap-4"}>
 <input type="hidden" name="operation" value={operation}/>{Object.entries(fields).map(([key,value])=><input key={key} type="hidden" name={key} value={value}/>)}
 <div className={management&&!management.inlineForms?"workflow-form-body":"flex flex-col gap-4"}><fieldset disabled={pending||disabled} className="flex min-w-0 flex-col gap-4">{children}</fieldset>
 {operation==="submit"?(uploadError||state.error)&&<Alert ref={alert} tabIndex={-1} className="border-amber-600/20 bg-amber-500/5"><TriangleAlert className="text-amber-600 dark:text-amber-300"/><AlertDescription className="text-foreground">{submissionErrorMessage(uploadError??state.submissionError??"service",locale)}</AlertDescription></Alert>:state.error&&<div ref={alert} role="alert" tabIndex={-1} className="error-message">{actionFeedback(state.error,locale)}</div>}
 {state.success&&operation!=="join"&&<p role="status" className="text-action">{actionFeedback(state.success,locale)}{state.task&&<> <Link className="text-link" href={`/tasks/${state.task}`}>{translateUi((en) ? "en" : "ar", "فتح المهمة", "Open task")}</Link></>}</p>}
 </div>{operation==="join"&&(pending||state.success)?<div className="flex flex-col gap-3"><p role="status">{translateUi(locale,"الحالة: منضم","Status: Joined")}</p><Button type="button" disabled>{translateUi(locale,"بدء العمل","Start work")}</Button></div>:footer}</form>
 <AlertDialog open={Boolean(staged)} onOpenChange={open=>{if(!open)setStaged(null);}}><AlertDialogContent dir={en?"ltr":"rtl"}><AlertDialogHeader><AlertDialogTitle><ContentText value={staged?.label}/>{translateUi((en) ? "en" : "ar", "؟", "?")}</AlertDialogTitle><AlertDialogDescription>{description}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><Button disabled={pending} onClick={()=>{if(staged){startTransition(()=>action(staged.data));setStaged(null);}}}>{translateUi((en) ? "en" : "ar", "تأكيد", "Confirm")}</Button><AlertDialogCancel>{translateUi((en) ? "en" : "ar", "إلغاء", "Cancel")}</AlertDialogCancel></AlertDialogFooter></AlertDialogContent></AlertDialog></>;
}
