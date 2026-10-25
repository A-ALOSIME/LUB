import Link from "next/link"
import { CalendarDays, Clock, ChevronDown } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item"
import { LiveFilterForm } from "@/components/live-filter-form"
import { WorkspaceEmptyState } from "@/components/workspace-empty-state"
import { ActivityHourFilter, type ActivityHourStatus } from "./activity-hour-filter"
import type { HoursData } from "@/features/hours/repository"
import { HoursFields, TermSelect } from "@/features/hours/view"
import { HoursRecordTable } from "@/features/hours/hours-record-table"
import { Progress } from "@/components/ui/progress"
import { formatHours } from "@/lib/display"
import { HoursStatusSummary } from "@/features/hours/hours-status-summary"
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
    <div className="flex min-w-0 items-center gap-3 overflow-x-auto pb-1">
      <LiveFilterForm action="/activity" method="get" className="w-56 shrink-0">
        <input type="hidden" name="tab" value="hours" />
        <input type="hidden" name="page" value="0" />
        {statusCode && <input type="hidden" name="hourStatus" value={status} />}
        <TermSelect compact terms={data.terms} all value={term ?? ""} locale={locale} className="w-full min-w-0" />
      </LiveFilterForm>
      <div className="shrink-0"><ActivityHourFilter value={status} locale={locale} /></div>
    </div>

    <HoursStatusSummary totals={data.hoursByStatus} locale={locale} />
    {data.byOrg.length > 0 && <details className="min-w-0 rounded-lg border border-border/70 p-3">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium"><ChevronDown aria-hidden="true" className="size-4"/>{c("توزيع الساعات حسب الجهة", "Hours by organization")}</summary>
      <ul className="mt-3 flex flex-col gap-2 border-t border-border/60 pt-3 text-sm">
        {data.byOrg.map((organization, index) => <li key={`${organization.name}-${index}`} className="grid min-w-0 max-w-2xl gap-2">
          <div className="flex flex-wrap items-center gap-3"><bdi>{organization.name}</bdi><span className="tabular-nums">{formatHours(organization.total,locale)}</span></div><Progress value={Number(data.total)>0?Number(organization.total)/Number(data.total)*100:0} aria-label={organization.name}/>
        </li>)}
      </ul>
    </details>}
    {data.records.length
      ? <HoursRecordTable items={data.records} locale={locale} personal />
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
