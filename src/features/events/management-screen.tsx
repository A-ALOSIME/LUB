"use client";
import {useEffect,useSyncExternalStore} from "react";
import {useI18n} from "@/components/i18n-provider";
import {Skeleton} from "@/components/ui/skeleton";
import {Alert,AlertDescription} from "@/components/ui/alert";
import {Button} from "@/components/ui/button";
import {useOrganizationEventsCache,type OrganizationEventsSnapshot} from "./management-cache";
import {EventRegistrantBrowser} from "./registrant-browser";
import {createTranslator} from "@/lib/i18n";
import {EventListActions} from "@/features/events/list-actions";
import { CalendarDays, Megaphone, UsersRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { eventDate, eventDateEn, eventLabels, eventLabelsEn } from "@/features/events/display";
import { EventCreateForm } from "@/features/events/form";
import {AnnouncementList} from "@/features/organizations/announcement-list";
import { EventsAnnouncementsActions } from "@/features/organizations/events-announcements-actions";
import { OrganizationSectionTabPanel, OrganizationSectionTabs } from "@/features/organizations/organization-section-tabs";
import { OrganizationStatusBadge } from "@/features/organizations/organization-status-badge";
import { WorkspaceEmptyState } from "@/components/workspace-empty-state";
import {formatCount} from "@/lib/display";

import type {Locale} from "@/lib/preferences";

function subscribe(notify:()=>void){window.addEventListener("popstate",notify);window.addEventListener("organization-section-change",notify);return()=>{window.removeEventListener("popstate",notify);window.removeEventListener("organization-section-change",notify);};}
export function OrganizationEventsScreen({organization}:{organization:string}){
 const {locale,t}=useI18n(),{entries,ensure,refresh,check}=useOrganizationEventsCache(),entry=entries[organization];
 const query=useSyncExternalStore(subscribe,()=>window.location.search,()=>"");
 useEffect(()=>{void ensure(organization);},[organization,ensure]);
 useEffect(()=>{if(!entry?.data)return;const inspect=()=>{if(document.visibilityState!=="hidden"&&navigator.onLine!==false)void check(organization);};const timer=setInterval(inspect,30000);window.addEventListener("focus",inspect);document.addEventListener("visibilitychange",inspect);return()=>{clearInterval(timer);window.removeEventListener("focus",inspect);document.removeEventListener("visibilitychange",inspect);};},[organization,entry?.data,check]);
 if(!entry?.data)return entry?.error?<Alert variant="destructive"><AlertDescription>{t("تعذّر تحميل فعاليات الجهة وإعلاناتها. حاول مجددًا.","Could not load organization events and announcements. Please try again.")}</AlertDescription><Button variant="outline" onClick={()=>void refresh(organization)}>{t("إعادة المحاولة","Retry")}</Button></Alert>:<div role="status" aria-label={t("جارٍ تحميل فعاليات الجهة","Loading organization events")} className="flex flex-col gap-4"><Skeleton className="h-10 w-72"/><Skeleton className="h-40 w-full"/></div>;
 const search=Object.fromEntries(new URLSearchParams(query));
 function onChange(values:Record<string,string|null>,replace=false){const url=new URL(window.location.href);for(const [key,value]of Object.entries(values))if(!value||value==="all"||value==="0")url.searchParams.delete(key);else url.searchParams.set(key,value);window.history[replace?"replaceState":"pushState"](window.history.state,"",url);window.dispatchEvent(new Event("organization-section-change"));}
 return <OrganizationEventsView id={organization} snapshot={entry.data} search={search} locale={locale} onChange={onChange}/>;
}
function OrganizationEventsView({id,snapshot,search,locale,onChange}:{id:string;snapshot:OrganizationEventsSnapshot;search:Record<string,string|undefined>;locale:Locale;onChange:(values:Record<string,string|null>,replace?:boolean)=>void}){
 const data=snapshot.workspace,en=locale==="en",labels=en?eventLabelsEn:eventLabels,date=en?eventDateEn:eventDate,c=createTranslator(locale);
 const page=Math.min(Math.max(0,Math.floor((data.events.length-1)/25)),Math.max(0,Math.floor(Number(search.page)||0))),pagedEvents=data.events.slice(page*25,page*25+26);
  const initialSection = search.section === "announcements" ? "announcements" : search.section === "registrants"?"registrants":"events";
  const actions = <EventsAnnouncementsActions organizationId={id} locale={locale} canCreateEvent={data.canManage} canCreateAnnouncement={data.canManageAnnouncements}>
    {data.canManage && <EventCreateForm organization={id} templates={data.templates} locale={locale}/>}
  </EventsAnnouncementsActions>;

  return <div className="workspace-content organization-events-page">
    <OrganizationSectionTabs
      items={[
        { id: "events", label: c("الفعاليات", "Events"), icon: <CalendarDays aria-hidden="true" /> },
        { id: "announcements", label: c("الإعلانات", "Announcements"), icon: <Megaphone aria-hidden="true" /> },
        { id: "registrants", label:c("المسجلون في الفعاليات","Event registrants"),icon:<UsersRound/> },
      ]}
      initialSection={initialSection}
      defaultSection="events"
      sticky={false}
      label={c("أقسام الفعاليات والإعلانات", "Events and announcements sections")}
      dir={en ? "ltr" : "rtl"}
      legacyHashSections={{ "#new-event": "events", "#new-announcement": "announcements" }}
      actionHiddenSections={[
        "announcements",
      ]}
      action={<div id="new-event" className="organization-events-actions"><span id="new-announcement" />{actions}</div>}
    >
      <OrganizationSectionTabPanel id="events">
        <section aria-label={c("الفعاليات", "Events")} className="workspace-events-section">
          {!data.canViewEvents ? <p className="workspace-empty">{c("ما عندك صلاحية عرض فعاليات الجهة.", "You do not have permission to view organization events.")}</p>
            : pagedEvents.length ? <ul className="divide-y divide-border">{pagedEvents.slice(0,25).map(event=><li key={event.id} className="relative flex min-w-0 flex-wrap items-center gap-4 py-4 transition-colors hover:bg-accent/50"><Link href={`/manage/organizations/${id}/events/${event.id}`} className="absolute inset-0 rounded-lg focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${c("عرض الفعالية","View event")} ${event.title||c("بدون عنوان","Untitled")}`}/><div className="pointer-events-none relative grid h-16 w-24 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-muted">{event.has_poster?<Image src={`/event-posters/${event.id}`} alt="" fill unoptimized loading="lazy" sizes="96px" className="object-contain"/>:<CalendarDays className="text-muted-foreground"/>}</div><div className="pointer-events-none min-w-0 flex-1"><h3 className="font-medium"><bdi>{event.title||c("فعالية بدون عنوان","Untitled event")}</bdi></h3><p className="mt-1 text-sm text-muted-foreground"><time dateTime={event.starts_at||undefined}>{date(event.starts_at)}</time>{event.location_text&&<> · <bdi>{event.location_text}</bdi></>}</p><p className="text-sm text-muted-foreground">{formatCount(event.registrant_count,"registrants",locale)}</p></div><OrganizationStatusBadge status={event.status_code==="Published"?"published":event.status_code==="Draft"?"draft":"closed"}>{labels[event.status_code]}</OrganizationStatusBadge>{data.canManage&&<EventListActions event={event} locale={locale}/>}</li>)}</ul> : <WorkspaceEmptyState icon={CalendarDays} title={c("لا توجد فعاليات بعد", "No events yet")} description={c("أنشئ أول فعالية للجهة.", "Create the organization's first event.")} action={undefined} />}
          {data.canViewEvents && <nav aria-label={c("صفحات الفعاليات", "Event pages")} className="mt-5 flex gap-5">{page > 0 && <Link className="text-link" href={`?section=events&page=${page - 1}`} onClick={event=>{event.preventDefault();onChange({page:String(page-1)});}}>{c("السابق", "Previous")}</Link>}{pagedEvents.length > 25 && <Link className="text-link" href={`?section=events&page=${page + 1}`} onClick={event=>{event.preventDefault();onChange({page:String(page+1)});}}>{c("التالي", "Next")}</Link>}</nav>}
        </section>
      </OrganizationSectionTabPanel>

      <OrganizationSectionTabPanel id="registrants">{data.canViewEvents&&<EventRegistrantBrowser data={snapshot.registrations} search={search} locale={locale} onChange={onChange}/>}</OrganizationSectionTabPanel>
      <OrganizationSectionTabPanel id="announcements">
        {data.canManageAnnouncements?<AnnouncementList items={data.announcements} org={id} locale={locale} filter={search.announcementStatus} onFilterChange={value=>onChange({announcementStatus:value})}/>:<p className="workspace-empty">{c("لا تملك صلاحية إدارة إعلانات الجهة.","You do not have permission to manage organization announcements.")}</p>}
      </OrganizationSectionTabPanel>
    </OrganizationSectionTabs>
  </div>;
}
