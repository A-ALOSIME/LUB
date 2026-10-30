
import {ContentText} from "@/components/content-text";
import {createTranslator,t as translateUi} from "@/lib/i18n";
import {NativeSelect} from "@/components/ui/native-select";
import Link from "next/link"
import { CalendarDays, Clock, ChevronDown } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {Button, buttonVariants } from "@/components/ui/button"
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item"
import { LiveFilterForm } from "@/components/live-filter-form"
import { WorkspaceEmptyState } from "@/components/workspace-empty-state"
import { ActivityHourFilter, type ActivityHourStatus } from "./activity-hour-filter"
import type { HoursData } from "@/features/hours/repository"
import { HoursFields, TermSelect } from "@/features/hours/view"
import { HoursRecordTable } from "@/features/hours/hours-record-table"
import { Progress } from "@/components/ui/progress"
import { formatHours, academicTerm } from "@/lib/display"
import { HoursStatusSummary } from "@/features/hours/hours-status-summary"
import { HoursForm } from "@/features/hours/form"
import {formatRiyadhDate} from "@/lib/datetime"

import { TaskPagination } from "@/features/tasks/task-list"
import type { Locale } from "@/lib/preferences"
import { FormField } from "@/components/form-field";

type MyEvent = { id: string; title: string; starts_at: string; status_code: string; registration: string; review_status?:string;attendance: string }

function statusVariant(status: string): "secondary" | "outline" | "destructive" {
  if (["Approved", "Present", "Completed", "Registered"].includes(status)) return "secondary"
  if (["Rejected", "Cancelled", "Absent"].includes(status)) return "destructive"
  return "outline"
}

export function ActivityEventRows({ events, page, locale,onPageChange }: { events: MyEvent[]; page: number; locale: Locale;onPageChange?:(page:number)=>void }) {
  const en = locale === "en"
  const date=(value:string)=>formatRiyadhDate(value,locale)
  const eventState=(event:MyEvent)=>event.registration==="Cancelled"?translateUi((en) ? "en" : "ar", "أُلغي التسجيل", "Registration cancelled"):event.review_status==="Rejected"?translateUi((en) ? "en" : "ar", "مرفوض", "Registration rejected"):event.review_status==="Pending"?translateUi((en) ? "en" : "ar", "بانتظار الموافقة", "Awaiting approval"):event.attendance==="Present"?translateUi((en) ? "en" : "ar", "حضور مؤكد", "Attendance confirmed"):event.attendance==="Absent"?translateUi((en) ? "en" : "ar", "لم تحضر", "Did not attend"):event.attendance==="Excused"?translateUi((en) ? "en" : "ar", "معذور", "Excused"):translateUi((en) ? "en" : "ar", "مقبول · بانتظار تأكيد الحضور", "Accepted · awaiting attendance confirmation")

  return <div className="flex min-w-0 flex-col gap-3">
    {events.length ? <ItemGroup role="list" aria-label={translateUi((en) ? "en" : "ar", "فعالياتي", "My events")}>
      {events.slice(0,25).map(event=><Link key={event.id} href={`/events/${event.id}`} className="rounded-lg outline-none hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-ring"><Item role="listitem" size="sm"><ItemMedia variant="icon"><CalendarDays aria-hidden="true"/></ItemMedia><ItemContent><ItemTitle className="flex flex-wrap items-center gap-2"><bdi><ContentText value={event.title}/></bdi><Badge variant={statusVariant(event.review_status==='Rejected'?'Rejected':event.attendance)}>{eventState(event)}</Badge></ItemTitle><ItemDescription>{date(event.starts_at)}</ItemDescription></ItemContent></Item></Link>)}
    </ItemGroup> : <WorkspaceEmptyState
      icon={CalendarDays}
      title={translateUi((en) ? "en" : "ar", "ما سجلت في فعالية بعد", "No event registrations yet")}
      description={translateUi((en) ? "en" : "ar", "تصفح الفعاليات القادمة للعثور على فعالية تناسبك.", "Browse upcoming events to find one to join.")}
      action={<Link href="/events" className={buttonVariants({ size: "lg", className: "workspace-empty-state-action w-full sm:w-auto" })}><CalendarDays data-icon="inline-start" aria-hidden="true" />{translateUi((en) ? "en" : "ar", "تصفح الفعاليات", "Browse events")}</Link>}
    />}
    {(page > 0 || events.length > 25) && <nav aria-label={translateUi((en) ? "en" : "ar", "صفحات فعالياتي", "My event pages")} className="flex flex-wrap gap-3">
      {page > 0 && <Button variant="outline" size="sm" {...(onPageChange?{onClick:()=>onPageChange(page-1)}:{render:<Link href={`/activity?tab=events&page=${page-1}`}/>,nativeButton:false})}>{translateUi((en) ? "en" : "ar", "السابق", "Previous")}</Button>}
      {events.length > 25 && <Button variant="outline" size="sm" {...(onPageChange?{onClick:()=>onPageChange(page+1)}:{render:<Link href={`/activity?tab=events&page=${page+1}`}/>,nativeButton:false})}>{translateUi((en) ? "en" : "ar", "التالي", "Next")}</Button>}
    </nav>}
  </div>
}

export function ActivityHours({ data, page, term, status, locale,onFiltersChange,onPageChange }: {
  data: HoursData
  page: number
  term: string | null
  status: ActivityHourStatus
  locale: Locale
  onFiltersChange?:(changes:{term?:string|null;status?:ActivityHourStatus})=>void
  onPageChange?:(page:number)=>void
}) {
  const en = locale === "en"
  const c = createTranslator(en ? "en" : "ar")
  const statusCode = status === "all" ? null : status === "approved" ? "Approved" : status === "pending" ? "Pending" : "Rejected"

  return <div className="flex min-w-0 flex-col gap-4">
    <div className="flex min-w-0 items-center gap-3 overflow-x-auto pb-1">
      {onFiltersChange?<NativeSelect aria-label={c("الفصل الدراسي","Academic term")} value={term??""} onChange={event=>onFiltersChange({term:event.target.value||null})} className="w-56 shrink-0"><option value="">{c("كل الفصول","All terms")}</option>{data.terms.map(item=><option key={item.id} value={item.id}>{academicTerm(item.name_ar,locale)} · {item.academic_year}</option>)}</NativeSelect>:<LiveFilterForm action="/activity" method="get" className="w-56 shrink-0">
        <input type="hidden" name="tab" value="hours" />
        <input type="hidden" name="page" value="0" />
        {statusCode && <input type="hidden" name="hourStatus" value={status} />}
        <TermSelect compact terms={data.terms} all value={term ?? ""} locale={locale} className="w-full min-w-0" />
      </LiveFilterForm>}
      <div className="shrink-0"><ActivityHourFilter value={status} locale={locale} onChange={onFiltersChange?status=>onFiltersChange({status}):undefined}/></div>
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
    {(page > 0 || data.records.length > 25) && <TaskPagination page={page} more={data.records.length > 25} base="/activity" onPageChange={onPageChange} query={{ tab: "hours", ...(term ? { term } : {}), ...(statusCode ? { hourStatus: status } : {}) }} locale={locale} />}

    {data.memberships.filter(membership => membership.self).map(membership => <details key={membership.id} className="rounded-lg border border-border/70 p-3">
      <summary className="cursor-pointer text-sm font-medium">{c("طلب ساعات ذاتي", "Self-reported hours request")} · <bdi>{membership.name}</bdi></summary>
      <div className="pt-3"><HoursForm operation="self" fields={{ member: membership.id }} label={c("إرسال للمراجعة", "Submit for review")} locale={locale}>
        <FormField  label={<>{c("نطاق العمل", "Work scope")}</>}><NativeSelect name="committee"><option value="">{c("الجهة بالكامل", "Whole organization")}</option>{membership.committees.map(item => <option key={item.id} value={item.id} dir="auto">{item.name}</option>)}</NativeSelect></FormField>
        <HoursFields locale={locale} />
      </HoursForm></div>
    </details>)}
  </div>
}
