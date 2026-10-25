"use client";

import { useState } from "react";
import { Check, Eye, SlidersHorizontal, X, ChevronDown } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {HourAdjustment} from "./hour-adjustment";
import {Collapsible,CollapsibleTrigger,CollapsibleContent} from "@/components/ui/collapsible";
import {Button} from "@/components/ui/button";
import {Separator} from "@/components/ui/separator";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { OrganizationStatusBadge } from "@/features/organizations/organization-status-badge";
import { ManagementActionSheet } from "@/components/management-action-sheet";
import { RowAction } from "@/components/row-action";
import { HoursForm } from "./form";
import type { HourRecord } from "./repository";
import type { Locale } from "@/lib/preferences";
import { formatRiyadhDate, formatRiyadhDateTime } from "@/lib/datetime";
import { academicLevel, academicTerm, formatHours } from "@/lib/display";
import { FormField } from "@/components/form-field";

const labels: Record<string, [string, string]> = {
  Pending: ["بانتظار الاعتماد", "Pending approval"],
  Approved: ["معتمدة", "Approved"],
  Rejected: ["مرفوضة", "Rejected"],
  Voided: ["مبطلة", "Voided"],
  MANUAL: ["إضافة يدوية", "Manual entry"],
  SELF_REPORTED: ["طلب ذاتي", "Self-reported"],
  TASK: ["مهمة", "Task"],
  EVENT: ["فعالية", "Event"],
};
export function HourStatus({
  status,
  locale = "ar",
}: {
  status: string;
  locale?: Locale;
}) {
  return (
    <OrganizationStatusBadge
      status={
        status === "Approved"
          ? "accepted"
          : status === "Pending"
            ? "review"
            : status === "Rejected"
              ? "rejected"
              : "inactive"
      }
    >
      {labels[status]?.[locale === "en" ? 1 : 0] ?? status}
    </OrganizationStatusBadge>
  );
}
function RecordActions({
  record,
  locale,
}: {
  record: HourRecord;
  locale: Locale;
}) {
  const [action, setAction] = useState<
      "adjust" | "details" | "approve" | "reject" | null
    >(null),
    en = locale === "en",
    c = (ar: string, english: string) => (en ? english : ar);
  const editable =
    record.canReview && ["Pending", "Approved"].includes(record.status_code);
  return (
    <>
      <div className="hours-row-actions">
        <RowAction
          label={c("تعديل الساعات", "Adjust hours")}
          hint={
            !editable
              ? c(
                  "يتطلب صلاحية تعديل الساعات وسجلًا قابلًا للتعديل.",
                  "Requires hours permission and an editable record.",
                )
              : undefined
          }
          disabled={!editable}
          onClick={() => setAction("adjust")}
        >
          <SlidersHorizontal />
        </RowAction>
        <RowAction
          label={c("عرض التفاصيل", "View details")}
          onClick={() => setAction("details")}
        >
          <Eye />
        </RowAction>
        {record.canReview && record.status_code === "Pending" ? (
          <>
            <RowAction
              label={c("اعتماد", "Approve")}
              onClick={() => setAction("approve")}
            >
              <Check />
            </RowAction>
            <RowAction
              label={c("رفض", "Reject")}
              danger
              onClick={() => setAction("reject")}
            >
              <X />
            </RowAction>
          </>
        ) : (
          <>
            <span className="row-action-space" />
            <span className="row-action-space" />
          </>
        )}
      </div>
      {action === "adjust" && (
        <ManagementActionSheet
          label=""
          title={c("تعديل الساعات", "Adjust hours")}
          locale={locale}
          open
          onOpenChange={(open) => {
            if (!open) setAction(null);
          }}
          hideTrigger
        >
          <HourAdjustment
            record={record}
            locale={locale}
            onSuccess={() => setAction(null)}
          />
        </ManagementActionSheet>
      )}
      {action === "details" && (
        <ManagementActionSheet
          label=""
          title={c("تفاصيل سجل الساعات", "Hours record details")}
          locale={locale}
          open
          onOpenChange={(open) => {
            if (!open) setAction(null);
          }}
          hideTrigger
          presentation="sheet"
        >
          <div className="hour-record-details">
            <HourStatus status={record.status_code} locale={locale}/>
            <dl className="hour-detail-fields">
              <div>
                <dt>{c("الجهة", "Organization")}</dt>
                <dd>{record.org_name}</dd>
              </div>
              <div>
                <dt>{c("السبب", "Reason")}</dt>
                <dd>{record.description}</dd>
              </div>
              <div>
                <dt>{c("الساعات", "Hours")}</dt>
                <dd>{formatHours(record.hours, locale)}</dd>
              </div>
              <div>
                <dt>{c("التاريخ", "Date")}</dt>
                <dd>{formatRiyadhDate(record.activity_date, locale, true)}</dd>
              </div>

            </dl>
            {record.decisions.length > 0 && (
              <><Separator/><Collapsible className="hour-decision-details">
                <CollapsibleTrigger render={<Button type="button" variant="ghost" className="hour-detail-toggle"/>}>
                  <ChevronDown aria-hidden="true" />
                  {c("تفاصيل القرار", "Decision details")}
                </CollapsibleTrigger>
                <CollapsibleContent className="flex flex-col gap-3 pt-3">
                  {record.decisions.map((decision, index) => (
                    <div key={index}>
                      <HourStatus
                        status={decision.status_code}
                        locale={locale}
                      />
                      <p className="text-sm text-muted-foreground">
                        {formatRiyadhDateTime(
                          decision.created_at,
                          locale,
                          true,
                        )}
                      </p>
                      {decision.note && (
                        <p className="whitespace-pre-wrap">{decision.note}</p>
                      )}
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible></>
            )}
            <Separator/><Collapsible>
              <CollapsibleTrigger render={<Button type="button" variant="ghost" className="hour-detail-toggle"/>}><ChevronDown/>
                {c("سجل التعديلات", "Adjustment history")}
              </CollapsibleTrigger><CollapsibleContent className="pt-3">
              {record.adjustments?.length ? (
                <ol className="flex flex-col gap-4">
                  {record.adjustments.map((item, index) => {
                    const delta =
                      Number(item.after_hours) - Number(item.before_hours);
                    return (
                      <li key={index} className="border-s border-border ps-3">
                        <p>
                          {c("تعديل", "Adjustment")}{" "}
                          <bdi dir="ltr">
                            {delta > 0 ? "+" : "−"}
                            {Math.abs(delta)}{" "}
                            {en
                              ? "hours"
                              : Math.abs(delta) >= 3 && Math.abs(delta) <= 10
                                ? "ساعات"
                                : "ساعة"}
                          </bdi>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatRiyadhDateTime(item.created_at, locale, true)}{" "}
                          · {c("بواسطة", "by")} {item.actor_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {item.before_hours} ← {item.after_hours}
                        </p>
                        {item.note && (
                          <p className="whitespace-pre-wrap text-sm">
                            {item.note}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {c("لم تُعدّل ساعات هذا السجل.", "No adjustments yet.")}
                </p>
              )}
            </CollapsibleContent></Collapsible>
          </div>
        </ManagementActionSheet>
      )}
      {(action === "approve" || action === "reject") && (
        <ManagementActionSheet
          label=""
          title={
            action === "reject"
              ? c(
                  `رفض ساعات ${record.owner ?? record.org_name}؟`,
                  `Reject hours for ${record.owner ?? record.org_name}?`,
                )
              : c(
                  `اعتماد ساعات ${record.owner ?? record.org_name}؟`,
                  `Approve hours for ${record.owner ?? record.org_name}?`,
                )
          }
          locale={locale}
          open
          onOpenChange={(open) => {
            if (!open) setAction(null);
          }}
          hideTrigger
        >
          <p className="mb-4 text-sm text-muted-foreground">
            {action === "reject"
              ? c(
                  "سيصبح السجل مرفوضًا ولن يُحتسب في الساعات المعتمدة.",
                  "The record will be rejected and excluded from approved hours.",
                )
              : c(
                  "ستُضاف ساعات السجل إلى الرصيد المعتمد.",
                  "The record will count toward approved hours.",
                )}
          </p>
          <HoursForm
            operation="review"
            fields={{
              record: record.id,
              status: action === "reject" ? "Rejected" : "Approved",
              ...(action === "approve" ? { note: "" } : {}),
            }}
            label={
              action === "reject"
                ? c("تأكيد الرفض", "Confirm rejection")
                : c("اعتماد الساعات", "Approve hours")
            }
            locale={locale}
            buttonClassName={action === "reject" ? "button-danger" : undefined}
            onSuccess={() => setAction(null)}
          >
            {action === "reject" && <FormField  id={`hour-rejection-${record.id}`} label={<>{c("سبب الرفض", "Rejection reason")}</>}><Textarea id={`hour-rejection-${record.id}`} name="note" required maxLength={3000} rows={3}/></FormField>}
          </HoursForm>
        </ManagementActionSheet>
      )}
    </>
  );
}
export function HoursRecordTable({
  items,
  locale = "ar",
  personal = false,
}: {
  items: HourRecord[];
  locale?: Locale;
  personal?: boolean;
}) {
  const en = locale === "en",
    c = (ar: string, english: string) => (en ? english : ar),
    records = items.slice(0, 25);
  const source = (record: HourRecord) =>
    `${labels[record.source_code]?.[en ? 1 : 0] ?? record.source_code}${!personal && record.context?.added_by ? ` ${c("بواسطة", "by")} ${record.context.added_by}` : ""}`;
  const identity = (record: HourRecord) => (
    <div className="flex min-w-0 items-center gap-2.5">
      {!personal && (
        <Avatar>
          <AvatarFallback>
            {record.owner?.trim().slice(0, 1) || "؟"}
          </AvatarFallback>
        </Avatar>
      )}
      <div className="min-w-0">
        <p className="font-medium break-words">
          {personal ? record.org_name : (record.owner ?? c("عضو", "Member"))}
        </p>
        <p className="text-xs text-muted-foreground break-words">
          {personal
            ? academicTerm(record.term_name, locale)
            : [
                record.context?.major,
                academicLevel(record.context?.level, locale),
              ]
                .filter(Boolean)
                .join(" · ")}
        </p>
      </div>
    </div>
  );
  return (
    <section
      className="hours-ledger min-w-0"
      aria-label={c("سجلات الساعات", "Hours records")}
    >
      <div className="hours-ledger-table rounded-lg border border-border">
        <Table className="hours-table"><colgroup><col/>{!personal&&<><col className="hours-column-committee"/><col className="hours-column-reason"/></>}<col className="hours-column-value"/><col className="hours-column-date"/>{personal&&<col className="hours-column-source"/>}<col className="hours-column-status"/><col className="hours-column-actions"/></colgroup>
          <TableHeader>
            <TableRow>
              <TableHead>
                {personal ? c("الجهة", "Organization") : c("العضو", "Member")}
              </TableHead>
              {!personal && (
                <>
                  <TableHead>{c("اللجنة", "Committee")}</TableHead>
                  <TableHead>{c("السبب", "Reason")}</TableHead>
                </>
              )}
              <TableHead>{c("الساعات", "Hours")}</TableHead>
              <TableHead>
                {personal
                  ? c("التاريخ", "Date")
                  : c("التاريخ والفصل", "Date and term")}
              </TableHead>
              {personal && <TableHead>{c("المصدر", "Source")}</TableHead>}
              <TableHead>{c("الحالة", "Status")}</TableHead>
              <TableHead>{c("الإجراءات", "Actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((record) => (
              <TableRow key={record.id}>
                <TableCell>{identity(record)}</TableCell>
                {!personal && (
                  <>
                    <TableCell>
                      {record.context?.committee_name ??
                        c("بدون لجنة", "No committee")}
                    </TableCell>
                    <TableCell>
                      <p dir="auto" className="break-words">
                        {record.description}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {source(record)}
                      </p>
                    </TableCell>
                  </>
                )}
                <TableCell>{formatHours(record.hours, locale)}</TableCell>
                <TableCell>
                  <time dateTime={record.activity_date}>
                    {formatRiyadhDate(record.activity_date, locale)}
                  </time>
                  {!personal && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {academicTerm(record.term_name, locale)}
                    </p>
                  )}
                </TableCell>
                {personal && <TableCell>{source(record)}</TableCell>}
                <TableCell>
                  <HourStatus status={record.status_code} locale={locale} />
                </TableCell>
                <TableCell>
                  <RecordActions record={record} locale={locale} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="hours-ledger-cards">
        {records.map((record) => (
          <li key={record.id}>
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle>{identity(record)}</CardTitle>
                  <HourStatus status={record.status_code} locale={locale} />
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  <strong>{formatHours(record.hours, locale)}</strong>
                  <span>{record.context?.committee_name}</span>
                  <time dateTime={record.activity_date}>
                    {formatRiyadhDate(record.activity_date, locale)}
                  </time>
                </div>
                {!personal && (
                  <p className="text-sm text-muted-foreground">
                    {academicTerm(record.term_name, locale)}
                  </p>
                )}
                <p dir="auto" className="break-words">
                  {record.description}
                </p>
                <p className="text-xs text-muted-foreground">
                  {source(record)}
                </p>
                <div className="border-t border-border pt-3">
                  <RecordActions record={record} locale={locale} />
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
