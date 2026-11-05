"use client";

import {EventRequestActions} from "./event-request-actions";
import {SelfHoursRequestAction} from "@/features/hours/self-request-action";
import {ContentText} from "@/components/content-text";
import {createTranslator,t as translateUi} from "@/lib/i18n";
import {NativeSelect} from "@/components/ui/native-select";
import {useRouter} from "next/navigation";
import Link from "next/link"
import { CalendarDays, Clock, ChevronDown } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {buttonVariants } from "@/components/ui/button"
import {ItemTable,ItemTitle} from "@/components/item-table";
import {ListThumbnail} from "@/components/list-thumbnail";
import {RowAction} from "@/components/row-action";
import {Eye,UserPlus} from "lucide-react"
import { LiveFilterForm } from "@/components/live-filter-form"
import { WorkspaceEmptyState } from "@/components/workspace-empty-state"
import { ActivityHourFilter, type ActivityHourStatus } from "./activity-hour-filter"
import type { HoursData } from "@/features/hours/repository"
import { TermSelect } from "@/features/hours/view"
import { HoursRecordTable } from "@/features/hours/hours-record-table"
import { Progress } from "@/components/ui/progress"
import { formatHours, academicTerm } from "@/lib/display"
import { HoursStatusSummary } from "@/features/hours/hours-status-summary"
import {formatRiyadhDate} from "@/lib/datetime"

import type {EventCard} from "@/features/events/repository";
import type { Locale } from "@/lib/preferences"


type MyEvent = {registration_id?:string;attendance_hours?:string;canWithdraw?:boolean;canReapply?:boolean; id: string; title: string; starts_at: string; status_code: string; registration: string; review_status?:string;contributions?:Array<{kind:string;title:string}>;attendance: string;org_name?:string;has_poster?:boolean }

function statusVariant(status: string): "secondary" | "outline" | "destructive" {
  if (["Approved", "Present", "Completed", "Registered"].includes(status)) return "secondary"
  if (["Rejected", "Cancelled", "Absent"].includes(status)) return "destructive"
  return "outline"
}

export function ActivityEventRows({ events, page, locale,onPageChange,hidePagination=false,empty }: { empty?:React.ReactNode;hidePagination?:boolean;events: MyEvent[]; page: number; locale: Locale;onPageChange?:(page:number)=>void }) {
  const router=useRouter();
  const en = locale === "en"
  const date=(value:string)=>formatRiyadhDate(value,locale)
  const eventState=(event:MyEvent)=>event.registration==="Cancelled"?translateUi((en) ? "en" : "ar", "مسحوب", "Withdrawn"):event.review_status==="Rejected"?translateUi((en) ? "en" : "ar", "مرفوض", "Registration rejected"):event.review_status==="Pending"?translateUi((en) ? "en" : "ar", "بانتظار الموافقة", "Awaiting approval"):event.review_status==="Recorded"?translateUi(locale,"مرصودة","Recorded"):event.attendance==="Present"?translateUi((en) ? "en" : "ar", "حضور مؤكد", "Attendance confirmed"):event.attendance==="Absent"?translateUi((en) ? "en" : "ar", "لم تحضر", "Did not attend"):event.attendance==="Excused"?translateUi((en) ? "en" : "ar", "معذور", "Excused"):translateUi((en) ? "en" : "ar", "مقبول · بانتظار تأكيد الحضور", "Accepted · awaiting attendance confirmation")

  return <div className="flex min-w-0 flex-col gap-3">
    {events.length ? <ItemTable pagination={hidePagination?undefined:{page,more:events.length>25,onChange:value=>{if(onPageChange)onPageChange(value);else router.push(`/activity?tab=events&page=${value}`);}}} items={events} href={event=>`/events/${event.id}`} label={translateUi(locale,"عرض تفاصيل الفعالية","View event details")} columns={[
      {id:"name",label:translateUi(locale,"الفعالية","Event"),render:event=><div className="flex min-w-0 items-center gap-3"><ListThumbnail icon={CalendarDays} src={event.has_poster?`/event-posters/${event.id}?thumbnail=1`:null}/><div className="min-w-0 flex-1"><ItemTitle><ContentText value={event.title}/></ItemTitle>{event.org_name&&<p className="text-sm text-muted-foreground"><ContentText value={event.org_name}/></p>}{event.contributions?.map(contribution=><p key={contribution.kind} className="text-sm text-muted-foreground">{contribution.title}</p>)}</div></div>},
      {id:"hours",label:translateUi(locale,"ساعات الحضور","Attendance hours"),className:"w-32",render:event=>formatHours(event.attendance_hours??0,locale)},
      {id:"status",label:translateUi(locale,"الحالة","Status"),className:"w-44",render:event=><Badge variant={statusVariant(event.review_status==='Recorded'?'Registered':event.review_status==='Rejected'?'Rejected':event.attendance)}>{eventState(event)}</Badge>},
      {id:"date",label:translateUi(locale,"التاريخ","Date"),className:"w-40",render:event=><time>{date(event.starts_at)}</time>},
      {id:"actions",label:translateUi(locale,"الإجراءات","Actions"),className:"w-36",render:event=><EventRequestActions event={event} locale={locale}/> }
    ]}/> : empty??<WorkspaceEmptyState
      icon={CalendarDays}
      title={translateUi((en) ? "en" : "ar", "ما سجلت في فعالية بعد", "No event registrations yet")}
      description={translateUi((en) ? "en" : "ar", "تصفح الفعاليات القادمة للعثور على فعالية تناسبك.", "Browse upcoming events to find one to join.")}
      action={<Link href="/events" className={buttonVariants({ size: "lg", className: "workspace-empty-state-action w-full sm:w-auto" })}><CalendarDays data-icon="inline-start" aria-hidden="true" />{translateUi((en) ? "en" : "ar", "تصفح الفعاليات", "Browse events")}</Link>}
    />}

  </div>
}

export function ActivityAvailableEvents({events,locale,empty}:{empty?:React.ReactNode;events:EventCard[];locale:Locale}){
 const c=createTranslator(locale);
 return <ItemTable items={events} href={event=>`/events/${event.id}`} label={c("عرض تفاصيل الفعالية","View event details")} empty={empty??<WorkspaceEmptyState icon={CalendarDays} title={c("لا توجد فعاليات متاحة الآن","No events available right now")} description={c("تفقّد الصفحة لاحقًا للاطلاع على الفعاليات الجديدة.","Check again later for new events.")}/>} columns={[
 {id:"name",label:c("الفعالية","Event"),render:event=><div className="flex min-w-0 items-center gap-3"><ListThumbnail icon={CalendarDays} src={event.has_poster?`/event-posters/${event.id}?thumbnail=1`:null}/><div className="min-w-0 flex-1"><ItemTitle><ContentText value={event.title}/></ItemTitle><p className="text-sm text-muted-foreground"><ContentText value={event.org_name}/></p></div></div>},
 {id:"date",label:c("التاريخ","Date"),className:"w-40",render:event=><time>{formatRiyadhDate(event.starts_at,locale)}</time>},
 {id:"actions",label:c("الإجراءات","Actions"),className:"w-24",render:event=><div className="flex items-center gap-1"><RowAction label={c("عرض التفاصيل","View details")} href={`/events/${event.id}`}><Eye/></RowAction><RowAction label={c("التسجيل في الفعالية","Register for event")} href={`/events/${event.id}`} disabled={!event.open}><UserPlus/></RowAction></div>}
 ]}/>;
}

export function ActivityHours({ data, page, term, status, locale,onFiltersChange,onPageChange,hideFilters=false,hidePagination=false,empty }: {
  empty?:React.ReactNode
  hidePagination?:boolean
  data: HoursData
  page: number
  term: string | null
  status: ActivityHourStatus
  locale: Locale
  hideFilters?:boolean
  onFiltersChange?:(changes:{term?:string|null;status?:ActivityHourStatus})=>void
  onPageChange?:(page:number)=>void
}) {
  const router=useRouter();
  const en = locale === "en"
  const c = createTranslator(en ? "en" : "ar")
  const statusCode = status === "all" ? null : status === "approved" ? "Approved" : status === "pending" ? "Pending" : "Rejected"

  return <div className="flex min-w-0 flex-col gap-4">
    {!hideFilters&&<div className="flex min-w-0 flex-wrap items-center gap-3">
      {onFiltersChange?<NativeSelect aria-label={c("الفصل الدراسي","Academic term")} value={term??""} onChange={event=>onFiltersChange({term:event.target.value||null})} className="w-auto max-w-full shrink-0"><option value="">{c("كل الفصول","All terms")}</option>{data.terms.map(item=><option key={item.id} value={item.id}>{academicTerm(item.name_ar,locale)} · {item.academic_year}</option>)}</NativeSelect>:<LiveFilterForm action="/activity" method="get" className="w-auto max-w-full shrink-0">
        <input type="hidden" name="tab" value="hours" />
        <input type="hidden" name="page" value="0" />
        {statusCode && <input type="hidden" name="hourStatus" value={status} />}
        <TermSelect compact terms={data.terms} all value={term ?? ""} locale={locale} className="w-full min-w-0" />
      </LiveFilterForm>}
      <SelfHoursRequestAction memberships={data.memberships} locale={locale}/><div className="shrink-0"><ActivityHourFilter value={status} locale={locale} onChange={onFiltersChange?status=>onFiltersChange({status}):undefined}/></div>
    </div>}

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
      ? <HoursRecordTable pagination={hidePagination?undefined:{page,more:data.records.length>25,onChange:value=>{if(onPageChange)onPageChange(value);else router.push(`/activity?${new URLSearchParams({tab:"hours",page:String(value),...(term?{term}:{}),...(statusCode?{hourStatus:status}:{})})}`);}}} items={data.records} locale={locale} personal />
      : empty??<WorkspaceEmptyState icon={Clock} title={c("لا توجد سجلات ساعات", "No hour records")} description={c("لا توجد سجلات لهذه الفترة والحالة.", "No records match this term and status.")} />}



  </div>
}
