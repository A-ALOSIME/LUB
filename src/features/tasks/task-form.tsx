"use client";
import Link from "next/link";
import {useActionState,useEffect,useRef,type ReactNode} from "react";
import {mutateTask,type TaskState} from "./actions";
import type {Locale} from "@/lib/preferences";
import {actionFeedback} from "@/lib/action-feedback";
export function TaskForm({operation,fields={},label,children,disabled=false,locale="ar"}:{operation:string;fields?:Record<string,string>;label:string;children?:ReactNode;disabled?:boolean;locale?:Locale}){
 const [state,action,pending]=useActionState<TaskState,FormData>(mutateTask,{});const alert=useRef<HTMLParagraphElement>(null);
 useEffect(()=>{if(state.error)alert.current?.focus();},[state]);
 return <form action={action} onReset={e=>e.preventDefault()} className="space-y-4"><input type="hidden" name="operation" value={operation}/>{Object.entries(fields).map(([k,v])=><input key={k} type="hidden" name={k} value={v}/>)}
 <fieldset disabled={pending||disabled} className="min-w-0 space-y-4">{children}<button className="button">{pending?locale==="en"?"Saving…":"جارٍ الحفظ…":label}</button></fieldset>
 {state.error&&<p ref={alert} role="alert" tabIndex={-1} className="error-message">{actionFeedback(state.error,locale)}</p>}{state.success&&<p role="status" className="text-action">{actionFeedback(state.success,locale)}{state.task&&<> <Link className="text-link" href={`/tasks/${state.task}`}>{locale==="en"?"Open task":"فتح المهمة"}</Link></>}</p>}</form>;
}
