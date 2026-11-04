import {t as translateUi} from "@/lib/i18n";
import {NumberText} from "@/components/number-text";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Plus } from "lucide-react";
import { localizedMetadata } from "@/lib/localized-metadata";
import { getPreferences } from "@/lib/preferences";
import { requireVerifiedProxyIdentity } from "@/features/auth/session";
import { getAdminOrganizations } from "@/features/organizations/management-repository";
import { AdminOrganizationTable } from "@/features/organizations/admin-organization-table";
import { localOrganizationContent } from "@/features/organizations/local-content";
import { Button } from "@/components/ui/button";
import { AdminOrganizationFilters } from "@/features/organizations/admin-organization-filters";
export async function generateMetadata() {
  return localizedMetadata("إدارة الجهات", "Organizations");
}
export default async function AdminOrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    type?: string;
    status?: string;
    page?: string;
  }>;
}) {
  const [user, { locale }, query] = await Promise.all([
      requireVerifiedProxyIdentity(),
      getPreferences(),
      searchParams,
    ]),
    en = locale === "en";
  const filters = {
    q: "",
    type: "",
    status: z
      .enum(["", "Active", "Inactive", "Archived"])
      .catch("")
      .parse(query.status ?? ""),
    page: 0,
  };
  const data = await getAdminOrganizations(user.id, filters);
  if (!data.allowed) notFound();
  const organizations=data.organizations.slice(0,25);
  for(let page=1;organizations.length<(data.total??0)&&page<=10000;page++){
    const next=await getAdminOrganizations(user.id,{...filters,page});
    if(!next.allowed)notFound();if(!next.organizations.length)break;
    organizations.push(...next.organizations.slice(0,25));
  }
  const rows = organizations.map((item) => ({
    ...item,
    logoUrl:
      item.logoUrl ||
      localOrganizationContent(item.nameAr, item.typeCode)?.logoSrc ||
      "",
  }));
  return (
    <main
      id="main"
      className="workspace-content flex flex-col gap-6"
      dir={en ? "ltr" : "rtl"}
    >
      <header className="workspace-page-header">
        <h1>{translateUi((en) ? "en" : "ar", "الجهات", "Organizations")}</h1>
      </header>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <AdminOrganizationFilters value={filters.status} locale={locale}/>
        <Button nativeButton={false} render={<Link href="/manage/organizations/new" />}><Plus />{translateUi((en) ? "en" : "ar", "إضافة جهة", "Add organization")}</Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {translateUi((en) ? "en" : "ar", "النتائج:", "Results:")} <bdi><NumberText value={data.total ?? 0}/></bdi>
      </p>
      <AdminOrganizationTable organizations={rows} locale={locale} />

    </main>
  );
}
