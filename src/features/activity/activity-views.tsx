import Link from "next/link"
import { CalendarDays, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item"
import { LiveFilterForm } from "@/components/live-filter-form"
import { WorkspaceEmptyState } from "@/components/workspace-empty-state"
import { ActivityHourFilter, type ActivityHourStatus } from "./activity-hour-filter"
import type { HourRecord, HoursData } from "@/features/hours/repository"
import { HoursFields, TermSelect, hourLabels, hourLabelsEn } from "@/features/hours/view"
import { HoursStatusSummary } from "@/features/hours/hours-status-summary"
import { HoursForm } from "@/features/hours/form"
import { eventDate, eventLabels } from "@/features/events/view"
import { eventDateEn, eventLabelsEn } from "@/features/events/display"
import { TaskPagination } from "@/features/tasks/task-list"
import type { Locale } from "@/lib/preferences"
import { formatRiyadhDate } from "@/lib/datetime"

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
    </ItemGroup> : <WorkspaceEmptyState
      icon={CalendarDays}
      title={en ? "No event registrations yet" : "ما سجلت في فعالية بعد"}
      description={en ? "Browse upcoming events to find one to join." : "تصفح الفعاليات القادمة للعثور على فعالية تناسبك."}
      action={<Link href="/events" className={buttonVariants({ size: "lg", className: "workspace-empty-state-action w-full sm:w-auto" })}><CalendarDays data-icon="inline-start" aria-hidden="true" />{en ? "Browse events" : "تصفح الفعاليات"}</Link>}
    />}
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
  return <ItemGroup role="list" aria-label={c("سجلات الساعات", "Hour records")}>
    {items.slice(0, 25).map(item => <Item key={item.id} role="listitem" size="sm" className="items-start">
      <ItemMedia variant="icon" className="mt-0.5"><Clock aria-hidden="true" /></ItemMedia>
      <ItemContent>
        <ItemTitle>{item.owner ?? c("سجل ساعات", "Hours record")} · {item.hours} {c("ساعة", "hours")}</ItemTitle>
        <ItemDescription className="flex flex-col gap-0.5">
          <span dir="auto">{item.org_name} · {item.term_name} · {formatRiyadhDate(item.activity_date, locale)} · {labels[item.source_code] ?? item.source_code}</span>
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

export function ActivityHours({ data, page, term, status, locale }: {
  data: HoursData
  page: number
  term: string | null
  status: ActivityHourStatus
  locale: Locale
}) {
  const en = locale === "en"
  const c = (ar: string, english: string) => en ? english : ar
  const statusCode = status === "all" ? null : status === "approved" ? "Approved" : status === "pending" ? "Pending" : "Rejected"

  return <div className="flex min-w-0 flex-col gap-4">
    <div className="grid min-w-0 grid-cols-1 items-end gap-3 lg:grid-cols-[minmax(12rem,14rem)_minmax(0,1fr)]">
      <LiveFilterForm action="/activity" method="get" className="min-w-0">
        <input type="hidden" name="tab" value="hours" />
        <input type="hidden" name="page" value="0" />
        {statusCode && <input type="hidden" name="hourStatus" value={status} />}
        <TermSelect terms={data.terms} all value={term ?? ""} locale={locale} className="w-full min-w-0" />
      </LiveFilterForm>
      <div className="min-w-0 max-w-full overflow-x-auto"><ActivityHourFilter value={status} locale={locale} /></div>
    </div>

    <HoursStatusSummary totals={data.hoursByStatus} locale={locale} />
    {data.byOrg.length > 0 && <details className="min-w-0 rounded-lg border border-border/70 p-3">
      <summary className="cursor-pointer text-sm font-medium">{c("توزيع الساعات حسب الجهة", "Hours by organization")}</summary>
      <ul className="mt-3 flex flex-col gap-2 border-t border-border/60 pt-3 text-sm">
        {data.byOrg.map((organization, index) => <li key={`${organization.name}-${index}`} className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <bdi>{organization.name}</bdi><span className="tabular-nums">{new Intl.NumberFormat(en ? "en-US" : "ar-SA-u-nu-latn", { maximumFractionDigits: 2 }).format(Number(organization.total))} {c("ساعة", "hours")}</span>
        </li>)}
      </ul>
    </details>}
    {data.records.length
      ? <ActivityHourRows items={data.records} locale={locale} />
      : <WorkspaceEmptyState icon={Clock} title={c("لا توجد سجلات ساعات", "No hour records")} description={c("لا توجد سجلات لهذه الفترة والحالة.", "No records match this term and status.")} />}
    {(page > 0 || data.records.length > 25) && <TaskPagination page={page} more={data.records.length > 25} base="/activity" query={{ tab: "hours", ...(term ? { term } : {}), ...(statusCode ? { hourStatus: status } : {}) }} locale={locale} />}

    {data.memberships.filter(membership => membership.self).map(membership => <details key={membership.id} className="rounded-lg border border-border/70 p-3">
      <summary className="cursor-pointer text-sm font-medium">{c("طلب ساعات ذاتي", "Self-reported hours request")} · <bdi>{membership.name}</bdi></summary>
      <div className="pt-3"><HoursForm operation="self" fields={{ member: membership.id }} label={c("إرسال للمراجعة", "Submit for review")} locale={locale}>
        <label>{c("نطاق العمل", "Work scope")}<select name="committee"><option value="">{c("الجهة بالكامل", "Whole organization")}</option>{membership.committees.map(item => <option key={item.id} value={item.id} dir="auto">{item.name}</option>)}</select></label>
        <HoursFields locale={locale} />
      </HoursForm></div>
    </details>)}
  </div>
}
