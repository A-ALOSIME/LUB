"use client";

import {t as translateUi,createTranslator} from "@/lib/i18n";
import {NumberText} from "@/components/number-text";
import { useId, useState, useTransition, type ReactNode } from "react";
import { Eye, Check, X, CalendarDays, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import {DataTable,type DataTablePagination} from "@/components/data-table";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/form-field";
import { RowAction } from "@/components/row-action";
import { WorkspaceStickySaveBar } from "@/components/workspace-sticky-save-bar";
import { toast } from "@/components/ui/toast";
import { formatCount } from "@/lib/display";
import { formatRiyadhDate, formatRiyadhTime, formatRiyadhDateTime } from "@/lib/datetime";
import { DateInput } from "./date-input";
import type { Locale } from "@/lib/preferences";
import type { WorkflowState } from "./actions";
import { RequestStatusBadge } from "./request-status-badge";

function interviewIsPast(value: string) { return new Date(value).getTime() <= Date.now(); }

export type ReviewDecision = "Accepted" | "Rejected" | "Interview";
export type ReviewRow = {
  id: string;
  name: string;
  subtitle: string;
  committee?: string | null;
  status: string;
  createdAt: string;
  selectable: boolean;
  decisions: ReviewDecision[];
  completedDecisions?: ReviewDecision[];
  extraAction?:ReactNode;
};
export function RequestReviewTable({
  rows,
  actionsClassName="w-48",pagination,
  locale = "ar",
  onOpen,
  onPrefetch,
  onDecision,
  bulkDecisions,
  showCommittee = false,
  decisionSlots=["Accepted","Rejected","Interview"],
  children,
}: {
  actionsClassName?:string;pagination?:DataTablePagination;
  rows: ReviewRow[];
  locale?: Locale;
  onOpen: (id: string) => void;
  onPrefetch?: (id:string)=>void;
  onDecision: (
    ids: string[],
    decision: ReviewDecision,
    message: string,
  ) => Promise<WorkflowState>;
  bulkDecisions: ReviewDecision[];
  showCommittee?: boolean;
  decisionSlots?:ReviewDecision[];
  children?:
    | ReactNode
    | ((choose: (ids: string[], status: ReviewDecision) => void) => ReactNode);
}) {
  const id = useId(),
    [selected, setSelected] = useState<string[]>([]),
    [decision, setDecision] = useState<{
      ids: string[];
      status: ReviewDecision;
    } | null>(null),
    [message, setMessage] = useState(""),
    [interviewAt, setInterviewAt] = useState(""),
    [interviewPast, setInterviewPast] = useState(false),
    [pending, start] = useTransition();
  const c = createTranslator((locale === "en") ? "en" : "ar");
  const labels = {
    Accepted: c("قبول", "Accept"),
    Rejected: c("رفض", "Reject"),
    Interview: c("جدولة مقابلة", "Schedule interview"),
  };
  const selectable = rows.filter((r) => r.selectable),
    checked = selected.filter((id) => selectable.some((r) => r.id === id));
  function choose(ids: string[], status: ReviewDecision) {
    setMessage("");
    setInterviewAt("");
    setInterviewPast(false);
    setDecision({ ids, status });
  }
  function execute() {
    if (!decision) return;
    if(decision.status === "Interview" && (!interviewAt || interviewIsPast(interviewAt))){setInterviewPast(true);return;}
    start(async () => {
      try {
        const result = await onDecision(eligible, decision.status, decision.status === "Interview" ? `${formatRiyadhDateTime(interviewAt,locale,true)}\n${message}` : message);
        if (result.error) {
          toast.add({ title: result.error, type: "error", timeout: 0 });
          return;
        }
        setDecision(null);
        setSelected([]);
        toast.add({
          title: c("تم حفظ القرار", "Decision saved"),
          type: "success",
          timeout: 3000,
        });
      } catch {
        toast.add({
          title: c(
            "تعذّر حفظ القرار. أعد المحاولة.",
            "The decision could not be saved. Try again.",
          ),
          type: "error",
          timeout: 0,
        });
      }
    });
  }
  function actions(row: ReviewRow) {
    return (
      <div
        className="request-review-actions flex items-center gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        <RowAction
          label={c("عرض التفاصيل", "View details")}
          onMouseEnter={()=>onPrefetch?.(row.id)} onTouchStart={()=>onPrefetch?.(row.id)} onClick={() => onOpen(row.id)}
        >
          <Eye />
        </RowAction>
        {decisionSlots.map(status=><RowAction key={status} label={labels[status]} danger={status==="Rejected"} disabled={pending||!row.decisions.includes(status)} hint={row.completedDecisions?.includes(status)?c("تم تنفيذ هذا القرار بالفعل","This decision has already been applied"):!row.decisions.includes(status)?c("الإجراء غير متاح لحالة هذا الطلب أو لصلاحياتك","This action is unavailable for this request status or your permissions"):undefined} onClick={()=>choose([row.id],status)}>{status==="Accepted"?<Check/>:status==="Rejected"?<X/>:<CalendarDays/>}</RowAction>)}
        {row.extraAction}

      </div>
    );
  }
  const first =
    decision?.ids.length === 1
      ? rows.find((r) => r.id === decision.ids[0])
      : null;
  const eligible = decision
    ? decision.ids.filter((id) =>
        rows.some((r) => r.id === id && r.decisions.includes(decision.status)),
      )
    : [];
  return (
    <div
      id={id}
      dir={locale === "en" ? "ltr" : "rtl"}
      className="@container min-w-0 pb-28"
    >
      {!rows.length ? (
        <div role="status" className="application-selection-empty">
          <Inbox />
          <span>{c("لا توجد طلبات مطابقة.", "No matching applications.")}</span>
        </div>
      ) : (
        <>
          <DataTable pagination={pagination} items={rows} locale={locale} tableKey="requests" label={c("عرض تفاصيل الطلب","View request details")} onOpen={row=>onOpen(row.id)} onPrefetch={row=>onPrefetch?.(row.id)} selection={{selected:new Set(checked),onChange:ids=>setSelected([...ids]),disabled:row=>!row.selectable,reason:row=>["Accepted","Rejected"].includes(row.status)?c("الطلبات المقبولة والمرفوضة ما تدخل في الإجراء الجماعي","Accepted and rejected requests cannot be included in bulk actions"):c("يتطلب صلاحية الإجراء الجماعي وحالة طلب قابلة للمراجعة","Requires bulk-review permission and a reviewable request")}} columns={[
            {id:"name",label:c("الطالب","Student"),render:row=><div><p className="font-medium" dir="auto">{row.name}</p><p className="text-sm text-muted-foreground" dir="auto">{row.subtitle}</p></div>},
            ...(showCommittee?[{id:"committee",label:c("اللجنة","Committee"),className:"w-40",render:(row:ReviewRow)=><bdi>{row.committee??"—"}</bdi>}]:[]),
            {id:"status",label:c("الحالة","Status"),className:"w-32",render:row=><RequestStatusBadge status={row.status} locale={locale}/>},
            {id:"date",label:c("تاريخ التقديم","Submitted"),className:"w-40",render:row=><><time dateTime={row.createdAt}>{formatRiyadhDate(row.createdAt,locale)}</time><p className="text-sm text-muted-foreground"><bdi>{formatRiyadhTime(row.createdAt,locale)}</bdi></p></>},
            {id:"actions",label:c("الإجراءات","Actions"),className:actionsClassName,render:actions}
          ]}/>

        </>
      )}
      <WorkspaceStickySaveBar
        formId={id}
        locale={locale}
        visible={checked.length > 0}
        pending={pending}
        onUndo={() => setSelected([])}
        message={
          translateUi((locale === "en") ? "en" : "ar", checked.length === 1
              ? "طلب واحد محدد"
              : checked.length === 2
                ? "طلبان محددان"
                : `${formatCount(checked.length, "applications")} ${checked.length <= 10 ? "محددة" : "محددًا"}`, `${checked.length} selected`)
        }
        actions={
          <>
            {bulkDecisions.map((status) => (
              <Button
                key={status}
                variant={status === "Rejected" ? "danger-outline" : "outline"}
                disabled={pending}
                onClick={() => choose(checked, status)}
              >
                {labels[status]}
              </Button>
            ))}
            <Button
              variant="ghost"
              size="icon"
              aria-label={c("إلغاء التحديد", "Clear selection")}
              onClick={() => setSelected([])}
            >
              <X />
            </Button>
          </>
        }
      />
      <AlertDialog
        open={!!decision}
        onOpenChange={(open) => {
          if (!open) setDecision(null);
        }}
      >
        <AlertDialogContent className="request-review-confirmation" dir={locale === "en" ? "ltr" : "rtl"}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {decision &&
                `${labels[decision.status]} ${first ? c(`طلب ${first.name}`, `${first.name}'s request`) : formatCount(eligible.length, "applications", locale, "oblique")}؟`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {decision &&
                c(
                  `ستتغير حالة ${first ? `طلب ${first.name}` : formatCount(eligible.length,"applications",locale,"oblique")} إلى ${{Accepted:"مقبول",Rejected:"مرفوض",Interview:"مقابلة"}[decision.status]}، ويظهر القرار في صفحة الطلبات.`,
                  "The decision will appear on the applicants' requests page.",
                )}
              {decision &&
                eligible.length < decision.ids.length &&
                c(
                  ` سيتم تجاوز ${formatCount(decision.ids.length - eligible.length, "applications")} لا ينطبق عليها الإجراء.`,
                  ` ${decision.ids.length - eligible.length} ineligible requests will be skipped.`,
                )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {decision?.status === "Interview" && <><DateInput key={`${decision.ids.join(",")}-interview`} name="interviewAt" label={c("موعد المقابلة","Interview date and time")} required locale={locale} onValueChange={value=>{setInterviewAt(value);setInterviewPast(interviewIsPast(value));}}/>{interviewPast&&<p role="alert" className="text-sm text-destructive">{c("اختر موعد مقابلة في المستقبل.","Choose a future interview appointment.")}</p>}</>}
          {decision?.status !== "Accepted" && (
            <FormField
              label={
                decision?.status === "Interview"
                  ? c("تفاصيل المقابلة", "Interview details")
                  : c("سبب الرفض (اختياري)", "Rejection reason (optional)")
              }
              hint={c("يظهر للطالب", "Visible to the student")}
            >
              <Textarea
                maxLength={1000}
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <span dir="ltr" className="self-end text-xs text-muted-foreground">
                <NumberText value={message.length}/> / 1000
              </span>
            </FormField>
          )}
          <AlertDialogFooter>
            <AlertDialogAction
              variant={
                decision?.status === "Rejected" ? "danger-outline" : "default"
              }
              disabled={
                pending ||
                !eligible.length ||
                (decision?.status === "Interview" && (!message.trim() || !interviewAt || interviewPast))
              }
              onClick={(e) => {
                e.preventDefault();
                execute();
              }}
            >
              {pending ? c("جارٍ الحفظ…", "Saving…") : c("تأكيد", "Confirm")}
            </AlertDialogAction>
            <AlertDialogCancel disabled={pending}>
              {c("إلغاء", "Cancel")}
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {typeof children === "function" ? children(choose) : children}
    </div>
  );
}
