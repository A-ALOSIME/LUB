import {localizedMetadata} from "@/lib/localized-metadata";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { z } from "zod";
import { eventDate } from "@/features/events/display";
import { PublicHeader } from "@/components/public-header";
import { readPublicOrganization as getPublicOrganization } from "@/features/organizations/public-data";
import { organizationTypes, organizationStatuses } from "@/features/organizations/validation";
import { getPreferences } from "@/lib/preferences";

export async function generateMetadata(){return localizedMetadata('تفاصيل الجهة','Organization details');}

export default async function OrganizationPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ committeePage?: string }>;
}) {
  const { slug } = await params;
  const en = (await getPreferences()).locale === "en";
  const committeePage = z.coerce.number().int().min(0).max(10000).catch(0).parse((await searchParams).committeePage ?? 0);
  let detail: Awaited<ReturnType<typeof getPublicOrganization>>;
  try { detail = await getPublicOrganization(slug, committeePage); }
  catch { return <><PublicHeader /><main id="main" className="mx-auto max-w-3xl px-5 py-14"><h1 className="text-3xl font-bold">{en?"Could not load this organization":"تعذّر تحميل الجهة"}</h1><p className="mt-5 leading-8 text-muted">{en?"Please refresh the page in a moment.":"حاول تحديث الصفحة بعد قليل."}</p><Link className="text-link mt-6 inline-block" href="/organizations">{en?"Back to clubs and councils":"العودة للأندية والمجالس"}</Link></main></>; }
  if (!detail) notFound();

  const { organization, committees, contacts, leadership, rounds, upcomingEvents, announcements } = detail;
  const pinnedAnnouncement = announcements.find(item => item.pinned);
  const featuredEvent = upcomingEvents.find(item => item.featured);
  const otherAnnouncements = announcements.filter(item => !item.pinned);
  const hasMoreDetail = Boolean(organization.mission || committees.length || leadership.length || contacts.length);
  const hasUpdates = Boolean(rounds.length || upcomingEvents.length || announcements.length);

  return <><PublicHeader /><main id="main" className="mx-auto max-w-7xl px-5 pb-20 pt-9 sm:px-8 sm:pt-12">
    <Link href="/organizations" className="text-link text-sm">{en?"Clubs and councils":"الأندية والمجالس"}</Link>
    <header className="organization-intro mt-6 rounded-2xl border border-[#d4e2ec] bg-[#e8f0f6] px-6 py-9 sm:px-10 sm:py-12">
      <div className="flex flex-wrap items-center gap-7">
        {organization.logoUrl && <Image unoptimized src={organization.logoUrl} alt={en?`Logo of ${organization.nameAr}`:`شعار ${organization.nameAr}`} width={96} height={96} referrerPolicy="no-referrer" className="size-24 rounded-xl bg-white p-2 object-contain" />}
        <div className="min-w-0"><p className="text-sm font-bold text-action">{en?organization.typeCode:organizationTypes[organization.typeCode as keyof typeof organizationTypes]}</p><h1 dir="auto" className="mt-2 text-4xl leading-[1.35] sm:text-5xl">{organization.nameAr}</h1></div>
      </div>
      {organization.summary && <p dir="auto" className="intro-summary mt-6 max-w-3xl whitespace-pre-line text-lg leading-9 text-[#354c60]">{organization.summary}</p>}
      {organization.tags.length > 0 && <ul aria-label={en?"Organization interests":"مجالات الجهة"} className="mt-6 flex flex-wrap gap-2">{organization.tags.map(tag => <li key={tag} dir="auto" className="rounded-md bg-white px-3 py-1 text-sm">{tag}</li>)}</ul>}
      {organization.statusCode !== "Active" && <p className="mt-6 rounded-lg border border-line bg-white p-4 leading-8">{en?`This organization is ${organization.statusCode.toLowerCase()}.`:`هذه الجهة ${organizationStatuses[organization.statusCode as keyof typeof organizationStatuses]}.`}{organization.archivedAt && <> {en?"Archived on":"أُرشفت بتاريخ"} {new Intl.DateTimeFormat(en?"en-US":"ar-SA", { dateStyle: "medium", calendar: "gregory", timeZone: "Asia/Riyadh" }).format(organization.archivedAt)}{en?". This link remains available to preserve its history.":"، ويبقى هذا الرابط متاحًا لحفظ تاريخها."}</>}</p>}
    </header>

    {(pinnedAnnouncement || featuredEvent) && <section className="panel mt-8 p-6 sm:p-8" aria-label={en?"Featured content":"المميز في الجهة"}><h2 className="text-xl font-bold">{en?"Featured":"المميز في الجهة"}</h2>{pinnedAnnouncement && <article className="mt-5"><p className="text-sm text-action">{en?"Pinned announcement":"إعلان مثبّت"}</p><h3 dir="auto" className="mt-2 text-lg font-bold">{pinnedAnnouncement.title}</h3><p dir="auto" className="mt-3 whitespace-pre-line leading-8 text-muted">{pinnedAnnouncement.body}</p></article>}{featuredEvent && <article className="mt-5 border-t border-line pt-5"><p className="text-sm text-action">{en?"Featured event":"فعالية مميزة"}</p><h3 dir="auto" className="mt-2 text-lg font-bold"><Link className="text-link" href={`/events/${featuredEvent.id}`}>{featuredEvent.title}</Link></h3><p className="mt-2 text-sm text-muted">{eventDate(featuredEvent.starts_at)}</p></article>}</section>}
    {otherAnnouncements.length > 0 && <section className="panel mt-8 p-6 sm:p-8"><h2 className="text-xl font-bold">{en?"Announcements":"إعلانات الجهة"}</h2><ul className="mt-5 divide-y divide-line">{otherAnnouncements.map(announcement => <li key={announcement.id} className="py-5 first:pt-0 last:pb-0"><h3 dir="auto" className="text-lg font-bold">{announcement.title}</h3><p dir="auto" className="mt-3 whitespace-pre-line leading-8 text-muted">{announcement.body}</p></li>)}</ul></section>}

    {(rounds.length > 0 || upcomingEvents.length > 0) && <div className="mt-8 grid gap-6 lg:grid-cols-2">
      {rounds.length > 0 && <section className="panel p-6 sm:p-8"><h2 className="text-xl font-bold">{en?"Join this organization":"طلبات الانضمام"}</h2><ul className="mt-5 space-y-5">{rounds.map(round => <li key={round.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4"><div><h3 dir="auto" className="font-semibold">{round.title}</h3>{!round.open && <p className="mt-1 text-sm text-muted">{en?"Applications closed":"التقديم مغلق"}</p>}</div><Link className={round.open ? "button button-compact" : "button button-secondary button-compact"} href={`/organizations/${slug}/apply/${round.id}`}>{en?round.open?"Apply now":"View round":round.open ? "قدّم الآن" : "عرض الجولة"}</Link></li>)}</ul></section>}
      {upcomingEvents.length > 0 && <section className="panel p-6 sm:p-8"><h2 className="text-xl font-bold">{en?"Upcoming and current events":"الفعاليات القادمة والجارية"}</h2><ul className="mt-5 space-y-4">{upcomingEvents.map(event => <li key={event.id}><Link dir="auto" className="text-link" href={`/events/${event.id}`}>{event.title}</Link><p className="mt-2 text-sm text-muted">{eventDate(event.starts_at)}</p></li>)}</ul><Link className="text-link mt-6 inline-block" href={`/events?org=${organization.id}&period=all`}>{en?"All organization events":"كل فعاليات الجهة"}</Link></section>}
    </div>}

    {hasMoreDetail && <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"><div className="space-y-6">
      {organization.mission && <section className="panel p-6 sm:p-8"><h2 className="text-xl font-bold">{en?"Our mission":"رسالتنا"}</h2><p dir="auto" className="mt-4 whitespace-pre-line leading-9 text-muted">{organization.mission}</p></section>}
      {committees.length > 0 && <section className="panel p-6 sm:p-8"><h2 className="text-xl font-bold">{en?"Committees":"اللجان"}</h2><ul className="mt-5 divide-y divide-line">{committees.map(committee => <li key={committee.id} className="py-5 first:pt-0 last:pb-0"><h3 dir="auto" className="text-lg font-medium">{committee.name}</h3>{committee.description && <p dir="auto" className="mt-2 whitespace-pre-line leading-8 text-muted">{committee.description}</p>}</li>)}</ul><nav aria-label={en?"Committee pages":"صفحات اللجان"} className="mt-5 flex flex-wrap gap-4">{committeePage > 0 && <Link className="text-link" href={`?committeePage=${committeePage - 1}`}>{en?"Previous committees":"اللجان السابقة"}</Link>}{detail.moreCommittees && <Link className="text-link" href={`?committeePage=${committeePage + 1}`}>{en?"Next committees":"اللجان التالية"}</Link>}</nav></section>}
    </div>
      {(leadership.length > 0 || contacts.length > 0) && <aside className="space-y-6" aria-label={en?"Leadership and contact":"قيادة الجهة والتواصل"}>
        {leadership.length > 0 && <section className="panel p-6"><h2 className="text-lg font-bold">{en?"Leadership":"قيادة الجهة"}</h2><dl className="mt-5 space-y-5">{leadership.map((person, index) => <div key={index}><dt className="text-sm text-muted">{en?person.roleCode==="OL"?"Leader":"Deputy leader":person.roleCode === "OL" ? "القائد" : "نائب القائد"}</dt><dd dir="auto" className="mt-1 font-medium">{person.fullName}</dd></div>)}</dl></section>}
        {contacts.length > 0 && <section className="panel p-6"><h2 className="text-lg font-bold">{en?"Contact":"التواصل"}</h2><ul className="mt-4 space-y-4">{contacts.map(link => <li key={link.id}><a href={link.url} target="_blank" rel="noopener noreferrer" className="text-link break-words">{link.label}<span className="sr-only"> {en?"(opens in a new window)":"(يفتح في نافذة جديدة)"}</span></a></li>)}</ul></section>}
      </aside>}
    </div>}
    {!hasMoreDetail && !hasUpdates && <div className="mt-8 border-t border-line pt-6"><p className="leading-8 text-muted">{en?"More details and activities will appear here when published.":"تفاصيل الجهة وأنشطتها الإضافية تظهر هنا عند نشرها."}</p><Link href="/organizations" className="text-link mt-3 inline-block">{en?"Explore other organizations":"استكشف الجهات الأخرى"}</Link></div>}
  </main></>;
}
