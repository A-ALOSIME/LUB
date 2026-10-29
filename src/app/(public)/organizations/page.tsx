import {t as translateUi} from "@/lib/i18n";
import {Button} from "@/components/ui/button";
import {Plus} from "lucide-react";
import {localizedMetadata} from "@/lib/localized-metadata";
import Link from "next/link";
import Image from "next/image";
import { localOrganizationContent } from "@/features/organizations/local-content";
import { IntentPrefetchLink } from "@/features/organizations/intent-prefetch-link";
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
    { code: "Council", title: translateUi((en) ? "en" : "ar", "المجالس", "Councils"), items: directory.organizations.filter(item => item.typeCode === "Council") },
    { code: "Club", title: translateUi((en) ? "en" : "ar", "الأندية", "Clubs"), items: directory.organizations.filter(item => item.typeCode === "Club") },
  ];

  return <><main id="main" className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
    <header className="directory-heading">
      <div><p className="mb-2 text-sm font-medium text-action">{translateUi((en) ? "en" : "ar", "كلية علوم الحاسب والمعلومات", "College of Computer and Information Sciences")}</p><h1 className="text-4xl leading-normal sm:text-5xl">{translateUi((en) ? "en" : "ar", "الأندية والمجالس", "Clubs and councils")}</h1></div>
      <div className="flex flex-wrap items-center gap-3"><Button render={<Link href="/organization-requests/new"/>}><Plus/>{translateUi((en) ? "en" : "ar", "طلب فتح نادي أو مجلس", "Request a club or council")}</Button>
      {groups && groups.some(group => group.items.length > 0) && <nav aria-label={translateUi((en) ? "en" : "ar", "أنواع الجهات", "Organization types")} className="directory-shortcuts">
        {groups.filter(group => group.items.length > 0).map(group => <a key={group.code} href={`#group-${group.code}`} className="button button-secondary">{group.title}</a>)}
      </nav>}</div>
    </header>
    {!directory && <section className="panel p-8" role="alert"><h2 className="text-xl font-semibold">{translateUi((en) ? "en" : "ar", "تعذّر تحميل الجهات", "Could not load organizations")}</h2><p className="mt-3 leading-7 text-muted">{translateUi((en) ? "en" : "ar", "حاول تحديث الصفحة بعد قليل.", "Please refresh the page in a moment.")}</p><Link href="/organizations" className="button button-secondary mt-5">{translateUi((en) ? "en" : "ar", "إعادة المحاولة", "Try again")}</Link></section>}
    {directory && (directory.organizations.length === 0 ? <section className="panel px-6 py-12 text-center"><h2 className="text-xl font-semibold">{translateUi((en) ? "en" : "ar", "لا توجد جهات لعرضها الآن", "No organizations to show yet")}</h2><p className="mt-3 leading-8 text-muted">{translateUi((en) ? "en" : "ar", "تظهر الأندية والمجالس هنا عندما تُضاف إلى لُبّ.", "Clubs and councils will appear here when they are added to LUB.")}</p></section> : <>
      {groups?.map(group => group.items.length > 0 && <section key={group.code} aria-labelledby={`group-${group.code}`} className="directory-group">
        <h2 id={`group-${group.code}`} className="directory-divider">{group.title}</h2>
        <ul className={`directory-grid${group.code === "Council" ? " directory-grid--councils" : ""}`}>{group.items.map(organization => {
          const profile = localOrganizationContent(organization.nameAr, organization.typeCode);
          const imageSrc = organization.logoUrl || profile?.logoSrc;
          // The CyberSec PNG has tall transparent margins; size its visible mark to the square art.
          const imageStyle = organization.logoUrl ? {objectFit:"contain" as const,objectPosition:"center",padding:0} : profile?.imageTheme === "cybersec"
            ? { transform: "translateY(8px) scale(2.078)", padding: 0, objectFit: "contain" as const, objectPosition: "center" }
            : profile?.imageTheme === "tuwaiq"
              ? { transform: "scale(1.4)", padding: 0, objectFit: "contain" as const, objectPosition: "center" }
            : profile?.imageTheme === "it-council" || profile?.imageTheme === "oss"
              ? { objectFit: "contain" as const, objectPosition: "center", padding: 0 }
            : profile?.imageTheme === "student-council"
              ? { transform: "scale(1.22)", padding: 0, objectFit: "contain" as const, objectPosition: "center" }
            : { objectFit: "contain" as const, objectPosition: "center" };
          return <li key={organization.id} className="organization-card">
            <IntentPrefetchLink href={`/organizations/${organization.slug}`} className="directory-link" aria-label={translateUi((en) ? "en" : "ar", `عرض ${organization.nameAr}`, `View ${organization.nameAr}`)}>
              <span className={`organization-card-art organization-card-art--${profile?.imageTheme ?? "default"}`} aria-hidden="true">
                {imageSrc ? <Image src={imageSrc} alt="" fill sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw" unoptimized className="organization-card-image" style={imageStyle} /> : <span className="organization-card-placeholder">{organization.typeCode === "Council" ? translateUi((en) ? "en" : "ar", "مجلس طلابي", "Student council") : translateUi((en) ? "en" : "ar", "نادي طلابي", "Student club")}</span>}
              </span>
              <span className="organization-card-copy">
                {organization.statusCode !== "Active" && <span className="mb-2 block text-sm text-muted">{en ? organization.statusCode : organizationStatuses[organization.statusCode as keyof typeof organizationStatuses]}</span>}
                <span dir="auto" className="organization-card-title">{organization.nameAr}</span>
                {organization.tags.length > 0 && <span className="organization-card-tags">{organization.tags.map(tag => <span key={tag} dir="auto">{tag}</span>)}</span>}
              </span>
            </IntentPrefetchLink>
          </li>;
        })}</ul>
      </section>)}
      {(page > 1 || directory.hasNext) && <nav aria-label={translateUi((en) ? "en" : "ar", "صفحات الجهات", "Organization pages")} className="mt-8 flex flex-wrap items-center justify-between gap-4">{page > 1 ? <Link className="button button-secondary" href={`/organizations?page=${page - 1}`}>{translateUi((en) ? "en" : "ar", "السابق", "Previous")}</Link> : <span />}<span className="text-sm text-muted">{translateUi((en) ? "en" : "ar", `الصفحة ${page}`, `Page ${page}`)}</span>{directory.hasNext && <Link className="button button-secondary" href={`/organizations?page=${page + 1}`}>{translateUi((en) ? "en" : "ar", "التالي", "Next")}</Link>}</nav>}
    </>)}
  </main></>;
}
