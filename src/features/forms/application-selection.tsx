"use client";

import { useActionState, useState } from "react";
import { useActionToast } from "@/components/action-toast";
import { Inbox, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { ManagementActionFooter, ManagementActionProvider } from "@/components/management-action-sheet";
import { mutateWorkflow, type WorkflowState } from "./actions";
import { ApplicationDetail } from "./application-detail";
import type { Application, Detail } from "./repository";
import type { Locale } from "@/lib/preferences";
import { OrganizationStatusBadge } from "@/features/organizations/organization-status-badge";
import { formatRiyadhDateTime } from "@/lib/datetime";

const statusLabels = {
  Submitted: { ar: "قيد المراجعة", en: "Under review" },
  Interview: { ar: "مقابلة", en: "Interview" },
  Accepted: { ar: "مقبول", en: "Accepted" },
  Rejected: { ar: "مرفوض", en: "Rejected" },
  Withdrawn: { ar: "منسحب", en: "Withdrawn" },
} as const;

export function ApplicationSelection({ rows, locale = "ar", canBulk, selectedApplication, query }: {
  rows: Application[];
  locale?: Locale;
  canBulk: boolean;
  selectedApplication?: { detail: Detail; name: string };
  query: string;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [status, setStatus] = useState("Accepted");
  const [detailDecision, setDetailDecision] = useState("Interview");
  const [message, setMessage] = useState("");
  const [state, action, pending] = useActionState(async (previous: WorkflowState, form: FormData) => {
    const result = await mutateWorkflow(previous, form);
    if (result.success) setSelected([]);
    return result;
  }, {});
  const router = useRouter();
  useActionToast(state, locale);
  const pathname = usePathname();
  const search = useSearchParams();
  const en = locale === "en";
  const c = (ar: string, english: string) => en ? english : ar;
  const selectable = rows.filter(application => application.canBulk && ["Submitted", "Interview"].includes(application.status_code));
  const closeDetail = (open: boolean) => {
    if (open) return;
    const next = new URLSearchParams(search.toString());
    next.delete("application");
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
  };

  function openDetail(id: string) {
    const next = new URLSearchParams(query);
    next.set("application", id);
    router.push(`${pathname}?${next}`, { scroll: false });
  }

  return <>
    <form action={action} dir={en ? "ltr" : "rtl"} className="min-w-0">
      <input type="hidden" name="operation" value="bulk" />
      {selected.map(id => <input key={id} type="hidden" name="selected" value={id} />)}
      {rows.length ? <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[38rem] text-sm">
          <thead className="bg-muted/20 text-start"><tr>
            <th className="w-10 px-3 py-2"><span className="sr-only">{c("تحديد الطلب","Select application")}</span></th>
            <th className="px-3 py-2 font-medium">{c("الطالب","Student")}</th>
            <th className="px-3 py-2 font-medium">{c("اللجنة","Committee")}</th>
            <th className="px-3 py-2 font-medium">{c("التاريخ","Date")}</th>
            <th className="px-3 py-2 font-medium">{c("الحالة","Status")}</th>
          </tr></thead>
          <tbody className="divide-y divide-line">
            {rows.map(application => {
              const canSelect = selectable.some(item => item.id === application.id);
              return <tr key={application.id} tabIndex={0} role="link" onClick={event => {
                if ((event.target as HTMLElement).closest("button,input,a")) return;
                openDetail(application.id);
              }} onKeyDown={event => { if (event.key === "Enter" && event.target === event.currentTarget) openDetail(application.id); }} className="cursor-pointer hover:bg-muted/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
                <td className="px-3 py-3" onClick={event => event.stopPropagation()}>{canSelect && <input type="checkbox" className="size-4" checked={selected.includes(application.id)} onChange={event => setSelected(current => event.target.checked ? [...current, application.id] : current.filter(id => id !== application.id))} aria-label={c(`تحديد طلب ${application.name}`, `Select ${application.name}'s application`)}/>}</td>
                <td className="px-3 py-3"><button type="button" className="text-start font-medium text-link" onClick={() => openDetail(application.id)} dir="auto">{application.name}</button><p className="mt-1 max-w-64 truncate text-xs text-muted" dir="auto">{application.title}</p></td>
                <td className="px-3 py-3" dir="auto">{application.committee ?? "—"}</td>
                <td className="px-3 py-3 whitespace-nowrap">{formatRiyadhDateTime(application.created_at, locale)}</td>
                <td className="px-3 py-3 whitespace-nowrap"><OrganizationStatusBadge status={application.status_code === "Accepted" ? "accepted" : application.status_code === "Rejected" ? "rejected" : application.status_code === "Submitted" || application.status_code === "Interview" ? "review" : "inactive"}>{statusLabels[application.status_code as keyof typeof statusLabels]?.[locale] ?? application.status_code}</OrganizationStatusBadge></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div> : <div role="status" className="application-selection-empty"><Inbox aria-hidden="true"/><span>{c("لا توجد طلبات مطابقة.","No matching applications.")}</span></div>}
      {state.error && <p role="alert" className="error-message mt-3">{state.error}</p>}
      {state.success && <p role="status" className="mt-3 text-sm text-action">{state.success}</p>}
      {state.bulk && <button formAction={action} name="undoBulk" value={state.bulk} className="button button-secondary mt-3" disabled={pending}>{c("تراجع عن العملية","Undo action")}</button>}
      {canBulk && selected.length > 0 && <div className="application-bulk-bar fixed inset-x-0 bottom-0 z-40 border-t border-border bg-popover/95 p-3 shadow-lg backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl flex-wrap items-end gap-3" dir={en ? "ltr" : "rtl"}>
          <p className="me-auto self-center text-sm font-medium">{c(`${selected.length} طلبات محددة`, `${selected.length} applications selected`)}</p>
          <label className="min-w-36">{c("القرار","Decision")}<NativeSelect name="bulk-status" value={status} onChange={event => setStatus(event.target.value)}><option value="Accepted">{c("قبول","Accept")}</option><option value="Rejected">{c("رفض","Reject")}</option><option value="Interview">{c("مقابلة","Interview")}</option></NativeSelect></label>
          {status === "Interview" && <label className="min-w-48 flex-1">{c("رسالة المقابلة","Interview message")}<input name="bulk-message" required maxLength={3000} value={message} onChange={event => setMessage(event.target.value)}/></label>}
          <input type="hidden" name="status" value={status}/><input type="hidden" name="message" value={message}/>
          <ManagementActionFooter label={pending ? c("جارٍ التنفيذ…","Applying…") : c("تنفيذ","Apply decision")} pending={pending} disabled={!selectable.length || (status === "Interview" && !message.trim())}/>
          <Button type="button" variant="ghost" onClick={() => setSelected([])}>{c("إلغاء التحديد","Clear selection")}</Button>
        </div>
      </div>}
    </form>
    {selectedApplication && <Sheet open onOpenChange={closeDetail}>
      <SheetContent side="left" showCloseButton={false} className="management-action-sheet gap-0 overflow-hidden p-0">
        <SheetHeader className="management-action-header"><SheetTitle className="min-w-0 break-words">{selectedApplication.name}</SheetTitle><SheetClose render={<Button type="button" variant="ghost" size="icon-sm" className="absolute end-3 top-3" aria-label={c("إغلاق","Close")} title={c("إغلاق","Close")}><X aria-hidden="true"/></Button>}/></SheetHeader>
        <ManagementActionProvider locale={locale} close={() => closeDetail(false)}>
        <div className="management-action-scroll space-y-5" dir={en ? "ltr" : "rtl"}>
          <ApplicationDetail detail={selectedApplication.detail} locale={locale}/>
          {selectedApplication.detail.canReview && ["Submitted","Interview"].includes(selectedApplication.detail.status_code) && <section className="space-y-3 border-t border-line pt-4"><h2 className="font-semibold">{c("قرار الطلب","Application decision")}</h2><form action={action} className="space-y-3"><input type="hidden" name="operation" value="decide"/><input type="hidden" name="application" value={selectedApplication.detail.id}/><label>{c("القرار","Decision")}<NativeSelect name="status" value={detailDecision} onChange={event=>setDetailDecision(event.target.value)}><option value="Accepted">{c("قبول","Accept")}</option><option value="Rejected">{c("رفض","Reject")}</option><option value="Interview">{c("مقابلة","Interview")}</option></NativeSelect></label><label>{c("رسالة المقابلة","Interview message")}<textarea name="message" maxLength={3000} rows={3} required={detailDecision==="Interview"}/></label><ManagementActionFooter label={pending?c("جارٍ الحفظ…","Saving…"):c("حفظ القرار","Save decision")} pending={pending}/></form></section>}
        </div>
        </ManagementActionProvider>
      </SheetContent>
    </Sheet>}
  </>;
}
