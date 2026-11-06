"use client";
import {useOriginHref} from "@/components/origin-link";
import {useOptimisticRows} from "@/lib/optimistic-rows";
import {CalendarDays} from "lucide-react";
import {ItemTable,ItemTitle} from "@/components/item-table";
import {ListThumbnail} from "@/components/list-thumbnail";
import {ListEmpty} from "@/components/list-empty";
import {ContentText} from "@/components/content-text";
import {Button} from "@/components/ui/button";
import {OrganizationStatusBadge} from "@/features/organizations/organization-status-badge";
import {EventListActions} from "./list-actions";
import {eventDay,eventDayEn,eventTime,eventTimeEn,eventLabels,eventLabelsEn} from "./display";
import {createTranslator} from "@/lib/i18n";
import type {Locale} from "@/lib/preferences";
import type {EventWorkspace} from "./workspace";
export function EventManagementTable({items,locale,canManage,filtered,clear,sort,onSort,activeStatus="all",pagination}:{pagination?:import("@/components/data-table").DataTablePagination;activeStatus?:string;items:EventWorkspace["events"];organization:string;locale:Locale;canManage:boolean;filtered:boolean;clear:()=>void;sort:string;onSort:()=>void}){
 const originHref=useOriginHref();
 const c=createTranslator(locale),date=locale==="en"?eventDayEn:eventDay,time=locale==="en"?eventTimeEn:eventTime,labels=locale==="en"?eventLabelsEn:eventLabels;
 const optimistic=useOptimisticRows(items,row=>row.id);
 return <ItemTable pagination={pagination} items={optimistic.items.filter(row=>activeStatus==="all"?row.status_code!=="Archived":row.status_code===activeStatus)} label={c("عرض الفعالية","View event")} href={e=>originHref(`/events/${e.id}`)} empty={<ListEmpty icon={CalendarDays} filtered={filtered} clear={clear} title={c("لا توجد فعاليات بعد","No events yet")} description={c("أنشئ أول فعالية للجهة.","Create the organization's first event.")}/>} columns={[
  {id:"name",label:c("الفعالية","Event"),render:e=><div className="flex min-w-0 items-center gap-3"><ListThumbnail src={e.has_poster?`/event-posters/${e.id}?thumbnail=1`:null} icon={CalendarDays}/><div className="min-w-0 flex-1"><ItemTitle><ContentText value={e.title||c("فعالية بدون عنوان","Untitled event")}/></ItemTitle></div></div>},
  {id:"date",className:"w-36",label:<Button size="sm" variant="ghost" onClick={onSort} aria-label={c("ترتيب تاريخ البداية","Sort start date")} aria-pressed={sort==="asc"}>{c("تاريخ البداية","Start date")}</Button>,render:e=>e.starts_at?<div><time dateTime={e.starts_at}>{date(e.starts_at)}</time><p className="text-sm text-muted-foreground"><bdi>{time(e.starts_at)}</bdi></p></div>:<span className="text-muted-foreground">{c("بدون تاريخ","No date")}</span>},
  {id:"status",label:c("الحالة","Status"),className:"w-24",render:e=><OrganizationStatusBadge status={e.status_code==="Published"?"published":e.status_code==="Draft"?"draft":e.status_code==="Archived"?"archived":"closed"}>{labels[e.status_code]}</OrganizationStatusBadge>},
  {id:"count",label:c("المسجلين","Registrants"),className:"w-24",render:e=>e.registrant_count},
  {id:"actions",label:c("الإجراءات","Actions"),className:"w-80",render:e=><EventListActions event={e} locale={locale} canManage={canManage} optimistic={(changes,remove)=>optimistic.change(e.id,row=>remove?null:{...row,...changes})}/>},
 ]}/>;
}
