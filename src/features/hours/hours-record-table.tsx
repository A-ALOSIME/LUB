"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { ManagementActionSheet } from "@/components/management-action-sheet";
import { HoursForm } from "./form";
import type { HourRecord } from "./repository";
import type { Locale } from "@/lib/preferences";
import { formatRiyadhDate } from "@/lib/datetime";

const labels = { Pending: ["بانتظار الاعتماد", "Pending approval"], Approved: ["معتمدة", "Approved"], Rejected: ["مرفوضة", "Rejected"], Voided: ["مبطلة", "Voided"] } as const;
const date = (value: string, locale: Locale) => formatRiyadhDate(value, locale);

function ReviewAction({ record, locale }: { record: HourRecord; locale: Locale }) {
  const en = locale === "en", c = (ar: string, english: string) => en ? english : ar;
  if (!record.canReview || !["Pending", "Approved"].includes(record.status_code)) return null;

  return <ManagementActionSheet label={record.status_code === "Approved" ? c("تصحيح", "Correct") : c("مراجعة", "Review")} title={record.status_code === "Approved" ? c("إبطال السجل للتصحيح", "Void record for correction") : c("مراجعة الساعات", "Review hours")} variant="outline" locale={locale}>
    <HoursForm operation="review" fields={{ record: record.id, ...(record.status_code === "Approved" ? { status: "Voided" } : {}) }} label={c("حفظ القرار", "Save decision")} locale={locale}>
      {record.status_code === "Pending" && <label>{c("القرار", "Decision")}<NativeSelect name="status"><option value="Approved">{c("اعتماد", "Approve")}</option><option value="Rejected">{c("رفض", "Reject")}</option></NativeSelect></label>}
      <label>{c("سبب القرار", "Decision reason")}<textarea name="note" maxLength={3000} rows={3} required={record.status_code === "Approved"}/></label>
      {record.status_code === "Approved" && <label className="flex items-center gap-2"><input type="checkbox" name="confirm" required className="size-4"/>{c("أؤكد إبطال الساعات", "Confirm voiding these hours")}</label>}
    </HoursForm>
  </ManagementActionSheet>;
}

function RecordStatus({ record, locale }: { record: HourRecord; locale: Locale }) {
  const en = locale === "en";
  const status = labels[record.status_code as keyof typeof labels];
  return <Badge variant={record.status_code === "Approved" ? "secondary" : record.status_code === "Rejected" ? "destructive" : "outline"}>{status?.[en ? 1 : 0] ?? record.status_code}</Badge>;
}

export function HoursRecordTable({ items, locale = "ar" }: { items: HourRecord[]; locale?: Locale }) {
  const en = locale === "en", c = (ar: string, english: string) => en ? english : ar;
  const records = items.slice(0, 25);

  return <section className="min-w-0" aria-label={c("سجلات الساعات", "Hours records")}>
    <ul className="grid min-w-0 gap-2 lg:hidden">
      {records.map(record => <li key={record.id}>
        <Card size="sm" className="min-w-0 gap-0">
          <CardHeader className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1">
            <CardTitle className="min-w-0 break-words text-sm font-semibold" dir="auto">{record.owner ?? c("عضو", "Member")}</CardTitle>
            <div className="row-span-2"><RecordStatus record={record} locale={locale}/></div>
            <CardDescription className="col-start-1 min-w-0 break-words text-xs">
              <time dateTime={record.activity_date}>{date(record.activity_date, locale)}</time><span aria-hidden="true"> · </span><span>{record.term_name}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="grid min-w-0 gap-3 pt-3">
            <p dir="auto" className="break-words text-sm leading-6">{record.description}</p>
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
              <p className="text-sm"><span className="text-muted-foreground">{c("الساعات", "Hours")}: </span><bdi className="font-semibold tabular-nums">{record.hours}</bdi></p>
              <ReviewAction record={record} locale={locale}/>
            </div>
          </CardContent>
        </Card>
      </li>)}
    </ul>

    <div className="hidden min-w-0 overflow-x-auto rounded-lg border border-border lg:block">
      <table className="w-full min-w-[52rem] text-sm">
        <thead className="bg-muted/40"><tr>
          <th className="px-3 py-2 text-start font-medium">{c("العضو", "Member")}</th>
          <th className="px-3 py-2 text-start font-medium">{c("التاريخ والفصل", "Date and term")}</th>
          <th className="px-3 py-2 text-start font-medium">{c("السبب", "Reason")}</th>
          <th className="px-3 py-2 text-start font-medium">{c("الساعات", "Hours")}</th>
          <th className="px-3 py-2 text-start font-medium">{c("الحالة", "Status")}</th>
          <th className="px-3 py-2 text-start font-medium">{c("إجراء", "Action")}</th>
        </tr></thead>
        <tbody className="divide-y divide-line">{records.map(record => <tr key={record.id}>
          <td className="px-3 py-3 font-medium" dir="auto">{record.owner ?? c("عضو", "Member")}</td>
          <td className="whitespace-nowrap px-3 py-3"><time dateTime={record.activity_date}>{date(record.activity_date, locale)}</time><div className="mt-1 text-xs text-muted">{record.term_name}</div></td>
          <td className="max-w-72 whitespace-normal px-3 py-3"><p dir="auto" className="line-clamp-2">{record.description}</p></td>
          <td className="px-3 py-3 font-semibold tabular-nums">{record.hours}</td>
          <td className="px-3 py-3"><RecordStatus record={record} locale={locale}/></td>
          <td className="px-3 py-3"><ReviewAction record={record} locale={locale}/></td>
        </tr>)}</tbody>
      </table>
    </div>
  </section>;
}
