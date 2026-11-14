import Image from "next/image";
import {CalendarDays, Clock, ExternalLink, MapPin, Timer, Video, type LucideIcon} from "lucide-react";
import {ArchivalEventContent} from "./archival-content";
import {OrganizationLogo} from "@/components/organization-logo";

import {ContentText} from "@/components/content-text";
import {t as translateUi,createTranslator} from "@/lib/i18n";
import {NumberText} from "@/components/number-text";
import { PublicEventRegistration } from "./public-registration";
import { EventPoster } from "./poster";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {EventShareButton} from "./event-share-button";
import {skillName} from "@/features/talent/profile-skills-model";
import {cn} from "@/lib/utils";
import { formatHours } from "@/lib/display";
import {formatRiyadhDateRange} from "@/lib/datetime";
import Link from "next/link";
import {OriginLink} from "@/components/origin-link";
import type { ReactNode } from "react";
import type { EventCard, EventDetail } from "./repository";
import { EventIcon } from "./icon";
import { localOrganizationContent } from "@/features/organizations/local-content";

import {
  eventDate,
  eventDateEn,
  eventDay,
  eventDayEn,
  eventTime,
  eventTimeEn,
  eventLabels,
  eventLabelsEn,
} from "./display";
import type { Locale } from "@/lib/preferences";
import { OrganizationStatusBadge } from "@/features/organizations/organization-status-badge";
export { eventDate, eventLabels } from "./display";
export { EventIcon } from "./icon";
export function EventCards({
  items,
  locale = "ar",
}: {
  items: EventCard[];
  locale?: Locale;
}) {
  const en = locale === "en",
    labels = en ? eventLabelsEn : eventLabels,
    day = en ? eventDayEn : eventDay,
    time = en ? eventTimeEn : eventTime;
  return items.length ? (
    <ul className="event-discovery-grid">
      {items.slice(0, 24).map((e) => {
        const localOrganization = localOrganizationContent(
          e.org_name,
          e.org_type_code,
        );
        const logoSrc =
          e.org_logo_url && e.org_logo_url !== localOrganization?.logoSrc
            ? e.org_logo_url
            : localOrganization?.eventLogoSrc ||
              e.org_logo_url ||
              localOrganization?.logoSrc;
        return (
          <li key={e.id} className="min-w-0"><Card className="h-full min-w-0 gap-0 py-0 transition-colors hover:bg-muted/40">
            <OriginLink href={`/events/${e.id}`} className="event-card flex min-w-0 flex-1 flex-col">
              <EventPoster
                src={e.has_poster ? `/event-posters/${e.id}` : null}
                title={e.title}
                locale={locale}
              />
              <div className="event-card-copy min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 dir="auto" className="m-0 text-xl font-semibold">
                    <ContentText value={en?(e.title_en?.trim()||e.title):e.title}/>
                  </h2>
                  {e.status_code !== "Published" && (
                    <OrganizationStatusBadge
                      status={e.status_code === "Draft" ? "draft" : "closed"}
                    >
                      {labels[e.status_code]}
                    </OrganizationStatusBadge>
                  )}
                </div>
                {(e.starts_at||e.source_date_text)&&<p className="event-card-meta">
                  <EventIcon name="calendar" />
                  <span>{translateUi((en) ? "en" : "ar", "التاريخ", "Date")}</span>
                  {e.source_date_text?<ContentText value={e.source_date_text}/>:<time dateTime={e.starts_at}>{day(e.starts_at)}</time>}
                </p>}
                {e.status_code!=="Archived"&&<p className="event-card-meta">
                  <EventIcon name="clock" />
                  <span>{translateUi((en) ? "en" : "ar", "الوقت", "Time")}</span>
                  <time dateTime={e.starts_at}>{time(e.starts_at)}</time>
                </p>}
                {(e.location_type_code!=="Unknown"||e.location_text)&&<p className="event-card-meta">
                  <EventIcon name="location" />
                  <span>{e.location_text?<ContentText value={e.location_text}/>:labels[e.location_type_code]}</span>
                </p>}
              </div>
              <div className="event-card-organization">
                <OrganizationLogo name={e.org_name} src={logoSrc} className="event-card-organization-logo"/>
                <bdi><ContentText value={en?(e.org_name_en?.trim()||e.org_name):e.org_name}/></bdi>
              </div>
              <span
                className={buttonVariants({
                  variant: "default",
                  className: "mx-5 mb-5",
                })}
              >
                {translateUi((en) ? "en" : "ar", "عرض الفعالية", "View event")}
              </span>
            </OriginLink>
          </Card></li>
        );
      })}
    </ul>
  ) : (
    <p role="status" className="panel event-empty-state text-muted">
      {translateUi((en) ? "en" : "ar", "لا توجد فعاليات مطابقة الآن.", "No matching events right now.")}
    </p>
  );
}
export function EventContent({
  data,
  user,
  superAdmin = false,
  locale = "ar",
}: {
  data: EventDetail;
  user: boolean;
  superAdmin?: boolean;
  locale?: Locale;
}) {
  const e = data.event;
  if(e.status_code==="Archived")return <ArchivalEventContent data={data} locale={locale}/>;
  const en = locale === "en";
  const c = createTranslator((en) ? "en" : "ar");
  const labels = en ? eventLabelsEn : eventLabels;
  const date = en ? eventDateEn : eventDate;
  const time = en ? eventTimeEn : eventTime;
  const localOrganization = localOrganizationContent(
    data.org_name,
    data.org_type_code,
  );
  const logoSrc =
    data.org_logo && data.org_logo !== localOrganization?.logoSrc
      ? data.org_logo
      : localOrganization?.eventLogoSrc ||
        data.org_logo ||
        localOrganization?.logoSrc;

  const title = (en ? e.title_en?.trim() : null) || e.title || c("فعالية بدون عنوان", "Untitled event");
  const publicEvent = data.isPublic ?? ["Published", "Completed"].includes(e.status_code);
  const facts = (
    <Card className="py-0">
      <dl dir={en ? "ltr" : "rtl"} className="divide-y divide-border px-4 sm:px-5">
        {e.starts_at && <>
          <EventFact icon={CalendarDays} label={c("التاريخ", "Date")}>
            {formatRiyadhDateRange(e.starts_at, e.ends_at, locale)}
          </EventFact>
          <EventFact icon={Clock} label={c("الوقت", "Time")}>
            <time dateTime={e.starts_at}>{time(e.starts_at)}</time>
            {e.ends_at && e.ends_at !== e.starts_at && <> – <time dateTime={e.ends_at}>{time(e.ends_at)}</time></>}
          </EventFact>
        </>}
        {(e.location_text || e.location_type_code !== "Unknown") && (
          <EventFact icon={e.location_type_code === "Online" ? Video : MapPin} label={c("الموقع", "Location")}>
            {e.location_text ? <bdi><ContentText value={e.location_text}/></bdi> : labels[e.location_type_code]}
          </EventFact>
        )}
        <EventFact icon={Timer} label={c("ساعات الحضور", "Attendance hours")}>
          {formatHours(e.attendance_hours, locale)}
        </EventFact>
      </dl>
    </Card>
  );
  const updates = (e.public_report || e.public_photos?.length > 0) && (
    <section
      className="panel event-detail-section"
      aria-labelledby="public-event-updates-title"
    >
      <h2 id="public-event-updates-title">
        {c("مستجدات الفعالية", "Event updates")}
      </h2>
      {e.public_report && (
        <p dir="auto" className="event-detail-description">
          <ContentText value={e.public_report}/>
        </p>
      )}
      {e.public_photos?.length > 0 && (
        <ul className="mt-5 grid gap-4 sm:grid-cols-2">
          {e.public_photos.map((url, index) => (
            <li key={url}>
              <Image
                unoptimized
                loading="lazy"
                src={url}
                alt={
                  translateUi((en) ? "en" : "ar", "صورة منشورة للفعالية " + (index + 1), "Event photo " + (index + 1))
                }
                width={640}
                height={400}
                referrerPolicy="no-referrer"
                className="w-full rounded-xl object-cover"
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
  return (
    <div className="event-detail">
      <Card className={cn("grid min-w-0 items-start gap-6 p-4 sm:p-6", e.has_poster && "md:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] md:grid-rows-[auto_1fr]")}>
        <header className={cn("flex min-w-0 flex-col gap-3", e.has_poster && "md:col-start-2 md:row-start-1")}>
          <Link href={"/organizations/" + data.slug} className="flex min-w-0 items-center gap-2 self-start text-sm font-medium text-muted-foreground hover:text-foreground">
            <OrganizationLogo name={data.org_name} src={logoSrc} className="size-9 shrink-0"/>
            <bdi className="wrap-anywhere"><ContentText value={en?(data.org_name_en?.trim()||data.org_name):data.org_name}/></bdi>
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="event-detail-title"><ContentText value={title}/></h1>
            {e.status_code !== "Published" && (
              <OrganizationStatusBadge status={e.status_code === "Draft" ? "draft" : "closed"}>{labels[e.status_code]}</OrganizationStatusBadge>
            )}
          </div>
        </header>
        <div className={cn("flex min-w-0 flex-col gap-5", e.has_poster && "md:col-start-2 md:row-start-2")}>
          {facts}
          {e.description && (
            <p dir="auto" className="max-w-[70ch] whitespace-pre-line wrap-anywhere leading-relaxed text-muted-foreground">
              <ContentText value={en?(e.description_en?.trim()||e.description):e.description}/>
            </p>
          )}
          {!!e.skills?.length && (
            <section className="flex min-w-0 flex-col gap-2">
              <h2 className="text-sm font-medium">{c("المهارات", "Skills")}</h2>
              <ul className="flex flex-wrap gap-2">
                {e.skills.map(skill => <li key={skill.key} className="min-w-0"><Badge variant="secondary" className="h-auto whitespace-normal wrap-anywhere">{skillName(skill, locale)}</Badge></li>)}
              </ul>
            </section>
          )}
          <div className="flex min-w-0 flex-col gap-3">
            {!superAdmin && !data.own && e.status_code === "Published" && e.registration_closes_at && (
              <dl className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                {data.remaining !== null && <div><dt className="inline">{c("المقاعد المتبقية", "Seats remaining")}</dt> <dd className="inline font-medium text-foreground"><NumberText value={data.remaining}/></dd></div>}
                <div><dt className="inline">{c("إغلاق التسجيل", "Registration closes")}</dt> <dd className="inline font-medium text-foreground"><time dateTime={e.registration_closes_at}>{date(e.registration_closes_at)}</time></dd></div>
              </dl>
            )}
            <div className="flex min-w-0 flex-wrap items-start gap-2">
              {!superAdmin && <div className="min-w-0 grow basis-full sm:basis-44">
                <PublicEventRegistration
                  event={{
                    id: e.id,
                    title,
                    status_code: e.status_code,
                    registration_opens_at: e.registration_opens_at,
                    opensLater: new Date(e.registration_opens_at) > new Date(),
                  }}
                  committees={data.committees}
                  open={data.open}
                  remaining={data.remaining}
                  own={data.own}
                  form={data.form}
                  status={data.status}
                  onboarded={data.onboarded}
                  user={user}
                  locale={locale}
                />
              </div>}
              {publicEvent && <EventShareButton id={e.id} title={title} locale={locale}/>}
              {data.canManage && (
                <Button nativeButton={false} variant="outline" className="min-h-10" render={<Link href={`/manage/organizations/${e.organization_id}/events`}/>}>
                  {c("إدارة الفعالية", "Manage event")}
                </Button>
              )}
            </div>
            {e.attendance_url && (
              <Button nativeButton={false} className="self-start" render={<a href={e.attendance_url} target="_blank" rel="noopener noreferrer"/>}>
                <ExternalLink data-icon="inline-start"/>{c("رابط الحضور", "Join online")}
              </Button>
            )}
          </div>
        </div>
        {e.has_poster && (
          <figure className="m-0 min-w-0 self-start md:col-start-1 md:row-span-2 md:row-start-1">
            <EventPoster src={`/event-posters/${e.id}`} title={title} locale={locale} detail/>
          </figure>
        )}
      </Card>
      {updates}
    </div>
  );
}

function EventFact({label, icon: Icon, children}: {label: string; icon: LucideIcon; children: ReactNode}) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,max-content)_minmax(0,1fr)] items-baseline gap-x-3 py-3 sm:gap-x-4">
      <dt className="flex min-w-0 items-center gap-2 text-start text-sm text-muted-foreground"><Icon aria-hidden className="size-4 shrink-0"/><span>{label}</span></dt>
      <dd className="min-w-0 wrap-anywhere text-end text-sm font-medium leading-relaxed">{children}</dd>
    </div>
  );
}
