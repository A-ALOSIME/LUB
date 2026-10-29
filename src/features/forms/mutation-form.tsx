"use client";
import {t as translateUi} from "@/lib/i18n";
import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { mutateWorkflow, type WorkflowState } from "./actions";
import type {Locale} from "@/lib/preferences";
import {actionFeedback} from "@/lib/action-feedback";
import { ManagementActionFooter } from "@/components/management-action-sheet";
import { useActionToast } from "@/components/action-toast";
export function WorkflowForm({ operation, fields = {}, label, children, secondaryAction, disabled=false, buttonClassName="button", formClassName="space-y-4", mutation=mutateWorkflow,locale="ar", onSuccess, splitBody=false, cancelVariant }: { operation: string; fields?: Record<string, string>; label: string; children?: ReactNode; secondaryAction?: ReactNode; disabled?: boolean; buttonClassName?:string; formClassName?:string; mutation?:(previous:WorkflowState,form:FormData)=>Promise<WorkflowState>;locale?:Locale; onSuccess?: (state:WorkflowState) => void; splitBody?:boolean; cancelVariant?:"ghost"|"outline" }) {
 const [state, action, pending] = useActionState<WorkflowState, FormData>(mutation, {}); const alert = useRef<HTMLParagraphElement>(null);
 useActionToast(state, locale);
 useEffect(() => { if (state.error) alert.current?.focus(); if (state.success) onSuccess?.(state); }, [state, onSuccess]);
 return <form action={action} onReset={event => event.preventDefault()} className={`${formClassName}${splitBody?" workflow-split-form":""}`}>
 <input type="hidden" name="operation" value={operation} />{Object.entries(fields).map(([key,value]) => <input key={key} type="hidden" name={key} value={value} />)}
 {splitBody ? <div className="workflow-form-body"> {children}{state.error && <p ref={alert} tabIndex={-1} role="alert" className="error-message">{actionFeedback(state.error,locale)}</p>}
 {state.success && <p role="status" className="text-action">{actionFeedback(state.success,locale)}</p>}
 {state.bulk && <button formAction={action} name="undoBulk" value={state.bulk} className="button button-secondary" disabled={pending}>{translateUi((locale==="en") ? "en" : "ar", "تراجع عن العملية", "Undo action")}</button>}
</div> : <> {children}{state.error && <p ref={alert} tabIndex={-1} role="alert" className="error-message">{actionFeedback(state.error,locale)}</p>}
 {state.success && <p role="status" className="text-action">{actionFeedback(state.success,locale)}</p>}
 {state.bulk && <button formAction={action} name="undoBulk" value={state.bulk} className="button button-secondary" disabled={pending}>{translateUi((locale==="en") ? "en" : "ar", "تراجع عن العملية", "Undo action")}</button>}
</>}
 <ManagementActionFooter label={pending ? translateUi((locale==="en") ? "en" : "ar", "جارٍ الحفظ…", "Saving…") : label} pending={pending} disabled={disabled} secondaryAction={secondaryAction} buttonClassName={buttonClassName} cancelVariant={cancelVariant}/></form>;
}
