"use client";

import { useActionState, useEffect, useId, useRef, type ReactNode } from "react";
import { mutateOrganization } from "./actions";
import type { MutationOperation, MutationState } from "./validation";
import type {Locale} from "@/lib/preferences";
import {actionFeedback} from "@/lib/action-feedback";
const fieldLabels: Record<string, string> = { nameAr: "اسم الجهة", name: "اسم اللجنة", slug: "اسم الرابط", typeCode: "نوع الجهة", summary: "النبذة", mission: "الرسالة", tagNames: "مجالات الاهتمام", websiteUrl: "رابط الموقع", logoUrl: "رابط الشعار", email: "البريد", description: "وصف اللجنة", title: "عنوان الإعلان", body: "نص الإعلان", pinned: "تثبيت الإعلان" };
const fieldLabelsEn: Record<string, string> = { nameAr: "Organization name", name: "Committee name", slug: "URL name", typeCode: "Organization type", summary: "Summary", mission: "Mission", tagNames: "Interests", websiteUrl: "Website", logoUrl: "Logo URL", email: "Email", description: "Committee description", title: "Announcement title", body: "Announcement text", pinned: "Pin announcement" };

export function MutationForm({ operation, fields = {}, submitLabel, confirmLabel, children,locale="ar" }: {
  operation: MutationOperation; fields?: Record<string, string>; submitLabel: string; confirmLabel?: string; children?: ReactNode;locale?:Locale;
}) {
  const labels=locale==="en"?fieldLabelsEn:fieldLabels;
  const [state, action, pending] = useActionState<MutationState, FormData>(mutateOrganization, {});
  const errorId = useId();
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (state.error) errorRef.current?.focus(); }, [state]);
  return <form action={action} onReset={event => event.preventDefault()} className="space-y-5">
    <input type="hidden" name="operation" value={operation} />
    {Object.entries(fields).map(([name, value]) => <input type="hidden" name={name} value={value} key={name} />)}
    <fieldset disabled={pending} aria-describedby={state.error ? errorId : undefined} className="space-y-5">
      {children}
      {confirmLabel && <label className="mb-0 flex items-start gap-3 text-sm leading-7"><input type="checkbox" name="confirmed" required className="mt-1 size-5 shrink-0 accent-action" /><span>{confirmLabel}</span></label>}
      <button disabled={pending} className="button">{pending ? locale==="en"?"Working…":"جارٍ التنفيذ…" : submitLabel}</button>
    </fieldset>
    {state.error && <div id={errorId} ref={errorRef} tabIndex={-1} role="alert" className="error-message">{actionFeedback(state.error,locale)}{state.fieldErrors && <ul className="mt-3 space-y-2">{Object.entries(state.fieldErrors).filter(([key]) => labels[key]).map(([key, messages]) => <li key={key}>{labels[key]}: {messages?.map(message=>actionFeedback(message,locale)).join(" ")}</li>)}</ul>}</div>}
    {state.success && <p role="status" className="rounded-lg border border-line bg-mist p-4 leading-7 text-action">{actionFeedback(state.success,locale)}</p>}
  </form>;
}
