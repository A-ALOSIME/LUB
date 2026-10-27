import {
  OrganizationSectionTabs,
  OrganizationSectionTabPanel,
} from "@/features/organizations/organization-section-tabs";
import { PublicEventRegistration } from "./public-registration";
import { EventPoster } from "./poster";
import { Upload, EyeOff } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EventSecondaryTools } from "./secondary-tools";
import {
  Pencil,
  Copy,
  SlidersHorizontal,
} from "lucide-react";
import { formatHours } from "@/lib/display";
import { NativeSelect } from "@/components/ui/native-select";
import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { ManagementActionSheet } from "@/components/management-action-sheet";
import type { EventCard, EventDetail } from "./repository";
import { EventForm, EventFields, EventAttachment } from "./form";
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
import {Switch} from "@/components/ui/switch";
import { FormField } from "@/components/form-field";
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
    <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
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
          <li key={e.id}>
            <Link href={`/events/${e.id}`} className="panel event-card min-w-0">
              <EventPoster
                src={e.has_poster ? `/event-posters/${e.id}` : null}
                title={e.title}
                locale={locale}
              />
              <div className="event-card-copy">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 dir="auto" className="m-0 text-xl font-semibold">
                    {e.title}
                  </h2>
                  {e.status_code !== "Published" && (
                    <OrganizationStatusBadge
                      status={e.status_code === "Draft" ? "draft" : "closed"}
                    >
                      {labels[e.status_code]}
                    </OrganizationStatusBadge>
                  )}
                </div>
                <p className="event-card-meta">
                  <EventIcon name="calendar" />
                  <span>{en ? "Date" : "التاريخ"}</span>
                  <time dateTime={e.starts_at}>{day(e.starts_at)}</time>
                </p>
                <p className="event-card-meta">
                  <EventIcon name="clock" />
                  <span>{en ? "Time" : "الوقت"}</span>
                  <time dateTime={e.starts_at}>{time(e.starts_at)}</time>
                </p>
                <p className="event-card-meta">
                  <EventIcon name="location" />
                  <span>{e.location_text || labels[e.location_type_code]}</span>
                  <Badge variant="outline">
                    {labels[e.location_type_code]}
                  </Badge>
                </p>
              </div>
              <div className="event-card-organization">
                {logoSrc ? (
                  <span className="event-card-organization-logo">
                    <Image
                      src={logoSrc}
                      alt=""
                      width={48}
                      height={48}
                      unoptimized
                      loading="lazy"
                    />
                  </span>
                ) : (
                  <span
                    className="event-card-organization-logo event-card-organization-logo--fallback"
                    aria-hidden="true"
                  >
                    {Array.from(e.org_name)[0] ?? "؟"}
                  </span>
                )}
                <bdi>{e.org_name}</bdi>
              </div>
              <span
                className={buttonVariants({
                  variant: "outline",
                  className: "self-start mx-5 mb-5",
                })}
              >
                {en ? "View event" : "عرض الفعالية"}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  ) : (
    <p role="status" className="panel event-empty-state text-muted">
      {en ? "No matching events right now." : "لا توجد فعاليات مطابقة الآن."}
    </p>
  );
}
export function EventContent({
  data,
  user,
  superAdmin = false,
  locale = "ar",
  initialAction,
  management = false,
  attendeesContent,
}: {
  data: EventDetail;
  user: boolean;
  superAdmin?: boolean;
  locale?: Locale;
  initialAction?: "edit" | "settings";
  management?: boolean;
  attendeesContent?:ReactNode;
}) {
  const e = data.event;
  const base = { event: e.id, revision: String(e.revision) };
  const en = locale === "en";
  const c = (ar: string, english: string) => (en ? english : ar);
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
          <bdi>{e.location_text}</bdi>
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
          {data.remaining}
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
          {e.public_report}
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
                  en
                    ? "Event photo " + (index + 1)
                    : "صورة منشورة للفعالية " + (index + 1)
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
            {logoSrc ? (
              <span className="event-detail-organization-logo">
                <Image
                  src={logoSrc}
                  alt=""
                  width={72}
                  height={72}
                  unoptimized
                />
              </span>
            ) : (
              <span
                className="event-detail-organization-logo event-card-organization-logo--fallback"
                aria-hidden="true"
              >
                {Array.from(data.org_name)[0] ?? "؟"}
              </span>
            )}
            <span>
              <span className="block text-xs font-medium text-muted">
                {c("تنظمها", "Organized by")}
              </span>
              <bdi>{data.org_name}</bdi>
            </span>
          </Link>
          <p className="event-detail-status">
            <Badge variant="outline">{labels[e.location_type_code]}</Badge>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 dir="auto" className="event-detail-title">
              {e.title || c("فعالية بدون عنوان", "Untitled event")}
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
          {!management && facts}
          {!management && e.description && (
            <p dir="auto" className="event-detail-description">
              {e.description}
            </p>
          )}
          {management && data.canManage && (
            <nav
              className="flex flex-wrap items-center gap-2"
              aria-label={c("أدوات الفعالية", "Event tools")}
            >
              {["Draft", "Published"].includes(e.status_code) && (
                <ManagementActionSheet
                  icon={<Pencil />}
                  initiallyOpen={initialAction === "edit"}
                  label={c("تعديل", "Edit")}
                  title={c("تعديل الفعالية", "Edit event")}
                  locale={locale}
                  width="wide"
                  mobileBottomSheet
                >
                  <EventForm
                    operation="save"
                    fields={{ ...base, org: e.organization_id }}
                    label={c("حفظ التعديلات", "Save changes")}
                    locale={locale}
                  >
                    <EventFields
                      value={e}
                      organization={e.organization_id}
                      locale={locale}
                    />
                  </EventForm>
                </ManagementActionSheet>
              )}
              <ManagementActionSheet
                icon={<SlidersHorizontal />}
                initiallyOpen={initialAction === "settings"}
                label={c("الإعدادات", "Settings")}
                title={c("إعدادات الفعالية", "Event settings")}
                locale={locale}
                mobileBottomSheet
              >
                {["Draft","Published"].includes(e.status_code)&&<EventForm operation="policy" fields={base} label={c("حفظ الإعدادات","Save settings")} locale={locale}><FormField label={c("التسجيل يتطلب موافقة","Registration requires approval")} hint={c("عند إيقافه تُقبل التسجيلات الجديدة تلقائيًا.","When off, new registrations are accepted automatically.")}><Switch name="approval" value="on" defaultChecked={e.requires_approval??false} aria-label={c("التسجيل يتطلب موافقة","Registration requires approval")}/></FormField></EventForm>}
                <EventForm
                  operation="status"
                  fields={base}
                  label={c("حفظ الحالة", "Save status")}
                  locale={locale}
                >
                  <FormField label={c("الإجراء", "Action")}>
                    <NativeSelect name="status">
                      {e.status_code === "Draft" ? (
                        <option value="Published">
                          {c("نشر الفعالية", "Publish event")}
                        </option>
                      ) : (
                        <option value="Completed">
                          {c(
                            "إكمال الفعالية واعتماد ساعات الحضور",
                            "Complete event and approve attendance hours",
                          )}
                        </option>
                      )}
                      <option value="Cancelled">
                        {c("إلغاء الفعالية", "Cancel event")}
                      </option>
                    </NativeSelect>
                  </FormField>
                  <label className="flex items-center gap-2">
                    <input name="confirm" type="checkbox" required />
                    {c(
                      "راجعت البيانات والحضور والموافقة الخارجية اللازمة",
                      "I reviewed details, attendance and required external approval",
                    )}
                  </label>
                </EventForm>
              </ManagementActionSheet>
              <ManagementActionSheet
                icon={<Copy />}
                label={c("تكرار", "Duplicate")}
                title={c(
                  "تكرار الفعالية إلى مسودة",
                  "Duplicate event as a draft",
                )}
                locale={locale}
                mobileBottomSheet
              >
                <EventForm
                  operation="duplicate"
                  fields={{ event: e.id,org:e.organization_id }}
                  label={c("إنشاء نسخة", "Create copy")}
                  locale={locale}
                >
                  <p>
                    {c(
                      "ستُنشأ مسودة مستقلة دون تغيير الفعالية الأصلية.",
                      "A separate draft will be created; the original event stays unchanged.",
                    )}
                  </p>
                </EventForm>
              </ManagementActionSheet>
              {["Draft", "Published"].includes(e.status_code) && (
                <ManagementActionSheet
                  icon={e.status_code === "Draft" ? <Upload /> : <EyeOff />}
                  label={
                    e.status_code === "Draft"
                      ? c("نشر", "Publish")
                      : c("إلغاء النشر", "Unpublish")
                  }
                  title={
                    e.status_code === "Draft"
                      ? c(`نشر «${e.title}»؟`, `Publish “${e.title}”?`)
                      : c(`إلغاء نشر «${e.title}»؟`, `Unpublish “${e.title}”?`)
                  }
                  locale={locale}
                  mobileBottomSheet
                >
                  <EventForm
                    operation="status"
                    fields={{
                      ...base,
                      status: e.status_code === "Draft" ? "Published" : "Draft",
                      confirm: "on",
                    }}
                    label={c("تأكيد", "Confirm")}
                    locale={locale}
                  >
                    <p>
                      {e.status_code === "Draft"
                        ? c(
                            "ستظهر الفعالية للجميع ويُفتح التسجيل في موعده.",
                            "The event becomes public and registration opens at its scheduled time.",
                          )
                        : c(
                            "ستختفي الفعالية من العرض العام ويتوقف التسجيل، مع الاحتفاظ بالمسجلين.",
                            "The event becomes private and registration pauses; existing registrations are preserved.",
                          )}
                    </p>
                  </EventForm>
                </ManagementActionSheet>
              )}
              <EventSecondaryTools
                locale={locale}
                actions={[
                  ...(e.status_code === "Published"
                    ? [
                        {
                          id: "feature",
                          label: c("تمييز الفعالية", "Feature event"),
                          content: (
                            <EventForm
                              operation="feature"
                              fields={{ event: e.id }}
                              label={c("حفظ التمييز", "Save featured status")}
                              locale={locale}
                            >
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  name="featured"
                                  defaultChecked={e.is_featured}
                                />
                                {c(
                                  "تمييز الفعالية في صفحة الجهة",
                                  "Feature on the organization page",
                                )}
                              </label>
                            </EventForm>
                          ),
                        },
                      ]
                    : []),
                  ...(["Published", "Completed"].includes(e.status_code)
                    ? [
                        {
                          id: "updates",
                          label: c("التحديثات العامة", "Public updates"),
                          content: (
                            <EventForm
                              operation="public-content"
                              fields={{ event: e.id }}
                              label={c("حفظ", "Save")}
                              locale={locale}
                            >
                              <FormField
                                label={c("ملخص أو تقرير عام", "Public report")}
                              >
                                <textarea
                                  name="report"
                                  defaultValue={e.public_report}
                                  rows={5}
                                  maxLength={5000}
                                />
                              </FormField>
                              <FormField
                                label={c(
                                  "روابط الصور العامة",
                                  "Public photo URLs",
                                )}
                              >
                                <textarea
                                  name="photos"
                                  defaultValue={
                                    e.public_photos?.join("\n") ?? ""
                                  }
                                  rows={4}
                                  dir="ltr"
                                />
                              </FormField>
                            </EventForm>
                          ),
                        },
                      ]
                    : []),
                  {
                    id: "attachments",
                    label: c("المرفقات", "Attachments"),
                    content: (
                      <>
                        <EventAttachment event={e.id} locale={locale} />
                        {data.assets.map((asset) => (
                          <p key={asset.id}>
                            <a
                              href={`/files/${asset.id}`}
                              className="text-link"
                            >
                              {asset.file_name}
                            </a>
                          </p>
                        ))}
                      </>
                    ),
                  },
                ]}
              />
            </nav>
          )}
          {!management && !superAdmin && (
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
                  href={
                    management
                      ? `/events/${e.id}`
                      : `/manage/organizations/${e.organization_id}/events/${e.id}`
                  }
                />
              }
            >
              {management
                ? c("عرض الصفحة العامة", "View public page")
                : c("إدارة الفعالية", "Manage event")}
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

      {management ? (
        <OrganizationSectionTabs
          items={[
            { id: "details", label: c("التفاصيل", "Details") },
            {
              id: "attendees",
              label: c("المسجلون والحضور", "Registrants and attendance"),
            },
          ]}
          initialSection="details"
          defaultSection="details"
          label={c("إدارة الفعالية", "Event management")}
          dir={en ? "ltr" : "rtl"}
          sticky={false}
        >
          <OrganizationSectionTabPanel id="details">
            <section className="panel flex flex-col gap-5">
              {facts}
              {e.description && (
                <p dir="auto" className="whitespace-pre-wrap leading-relaxed">
                  {e.description}
                </p>
              )}
            </section>
            {updates}
          </OrganizationSectionTabPanel>
          <OrganizationSectionTabPanel id="attendees">
            {attendeesContent}
          </OrganizationSectionTabPanel>
        </OrganizationSectionTabs>
      ) : (
        updates
      )}
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
