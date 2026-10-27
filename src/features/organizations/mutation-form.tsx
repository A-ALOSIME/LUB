"use client";

import { useActionState, useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { mutateOrganization } from "./actions";
import type { MutationOperation, MutationState } from "./validation";
import type {Locale} from "@/lib/preferences";
import {actionFeedback} from "@/lib/action-feedback";
import { ProfileFormContext } from "./profile-form-state";
import { ManagementActionFooter } from "@/components/management-action-sheet";
import { WorkspaceStickySaveBar } from "@/components/workspace-sticky-save-bar";
import { useActionToast } from "@/components/action-toast";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { navigationHistoryIndex } from "@/lib/navigation-history";

function snapshot(form: HTMLFormElement) {
  return JSON.stringify(Array.from(new FormData(form).entries()));
}
function formValues(form: HTMLFormElement) {
  const values = Object.fromEntries(Array.from(new FormData(form).entries()).map(([name, value]) => [name, typeof value === "string" ? value : ""]));
  for (const control of Array.from(form.elements)) {
    if (control instanceof HTMLInputElement && control.name && (control.type === "checkbox" || control.type === "radio")) values[control.name] = control.checked ? control.value : "";
  }
  return values;
}
type FormControlsSnapshot = {
  values: Record<string, string>;
  controls: Array<{ type: "input"; value: string; checked: boolean } | { type: "textarea"; value: string } | { type: "select"; selected: boolean[] }>;
};
function captureFormControls(form: HTMLFormElement): FormControlsSnapshot {
  const controls: FormControlsSnapshot["controls"] = [];
  for (const control of Array.from(form.elements)) {
    if (control instanceof HTMLInputElement) controls.push({ type: "input", value: control.value, checked: control.checked });
    else if (control instanceof HTMLTextAreaElement) controls.push({ type: "textarea", value: control.value });
    else if (control instanceof HTMLSelectElement) controls.push({ type: "select", selected: Array.from(control.options).map(option => option.selected) });
  }
  return { values: formValues(form), controls };
}
function restoreFormControls(form: HTMLFormElement, saved: FormControlsSnapshot) {
  const controls = Array.from(form.elements).filter(control => control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement);
  controls.forEach((control, index) => {
    const state = saved.controls[index];
    if (!state) return;
    if (control instanceof HTMLInputElement && state.type === "input") {
      if (control.type === "checkbox" || control.type === "radio") {
        control.checked = state.checked;
        control.defaultChecked = state.checked;
      } else if (control.type !== "file") {
        control.value = state.value;
        control.defaultValue = state.value;
      }
    } else if (control instanceof HTMLTextAreaElement && state.type === "textarea") {
      control.value = state.value;
      control.defaultValue = state.value;
    } else if (control instanceof HTMLSelectElement && state.type === "select") {
      Array.from(control.options).forEach((option, optionIndex) => {
        option.selected = state.selected[optionIndex] ?? false;
        option.defaultSelected = option.selected;
      });
    }
  });
}
const fieldLabels: Record<string, string> = { nameAr: "اسم الجهة", name: "اسم اللجنة", slug: "اسم الرابط", typeCode: "نوع الجهة", summary: "النبذة", mission: "الرسالة", tagNames: "مجالات الاهتمام", contacts: "قنوات التواصل", email: "البريد", description: "وصف اللجنة", title: "عنوان الإعلان", body: "نص الإعلان", pinned: "تثبيت الإعلان" };
const fieldLabelsEn: Record<string, string> = { nameAr: "Organization name", name: "Committee name", slug: "URL name", typeCode: "Organization type", summary: "Summary", mission: "Mission", tagNames: "Interests", contacts: "Contact channels", email: "Email", description: "Committee description", title: "Announcement title", body: "Announcement text", pinned: "Pin announcement" };

export function MutationForm({ operation, fields = {}, submitLabel, confirmLabel, children, locale="ar", onSuccess, formClassName, buttonClassName, stickySaveBar = false, cancelInModal = true, inlineFooter = false, footerAction }: {
  operation: MutationOperation; fields?: Record<string, string>; submitLabel: string; confirmLabel?: string; children?: ReactNode;locale?:Locale; onSuccess?: () => void; formClassName?: string; buttonClassName?: string; stickySaveBar?: boolean; cancelInModal?: boolean; inlineFooter?: boolean; footerAction?: ReactNode;
}) {
  const labels=locale==="en"?fieldLabelsEn:fieldLabels;
  const [state, action, pending] = useActionState<MutationState, FormData>(mutateOrganization, {});
  const errorId = useId();
  const formId = useId();
  const errorRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const pendingSubmission = useRef<FormControlsSnapshot | null>(null);
  const savedControls = useRef<FormControlsSnapshot | null>(null);
  const baseline = useRef<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [resetValues, setResetValues] = useState<Record<string, string>>({});
  const [changeVersion, setChangeVersion] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const departure = useRef<(() => void) | null>(null);
  const bypassDeparture = useRef(false);
  useActionToast(state, locale, stickySaveBar ? locale === "en" ? "Saved" : "تم الحفظ" : undefined);

  useEffect(() => {
    if (!stickySaveBar || !formRef.current) return;
    const current = snapshot(formRef.current);
    if (baseline.current === null) {
      baseline.current = current;
      savedControls.current = captureFormControls(formRef.current);
    }
    else setDirty(current !== baseline.current);
  }, [changeVersion, stickySaveBar]);
  useEffect(() => { if (state.error && !stickySaveBar) errorRef.current?.focus(); }, [state, stickySaveBar]);
  useEffect(() => {
    if (!stickySaveBar || !dirty) return;
    const historyIndex = navigationHistoryIndex();
    let restoringHistory = false;
    let allowTraversal = false;
    let restoredSteps = 0;
    function beforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    function beforeNavigate(event: MouseEvent) {
      if (bypassDeparture.current) return;
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link || link.hasAttribute("download") || link.target && link.target !== "_self") return;
      const destination = new URL(link.href, window.location.href);
      if (destination.origin === window.location.origin && destination.pathname === window.location.pathname && destination.search === window.location.search) return;
      event.preventDefault();
      event.stopPropagation();
      departure.current = () => { bypassDeparture.current = true; link.click(); bypassDeparture.current = false; };
      setLeaveOpen(true);
    }
    function beforeSection(event: Event) {
      event.preventDefault();
      departure.current = (event as CustomEvent<() => void>).detail;
      setLeaveOpen(true);
    }
    function beforeHistory(event: PopStateEvent) {
      if (allowTraversal) { allowTraversal = false; return; }
      const destinationIndex = navigationHistoryIndex();
      if (typeof historyIndex !== "number" || typeof destinationIndex !== "number") return;
      const restoreBy = Math.sign(historyIndex - destinationIndex);
      if (restoringHistory) {
        event.stopImmediatePropagation();
        if (!restoreBy) restoringHistory = false;
        else { restoredSteps += 1; window.history.go(restoreBy); }
        return;
      }
      if (!restoreBy) return;
      // vinext indices can have gaps after a history fork. Walk entries back to
      // the original entry, then resume by the actual number of steps restored.
      event.stopImmediatePropagation();
      restoredSteps = 1;
      departure.current = () => { allowTraversal = true; window.history.go(-restoreBy * restoredSteps); };
      restoringHistory = true;
      window.history.go(restoreBy);
      setLeaveOpen(true);
    }
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", beforeNavigate, true);
    window.addEventListener("workspace-before-navigate", beforeSection);
    window.addEventListener("popstate", beforeHistory, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", beforeNavigate, true);
      window.removeEventListener("workspace-before-navigate", beforeSection);
      window.removeEventListener("popstate", beforeHistory, true);
    };
  }, [dirty, locale, stickySaveBar]);
  useEffect(() => { if (state.error) pendingSubmission.current = null; }, [state.error]);
  useEffect(() => { if (state.success) onSuccess?.(); }, [state.success, onSuccess]);
  useEffect(() => {
    if (!stickySaveBar || !state.success || !formRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      if (!formRef.current) return;
      const saved = pendingSubmission.current ?? captureFormControls(formRef.current);
      pendingSubmission.current = null;
      restoreFormControls(formRef.current, saved);
      savedControls.current = saved;
      setResetValues(saved.values);
      baseline.current = snapshot(formRef.current);
      setResetKey(key => key + 1);
      setDirty(false);
      setLeaveOpen(false);
      const continueNavigation = departure.current;
      departure.current = null;
      continueNavigation?.();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [state, stickySaveBar]);

  const markChanged = useCallback(() => {
    setChangeVersion(version => version + 1);
  }, []);

  function trackChange(target: EventTarget | null) {
    if (target instanceof Element && target.closest("[data-ignore-dirty]")) return;
    markChanged();
  }

  function undoChanges() {
    formRef.current?.reset();
    if (formRef.current && savedControls.current) restoreFormControls(formRef.current, savedControls.current);
    setResetKey(key => key + 1);
    setDirty(false);
  }

  return <form id={stickySaveBar ? formId : undefined} ref={formRef} action={action} noValidate={stickySaveBar} onReset={event => event.preventDefault()} onInputCapture={event => trackChange(event.target)} onChangeCapture={event => trackChange(event.target)} onClickCapture={event => trackChange(event.target)} onSubmitCapture={event => {
    if (stickySaveBar && formRef.current) pendingSubmission.current = captureFormControls(formRef.current);
    trackChange(event.target);
  }} data-dirty={stickySaveBar && dirty ? "true" : undefined} className={`space-y-5 ${formClassName ?? ""}`}>
    <input type="hidden" name="operation" value={operation} />
    {Object.entries(fields).map(([name, value]) => <input type="hidden" name={name} value={value} key={name} />)}
    <ProfileFormContext.Provider value={{ resetKey, resetValues, markChanged }}>
      <fieldset disabled={pending} aria-describedby={state.error ? errorId : undefined} className="space-y-5">
        {children}
        {confirmLabel && <label className="mb-0 flex items-start gap-3 text-sm leading-7"><input type="checkbox" name="confirmed" required className="mt-1 size-5 shrink-0 accent-action" /><span>{confirmLabel}</span></label>}
        {!stickySaveBar && <ManagementActionFooter label={pending ? locale==="en"?"Working…":"جارٍ التنفيذ…" : submitLabel} pending={pending} buttonClassName={buttonClassName} showCancel={cancelInModal} secondaryAction={footerAction} sticky={!inlineFooter}/>}
      </fieldset>
    </ProfileFormContext.Provider>
    {state.error && <div id={errorId} ref={errorRef} tabIndex={-1} role="alert" className={stickySaveBar ? "sr-only" : "error-message"}>{actionFeedback(state.error,locale)}{state.fieldErrors && <ul className="mt-3 space-y-2">{Object.entries(state.fieldErrors).filter(([key]) => labels[key]).map(([key, messages]) => <li key={key}>{labels[key]}: {messages?.map(message=>actionFeedback(message,locale)).join(" ")}</li>)}</ul>}</div>}
    {stickySaveBar && <WorkspaceStickySaveBar formId={formId} locale={locale} visible={dirty} pending={pending} onUndo={undoChanges} />}
    {stickySaveBar && <AlertDialog open={leaveOpen} onOpenChange={open => { if (!pending) { setLeaveOpen(open); if (!open) departure.current = null; } }}>
      <AlertDialogContent dir={locale === "en" ? "ltr" : "rtl"} data-ignore-dirty>
        <AlertDialogHeader>
          <AlertDialogTitle>{locale === "en" ? "Unsaved changes" : "لديك تغييرات غير محفوظة"}</AlertDialogTitle>
          <AlertDialogDescription>{locale === "en" ? "Save your changes before leaving?" : "هل تريد حفظ التغييرات قبل المتابعة؟"}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button type="button" disabled={pending} onClick={() => formRef.current?.requestSubmit()}>{pending ? locale === "en" ? "Saving…" : "جاري الحفظ" : locale === "en" ? "Save" : "حفظ"}</Button>
          <Button type="button" variant="danger-outline" disabled={pending} onClick={() => { const next = departure.current; departure.current = null; undoChanges(); setLeaveOpen(false); next?.(); }}>{locale === "en" ? "Discard changes" : "تجاهل التغييرات"}</Button>
          <Button type="button" variant="outline" disabled={pending} onClick={() => { departure.current = null; setLeaveOpen(false); }}>{locale === "en" ? "Stay" : "البقاء"}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>}
  </form>;
}
