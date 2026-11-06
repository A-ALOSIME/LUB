import Image from "next/image";
import {ArchivalEventContent} from "./archival-content";
import {OrganizationLogo} from "@/components/organization-logo";

import {ContentText} from "@/components/content-text";
import {t as translateUi,createTranslator} from "@/lib/i18n";
import {NumberText} from "@/components/number-text";
import { PublicEventRegistration } from "./public-registration";
import { EventPoster } from "./poster";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatHours } from "@/lib/display";
import Link from "next/link";
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
    <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),22rem))] justify-center gap-5">
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
          <li key={e.id}><Card className="h-full gap-0 py-0 transition-colors hover:bg-muted/40">
            <Link href={`/events/${e.id}`} className="event-card flex min-w-0 flex-1 flex-col">
              <EventPoster
                src={e.has_poster ? `/event-posters/${e.id}` : null}
                title={e.title}
                locale={locale}
              />
              <div className="event-card-copy">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 dir="auto" className="m-0 text-xl font-semibold">
                    <ContentText autoTranslate={e.status_code!=="Draft"} value={e.title}/>
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
                  {e.source_date_text?<ContentText autoTranslate value={e.source_date_text}/>:<time dateTime={e.starts_at}>{day(e.starts_at)}</time>}
                </p>}
                {e.status_code!=="Archived"&&<p className="event-card-meta">
                  <EventIcon name="clock" />
                  <span>{translateUi((en) ? "en" : "ar", "الوقت", "Time")}</span>
                  <time dateTime={e.starts_at}>{time(e.starts_at)}</time>
                </p>}
                {(e.location_type_code!=="Unknown"||e.location_text)&&<p className="event-card-meta">
                  <EventIcon name="location" />
                  <span>{e.location_text?<ContentText autoTranslate value={e.location_text}/>:labels[e.location_type_code]}</span>
                </p>}
              </div>
              <div className="event-card-organization">
                <OrganizationLogo name={e.org_name} src={logoSrc} className="event-card-organization-logo"/>
                <bdi><ContentText autoTranslate value={e.org_name}/></bdi>
              </div>
              <span
                className={buttonVariants({
                  variant: "default",
                  className: "mx-5 mb-5",
                })}
              >
                {translateUi((en) ? "en" : "ar", "عرض الفعالية", "View event")}
              </span>
            </Link>
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
  const day = en ? eventDayEn : eventDay;
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

  const facts = (
    <dl className="event-detail-facts">
      <EventFact icon="calendar" label={c("موعد الفعالية", "Event date")}>
        <time dateTime={e.starts_at}>{day(e.starts_at)}</time>
        {e.ends_at !== e.starts_at && (
          <>
            {" "}
            · {c("حتى", "to")}{" "}
            <time dateTime={e.ends_at}>{day(e.ends_at)}</time>
          </>
        )}
      </EventFact>
      <EventFact icon="clock" label={c("الوقت", "Time")}>
        <time dateTime={e.starts_at}>{time(e.starts_at)}</time>
        {e.ends_at !== e.starts_at && (
          <>
            {" "}
            – <time dateTime={e.ends_at}>{time(e.ends_at)}</time>
          </>
        )}
      </EventFact>
      <EventFact
        icon={e.location_type_code === "Online" ? "online" : "location"}
        label={c("الموقع", "Location")}
      >
        {e.location_text ? (
          <bdi><ContentText autoTranslate value={e.location_text}/></bdi>
        ) : (
          labels[e.location_type_code]
        )}
      </EventFact>
      <EventFact
        icon="calendar"
        label={c("فترة التسجيل", "Registration period")}
      >
        <time dateTime={e.registration_opens_at}>
          {date(e.registration_opens_at)}
        </time>{" "}
        ·{" "}
        <time dateTime={e.registration_closes_at}>
          {date(e.registration_closes_at)}
        </time>
      </EventFact>
      {data.remaining !== null && (
        <EventFact
          icon="users"
          label={c("المقاعد المتبقية", "Seats remaining")}
        >
          <NumberText value={data.remaining}/>
        </EventFact>
      )}
      <EventFact
        icon="certificate"
        label={c("ساعات الحضور", "Attendance hours")}
      >
        {formatHours(e.attendance_hours, locale)}
      </EventFact>
      {e.online_url && (
        <EventFact icon="online" label={c("رابط الحضور", "Attendance link")}>
          <a
            href={e.online_url}
            className="text-link wrap-anywhere"
            rel="noopener noreferrer"
          >
            {c("فتح الرابط", "Open link")}
          </a>
        </EventFact>
      )}
    </dl>
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
          <ContentText autoTranslate value={e.public_report}/>
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
      <section className="panel event-detail-hero">
        <div className="event-detail-copy">
          <Link
            href={"/organizations/" + data.slug}
            className="event-detail-organization"
            dir="auto"
          >
            <OrganizationLogo name={data.org_name} src={logoSrc} className="event-detail-organization-logo"/>
            <span>
              <span className="block text-xs font-medium text-muted">
                {c("تنظمها", "Organized by")}
              </span>
              <bdi><ContentText autoTranslate value={data.org_name}/></bdi>
            </span>
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 dir="auto" className="event-detail-title">
              {e.title?<ContentText autoTranslate={e.status_code!=="Draft"} value={e.title}/>:c("فعالية بدون عنوان", "Untitled event")}
            </h1>
            <OrganizationStatusBadge
              status={
                e.status_code === "Published"
                  ? "published"
                  : e.status_code === "Draft"
                    ? "draft"
                    : "closed"
              }
            >
              {labels[e.status_code]}
            </OrganizationStatusBadge>
          </div>
          {facts}
          {e.description && (
            <p dir="auto" className="event-detail-description">
              <ContentText autoTranslate={e.status_code!=="Draft"} value={e.description}/>
            </p>
          )}
          {!superAdmin && (
            <PublicEventRegistration
              event={{
                id: e.id,
                title: e.title,
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
          )}
          {data.canManage && (
            <Button
              nativeButton={false}
              variant="outline"
              size="sm"
              render={
                <Link
                  href={`/manage/organizations/${e.organization_id}/events`}
                />
              }
            >
              {c("إدارة الفعالية", "Manage event")}
            </Button>
          )}
        </div>
        <figure className="event-detail-poster">
          <EventPoster
            src={e.has_poster ? `/event-posters/${e.id}` : null}
            title={e.title}
            locale={locale}
            detail
          />
        </figure>
      </section>

      {updates}
    </div>
  );
}

function EventFact({
  icon,
  label,
  children,
}: {
  icon: "calendar" | "clock" | "online" | "location" | "users" | "certificate";
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="event-detail-fact">
      <dt>
        <EventIcon name={icon} />
        {label}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}
