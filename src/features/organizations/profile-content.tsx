import Image from "next/image";
import type { OrganizationProfilePresentation } from "./organization-public-profile";
import type { OrganizationProfileSection } from "./local-content";
import { AnimatedStat } from "./animated-stat";
import { organizationSectionTitle } from "./section-groups";
import { OrganizationStatusBadge } from "./organization-status-badge";

export type ProfileIconName = "vision" | "mission" | "goals" | "teams" | "events" | "partners" | "programs" | "values" | "technology" | "membership" | "reach";

export function OrganizationProfileIcon({ name }: { name: ProfileIconName }) {
  const shared = { fill: "none", stroke: "currentColor", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, strokeWidth: 1.8 };

  return <svg aria-hidden="true" viewBox="0 0 24 24" {...shared}>
    {name === "vision" && <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>}
    {name === "mission" && <><path d="M5 21V4" /><path d="M5 5c5-4 9 4 14 0v9c-5 4-9-4-14 0" /></>}
    {name === "goals" && <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /><path d="m16.5 7.5 4-4m-4 0h4v4" /></>}
    {name === "teams" && <><circle cx="9" cy="8" r="3" /><path d="M3.5 19c.3-3 2.4-5 5.5-5s5.2 2 5.5 5" /><path d="M16 5.5a3 3 0 0 1 0 5.7M17 14c2.2.4 3.5 2.1 3.7 4.5" /></>}
    {name === "events" && <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18M8 14h3M8 17h6" /></>}
    {name === "partners" && <><path d="m3 12 4-4 4 1 2-2 8 5-4 6-4-2-2 1-5-3" /><path d="m7 8 3-3 5 2m-5 6 3 2m0-5 4 3m-2-5 4 3" /></>}
    {name === "programs" && <><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H20v17H7.5A3.5 3.5 0 0 0 4 22z" /><path d="M4 5.5v16.2M8 7h8M8 11h8M8 15h5" /></>}
    {name === "values" && <><path d="m12 2 2.4 6.3L21 11l-6.6 2.7L12 20l-2.4-6.3L3 11l6.6-2.7z" /><path d="m19 16 1.2 2.1L22 19l-1.8.9L19 22l-1.2-2.1L16 19l1.8-.9z" /></>}
    {name === "technology" && <><rect x="6" y="6" width="12" height="12" rx="2" /><path d="M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4M10 10h4v4h-4z" /></>}
    {name === "membership" && <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="M6 16c.5-1.7 1.5-2.5 3-2.5s2.5.8 3 2.5m2-5h4m-4 4h4" /></>}
    {name === "reach" && <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18M5 6h14M5 18h14" /></>}
  </svg>;
}

function sectionIcon(title: string, highlightsOnly: boolean): ProfileIconName {
  if (/رؤية|vision/i.test(title)) return "vision";
  if (/رسالة|mission/i.test(title)) return "mission";
  if (/أهداف|هدف|goals?|objectives?/i.test(title)) return "goals";
  if (/لجان|لجنة|فرق|فريق|هيكل|إدار|مسؤول|مهمات|committees?|teams?|structure/i.test(title)) return "teams";
  if (/شركاء|شراكة|تعاون|علاقات|رعاية|تواصل|partners?|collaboration/i.test(title)) return "partners";
  if (/قيم|مبادئ|جودة|شفافية|استدامة|values?/i.test(title)) return "values";
  if (/عضوية|مشاركة|فرص|طلاب|فئة مستهدفة|مهارات|سوق العمل|مهنية|توظيف|membership|participation/i.test(title)) return "membership";
  if (/مجالات|تقنية|ابتكار|برمجة|ذكاء اصطناعي|بيانات|شبكات|أنظمة|technology|fields?/i.test(title)) return "technology";
  if (/أثر|مخرجات|إنجاز|أعمال|فعالية|منافسات|events?|impact|achievement/i.test(title) || highlightsOnly) return "events";
  if (/عالمي|انطلاقة|فرع الجامعة|سمعة|مجتمع|عالمية|reach|global/i.test(title)) return "reach";
  if (/برامج|أنشطة|نشاط|كيف يعمل|معسكرات|ورش|دورات|لقاءات|تخطيط|تشغيل|مسارات|programs?|activities/i.test(title)) return "programs";
  return "programs";
}

function statIcon(label: string): ProfileIconName {
  if (/طالب|عضو|حضور|student|member|attendance/i.test(label)) return "teams";
  if (/دولة|عالمي|country|global/i.test(label)) return "reach";
  if (/فعالية|ورشة|event|workshop/i.test(label)) return "events";
  return "technology";
}

function isCommitteeSection(title: string): boolean {
  return /لجان|لجنة|فرق|فريق|committees?|teams?/i.test(title);
}

function ProfileSection({ section, en, sectionId, expandSections, hideIcon }: { section: OrganizationProfileSection; en: boolean; sectionId: string; expandSections: boolean; hideIcon: boolean }) {
  const items = section.highlightsOnly ? section.items?.filter(item => item.highlighted) : section.items;
  const committeeSection = isCommitteeSection(section.title);
  const icon = sectionIcon(section.title, Boolean(section.highlightsOnly));
  const title = organizationSectionTitle(section.title);
  const isGoalsList = section.title === "أهداف النادي";
  const isIeeeGlobalHistory = section.title === "من IEEE العالمية إلى فرع الجامعة";
  const rtlClass = isIeeeGlobalHistory ? " organization-profile-section--rtl" : "";
  const content = <>
    {section.body && <p dir="auto" className="mb-5 max-w-prose leading-8 text-muted">{section.body}</p>}
    {items && <ul className={`organization-profile-items grid gap-x-8 gap-y-3 sm:grid-cols-2${isGoalsList ? " organization-profile-items--bulleted" : ""}`}>
      {items.map((item, index) => <li key={`${item.title}-${index}`} className={`organization-profile-item${committeeSection ? " organization-profile-committee-item" : ""}`}>
        {committeeSection && <div className="organization-profile-committee-heading">
          <span className="organization-profile-committee-icon"><OrganizationProfileIcon name="teams" /></span>
          <OrganizationStatusBadge status="public">{en ? "Public" : "عامة"}</OrganizationStatusBadge>
        </div>}
        <h3 dir="auto" className="font-semibold leading-7">{item.title}</h3>
        {item.body && <p dir="auto" className="mt-2 text-sm leading-7 text-muted">{item.body}</p>}
      </li>)}
    </ul>}
    {section.image && <Image src={section.image.src} alt={section.image.alt} width={section.image.width} height={section.image.height} sizes="(max-width: 767px) 100vw, 1200px" unoptimized className="organization-profile-image" style={{ maxWidth: section.image.width }} />}
  </>;

  const showDirectly = expandSections || section.highlightsOnly || isCommitteeSection(section.title);

  return section.collapsible && !showDirectly
    ? <details id={sectionId} dir={isIeeeGlobalHistory ? "rtl" : undefined} className={`organization-profile-disclosure organization-section-nav-target${rtlClass}`}>
      <summary className="organization-profile-disclosure-summary">
        <span dir={isIeeeGlobalHistory ? "rtl" : "auto"} className="organization-profile-section-title mb-0 text-xl font-bold">{!hideIcon && <span className="organization-profile-section-icon"><OrganizationProfileIcon name={icon} /></span>}{title}</span>
        <span className="text-sm text-action">{en ? "Show details" : "عرض التفاصيل"}</span>
      </summary>
      <div className="pt-5">{content}</div>
    </details>
    : <section aria-labelledby={sectionId} dir={isIeeeGlobalHistory ? "rtl" : undefined} className={`organization-profile-section${section.highlightsOnly ? " organization-profile-section--highlights" : ""}${section.title.includes("عبر الأعوام") ? " organization-profile-section--annual" : ""}${isCommitteeSection(section.title) ? " organization-profile-section--committees" : ""}${rtlClass}`}>
      <h2 id={sectionId} dir={isIeeeGlobalHistory ? "rtl" : "auto"} className="organization-profile-section-title organization-section-nav-target text-xl font-bold">{!hideIcon && <span className="organization-profile-section-icon"><OrganizationProfileIcon name={icon} /></span>}{title}</h2>
      {content}
    </section>;
}

export function OrganizationProfileContent({
  profile,
  en,
  visibleSectionIndexes,
  showOverview = true,
  expandSections = false,
  showSectionIcons = true,
}: {
  profile: OrganizationProfilePresentation;
  en: boolean;
  visibleSectionIndexes?: readonly number[];
  showOverview?: boolean;
  expandSections?: boolean;
  showSectionIcons?: boolean;
}) {
  const sections = profile.sections
    .map((section, index) => ({ section, index }))
    .filter(({ index }) => visibleSectionIndexes === undefined || visibleSectionIndexes.includes(index))
    .filter(({ section }) => !/^ملاحظة$|^note$/i.test(section.title.trim()));
  const hasOverview = showOverview && Boolean(profile.motto || profile.vision || profile.mission || profile.stats?.length);

  if (!hasOverview && !sections.length) return null;

  return <div className="organization-profile-content">
    {showOverview && profile.motto && <p dir="auto" className="organization-profile-motto">{profile.motto}</p>}
    {showOverview && (profile.vision || profile.mission) && <section id="organization-profile-statements" aria-label={en ? "Vision and mission" : "الرؤية والرسالة"} className="organization-profile-statements organization-section-nav-target">
      {profile.vision && <article className="organization-profile-statement"><h2 className="organization-profile-statement-title"><span className="organization-profile-statement-icon"><OrganizationProfileIcon name="vision" /></span>{en ? "Vision" : "رؤيتنا"}</h2><p dir="auto" className="leading-8 text-muted">{profile.vision}</p></article>}
      {profile.mission && <article className="organization-profile-statement"><h2 className="organization-profile-statement-title"><span className="organization-profile-statement-icon"><OrganizationProfileIcon name="mission" /></span>{en ? "Mission" : "رسالتنا"}</h2><p dir="auto" className="leading-8 text-muted">{profile.mission}</p></article>}
    </section>}
    {showOverview && profile.stats && <ul className="organization-profile-stats flex flex-wrap gap-4" aria-label={en ? "Organization figures" : "أرقام الجهة"}>
      {profile.stats.map(stat => <li key={stat.label}><span className="organization-profile-stat-icon"><OrganizationProfileIcon name={statIcon(stat.label)} /></span><strong><AnimatedStat value={stat.value} /></strong><span>{stat.label}</span></li>)}
    </ul>}
    {sections.map(({ section, index }) => <ProfileSection key={section.title} section={section} sectionId={`organization-profile-section-${index}`} en={en} expandSections={expandSections} hideIcon={!showSectionIcons} />)}
  </div>;
}
