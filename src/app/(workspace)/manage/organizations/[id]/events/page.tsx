import {createTranslator} from "@/lib/i18n";
import {EventRegistrantPanel} from "@/features/events/registrant-panel";
import {EventListActions} from "@/features/events/list-actions";
import { CalendarDays, Megaphone, UsersRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { eventDate, eventDateEn, eventLabels, eventLabelsEn } from "@/features/events/display";
import { EventCreateForm } from "@/features/events/form";
import { eventWorkspaceOverview } from "@/features/events/workspace";
import { loadManagementPageData } from "@/features/organizations/access";
import {AnnouncementList} from "@/features/organizations/announcement-list";
import { EventsAnnouncementsActions } from "@/features/organizations/events-announcements-actions";
import { OrganizationSectionTabPanel, OrganizationSectionTabs } from "@/features/organizations/organization-section-tabs";
import { OrganizationStatusBadge } from "@/features/organizations/organization-status-badge";
import { WorkspaceEmptyState } from "@/components/workspace-empty-state";
import { getPreferences } from "@/lib/preferences";
import { localizedMetadata } from "@/lib/localized-metadata";
import {formatCount} from "@/lib/display";

export async function generateMetadata() {
  return localizedMetadata("الفعاليات والإعلانات", "Events and announcements");
}

export default async function ManageEvents({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string,string|undefined>>;
}) {
  const [{ locale }, { id }, search] = await Promise.all([getPreferences(), params, searchParams]);
  const en = locale === "en";
  const labels = en ? eventLabelsEn : eventLabels;
  const date = en ? eventDateEn : eventDate;
  const c = createTranslator(en ? "en" : "ar");
  if (!z.uuid().safeParse(id).success) notFound();

  const page = Math.floor(Math.min(10000, Math.max(0, Number(search.page) || 0)));
  const { user,data } = await loadManagementPageData(userId => eventWorkspaceOverview(userId, id, page));
  if (!data) notFound();
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
            : data.events.length ? <ul className="divide-y divide-border">{data.events.slice(0,25).map(event=><li key={event.id} className="relative flex min-w-0 flex-wrap items-center gap-4 py-4 transition-colors hover:bg-accent/50"><Link href={`/manage/organizations/${id}/events/${event.id}`} className="absolute inset-0 rounded-lg focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${c("عرض الفعالية","View event")} ${event.title||c("بدون عنوان","Untitled")}`}/><div className="pointer-events-none relative grid h-16 w-24 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-muted">{event.has_poster?<Image src={`/event-posters/${event.id}`} alt="" fill unoptimized loading="lazy" sizes="96px" className="object-contain"/>:<CalendarDays className="text-muted-foreground"/>}</div><div className="pointer-events-none min-w-0 flex-1"><h3 className="font-medium"><bdi>{event.title||c("فعالية بدون عنوان","Untitled event")}</bdi></h3><p className="mt-1 text-sm text-muted-foreground"><time dateTime={event.starts_at||undefined}>{date(event.starts_at)}</time>{event.location_text&&<> · <bdi>{event.location_text}</bdi></>}</p><p className="text-sm text-muted-foreground">{formatCount(event.registrant_count,"registrants",locale)}</p></div><OrganizationStatusBadge status={event.status_code==="Published"?"published":event.status_code==="Draft"?"draft":"closed"}>{labels[event.status_code]}</OrganizationStatusBadge>{data.canManage&&<EventListActions event={event} locale={locale}/>}</li>)}</ul> : <WorkspaceEmptyState icon={CalendarDays} title={c("لا توجد فعاليات بعد", "No events yet")} description={c("أنشئ أول فعالية للجهة.", "Create the organization's first event.")} action={undefined} />}
          {data.canViewEvents && <nav aria-label={c("صفحات الفعاليات", "Event pages")} className="mt-5 flex gap-5">{page > 0 && <Link className="text-link" href={`?section=events&page=${page - 1}`}>{c("السابق", "Previous")}</Link>}{data.events.length > 25 && <Link className="text-link" href={`?section=events&page=${page + 1}`}>{c("التالي", "Next")}</Link>}</nav>}
        </section>
      </OrganizationSectionTabPanel>

      <OrganizationSectionTabPanel id="registrants">{data.canViewEvents&&<EventRegistrantPanel user={user.id} organization={id} search={search} locale={locale}/>}</OrganizationSectionTabPanel>
      <OrganizationSectionTabPanel id="announcements">
        {data.canManageAnnouncements?<AnnouncementList items={data.announcements} org={id} locale={locale}/>:<p className="workspace-empty">{c("لا تملك صلاحية إدارة إعلانات الجهة.","You do not have permission to manage organization announcements.")}</p>}
      </OrganizationSectionTabPanel>
    </OrganizationSectionTabs>
  </div>;
}
