"use client";

import { useId, useState, useTransition, type ReactNode } from "react";
import { Eye, Check, X, CalendarDays, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
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
};
export function RequestReviewTable({
  rows,
  locale = "ar",
  onOpen,
  onDecision,
  bulkDecisions,
  showCommittee = false,
  children,
}: {
  rows: ReviewRow[];
  locale?: Locale;
  onOpen: (id: string) => void;
  onDecision: (
    ids: string[],
    decision: ReviewDecision,
    message: string,
  ) => Promise<WorkflowState>;
  bulkDecisions: ReviewDecision[];
  showCommittee?: boolean;
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
  const c = (ar: string, en: string) => (locale === "en" ? en : ar);
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
  function toggle(target: string, value: boolean) {
    setSelected((current) =>
      value
        ? [...new Set([...current, target])]
        : current.filter((v) => v !== target),
    );
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
  function selection(row: ReviewRow) {
    return (
      <Checkbox
        checked={checked.includes(row.id)}
        disabled={!row.selectable}
        className={!row.selectable ? "opacity-35" : ""}
        aria-label={c(`تحديد طلب ${row.name}`, `Select ${row.name}'s request`)}
        onCheckedChange={(value) => toggle(row.id, value)}
      />
    );
  }
  function actions(row: ReviewRow) {
    return (
      <div
        className="request-review-actions flex items-center gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        <RowAction
          label={c("عرض التفاصيل", "View details")}
          onClick={() => onOpen(row.id)}
        >
          <Eye />
        </RowAction>
        {(["Accepted", "Rejected", "Interview"] as ReviewDecision[]).map(
          (status) =>
            row.decisions.includes(status) ? (
              <RowAction
                key={status}
                label={labels[status]}
                danger={status === "Rejected"}
                disabled={pending}
                onClick={() => choose([row.id], status)}
              >
                {status === "Accepted" ? (
                  <Check />
                ) : status === "Rejected" ? (
                  <X />
                ) : (
                  <CalendarDays />
                )}
              </RowAction>
            ) : row.completedDecisions?.includes(status) ? (
              <RowAction key={status} label={c("مقبول بالفعل","Already accepted")} disabled><Check /></RowAction>
            ) : (
              <span
                key={status}
                className="hidden size-10 shrink-0 md:block"
                aria-hidden="true"
              />
            ),
        )}
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
          <div className="hidden rounded-lg border border-border @[48rem]:block">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow className="border-border bg-transparent hover:bg-transparent">
                  <TableHead className="w-12">
                    <Checkbox
                      aria-label={c("تحديد الكل", "Select all")}
                      checked={
                        checked.length > 0 &&
                        checked.length === selectable.length
                      }
                      indeterminate={
                        checked.length > 0 && checked.length < selectable.length
                      }
                      disabled={!selectable.length}
                      onCheckedChange={(value) =>
                        setSelected(value ? selectable.map((r) => r.id) : [])
                      }
                    />
                  </TableHead>
                  <TableHead>{c("الطالب", "Student")}</TableHead>
                  {showCommittee && (
                    <TableHead className="w-[18%]">
                      {c("اللجنة", "Committee")}
                    </TableHead>
                  )}
                  <TableHead className="w-36">
                    {c("الحالة", "Status")}
                  </TableHead>
                  <TableHead className="w-40">
                    {c("تاريخ التقديم", "Submitted")}
                  </TableHead>
                  <TableHead className="w-48">
                    {c("الإجراءات", "Actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={row.id}
                    tabIndex={0}
                    className={`cursor-pointer border-border hover:bg-muted/20 ${checked.includes(row.id) ? "bg-primary/5" : ""}`}
                    onClick={(e) => {
                      if (
                        !(e.target as HTMLElement).closest(
                          'button,a,input,[role="checkbox"]',
                        )
                      )
                        onOpen(row.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && e.target === e.currentTarget)
                        onOpen(row.id);
                    }}
                  >
                    <TableCell>{selection(row)}</TableCell>
                    <TableCell>
                      <p className="break-words font-medium" dir="auto">
                        {row.name}
                      </p>
                      <p
                        className="mt-1 break-words text-sm text-muted-foreground"
                        dir="auto"
                      >
                        {row.subtitle}
                      </p>
                    </TableCell>
                    {showCommittee && (
                      <TableCell>
                        <bdi>{row.committee ?? "—"}</bdi>
                      </TableCell>
                    )}
                    <TableCell>
                      <RequestStatusBadge status={row.status} locale={locale} />
                    </TableCell>
                    <TableCell>
                      <time dateTime={row.createdAt}>
                        {formatRiyadhDate(row.createdAt, locale)}
                      </time>
                      <p className="text-sm text-muted-foreground">
                        {formatRiyadhTime(row.createdAt, locale)}
                      </p>
                    </TableCell>
                    <TableCell>{actions(row)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="request-review-mobile flex flex-col gap-3 @[48rem]:hidden">
            {rows.map((row) => (
              <li key={row.id}>
                <Card>
                  <CardHeader className="flex flex-row items-start gap-3">
                    {selection(row)}
                    <button
                      className="min-w-0 flex-1 text-start"
                      onClick={() => onOpen(row.id)}
                    >
                      <span className="block font-medium" dir="auto">
                        {row.name}
                      </span>
                      <span
                        className="text-sm text-muted-foreground"
                        dir="auto"
                      >
                        {row.subtitle}
                      </span>
                    </button>
                    <RequestStatusBadge status={row.status} locale={locale} />
                  </CardHeader>
                  <CardContent>
                    {row.committee && <p>{row.committee}</p>}
                    <time
                      className="text-sm text-muted-foreground"
                      dateTime={row.createdAt}
                    >
                      {formatRiyadhDate(row.createdAt, locale)} ·{" "}
                      {formatRiyadhTime(row.createdAt, locale)}
                    </time>
                  </CardContent>
                  <CardFooter className="border-border">
                    {actions(row)}
                  </CardFooter>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
      <WorkspaceStickySaveBar
        formId={id}
        locale={locale}
        visible={checked.length > 0}
        pending={pending}
        onUndo={() => setSelected([])}
        message={
          locale === "en"
            ? `${checked.length} selected`
            : checked.length === 1
              ? "طلب واحد محدد"
              : checked.length === 2
                ? "طلبان محددان"
                : `${formatCount(checked.length, "applications")} ${checked.length <= 10 ? "محددة" : "محددًا"}`
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
                {message.length} / 1000
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
