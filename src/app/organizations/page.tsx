import {localizedMetadata} from "@/lib/localized-metadata";
import Link from "next/link";
import Image from "next/image";
import { PublicHeader } from "@/components/public-header";
import { localOrganizationContent } from "@/features/organizations/local-content";
import { readPublicDirectory } from "@/features/organizations/public-data";
import { discoverySchema, organizationStatuses } from "@/features/organizations/validation";
import { getPreferences } from "@/lib/preferences";

export async function generateMetadata(){return localizedMetadata('الأندية والمجالس','Clubs and councils',{}, {index:true,canonical:"/organizations",description:{ar:"اكتشف الأندية والمجالس الطلابية في كلية علوم الحاسب والمعلومات، وتعرّف على مجالاتها وأنشطتها وفرص الانضمام المنشورة.",en:"Discover student clubs and councils at the College of Computer and Information Sciences, including their interests, activities, and published opportunities."}});}

export default async function OrganizationsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const en = (await getPreferences()).locale === "en";
  const requestedPage = (await searchParams).page;
  const page = Math.min(10000, Math.max(1, Number(requestedPage) || 1));
  const filters = discoverySchema.parse({ page });
  let directory: Awaited<ReturnType<typeof readPublicDirectory>> | undefined;
  try { directory = await readPublicDirectory(filters); }
  catch { /* Show a retry state without leaking service details. */ }
  const groups = directory && [
    { code: "Council", title: en ? "Councils" : "المجالس", items: directory.organizations.filter(item => item.typeCode === "Council") },
    { code: "Club", title: en ? "Clubs" : "الأندية", items: directory.organizations.filter(item => item.typeCode === "Club") },
  ];

  return <><PublicHeader /><main id="main" className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
    <header className="directory-heading">
      <div><p className="mb-2 text-sm font-medium text-action">{en ? "College of Computer and Information Sciences" : "كلية علوم الحاسب والمعلومات"}</p><h1 className="text-4xl leading-normal sm:text-5xl">{en ? "Clubs and councils" : "الأندية والمجالس"}</h1></div>
      {groups && groups.some(group => group.items.length > 0) && <nav aria-label={en ? "Organization types" : "أنواع الجهات"} className="directory-shortcuts">
        {groups.filter(group => group.items.length > 0).map(group => <a key={group.code} href={`#group-${group.code}`} className="button button-secondary">{group.title}</a>)}
      </nav>}
    </header>
    {!directory && <section className="panel p-8" role="alert"><h2 className="text-xl font-semibold">{en ? "Could not load organizations" : "تعذّر تحميل الجهات"}</h2><p className="mt-3 leading-7 text-muted">{en ? "Please refresh the page in a moment." : "حاول تحديث الصفحة بعد قليل."}</p><Link href="/organizations" className="button button-secondary mt-5">{en ? "Try again" : "إعادة المحاولة"}</Link></section>}
    {directory && (directory.organizations.length === 0 ? <section className="panel px-6 py-12 text-center"><h2 className="text-xl font-semibold">{en ? "No organizations to show yet" : "لا توجد جهات لعرضها الآن"}</h2><p className="mt-3 leading-8 text-muted">{en ? "Clubs and councils will appear here when they are added to LUB." : "تظهر الأندية والمجالس هنا عندما تُضاف إلى لُبّ."}</p></section> : <>
      {groups?.map(group => group.items.length > 0 && <section key={group.code} aria-labelledby={`group-${group.code}`} className="directory-group">
        <h2 id={`group-${group.code}`} className="directory-divider">{group.title}</h2>
        <ul className={`directory-grid${group.code === "Council" ? " directory-grid--councils" : ""}`}>{group.items.map(organization => {
          const profile = localOrganizationContent(organization.nameAr, organization.typeCode);
          const imageSrc = profile?.logoSrc;
          const summary = profile?.summary ?? organization.summary;
          const containedLogo = profile && ["cybersec", "dhaheer", "ieee", "is-council", "it-council", "oss", "student-council"].includes(profile.imageTheme);
          // The CyberSec PNG has tall transparent margins; size its visible mark to the square art.
          const imageStyle = profile?.imageTheme === "cybersec"
            ? { width: "auto", height: "207.8%", top: "-44.8%", right: "auto", bottom: "auto", left: "50%", transform: "translateX(-50%)", padding: 0, objectFit: "contain" as const, objectPosition: "center" }
            : profile?.imageTheme === "tuwaiq"
              ? { width: "140%", height: "109%", maxWidth: "none", top: "50%", right: "auto", bottom: "auto", left: "50%", transform: "translate(-50%, -50%)", padding: 0, objectFit: "contain" as const, objectPosition: "center" }
            : profile?.imageTheme === "it-council" || profile?.imageTheme === "oss"
              ? { objectFit: "contain" as const, objectPosition: "center", padding: 0 }
            : profile?.imageTheme === "student-council"
              ? { width: "122%", height: "122%", top: "50%", right: "auto", bottom: "auto", left: "50%", transform: "translate(-50%, -50%)", padding: 0, objectFit: "contain" as const, objectPosition: "center" }
            : containedLogo ? { objectFit: "contain" as const, objectPosition: "center" } : undefined;
          return <li key={organization.id} className="organization-card">
            <Link href={`/organizations/${organization.slug}`} className="directory-link" aria-label={en ? `View ${organization.nameAr}` : `عرض ${organization.nameAr}`}>
              <span className={`organization-card-art organization-card-art--${profile?.imageTheme ?? "default"}`} aria-hidden="true">
                {imageSrc ? <Image src={imageSrc} alt="" fill sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw" unoptimized className="organization-card-image" style={imageStyle} /> : <span className="organization-card-placeholder">{organization.typeCode === "Council" ? en ? "Student council" : "مجلس طلابي" : en ? "Student club" : "نادي طلابي"}</span>}
              </span>
              <span className="organization-card-copy">
                {organization.statusCode !== "Active" && <span className="mb-2 block text-sm text-muted">{en ? organization.statusCode : organizationStatuses[organization.statusCode as keyof typeof organizationStatuses]}</span>}
                <span dir="auto" className="organization-card-title">{organization.nameAr}</span>
                {summary && <span dir="auto" className="organization-card-summary">{summary}</span>}
                {organization.tags.length > 0 && <span className="organization-card-tags">{organization.tags.map(tag => <span key={tag} dir="auto">{tag}</span>)}</span>}
              </span>
            </Link>
          </li>;
        })}</ul>
      </section>)}
      {(page > 1 || directory.hasNext) && <nav aria-label={en ? "Organization pages" : "صفحات الجهات"} className="mt-8 flex flex-wrap items-center justify-between gap-4">{page > 1 ? <Link className="button button-secondary" href={`/organizations?page=${page - 1}`}>{en ? "Previous" : "السابق"}</Link> : <span />}<span className="text-sm text-muted">{en ? `Page ${page}` : `الصفحة ${page}`}</span>{directory.hasNext && <Link className="button button-secondary" href={`/organizations?page=${page + 1}`}>{en ? "Next" : "التالي"}</Link>}</nav>}
    </>)}
  </main></>;
}
