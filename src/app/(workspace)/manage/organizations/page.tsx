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
    page: z.coerce
      .number()
      .int()
      .min(0)
      .max(10000)
      .catch(0)
      .parse(query.page ?? 0),
  };
  const data = await getAdminOrganizations(user.id, filters);
  if (!data.allowed) notFound();
  const rows = data.organizations.map((item) => ({
    ...item,
    logoUrl:
      item.logoUrl ||
      localOrganizationContent(item.nameAr, item.typeCode)?.logoSrc ||
      "",
  }));
  const href = (page: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...filters, page }))
      if (value !== "" && value !== 0) params.set(key, String(value));
    return `/manage/organizations?${params}`;
  };
  return (
    <main
      id="main"
      className="workspace-content flex flex-col gap-6"
      dir={en ? "ltr" : "rtl"}
    >
      <header className="workspace-page-header">
        <h1>{en ? "Organizations" : "الجهات"}</h1>
      </header>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <AdminOrganizationFilters value={filters.status} locale={locale}/>
        <Button nativeButton={false} render={<Link href="/manage/organizations/new" />}><Plus />{en ? "Add organization" : "إضافة جهة"}</Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {en ? "Results:" : "النتائج:"} <bdi>{data.total ?? 0}</bdi>
      </p>
      <AdminOrganizationTable organizations={rows} locale={locale} />
      {(filters.page > 0 || (filters.page + 1) * 25 < (data.total ?? 0)) && (
        <nav
          className="flex items-center justify-between"
          aria-label={en ? "Organization pages" : "صفحات الجهات"}
        >
          {filters.page > 0 ? (
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={href(filters.page - 1)} />}
            >
              {en ? "Previous" : "السابق"}
            </Button>
          ) : (
            <span />
          )}
          {(filters.page + 1) * 25 < (data.total ?? 0) && (
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={href(filters.page + 1)} />}
            >
              {en ? "Next" : "التالي"}
            </Button>
          )}
        </nav>
      )}
    </main>
  );
}
