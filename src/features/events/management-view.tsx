"use client";
import {CalendarDays,Megaphone,UsersRound,Search} from "lucide-react";
import Link from "next/link";
import {EventManagementTable} from "./management-table";
import {eventListRows} from "./list-order";
import {SearchFilterToolbar} from "@/components/search-filter-toolbar";
import {InputGroup,InputGroupInput,InputGroupAddon} from "@/components/ui/input-group";
import {FilterTabs} from "@/components/ui/filter-tabs";
import {EventCreateForm} from "./form";
import {EventRegistrantBrowser} from "./registrant-browser";
import {AnnouncementList} from "@/features/organizations/announcement-list";
import {EventsAnnouncementsActions} from "@/features/organizations/events-announcements-actions";
import {OrganizationSectionTabs,OrganizationSectionTabPanel} from "@/features/organizations/organization-section-tabs";
import {createTranslator} from "@/lib/i18n";
import type {OrganizationEventsSnapshot} from "./management-cache";
import type {Locale} from "@/lib/preferences";
export function OrganizationEventsView({id,snapshot,search,locale,onChange,serverPaged=false}:{serverPaged?:boolean;id:string;snapshot:OrganizationEventsSnapshot;search:Record<string,string|undefined>;locale:Locale;onChange:(values:Record<string,string|null>,replace?:boolean)=>void}){
 const data=snapshot.workspace,en=locale==="en",c=createTranslator(locale);
 const status=search.eventStatus??"all",q=search.eventSearch??"",sort=search.sort??"desc",rows=eventListRows(data.events,{status,q,sort});
 const page=serverPaged?Math.max(0,Math.floor(Number(search.page)||0)):Math.min(Math.max(0,Math.floor((rows.length-1)/25)),Math.max(0,Math.floor(Number(search.page)||0))),pagedEvents=serverPaged?rows:rows.slice(page*25,page*25+26);
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

    >
      <OrganizationSectionTabPanel id="events">
        <section aria-label={c("الفعاليات", "Events")} className="workspace-events-section">
          <SearchFilterToolbar search={<InputGroup><InputGroupAddon><Search/></InputGroupAddon><InputGroupInput type="search" value={q} aria-label={c("بحث الفعاليات","Search events")} placeholder={c("ابحث عن فعالية","Search events")} onChange={event=>onChange({eventSearch:event.target.value,page:null},true)}/></InputGroup>}><FilterTabs value={status} ariaLabel={c("حالة الفعالية","Event status")} dir={en?"ltr":"rtl"} onValueChange={value=>onChange({eventStatus:value,page:null})} options={[["all",c("الكل","All")],["Published",c("منشورة","Published")],["Draft",c("مسودة","Draft")],["Cancelled",c("ملغاة","Cancelled")],["Archived",c("مؤرشفة","Archived")]].map(([value,label])=>({value,label}))}/>{actions}</SearchFilterToolbar>
          {!data.canViewEvents?<p>{c("ما عندك صلاحية عرض فعاليات الجهة.","You do not have permission to view organization events.")}</p>:<EventManagementTable activeStatus={status} items={pagedEvents.slice(0,25)} organization={id} locale={locale} canManage={data.canManage} filtered={Boolean(q||status!=="all")} clear={()=>onChange({eventStatus:null,eventSearch:null,page:null})} sort={sort} onSort={()=>onChange({sort:sort==="asc"?"desc":"asc",page:null})}/>}
          {data.canViewEvents && <nav aria-label={c("صفحات الفعاليات", "Event pages")} className="mt-5 flex gap-5">{page > 0 && <Link className="text-link" href={`?section=events&page=${page - 1}`} onClick={event=>{event.preventDefault();onChange({page:String(page-1)});}}>{c("السابق", "Previous")}</Link>}{pagedEvents.length > 25 && <Link className="text-link" href={`?section=events&page=${page + 1}`} onClick={event=>{event.preventDefault();onChange({page:String(page+1)});}}>{c("التالي", "Next")}</Link>}</nav>}
        </section>
      </OrganizationSectionTabPanel>

      <OrganizationSectionTabPanel id="registrants">{data.canViewEvents&&<EventRegistrantBrowser organization={id} serverPaged={serverPaged} data={snapshot.registrations} search={search} locale={locale} onChange={onChange}/>}</OrganizationSectionTabPanel>
      <OrganizationSectionTabPanel id="announcements">
        {data.canManageAnnouncements?<AnnouncementList items={data.announcements} org={id} locale={locale} serverPaged={serverPaged} filter={search.announcementStatus} onFilterChange={value=>onChange({announcementStatus:value})}/>:<p className="workspace-empty">{c("لا تملك صلاحية إدارة إعلانات الجهة.","You do not have permission to manage organization announcements.")}</p>}
      </OrganizationSectionTabPanel>
    </OrganizationSectionTabs>
  </div>;
}
