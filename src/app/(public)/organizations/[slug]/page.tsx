import {translateContent} from "@/lib/content-translation";

import {ContentText} from "@/components/content-text";
import {t as translateUi} from "@/lib/i18n";
import {localizedMetadata} from "@/lib/localized-metadata";
import Link from "next/link";
import Image from "next/image";
import {Button} from "@/components/ui/button";
import {PublicRegistration,RegistrationCallToAction} from "@/features/forms/public-registration";
import {getRound} from "@/features/forms/repository";
import {PublicAnnouncements} from "@/features/organizations/public-announcements";
import { ArrowRight, Settings2, Megaphone } from "lucide-react";
import { notFound } from "next/navigation";
import { eventDate } from "@/features/events/display";
import { readPublicOrganization as getPublicOrganization } from "@/features/organizations/public-data";
import { localOrganizationContent } from "@/features/organizations/local-content";
import { groupOrganizationProfileSections, orderOrganizationTabs, type OrganizationProfileGroup, type OrganizationProfileGroupKind } from "@/features/organizations/section-groups";
import { OrganizationSectionTabPanel, OrganizationSectionTabs } from "@/features/organizations/organization-section-tabs";
import { selectOrganizationEventHighlights } from "@/features/organizations/event-highlights";
import { OrganizationProfileContent, OrganizationProfileIcon, type ProfileIconName } from "@/features/organizations/profile-content";
import { SocialLinkIcons } from "@/features/organizations/social-links";
import { organizationContactLabel } from "@/features/organizations/contact-channels";
import { organizationTypes, organizationStatuses } from "@/features/organizations/validation";
import { getPreferences } from "@/lib/preferences";
import { getVerifiedUser } from "@/features/auth/session";
import { isSuperAdminUser } from "@/features/auth/authorization";
import { formatRiyadhDate } from "@/lib/datetime";
import { canManageOrganizationSettings } from "@/features/organizations/management-repository";
import { JsonLd } from "@/lib/json-ld";
import { toMetaDescription } from "@/lib/seo";
import type { CSSProperties } from "react";
import { buildCommitteeTree } from "@/features/organizations/committee-tree";
import { buildOrganizationProfilePresentation } from "@/features/organizations/organization-public-profile";
import { OrganizationCommitteeChart } from "@/features/organizations/organization-committee-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export async function generateMetadata({params}:{params:Promise<{slug:string}>}){
  const [{slug},{locale}]=await Promise.all([params,getPreferences()]);
  try {
    const detail=await getPublicOrganization(slug);
    if(!detail)return localizedMetadata('الجهة غير موجودة','Organization not found');
    const {organization}=detail;
    const profile=localOrganizationContent(organization.nameAr,organization.typeCode);
    const summary=organization.summary ?? profile?.about ?? "";
    const description=toMetaDescription(summary,`جهة طلابية ${organization.nameAr} على منصة لُبّ.`);
    return localizedMetadata(organization.nameAr,translateContent(organization.nameAr,"en"),{}, {
      index:organization.statusCode==="Active",
      canonical:`/organizations/${organization.slug}`,
      description:{ar:description,en:toMetaDescription(translateContent(summary,"en"),`Student organization ${translateContent(organization.nameAr,"en")} on LUB.`)},
    });
  } catch {
    return localizedMetadata(translateUi((locale==="en") ? "en" : "ar", "تفاصيل الجهة", "Organization details"),translateUi((locale==="en") ? "en" : "ar", "تفاصيل الجهة", "Organization details"));
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
    case "programs": return "programs";
  }
}

function profileGroupLabel(group: OrganizationProfileGroup, en: boolean): string {
  if (!en) return group.label;
  switch (group.kind) {
    case "about": return "About";
    case "programs": return "Programs";
    case "structure": return "Committees";
    case "activities": return "Events";
    case "fields": return "Fields";
    case "partnerships": return "Partners";
    case "impact": return "Achievements";
    case "membership": return "Membership";
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
  let detail: Awaited<ReturnType<typeof getPublicOrganization>>;
  try { detail = await getPublicOrganization(slug); }
  catch { return <><main id="main" className="mx-auto max-w-3xl px-5 py-14"><h1 className="text-3xl font-bold">{translateUi((en) ? "en" : "ar", "تعذّر تحميل الجهة", "Could not load this organization")}</h1><p className="mt-5 leading-8 text-muted">{translateUi((en) ? "en" : "ar", "حاول تحديث الصفحة بعد قليل.", "Please refresh the page in a moment.")}</p><Link className="text-link mt-6 inline-block" href="/organizations">{translateUi((en) ? "en" : "ar", "العودة للأندية والمجالس", "Back to clubs and councils")}</Link></main></>; }
  if (!detail) notFound();

  const { organization, committees, contacts, leadership, rounds, upcomingEvents, announcements } = detail;
  const currentRound=rounds[0];
  const ownRegistration=currentRound&&user?(await getRound(currentRound.id,user.id))?.application:null;
  const canManageOrganization = superAdmin || Boolean(user && await canManageOrganizationSettings(user.id, organization.id).catch(() => false));
  const profile = localOrganizationContent(organization.nameAr, organization.typeCode);
  const presentation = buildOrganizationProfilePresentation({ curated: profile, saved: organization.publicProfileContent, mission: organization.mission, memberCount: organization.memberCount });
  const savedSocialLinks = contacts.map(contact => ({ label: organizationContactLabel(contact.kind, en), value: contact.value, href: contact.url }));
  const socialLinks = organization.linksCustomized ? savedSocialLinks : savedSocialLinks.length ? savedSocialLinks : (profile?.links ?? []);
  const eventHighlights = selectOrganizationEventHighlights(upcomingEvents);
  const featuredEvent = eventHighlights.find(item => item.featured);
  const otherEventHighlights = eventHighlights.filter(item => item.id !== featuredEvent?.id);
  const hasActivity = Boolean(featuredEvent || otherEventHighlights.length);
  const profileSectionGroups = groupOrganizationProfileSections(presentation.sections);
  const namedLeadershipDetails = leadership.map(person => `${en
    ? person.roleCode === "OL" ? "Leader" : "Deputy leader"
    : person.roleCode === "OL" ? "القائد" : "نائب القائد"}: ${person.fullName}`);
  const databaseCommitteeRecords = committees.map(committee => ({
    ...committee,
    isPublic: true,
    statusCode: "Active",
    copiedFromCommitteeId: null,
    canEdit: false,
    memberCount: null,
    leaderName: committee.leaderName,
  }));
  // The public diagram uses the same saved hierarchy as management, filtered by public access.
  const rootLeadershipDetails = [...new Set(namedLeadershipDetails)];
  const committeeTree = buildCommitteeTree(databaseCommitteeRecords);
  const aboutProfileGroup = profileSectionGroups.find(group => group.kind === "about");
  const leadershipInOverview = leadership.length > 0 && committees.length === 0;
  const hasOverview = Boolean(aboutProfileGroup?.entries.length || presentation.motto?.trim() || presentation.vision?.trim() || presentation.mission?.trim() || presentation.stats?.length || leadershipInOverview);
  const sectionNavItems: { id: string; label: string; icon: ProfileIconName; profileSectionIndexes: number[] }[] = [
    ...(hasOverview ? [{ id: "about", label: translateUi((en) ? "en" : "ar", "عن الجهة", "About"), icon: "reach" as const, profileSectionIndexes: aboutProfileGroup?.entries.map(entry => entry.index) ?? [] }] : []),
    ...profileSectionGroups.filter(group => group.kind !== "about" && group.kind !== "structure").map(group => ({
      id: group.id,
      label: profileGroupLabel(group, en),
      icon: profileGroupIcon(group.kind),
      profileSectionIndexes: group.entries.map(entry => entry.index),
    })),
  ];
  if (committees.length > 0) {
    sectionNavItems.push({ id: "structure", label: translateUi((en) ? "en" : "ar", "اللجان", "Committees"), icon: "teams", profileSectionIndexes: [] });
  }
  if (hasActivity && !sectionNavItems.some(item => item.id === "activities")) {
    sectionNavItems.push({ id: "activities", label: translateUi((en) ? "en" : "ar", "الفعاليات", "Events"), icon: "events", profileSectionIndexes: [] });
  }
  sectionNavItems.push({ id: "applications", label: translateUi((en) ? "en" : "ar", "التقديم", "Applications"), icon: "membership", profileSectionIndexes: [] });
  if(announcements.length)sectionNavItems.push({id:"announcements",label:translateUi((en) ? "en" : "ar", "الإعلانات", "Announcements"),icon:"events",profileSectionIndexes:[]});
  const requestedSection = Array.isArray(query.section) ? query.section[0] : query.section;
  const orderedNavItems = orderOrganizationTabs(sectionNavItems);
  const activeSection = orderedNavItems.find(item => item.id === requestedSection) ?? orderedNavItems[0];

  const visibleSummary=organization.summary ?? profile?.about ?? "";
  const canonicalUrl=`https://lub.community/organizations/${organization.slug}`;
  const logoUrl=organization.logoUrl || (profile?.logoSrc ? new URL(profile.logoSrc,"https://lub.community").toString() : undefined);
  const organizationLogo = organization.logoUrl || profile?.logoSrc;
  const isCuratedArtwork = !organization.logoUrl;
  const heroImageLayout = isCuratedArtwork && profile?.imageTheme === "cybersec" ? { width: 738, height: 1600 } : { fill: true as const };
  const heroImageStyle: CSSProperties | undefined = isCuratedArtwork && profile?.imageTheme === "cybersec"
    ? { position: "absolute", width: "auto", height: "180%", maxWidth: "none", top: "57%", right: "auto", bottom: "auto", left: "50%", transform: "translate(-50%, -50%)", padding: 0, objectFit: "contain", objectPosition: "center" }
    : profile?.imageTheme === "tuwaiq"
      ? { width: "140%", height: "109%", maxWidth: "none", top: "50%", right: "auto", bottom: "auto", left: "50%", transform: "translate(-50%, -50%)", padding: 0, objectFit: "contain", objectPosition: "center" }
      : profile?.imageTheme === "it-council" ? { padding: 0, objectFit: "contain", objectPosition: "center" } : { objectFit: "contain", objectPosition: "center" };
  const sameAs=socialLinks.flatMap(link=>{
    if(!link.href)return [];
    try { const url=new URL(link.href);return url.protocol==="https:"?[url.toString()]:[]; }
    catch { return []; }
  });

  return <>{organization.statusCode==="Active"&&<JsonLd data={{
    "@context":"https://schema.org",
    "@type":"Organization",
    name:organization.nameAr,
    url:canonicalUrl,
    ...(visibleSummary?{description:visibleSummary}:{}),
    ...(logoUrl?{logo:logoUrl}:{}),
    ...(sameAs.length?{sameAs:[...new Set(sameAs)]}:{}),
  }}/>}<main id="main" className="mx-auto max-w-7xl px-5 pb-20 pt-9 sm:px-8 sm:pt-12">
    <div className="flex flex-wrap items-center justify-between gap-3"><Button nativeButton={false} variant="ghost" render={<Link href="/organizations"/>}><ArrowRight/>{translateUi((en) ? "en" : "ar", "الأندية والمجالس", "Clubs and councils")}</Button>{canManageOrganization&&<Button nativeButton={false} variant="outline" render={<Link href={`/manage/organizations/${organization.id}`}/>}><Settings2/>{translateUi((en) ? "en" : "ar", "إعدادات الجهة", "Organization settings")}</Button>}</div>
    <header id="organization-overview" className="organization-hero organization-section-nav-target mt-6">
      {profile?.coverSrc && <figure className={"organization-hero-cover" + (profile?.imageTheme ? " organization-hero-cover--" + profile.imageTheme : "")}><Image src={profile.coverSrc} alt={translateUi((en) ? "en" : "ar", profile.imageTheme === "ieee" ? `شعار ${organization.nameAr}` : `غلاف ${organization.nameAr}`, profile.imageTheme === "ieee" ? `Logo of ${organization.nameAr}` : `${organization.nameAr} banner`)} fill sizes="(max-width: 767px) 100vw, 1200px" unoptimized className="organization-hero-cover-image" /></figure>}
      <div className={"organization-hero-main" + (profile?.coverSrc ? " organization-hero-main--cover" : "") + (profile?.coverSrc && organization.logoUrl ? " organization-hero-main--custom-cover" : "")}>
      {profile?.coverSrc && organization.logoUrl && <div className="organization-hero-custom-logo"><Image src={organization.logoUrl} alt={translateUi((en) ? "en" : "ar", `شعار ${organization.nameAr}`, `Logo of ${organization.nameAr}`)} fill sizes="96px" unoptimized referrerPolicy="no-referrer" className="organization-hero-image" /></div>}
      {!profile?.coverSrc && organizationLogo && <div className={`organization-hero-art organization-hero-art--${organization.logoUrl ? "default" : profile?.imageTheme ?? "default"}`}>
          <Image src={organizationLogo} alt={translateUi((en) ? "en" : "ar", `شعار ${organization.nameAr}`, `Logo of ${organization.nameAr}`)} {...heroImageLayout} sizes="(max-width: 767px) 100vw, 320px" unoptimized referrerPolicy={organization.logoUrl ? "no-referrer" : undefined} className="organization-hero-image" style={heroImageStyle} />
        </div>}
        <div className="organization-hero-copy">
          <p className="text-sm font-bold text-action">{en ? organization.typeCode : organizationTypes[organization.typeCode as keyof typeof organizationTypes]}</p>
          <h1 dir="auto" className="mt-2 text-4xl leading-[1.35] sm:text-5xl"><ContentText value={organization.nameAr}/></h1>
          {visibleSummary && <p dir="auto" className="intro-summary mt-5 max-w-3xl whitespace-pre-line text-lg leading-9"><ContentText value={visibleSummary}/></p>}
          {currentRound&&!superAdmin&&<div className="mt-5"><RegistrationCallToAction round={currentRound} slug={slug} locale={preferences.locale} signedIn={!!user} application={ownRegistration}/></div>}
          {organization.tags.length > 0 && <ul aria-label={translateUi((en) ? "en" : "ar", "مجالات الجهة", "Organization interests")} className="mt-6 flex flex-wrap gap-2">{organization.tags.map(tag => <li key={tag} dir="auto" className="rounded-md bg-white px-3 py-1 text-sm">{tag}</li>)}</ul>}
          {organization.statusCode !== "Active" && <p className="mt-6 rounded-lg border border-line bg-white p-4 leading-8">{translateUi((en) ? "en" : "ar", `هذه الجهة ${organizationStatuses[organization.statusCode as keyof typeof organizationStatuses]}.`, `This organization is ${organization.statusCode.toLowerCase()}.`)}{organization.archivedAt && <> {translateUi((en) ? "en" : "ar", "أُرشفت بتاريخ", "Archived on")} {formatRiyadhDate(organization.archivedAt, preferences.locale)}{translateUi((en) ? "en" : "ar", "، ويبقى هذا الرابط متاحًا لحفظ تاريخها.", ". This link remains available to preserve its history.")}</>}</p>}
          {socialLinks.some(link => link.href) && <section id="organization-contact" className="organization-hero-social organization-section-nav-target" aria-labelledby="organization-social-title">
            <h2 id="organization-social-title" className="text-sm font-bold">{translateUi((en) ? "en" : "ar", "روابط التواصل", "Organization links")}</h2>
            <SocialLinkIcons links={socialLinks} en={en} />
          </section>}
        </div>
      </div>
    </header>

    {activeSection && <OrganizationSectionTabs
      items={orderedNavItems.map(item => ({ ...item, icon: item.id==="announcements"?<Megaphone/>:<OrganizationProfileIcon name={item.icon} /> }))}
      initialSection={activeSection.id}
      label={translateUi((en) ? "en" : "ar", `أقسام ${organization.nameAr}`, `${organization.nameAr} sections`)}
      dir={en ? "ltr" : "rtl"}
      centered
      showSingleTab
    >
      {orderedNavItems.map(item => <OrganizationSectionTabPanel key={item.id} id={item.id}>
        {presentation && item.id !== "structure" && (item.profileSectionIndexes.length > 0 || item.id === "about") && <div id={`organization-profile-${item.id}`} className="organization-section-nav-target"><OrganizationProfileContent profile={presentation} en={en} visibleSectionIndexes={item.profileSectionIndexes} showOverview={item.id === "about"} expandSections /></div>}
        {item.id === "about" && leadershipInOverview && <Card><CardHeader><CardTitle>{translateUi((en) ? "en" : "ar", "قيادة الجهة", "Organization leadership")}</CardTitle></CardHeader><CardContent className="flex flex-col gap-2">{rootLeadershipDetails.map(detail => <p key={detail} dir="auto">{detail}</p>)}</CardContent></Card>}
        {item.id === "activities" && hasActivity && <section className="organization-section-nav-target mt-8" aria-labelledby="organization-updates-title">
          <h2 id="organization-updates-title" className="text-xl font-bold">{translateUi((en) ? "en" : "ar", "الفعاليات والمستجدات", "Activities and updates")}</h2>
          <div className="organization-update-list">
            {featuredEvent&&<section className="panel p-6 sm:p-8"><h3 className="text-lg font-bold">{translateUi((en) ? "en" : "ar", "فعالية مميزة", "Featured event")}</h3><Link className="text-link" href={`/events/${featuredEvent.id}`}><ContentText value={featuredEvent.title}/></Link><p className="mt-2 text-sm text-muted">{eventDate(featuredEvent.starts_at)}</p></section>}
            {otherEventHighlights.length > 0 && <section className="panel p-6 sm:p-8"><h3 className="text-lg font-bold">{translateUi((en) ? "en" : "ar", "فعاليات مختارة", "Selected events")}</h3><ul className="mt-5 space-y-4">{otherEventHighlights.map(event => <li key={event.id}><Link dir="auto" className="text-link" href={`/events/${event.id}`}><ContentText value={event.title}/></Link><p className="mt-2 text-sm text-muted">{eventDate(event.starts_at)}</p></li>)}</ul>{upcomingEvents.length > eventHighlights.length && <Link className="text-link mt-6 inline-block" href={`/events/discover?org=${organization.id}&period=all`}>{translateUi((en) ? "en" : "ar", "كل فعاليات الجهة", "All organization events")}</Link>}</section>}
          </div>
        </section>}
        {item.id==="announcements"&&<PublicAnnouncements items={announcements} locale={preferences.locale}/>}
        {item.id==="applications"&&<section className="mt-8"><PublicRegistration round={currentRound} slug={slug} locale={preferences.locale} signedIn={!!user} application={ownRegistration}/></section>}
        {item.id === "structure" && <section className="mt-8 space-y-5" aria-label={translateUi((en) ? "en" : "ar", "هيكل الجهة", "Organization structure")}>
          <section className="panel p-4 sm:p-6"><h2 className="text-xl font-bold">{translateUi((en) ? "en" : "ar", "اللجان", "Committees")}</h2><OrganizationCommitteeChart organizationId={organization.id} organizationName={organization.nameAr} rootDetails={rootLeadershipDetails} committees={committeeTree} canManage={false} readOnly locale={preferences.locale} parentOptions={[]} emptyMessage={translateUi((en) ? "en" : "ar", "لا توجد لجان عامة حالياً.", "No public committees yet.")} /></section>
        </section>}
      </OrganizationSectionTabPanel>)}
    </OrganizationSectionTabs>}
  </main></>;
}
