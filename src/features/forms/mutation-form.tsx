"use client";
import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { mutateWorkflow, type WorkflowState } from "./actions";
import type {Locale} from "@/lib/preferences";
import {actionFeedback} from "@/lib/action-feedback";
export function WorkflowForm({ operation, fields = {}, label, children, disabled=false, mutation=mutateWorkflow,locale="ar" }: { operation: string; fields?: Record<string, string>; label: string; children?: ReactNode; disabled?: boolean; mutation?:(previous:WorkflowState,form:FormData)=>Promise<WorkflowState>;locale?:Locale }) {
 const [state, action, pending] = useActionState<WorkflowState, FormData>(mutation, {}); const alert = useRef<HTMLParagraphElement>(null);
 useEffect(() => { if (state.error) alert.current?.focus(); }, [state]);
 return <form action={action} onReset={event => event.preventDefault()} className="space-y-4">
 <input type="hidden" name="operation" value={operation} />{Object.entries(fields).map(([key,value]) => <input key={key} type="hidden" name={key} value={value} />)}
 {children}{state.error && <p ref={alert} tabIndex={-1} role="alert" className="error-message">{actionFeedback(state.error,locale)}</p>}
 {state.success && <p role="status" className="text-action">{actionFeedback(state.success,locale)}</p>}
 {state.bulk && <button formAction={action} name="undoBulk" value={state.bulk} className="button button-secondary" disabled={pending}>{locale==="en"?"Undo action":"تراجع عن العملية"}</button>}
 <button disabled={pending || disabled} className="button">{pending ? locale==="en"?"Saving…":"جارٍ الحفظ…" : label}</button></form>;
}
