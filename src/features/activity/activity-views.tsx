import Link from "next/link"
import { CalendarDays, Clock, FileText } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item"
import { ActivityDocumentsSheet } from "./activity-documents-sheet"
import { ActivityHourFilter, type ActivityHourStatus } from "./activity-hour-filter"
import { DocumentForm } from "@/features/documents/form"
import type { DocumentItem } from "@/features/documents/repository"
import type { HourRecord, HoursData } from "@/features/hours/repository"
import { HoursFields, TermSelect, hourLabels, hourLabelsEn } from "@/features/hours/view"
import { HoursForm } from "@/features/hours/form"
import { eventDate, eventLabels } from "@/features/events/view"
import { eventDateEn, eventLabelsEn } from "@/features/events/display"
import { TaskPagination } from "@/features/tasks/task-list"
import type { Locale } from "@/lib/preferences"

type MyEvent = { id: string; title: string; starts_at: string; status_code: string; registration: string; attendance: string }

function statusVariant(status: string): "secondary" | "outline" | "destructive" {
  if (["Approved", "Present", "Completed", "Registered"].includes(status)) return "secondary"
  if (["Rejected", "Cancelled", "Absent"].includes(status)) return "destructive"
  return "outline"
}

export function ActivityEventRows({ events, page, locale }: { events: MyEvent[]; page: number; locale: Locale }) {
  const en = locale === "en"
  const labels = en ? eventLabelsEn : eventLabels
  const date = en ? eventDateEn : eventDate

  return <div className="flex min-w-0 flex-col gap-3">
    {events.length ? <ItemGroup role="list" aria-label={en ? "My events" : "فعالياتي"}>
      {events.slice(0, 25).map(event => <Item key={event.id} role="listitem" size="sm">
        <ItemMedia variant="icon"><CalendarDays aria-hidden="true" /></ItemMedia>
        <ItemContent>
          <ItemTitle><Link className="text-foreground hover:underline" href={`/events/${event.id}`} dir="auto">{event.title}</Link></ItemTitle>
          <ItemDescription>{date(event.starts_at)} · {labels[event.registration] ?? event.registration} · {labels[event.attendance] ?? event.attendance}</ItemDescription>
        </ItemContent>
        <ItemActions><Badge variant={statusVariant(event.attendance === "Pending" ? event.registration : event.attendance)}>{labels[event.attendance] ?? labels[event.registration] ?? event.attendance}</Badge></ItemActions>
      </Item>)}
    </ItemGroup> : <p role="status" className="py-3 text-sm text-muted-foreground">{en ? "You have not registered for an event yet." : "ما سجلت في فعالية بعد."}</p>}
    {(page > 0 || events.length > 25) && <nav aria-label={en ? "My event pages" : "صفحات فعالياتي"} className="flex flex-wrap gap-3">
      {page > 0 && <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/activity?tab=events&page=${page - 1}`}>{en ? "Previous" : "السابق"}</Link>}
      {events.length > 25 && <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/activity?tab=events&page=${page + 1}`}>{en ? "Next" : "التالي"}</Link>}
    </nav>}
  </div>
}

function ActivityHourRows({ items, locale }: { items: HourRecord[]; locale: Locale }) {
  const en = locale === "en"
  const labels = en ? hourLabelsEn : hourLabels
  const c = (ar: string, english: string) => en ? english : ar
  if (!items.length) return <p role="status" className="py-3 text-sm text-muted-foreground">{c("لا توجد سجلات بهذه الحالة.", "No records match this status.")}</p>

  return <ItemGroup role="list" aria-label={c("سجلات الساعات", "Hour records")}>
    {items.slice(0, 25).map(item => <Item key={item.id} role="listitem" size="sm" className="items-start">
      <ItemMedia variant="icon" className="mt-0.5"><Clock aria-hidden="true" /></ItemMedia>
      <ItemContent>
        <ItemTitle>{item.owner ?? c("سجل ساعات", "Hours record")} · {item.hours} {c("ساعة", "hours")}</ItemTitle>
        <ItemDescription className="flex flex-col gap-0.5">
          <span dir="auto">{item.org_name} · {item.term_name} · {item.activity_date} · {labels[item.source_code] ?? item.source_code}</span>
          <span dir="auto" className="line-clamp-2">{item.description}</span>
        </ItemDescription>
        {item.decisions.length > 0 && <details className="mt-1 text-xs text-muted-foreground">
          <summary className="cursor-pointer">{c("تفاصيل القرار", "Decision details")}</summary>
          <div className="flex flex-col gap-1 pt-1">{item.decisions.map((decision, index) => <p key={`${decision.created_at}-${index}`}>{labels[decision.status_code] ?? decision.status_code}{decision.note && <>: <span dir="auto">{decision.note}</span></>}</p>)}</div>
        </details>}
        {item.canReview && ["Pending", "Approved"].includes(item.status_code) && <details className="mt-1 text-xs">
          <summary className="cursor-pointer font-medium">{item.status_code === "Approved" ? c("إبطال السجل للتصحيح", "Void record for correction") : c("مراجعة الساعات", "Review hours")}</summary>
          <div className="pt-2"><HoursForm operation="review" fields={{ record: item.id, ...(item.status_code === "Approved" ? { status: "Voided" } : {}) }} label={c("حفظ القرار", "Save decision")} locale={locale}>
            {item.status_code === "Pending" && <label>{c("القرار", "Decision")}<select name="status"><option value="Approved">{c("اعتماد", "Approve")}</option><option value="Rejected">{c("رفض", "Reject")}</option></select></label>}
            <label>{c("سبب القرار", "Reason for decision")}<textarea name="note" maxLength={3000} rows={3} required={item.status_code === "Approved"} /></label>
            {item.status_code === "Approved" && <label className="flex items-center gap-2"><input type="checkbox" name="confirm" required className="size-4" />{c("أؤكد إبطال الساعات", "I confirm voiding these hours")}</label>}
          </HoursForm></div>
        </details>}
      </ItemContent>
      <ItemActions><Badge variant={statusVariant(item.status_code)}>{labels[item.status_code] ?? item.status_code}</Badge></ItemActions>
    </Item>)}
  </ItemGroup>
}

function ActivityDocumentRows({ items, locale }: { items: DocumentItem[]; locale: Locale }) {
  const en = locale === "en"
  const c = (ar: string, english: string) => en ? english : ar
  const statuses: Record<string, string> = en
    ? { Archived: "Archived", Ready: "Ready", Generating: "Preparing", Failed: "Failed" }
    : { Archived: "مؤرشف", Ready: "جاهز", Generating: "جارٍ التجهيز", Failed: "تعذّر التجهيز" }
  if (!items.length) return <p role="status" className="py-6 text-center text-sm text-muted-foreground">{c("لا توجد مستندات محفوظة.", "No saved documents.")}</p>

  return <ItemGroup role="list" aria-label={c("مستنداتي", "My documents")}>
    {items.slice(0, 25).map(document => <Item key={document.id} role="listitem" size="sm" className="items-start">
      <ItemMedia variant="icon" className="mt-0.5"><FileText aria-hidden="true" /></ItemMedia>
      <ItemContent>
        <ItemTitle>{document.document_type_code === "Hours_Certificate" ? c("بيان الساعات التطوعية", "Volunteer hours certificate") : c("تقرير الساعات", "Hours report")}</ItemTitle>
        <ItemDescription dir="auto">{document.name} · {document.scope} · {document.period} · {document.total} {c("ساعة", "hours")}</ItemDescription>
        {document.canArchive && document.status_code === "Ready" && <details className="mt-1 text-xs">
          <summary className="cursor-pointer">{c("أرشفة النسخة", "Archive copy")}</summary>
          <div className="pt-2"><DocumentForm operation="archive" fields={{ document: document.id }} label={c("أرشفة", "Archive")} locale={locale}>
            <label className="flex items-center gap-2"><input name="confirm" type="checkbox" required className="size-4" />{c("أؤكد الأرشفة مع بقاء النسخة المحفوظة", "I confirm archiving while keeping the saved copy")}</label>
          </DocumentForm></div>
        </details>}
      </ItemContent>
      <ItemActions className="flex-col items-end sm:flex-row sm:items-center">
        <Badge variant={statusVariant(document.status_code)}>{statuses[document.status_code] ?? document.status_code}</Badge>
        {document.status_code === "Ready" || document.status_code === "Archived"
          ? <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/documents/${document.id}/file`}>{c("تنزيل", "Download")}</Link>
          : document.canRetry && <DocumentForm operation="retry" fields={{ document: document.id }} label={c("إعادة التجهيز", "Retry")} locale={locale} />}
      </ItemActions>
    </Item>)}
  </ItemGroup>
}

export function ActivityHours({ data, page, term, status, documents, documentsPage, locale }: {
  data: HoursData
  page: number
  term: string | null
  status: ActivityHourStatus
  documents: DocumentItem[]
  documentsPage: number
  locale: Locale
}) {
  const en = locale === "en"
  const c = (ar: string, english: string) => en ? english : ar
  const statusCode = status === "all" ? null : status === "approved" ? "Approved" : status === "pending" ? "Pending" : "Rejected"

  return <div className="flex min-w-0 flex-col gap-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-base font-semibold">{c("سجل الساعات", "Hours history")}</h2>
      <ActivityDocumentsSheet locale={locale}>
        <ActivityDocumentRows items={documents} locale={locale} />
        {(documentsPage > 0 || documents.length > 25) && <nav aria-label={en ? "Document pages" : "صفحات المستندات"} className="flex flex-wrap gap-2 py-3">
          {documentsPage > 0 && <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/activity?tab=hours&documents=1&docPage=${documentsPage - 1}`}>{en ? "Previous" : "السابق"}</Link>}
          {documents.length > 25 && <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/activity?tab=hours&documents=1&docPage=${documentsPage + 1}`}>{en ? "Next" : "التالي"}</Link>}
        </nav>}
      </ActivityDocumentsSheet>
    </div>

    <form action="/activity" method="get" className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="tab" value="hours" />
      {statusCode && <input type="hidden" name="hourStatus" value={status} />}
      <div className="min-w-0 flex-1 sm:max-w-xs"><TermSelect terms={data.terms} all value={term ?? ""} locale={locale} /></div>
      <Button type="submit" variant="outline" size="sm">{c("عرض الفترة", "Show period")}</Button>
    </form>

    <Card size="sm">
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle>{c("الرصيد المعتمد", "Approved balance")}</CardTitle>
        <span className="text-lg font-semibold tabular-nums">{new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(data.total))} <span className="text-sm font-normal text-muted-foreground">{c("ساعة", "hours")}</span></span>
      </CardHeader>
      {data.byOrg.length > 0 && <CardContent className="flex flex-col gap-2">
        {data.byOrg.map((organization, index) => <div key={`${organization.name}-${index}`} className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2 text-sm">
          <bdi>{organization.name}</bdi><span className="tabular-nums">{new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(organization.total))} {c("ساعة", "hours")}</span>
        </div>)}
      </CardContent>}
    </Card>

    <ActivityHourFilter value={status} locale={locale} />
    <ActivityHourRows items={data.records} locale={locale} />
    {(page > 0 || data.records.length > 25) && <TaskPagination page={page} more={data.records.length > 25} base="/activity" query={{ tab: "hours", ...(term ? { term } : {}), ...(statusCode ? { hourStatus: status } : {}) }} locale={locale} />}

    {data.memberships.filter(membership => membership.self).map(membership => <details key={membership.id} className="rounded-lg border border-border/70 p-3">
      <summary className="cursor-pointer text-sm font-medium">{c("طلب ساعات ذاتي", "Self-reported hours request")} · <bdi>{membership.name}</bdi></summary>
      <div className="pt-3"><HoursForm operation="self" fields={{ member: membership.id }} label={c("إرسال للمراجعة", "Submit for review")} locale={locale}>
        <label>{c("نطاق العمل", "Work scope")}<select name="committee"><option value="">{c("الجهة بالكامل", "Whole organization")}</option>{membership.committees.map(item => <option key={item.id} value={item.id} dir="auto">{item.name}</option>)}</select></label>
        <HoursFields terms={data.terms} locale={locale} />
      </HoursForm></div>
    </details>)}
  </div>
}
