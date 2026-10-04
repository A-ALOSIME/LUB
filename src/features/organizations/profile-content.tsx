import Image from "next/image";
import type { LocalOrganizationContent, OrganizationProfileSection } from "./local-content";

function ProfileSection({ section, en, sectionId }: { section: OrganizationProfileSection; en: boolean; sectionId: string }) {
  const content = <>
    {section.body && <p dir="auto" className="mb-5 max-w-prose leading-8 text-muted">{section.body}</p>}
    {section.items && <ul className="organization-profile-items grid gap-x-8 gap-y-3 sm:grid-cols-2">
      {section.items.map((item, index) => <li key={`${item.title}-${index}`} className="organization-profile-item">
        <h3 dir="auto" className="font-semibold leading-7">{item.title}</h3>
        {item.body && <p dir="auto" className="mt-2 text-sm leading-7 text-muted">{item.body}</p>}
      </li>)}
    </ul>}
    {section.image && <Image src={section.image.src} alt={section.image.alt} width={section.image.width} height={section.image.height} sizes="(max-width: 767px) 100vw, 1200px" unoptimized className="organization-profile-image" />}
  </>;

  return section.collapsible
    ? <details className="organization-profile-disclosure">
      <summary className="organization-profile-disclosure-summary">
        <span dir="auto" className="text-xl font-bold">{section.title}</span>
        <span className="text-sm text-action">{en ? "Show details" : "عرض التفاصيل"}</span>
      </summary>
      <div className="pt-5">{content}</div>
    </details>
    : <section aria-labelledby={sectionId} className="organization-profile-section">
      <h2 id={sectionId} dir="auto" className="mb-5 text-xl font-bold">{section.title}</h2>
      {content}
    </section>;
}

export function OrganizationProfileContent({ profile, en }: { profile: LocalOrganizationContent; en: boolean }) {
  if (!profile.vision && !profile.mission && !profile.stats?.length && !profile.sections.length) return null;

  return <div className="organization-profile-content">
    {profile.motto && <p dir="auto" className="organization-profile-motto">{profile.motto}</p>}
    {(profile.vision || profile.mission) && <section aria-label={en ? "Vision and mission" : "الرؤية والرسالة"} className="organization-profile-statements grid gap-6 sm:grid-cols-2">
      {profile.vision && <div><h2 className="mb-3 text-lg font-bold">{en ? "Vision" : "رؤيتنا"}</h2><p dir="auto" className="leading-8 text-muted">{profile.vision}</p></div>}
      {profile.mission && <div><h2 className="mb-3 text-lg font-bold">{en ? "Mission" : "رسالتنا"}</h2><p dir="auto" className="leading-8 text-muted">{profile.mission}</p></div>}
    </section>}
    {profile.stats && <ul className="organization-profile-stats flex flex-wrap gap-4" aria-label={en ? "Organization figures" : "أرقام الجهة"}>
      {profile.stats.map(stat => <li key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></li>)}
    </ul>}
    {profile.sections.map((section, index) => <ProfileSection key={section.title} section={section} sectionId={`organization-profile-section-${index}`} en={en} />)}
  </div>;
}
