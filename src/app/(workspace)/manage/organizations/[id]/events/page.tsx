import { localizedMetadata } from "@/lib/localized-metadata";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireManagementUser } from "@/features/organizations/access";
import { eventWorkspaceOverview } from "@/features/events/workspace";
import { EventForm, EventFields } from "@/features/events/form";
import { eventLabels, eventDate, eventLabelsEn, eventDateEn } from "@/features/events/display";
import { getPreferences } from "@/lib/preferences";

export async function generateMetadata() {
  return localizedMetadata("إدارة الفعاليات", "Manage events");
}

export default async function ManageEvents({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const [user, { locale }] = await Promise.all([requireManagementUser(), getPreferences()]);
  const en = locale === "en";
  const labels = en ? eventLabelsEn : eventLabels;
  const date = en ? eventDateEn : eventDate;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const search = await searchParams;
  const page = Math.floor(Math.min(10000, Math.max(0, Number(search.page) || 0)));
  const data = await eventWorkspaceOverview(user.id, id, page);
  if (!data) notFound();
  return <div className="workspace-content organization-events-page">
    <header className="workspace-page-header">
      <div>
        <p className="workspace-eyebrow">{en ? "Organization workspace" : "مساحة الجهة"}</p>
        <h1 className="mt-2 text-3xl font-bold">{en ? "Events" : "الفعاليات"}</h1>
        <p className="mt-2 leading-7 text-muted"><bdi>{data.name}</bdi> · {en ? "Create events, attach posters and manage publication." : "أنشئ الفعاليات وأرفق بوستراتها وتابع نشرها."}</p>
      </div>
      {data.canManage && <a className="button shrink-0" href="#new-event">{en ? "Create event" : "إنشاء فعالية"}</a>}
    </header>

    {data.canManage && <section id="new-event" className="workspace-panel panel mb-8 p-5 sm:p-7">
      <div className="workspace-section-heading">
        <span className="workspace-section-icon" aria-hidden="true">＋</span>
        <div><p className="workspace-eyebrow">{en ? "Event setup" : "إعداد الفعالية"}</p><h2 className="text-xl font-bold">{en ? "Create an event" : "فعالية جديدة"}</h2></div>
      </div>
      <p className="mt-3 max-w-3xl leading-7 text-muted">{en ? "Add event details and an optional poster. The poster is shown publicly only after the event is published." : "أضف تفاصيل الفعالية وارفق بوسترًا اختياريًا. لا يظهر البوستر للعامة إلا بعد نشر الفعالية."}</p>
      <EventForm operation="save" fields={{ org: id }} label={en ? "Save draft" : "حفظ المسودة"} locale={locale}>
        <EventFields organization={id} templates={data.templates} locale={locale} />
      </EventForm>
    </section>}

    <section aria-labelledby="events-list-title" className="workspace-events-section">
      <div className="workspace-section-heading mb-4">
        <span className="workspace-section-icon" aria-hidden="true">◷</span>
        <div><p className="workspace-eyebrow">{en ? "Event list" : "سجل الجهة"}</p><h2 id="events-list-title" className="text-xl font-bold">{en ? "Events" : "فعاليات الجهة"}</h2></div>
      </div>
      {data.events.length ? <ul className="grid gap-4 xl:grid-cols-2">{data.events.slice(0, 25).map(event => <li key={event.id} className="workspace-panel workspace-event-card panel min-w-0 overflow-hidden">
        {event.has_poster && <Link href={`/events/${event.id}`} aria-label={en ? `Open ${event.title}` : `افتح ${event.title}`} className="workspace-event-poster"><Image src={`/event-posters/${event.id}`} alt="" fill unoptimized sizes="(max-width: 1279px) 100vw, 40vw" /></Link>}
        <div className="workspace-event-copy">
          <div className="flex flex-wrap items-center justify-between gap-3"><span className={`workspace-status ${event.status_code === "Published" ? "is-current" : ""}`}>{labels[event.status_code]}</span><time className="text-sm text-muted" dateTime={event.starts_at}>{date(event.starts_at)}</time></div>
          <h3 dir="auto" className="mt-3 break-words text-lg font-bold"><Link href={`/events/${event.id}`} className="text-link">{event.title}</Link></h3>
        </div>
      </li>)}</ul> : <div className="workspace-empty workspace-panel panel"><p className="font-semibold">{en ? "No events yet." : "ما فيه فعاليات مسجلة للجهة حتى الآن."}</p>{data.canManage && <p className="mt-1 text-sm text-muted">{en ? "Create the first event above to get started." : "ابدأ بإنشاء أول فعالية من النموذج أعلاه."}</p>}</div>}
      <nav aria-label={en ? "Event pages" : "صفحات الفعاليات"} className="mt-6 flex gap-5">{page > 0 && <Link className="text-link" href={`?page=${page - 1}`}>{en ? "Previous" : "السابق"}</Link>}{data.events.length > 25 && <Link className="text-link" href={`?page=${page + 1}`}>{en ? "Next" : "التالي"}</Link>}</nav>
    </section>
  </div>;
}
