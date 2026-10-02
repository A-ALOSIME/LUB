import {localizedMetadata} from "@/lib/localized-metadata";
import Link from "next/link";
import { PublicHeader } from "@/components/public-header";
import { readPublicDirectory } from "@/features/organizations/public-data";
import { discoverySchema, organizationStatuses } from "@/features/organizations/validation";
import { getPreferences } from "@/lib/preferences";

export async function generateMetadata(){return localizedMetadata('الأندية والمجالس','Clubs and councils');}

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

  return <><PublicHeader /><main id="main" className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
    <header className="mb-10 border-b border-line pb-8"><p className="mb-2 text-sm font-medium text-action">{en ? "Explore LUB" : "استكشف لُبّ"}</p><h1 className="text-4xl leading-normal sm:text-5xl">{en ? "Clubs and councils" : "الأندية والمجالس"}</h1><p className="mt-3 max-w-2xl leading-8 text-muted">{en ? "Student organizations for every interest. Find where you belong." : "جهات طلابية لكل اهتمام. تعرّف عليها واختر أين تبدأ."}</p></header>
    {!directory && <section className="panel p-8" role="alert"><h2 className="text-xl font-semibold">{en ? "Could not load organizations" : "تعذّر تحميل الجهات"}</h2><p className="mt-3 leading-7 text-muted">{en ? "Please refresh the page in a moment." : "حاول تحديث الصفحة بعد قليل."}</p><Link href="/organizations" className="button button-secondary mt-5">{en ? "Try again" : "إعادة المحاولة"}</Link></section>}
    {directory && (directory.organizations.length === 0 ? <section className="panel px-6 py-12 text-center"><h2 className="text-xl font-semibold">{en ? "No organizations to show yet" : "لا توجد جهات لعرضها الآن"}</h2><p className="mt-3 leading-8 text-muted">{en ? "Clubs and councils will appear here when they are added to LUB." : "تظهر الأندية والمجالس هنا عندما تُضاف إلى لُبّ."}</p></section> : <>
      {groups?.map(group => group.items.length > 0 && <section key={group.code} aria-labelledby={`group-${group.code}`} className="mb-10">
        <h2 id={`group-${group.code}`} className="directory-divider">{group.title}</h2>
        <ul className="grid gap-x-10 md:grid-cols-2">{group.items.map(organization => <li key={organization.id} className="directory-item">
          <Link href={`/organizations/${organization.slug}`} className="directory-link" aria-label={en ? `View ${organization.nameAr}` : `عرض ${organization.nameAr}`}>
            {organization.statusCode !== "Active" && <span className="mb-2 block text-sm text-muted">{en ? organization.statusCode : organizationStatuses[organization.statusCode as keyof typeof organizationStatuses]}</span>}
            <h3 dir="auto" className="text-xl leading-8 font-bold sm:text-2xl">{organization.nameAr}</h3>
            {organization.summary && <p dir="auto" className="mt-2 line-clamp-3 max-w-prose leading-8 text-muted">{organization.summary}</p>}
            {organization.tags.length > 0 && <span className="mt-4 flex flex-wrap gap-2">{organization.tags.map(tag => <span key={tag} dir="auto" className="rounded-md border border-line px-3 py-1 text-sm">{tag}</span>)}</span>}
            <span className="mt-4 block text-sm font-bold text-action">{en ? "View details" : "عرض التفاصيل"} <span aria-hidden="true">↗</span></span>
          </Link>
        </li>)}</ul>
      </section>)}
      {(page > 1 || directory.hasNext) && <nav aria-label={en ? "Organization pages" : "صفحات الجهات"} className="mt-8 flex flex-wrap items-center justify-between gap-4">{page > 1 ? <Link className="button button-secondary" href={`/organizations?page=${page - 1}`}>{en ? "Previous" : "السابق"}</Link> : <span />}<span className="text-sm text-muted">{en ? `Page ${page}` : `الصفحة ${page}`}</span>{directory.hasNext && <Link className="button button-secondary" href={`/organizations?page=${page + 1}`}>{en ? "Next" : "التالي"}</Link>}</nav>}
    </>)}
  </main></>;
}
