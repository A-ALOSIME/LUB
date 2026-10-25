import { RowAction } from "@/components/row-action";
import { Eye } from "lucide-react";
import { CalendarDays, Megaphone, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EventDraftPreview } from "@/features/events/draft-preview";
import { eventDate, eventDateEn, eventLabels, eventLabelsEn } from "@/features/events/display";
import { EventFields, EventForm } from "@/features/events/form";
import { eventWorkspaceOverview } from "@/features/events/workspace";
import { loadManagementPageData } from "@/features/organizations/access";
import { AnnouncementDialog } from "@/app/(workspace)/manage/organizations/[id]/announcement-dialog";
import { EventsAnnouncementsActions } from "@/features/organizations/events-announcements-actions";
import { OrganizationSectionTabPanel, OrganizationSectionTabs } from "@/features/organizations/organization-section-tabs";
import { OrganizationStatusBadge } from "@/features/organizations/organization-status-badge";
import { WorkspaceEmptyState } from "@/components/workspace-empty-state";
import { getPreferences } from "@/lib/preferences";
import { localizedMetadata } from "@/lib/localized-metadata";
import { formatRiyadhDateTime } from "@/lib/datetime";

export async function generateMetadata() {
  return localizedMetadata("الفعاليات والإعلانات", "Events and announcements");
}

export default async function ManageEvents({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; section?: string }>;
}) {
  const [{ locale }, { id }, search] = await Promise.all([getPreferences(), params, searchParams]);
  const en = locale === "en";
  const labels = en ? eventLabelsEn : eventLabels;
  const date = en ? eventDateEn : eventDate;
  const c = (ar: string, english: string) => en ? english : ar;
  if (!z.uuid().safeParse(id).success) notFound();

  const page = Math.floor(Math.min(10000, Math.max(0, Number(search.page) || 0)));
  const { data } = await loadManagementPageData(userId => eventWorkspaceOverview(userId, id, page));
  if (!data) notFound();
  const initialSection = search.section === "announcements" ? "announcements" : "events";
  const actions = <EventsAnnouncementsActions organizationId={id} locale={locale} canCreateEvent={data.canManage} canCreateAnnouncement={data.canManageAnnouncements}>
    {data.canManage && <EventForm operation="save" fields={{ org: id }} label={c("حفظ المسودة", "Save draft")} secondaryAction={<EventDraftPreview locale={locale} />} locale={locale}>
      <EventFields organization={id} templates={data.templates} locale={locale} />
    </EventForm>}
  </EventsAnnouncementsActions>;

  return <div className="workspace-content organization-events-page">
    <OrganizationSectionTabs
      items={[
        { id: "events", label: c("الفعاليات", "Events"), icon: <CalendarDays aria-hidden="true" /> },
        { id: "announcements", label: c("الإعلانات", "Announcements"), icon: <Megaphone aria-hidden="true" /> },
      ]}
      initialSection={initialSection}
      defaultSection="events"
      sticky={false}
      label={c("أقسام الفعاليات والإعلانات", "Events and announcements sections")}
      dir={en ? "ltr" : "rtl"}
      legacyHashSections={{ "#new-event": "events", "#new-announcement": "announcements" }}
      actionHiddenSections={[
        ...(data.events.length === 0 ? ["events"] : []),
        ...(data.announcements.length === 0 ? ["announcements"] : []),
      ]}
      action={<div id="new-event" className="organization-events-actions"><span id="new-announcement" />{actions}</div>}
    >
      <OrganizationSectionTabPanel id="events">
        <section aria-label={c("الفعاليات", "Events")} className="workspace-events-section">
          {!data.canViewEvents ? <p className="workspace-empty">{c("ما عندك صلاحية عرض فعاليات الجهة.", "You do not have permission to view organization events.")}</p>
            : data.events.length ? <ul className="divide-y divide-line">{data.events.slice(0, 25).map(event => <li key={event.id} className="flex min-w-0 items-center gap-3 py-3 first:pt-0">
              {event.has_poster && <Link href={`/events/${event.id}`} aria-label={en ? `Open ${event.title}` : `افتح ${event.title}`} className="relative size-12 shrink-0 overflow-hidden rounded-md border border-border"><Image src={`/event-posters/${event.id}`} alt="" fill unoptimized sizes="48px" /></Link>}
              <div className="min-w-0 flex-1">
                <h3 dir="auto" className="truncate font-semibold"><Link href={`/events/${event.id}`} className="text-link">{event.title}</Link></h3>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted"><time dateTime={event.starts_at}>{date(event.starts_at)}</time><span aria-hidden="true">·</span><span>{c("المسجلون", "Registrants")}: {event.registrant_count}</span></p>
              </div>
              <OrganizationStatusBadge status={event.status_code === "Published" ? "published" : event.status_code === "Draft" ? "draft" : "closed"}>{labels[event.status_code]}</OrganizationStatusBadge><RowAction label={c("عرض الفعالية","View event")} href={`/events/${event.id}`}><Eye/></RowAction>
            </li>)}</ul> : <WorkspaceEmptyState icon={CalendarDays} title={c("لا توجد فعاليات بعد", "No events yet")} description={c("أنشئ أول فعالية للجهة.", "Create the organization's first event.")} action={data.canManage ? <a href="#new-event" className={buttonVariants({ size: "lg", className: "workspace-empty-state-action w-full sm:w-auto" })}><Plus data-icon="inline-start" aria-hidden="true" />{c("فعالية جديدة", "New event")}</a> : undefined} />}
          {data.canViewEvents && <nav aria-label={c("صفحات الفعاليات", "Event pages")} className="mt-5 flex gap-5">{page > 0 && <Link className="text-link" href={`?section=events&page=${page - 1}`}>{c("السابق", "Previous")}</Link>}{data.events.length > 25 && <Link className="text-link" href={`?section=events&page=${page + 1}`}>{c("التالي", "Next")}</Link>}</nav>}
        </section>
      </OrganizationSectionTabPanel>

      <OrganizationSectionTabPanel id="announcements">
        <section aria-label={c("إعلانات الجهة", "Organization announcements")} className="organization-announcements-section">
          {!data.canManageAnnouncements ? <p className="workspace-empty">{c("لا تملك صلاحية إدارة إعلانات الجهة.", "You do not have permission to manage organization announcements.")}</p>
            : data.announcements.length ? <ul className="organization-announcement-list">
              {data.announcements.map(announcement => <li key={announcement.id} className="organization-announcement-row">
                <div className="organization-announcement-copy">
                  <h2 dir="auto">{announcement.title}</h2>
                  <div className="organization-announcement-meta">
                    <time dateTime={announcement.createdAt}>{formatRiyadhDateTime(announcement.createdAt, locale)}</time>
                    <OrganizationStatusBadge status={announcement.published ? "published" : "draft"}>{announcement.published ? c("منشور", "Published") : c("مسودة", "Draft")}</OrganizationStatusBadge>
                    {announcement.pinned && <Badge variant="outline">{c("مثبّت", "Pinned")}</Badge>}
                  </div>
                </div>
                <AnnouncementDialog organizationId={id} announcement={announcement} locale={locale} triggerLabel={c("تعديل", "Edit")} />
              </li>)}
            </ul> : <WorkspaceEmptyState icon={Megaphone} title={c("لا توجد إعلانات بعد", "No announcements yet")} description={c("أنشئ أول إعلان للجهة.", "Create the organization's first announcement.")} action={data.canManageAnnouncements ? <a href="#new-announcement" className={buttonVariants({ size: "lg", className: "workspace-empty-state-action w-full sm:w-auto" })}><Plus data-icon="inline-start" aria-hidden="true" />{c("إعلان جديد", "New announcement")}</a> : undefined} />}
        </section>
      </OrganizationSectionTabPanel>
    </OrganizationSectionTabs>
  </div>;
}
