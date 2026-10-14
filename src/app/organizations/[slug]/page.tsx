import {localizedMetadata} from "@/lib/localized-metadata";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { z } from "zod";
import { eventDate } from "@/features/events/display";
import { PublicHeader } from "@/components/public-header";
import { readPublicOrganization as getPublicOrganization } from "@/features/organizations/public-data";
import { localOrganizationContent } from "@/features/organizations/local-content";
import { groupOrganizationProfileSections, type OrganizationProfileGroup, type OrganizationProfileGroupKind } from "@/features/organizations/section-groups";
import { selectOrganizationEventHighlights } from "@/features/organizations/event-highlights";
import { OrganizationProfileContent, OrganizationProfileIcon, type ProfileIconName } from "@/features/organizations/profile-content";
import { SocialLinkIcons } from "@/features/organizations/social-links";
import { organizationTypes, organizationStatuses } from "@/features/organizations/validation";
import { getPreferences } from "@/lib/preferences";
import { getVerifiedUser } from "@/features/auth/session";
import { isSuperAdminUser } from "@/features/auth/authorization";
import { JsonLd } from "@/lib/json-ld";
import { toMetaDescription } from "@/lib/seo";
import type { CSSProperties } from "react";

export async function generateMetadata({params}:{params:Promise<{slug:string}>}){
  const [{slug},{locale}]=await Promise.all([params,getPreferences()]);
  try {
    const detail=await getPublicOrganization(slug);
    if(!detail)return localizedMetadata('الجهة غير موجودة','Organization not found');
    const {organization}=detail;
    const profile=localOrganizationContent(organization.nameAr,organization.typeCode);
    const summary=profile?.about??organization.summary;
    const description=toMetaDescription(summary,`جهة طلابية ${organization.nameAr} على منصة لُبّ.`);
    return localizedMetadata(organization.nameAr,organization.nameAr,{}, {
      index:organization.statusCode==="Active",
      canonical:`/organizations/${organization.slug}`,
      description:{ar:description,en:description},
    });
  } catch {
    return localizedMetadata(locale==="en"?"Organization details":"تفاصيل الجهة",locale==="en"?"Organization details":"تفاصيل الجهة");
  }
}

function profileGroupIcon(kind: OrganizationProfileGroupKind): ProfileIconName {
  switch (kind) {
    case "about": return "reach";
    case "structure": return "teams";
    case "activities":
    case "impact": return "events";
    case "fields": return "technology";
    case "partnerships": return "partners";
    case "membership": return "membership";
    case "programs":
    case "custom": return "programs";
  }
}

function profileGroupLabel(group: OrganizationProfileGroup, en: boolean): string {
  if (!en) return group.label;
  switch (group.kind) {
    case "about": return "About";
    case "programs": return "Programs";
    case "structure": return group.label === "اللجان" ? "Committees" : "Structure";
    case "activities": return "Events";
    case "fields": return "Fields";
    case "partnerships": return "Partners";
    case "impact": return "Achievements";
    case "membership": return "Membership";
    case "custom": return group.label;
  }
}

export default async function OrganizationPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ committeePage?: string | string[]; section?: string | string[] }>;
}) {
  const { slug } = await params;
  const [preferences,user] = await Promise.all([getPreferences(),getVerifiedUser()]);
  const en = preferences.locale === "en";
  const superAdmin = user ? await isSuperAdminUser(user.id) : false;
  const query = await searchParams;
  const committeePageValue = Array.isArray(query.committeePage) ? query.committeePage[0] : query.committeePage;
  const committeePage = z.coerce.number().int().min(0).max(10000).catch(0).parse(committeePageValue ?? 0);
  let detail: Awaited<ReturnType<typeof getPublicOrganization>>;
  try { detail = await getPublicOrganization(slug, committeePage); }
  catch { return <><PublicHeader /><main id="main" className="mx-auto max-w-3xl px-5 py-14"><h1 className="text-3xl font-bold">{en?"Could not load this organization":"تعذّر تحميل الجهة"}</h1><p className="mt-5 leading-8 text-muted">{en?"Please refresh the page in a moment.":"حاول تحديث الصفحة بعد قليل."}</p><Link className="text-link mt-6 inline-block" href="/organizations">{en?"Back to clubs and councils":"العودة للأندية والمجالس"}</Link></main></>; }
  if (!detail) notFound();

  const { organization, committees, contacts, leadership, rounds, upcomingEvents, announcements } = detail;
  const profile = localOrganizationContent(organization.nameAr, organization.typeCode);
  const socialLinks = [
    ...contacts.map(contact => ({ label: contact.label, value: contact.url, href: contact.url })),
    ...(profile?.links ?? []),
  ];
  const pinnedAnnouncement = announcements.find(item => item.pinned);
  const eventHighlights = selectOrganizationEventHighlights(upcomingEvents);
  const featuredEvent = eventHighlights.find(item => item.featured);
  const otherEventHighlights = eventHighlights.filter(item => item.id !== featuredEvent?.id);
  const otherAnnouncements = announcements.filter(item => !item.pinned);
  const hasMainDetail = Boolean(committees.length);
  const hasSidebarDetail = Boolean(leadership.length);
  const hasUpdates = Boolean(rounds.length || eventHighlights.length || announcements.length);
  const hasOrganizationStructure = Boolean(committees.length || leadership.length);
  const hasActivity = Boolean(pinnedAnnouncement || featuredEvent || otherAnnouncements.length || otherEventHighlights.length);
  const profileSectionGroups = groupOrganizationProfileSections(profile?.sections ?? [], { mergeFieldsWithPrograms: organization.slug === "ieee-club", separateGoals: organization.slug === "dhaheer-club" });
  const aboutProfileGroup = profileSectionGroups.find(group => group.kind === "about");
  const aboutLabel = en ? "About" : `عن ${organization.nameAr.includes("مجتمع") ? "المجتمع" : organization.typeCode === "Council" ? "المجلس" : "النادي"}`;
  const sectionNavItems: { id: string; label: string; icon: ProfileIconName; profileSectionIndexes: number[] }[] = [
    { id: "about", label: aboutLabel, icon: "reach", profileSectionIndexes: aboutProfileGroup?.entries.map(entry => entry.index) ?? [] },
    ...profileSectionGroups.filter(group => group.kind !== "about").map(group => ({
      id: group.id,
      label: profileGroupLabel(group, en),
      icon: profileGroupIcon(group.kind),
      profileSectionIndexes: group.entries.map(entry => entry.index),
    })),
  ];
  if (hasOrganizationStructure && !sectionNavItems.some(item => item.id === "structure")) {
    sectionNavItems.push({ id: "structure", label: en ? "Committees" : committees.length ? "اللجان" : "القيادة", icon: "teams", profileSectionIndexes: [] });
  }
  if (hasActivity && !sectionNavItems.some(item => item.id === "activities")) {
    sectionNavItems.push({ id: "activities", label: en ? "Events" : "الفعاليات", icon: "events", profileSectionIndexes: [] });
  }
  if (rounds.length) sectionNavItems.push({ id: "applications", label: en ? "Applications" : "التقديم", icon: "membership", profileSectionIndexes: [] });
  const requestedSection = Array.isArray(query.section) ? query.section[0] : query.section;
  const activeSection = sectionNavItems.find(item => item.id === requestedSection) ?? sectionNavItems[0];
  const showingAbout = activeSection.id === "about";
  const showingStructure = activeSection.id === "structure";
  const showingActivities = activeSection.id === "activities";
  const showingApplications = activeSection.id === "applications";

  const visibleSummary=profile?.about??organization.summary;
  const canonicalUrl=`https://lub.community/organizations/${organization.slug}`;
  const logoUrl=profile?.logoSrc?new URL(profile.logoSrc,"https://lub.community").toString():organization.logoUrl??undefined;
  const heroImageLayout = profile?.imageTheme === "cybersec" ? { width: 738, height: 1600 } : { fill: true as const };
  const heroImageStyle: CSSProperties | undefined = profile?.imageTheme === "cybersec"
    ? { position: "absolute", width: "auto", height: "180%", maxWidth: "none", top: "57%", right: "auto", bottom: "auto", left: "50%", transform: "translate(-50%, -50%)", padding: 0, objectFit: "contain", objectPosition: "center" }
    : profile?.imageTheme === "tuwaiq"
      ? { width: "140%", height: "109%", maxWidth: "none", top: "50%", right: "auto", bottom: "auto", left: "50%", transform: "translate(-50%, -50%)", padding: 0, objectFit: "contain", objectPosition: "center" }
      : profile?.imageTheme === "it-council" ? { padding: 0, objectFit: "contain", objectPosition: "center" } : { objectFit: "contain", objectPosition: "center" };
  const sameAs=socialLinks.flatMap(link=>{
    if(!link.href)return [];
    try { const url=new URL(link.href);return url.protocol==="https:"?[url.toString()]:[]; }
    catch { return []; }
  });

  return <><PublicHeader />{organization.statusCode==="Active"&&<JsonLd data={{
    "@context":"https://schema.org",
    "@type":"Organization",
    name:organization.nameAr,
    url:canonicalUrl,
    ...(visibleSummary?{description:visibleSummary}:{}),
    ...(logoUrl?{logo:logoUrl}:{}),
    ...(sameAs.length?{sameAs:[...new Set(sameAs)]}:{}),
  }}/>}<main id="main" className="mx-auto max-w-7xl px-5 pb-20 pt-9 sm:px-8 sm:pt-12">
    <Link href="/organizations" className="text-link text-sm">{en?"Clubs and councils":"الأندية والمجالس"}</Link>
    <header id="organization-overview" className="organization-hero organization-section-nav-target mt-6">
      {profile?.coverSrc && <figure className={"organization-hero-cover" + (profile?.imageTheme ? " organization-hero-cover--" + profile.imageTheme : "")}><Image src={profile.coverSrc} alt={en ? profile.imageTheme === "ieee" ? `Logo of ${organization.nameAr}` : `${organization.nameAr} banner` : profile.imageTheme === "ieee" ? `شعار ${organization.nameAr}` : `غلاف ${organization.nameAr}`} fill sizes="(max-width: 767px) 100vw, 1200px" unoptimized className="organization-hero-cover-image" /></figure>}
      <div className={"organization-hero-main" + (profile?.coverSrc ? " organization-hero-main--cover" : "")}>
        {!profile?.coverSrc && (profile?.logoSrc || organization.logoUrl) && <div className={`organization-hero-art organization-hero-art--${profile?.imageTheme ?? "default"}`}>
          <Image src={profile?.logoSrc ?? organization.logoUrl!} alt={en ? `Logo of ${organization.nameAr}` : `شعار ${organization.nameAr}`} {...heroImageLayout} sizes="(max-width: 767px) 100vw, 320px" unoptimized referrerPolicy={!profile?.logoSrc ? "no-referrer" : undefined} className="organization-hero-image" style={heroImageStyle} />
        </div>}
        <div className="organization-hero-copy">
          <p className="text-sm font-bold text-action">{en ? organization.typeCode : organizationTypes[organization.typeCode as keyof typeof organizationTypes]}</p>
          <h1 dir="auto" className="mt-2 text-4xl leading-[1.35] sm:text-5xl">{organization.nameAr}</h1>
          {(profile?.about ?? organization.summary) && <p dir="auto" className="intro-summary mt-5 max-w-3xl whitespace-pre-line text-lg leading-9">{profile?.about ?? organization.summary}</p>}
          {organization.tags.length > 0 && <ul aria-label={en ? "Organization interests" : "مجالات الجهة"} className="mt-6 flex flex-wrap gap-2">{organization.tags.map(tag => <li key={tag} dir="auto" className="rounded-md bg-white px-3 py-1 text-sm">{tag}</li>)}</ul>}
          {organization.statusCode !== "Active" && <p className="mt-6 rounded-lg border border-line bg-white p-4 leading-8">{en ? `This organization is ${organization.statusCode.toLowerCase()}.` : `هذه الجهة ${organizationStatuses[organization.statusCode as keyof typeof organizationStatuses]}.`}{organization.archivedAt && <> {en ? "Archived on" : "أُرشفت بتاريخ"} {new Intl.DateTimeFormat(en ? "en-US" : "ar-SA", { dateStyle: "medium", calendar: "gregory", timeZone: "Asia/Riyadh" }).format(organization.archivedAt)}{en ? ". This link remains available to preserve its history." : "، ويبقى هذا الرابط متاحًا لحفظ تاريخها."}</>}</p>}
          {socialLinks.some(link => link.href) && <section id="organization-contact" className="organization-hero-social organization-section-nav-target" aria-labelledby="organization-social-title">
            <h2 id="organization-social-title" className="text-sm font-bold">{en ? "Organization links" : "روابط التواصل"}</h2>
            <SocialLinkIcons links={socialLinks} en={en} />
          </section>}
        </div>
      </div>
    </header>

    {sectionNavItems.length > 1 && <nav className="organization-section-nav" aria-label={en ? `${organization.nameAr} sections` : `أقسام ${organization.nameAr}`}>
      <ul className="organization-section-nav-list">
        {sectionNavItems.map(item => <li key={item.id}><Link prefetch={false} aria-current={activeSection.id === item.id ? "page" : undefined} className="organization-section-nav-link" href={item.id === "about" ? `/organizations/${slug}` : `/organizations/${slug}?section=${encodeURIComponent(item.id)}`}><OrganizationProfileIcon name={item.icon} /><span>{item.label}</span></Link></li>)}
      </ul>
    </nav>}

    {profile && (showingAbout || activeSection.profileSectionIndexes.length > 0) && <div id="organization-profile" className="organization-section-nav-target"><OrganizationProfileContent profile={profile} en={en} visibleSectionIndexes={activeSection.profileSectionIndexes} showOverview={showingAbout} expandSections showSectionIcons={!(organization.slug === "ieee-club" && activeSection.id === "programs")} /></div>}
    {showingAbout && organization.mission && !profile?.mission && <section className="organization-profile-statement mt-6" aria-labelledby="organization-mission-heading"><h2 id="organization-mission-heading" className="organization-profile-statement-title"><span className="organization-profile-statement-icon"><OrganizationProfileIcon name="mission" /></span>{en?"Our mission":"رسالتنا"}</h2><p dir="auto" className="whitespace-pre-line leading-9 text-muted">{organization.mission}</p></section>}
    {showingActivities && hasActivity && <section className="organization-section-nav-target mt-8" aria-labelledby="organization-updates-title">
      <h2 id="organization-updates-title" className="text-xl font-bold">{en ? "Activities and updates" : "الفعاليات والمستجدات"}</h2>
      <div className="organization-update-list">
        {(pinnedAnnouncement || featuredEvent) && <section className="panel p-6 sm:p-8" aria-label={en?"Featured content":"المميز في الجهة"}><h3 className="text-lg font-bold">{en?"Featured":"المميز في الجهة"}</h3>{pinnedAnnouncement && <article className="mt-5"><p className="text-sm text-action">{en?"Pinned announcement":"إعلان مثبّت"}</p><h4 dir="auto" className="mt-2 text-lg font-bold">{pinnedAnnouncement.title}</h4><p dir="auto" className="mt-3 whitespace-pre-line leading-8 text-muted">{pinnedAnnouncement.body}</p></article>}{featuredEvent && <article className="mt-5 border-t border-line pt-5"><p className="text-sm text-action">{en?"Featured event":"فعالية مميزة"}</p><h4 dir="auto" className="mt-2 text-lg font-bold"><Link className="text-link" href={`/events/${featuredEvent.id}`}>{featuredEvent.title}</Link></h4><p className="mt-2 text-sm text-muted">{eventDate(featuredEvent.starts_at)}</p></article>}</section>}
        {otherAnnouncements.length > 0 && <section className="panel p-6 sm:p-8"><h3 className="text-lg font-bold">{en?"Announcements":"إعلانات الجهة"}</h3><ul className="mt-5 divide-y divide-line">{otherAnnouncements.map(announcement => <li key={announcement.id} className="py-5 first:pt-0 last:pb-0"><h4 dir="auto" className="font-bold">{announcement.title}</h4><p dir="auto" className="mt-3 whitespace-pre-line leading-8 text-muted">{announcement.body}</p></li>)}</ul></section>}
        {otherEventHighlights.length > 0 && <section className="panel p-6 sm:p-8"><h3 className="text-lg font-bold">{en?"Selected events":"فعاليات مختارة"}</h3><ul className="mt-5 space-y-4">{otherEventHighlights.map(event => <li key={event.id}><Link dir="auto" className="text-link" href={`/events/${event.id}`}>{event.title}</Link><p className="mt-2 text-sm text-muted">{eventDate(event.starts_at)}</p></li>)}</ul>{upcomingEvents.length > eventHighlights.length && <Link className="text-link mt-6 inline-block" href={`/events/discover?org=${organization.id}&period=all`}>{en?"All organization events":"كل فعاليات الجهة"}</Link>}</section>}
      </div>
    </section>}
    {showingApplications && rounds.length > 0 && <section className="panel mt-8 p-6 sm:p-8"><h2 className="text-xl font-bold">{en?"Join this organization":"طلبات الانضمام"}</h2><ul className="mt-5 space-y-5">{rounds.map(round => <li key={round.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4"><div><h3 dir="auto" className="font-semibold">{round.title}</h3>{!round.open && <p className="mt-1 text-sm text-muted">{en?"Applications closed":"التقديم مغلق"}</p>}</div>{!superAdmin&&<Link className={round.open ? "button button-compact" : "button button-secondary button-compact"} href={`/organizations/${slug}/apply/${round.id}`}>{en?round.open?"Apply now":"View round":round.open ? "قدّم الآن" : "عرض الجولة"}</Link>}</li>)}</ul></section>}

    {showingStructure && (hasMainDetail || hasSidebarDetail) && <div className={"mt-8 grid items-start gap-6 " + (hasMainDetail && hasSidebarDetail ? "lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" : "grid-cols-1")}>
      {hasMainDetail && <div className="space-y-6">
        {committees.length > 0 && <section className="panel p-6 sm:p-8"><h2 className="text-xl font-bold">{en?"Committees":"اللجان"}</h2><ul className="mt-5 divide-y divide-line">{committees.map(committee => <li key={committee.id} className="py-5 first:pt-0 last:pb-0"><h3 dir="auto" className="text-lg font-medium">{committee.name}</h3>{committee.description && <p dir="auto" className="mt-2 whitespace-pre-line leading-8 text-muted">{committee.description}</p>}</li>)}</ul><nav aria-label={en?"Committee pages":"صفحات اللجان"} className="mt-5 flex flex-wrap gap-4">{committeePage > 0 && <Link className="text-link" href={`?section=structure&committeePage=${committeePage - 1}`}>{en?"Previous committees":"اللجان السابقة"}</Link>}{detail.moreCommittees && <Link className="text-link" href={`?section=structure&committeePage=${committeePage + 1}`}>{en?"Next committees":"اللجان التالية"}</Link>}</nav></section>}
      </div>}
      {hasSidebarDetail && <aside className="space-y-6" aria-label={en?"Leadership and contact":"قيادة الجهة والتواصل"}>
        {leadership.length > 0 && <section className="panel p-6"><h2 className="text-lg font-bold">{en?"Leadership":"قيادة الجهة"}</h2><dl className="mt-5 space-y-5">{leadership.map((person, index) => <div key={index}><dt className="text-sm text-muted">{en?person.roleCode==="OL"?"Leader":"Deputy leader":person.roleCode === "OL" ? "القائد" : "نائب القائد"}</dt><dd dir="auto" className="mt-1 font-medium">{person.fullName}</dd></div>)}</dl></section>}
      </aside>}
    </div>}
    {showingAbout && !hasMainDetail && !hasSidebarDetail && !hasUpdates && !profile && !socialLinks.some(link => link.href) && <div className="mt-8 border-t border-line pt-6"><p className="leading-8 text-muted">{en?"More details and activities will appear here when published.":"تفاصيل الجهة وأنشطتها الإضافية تظهر هنا عند نشرها."}</p><Link href="/organizations" className="text-link mt-3 inline-block">{en?"Explore other organizations":"استكشف الجهات الأخرى"}</Link></div>}
  </main></>;
}
