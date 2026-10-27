import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Plus, Search } from "lucide-react";
import { localizedMetadata } from "@/lib/localized-metadata";
import { getPreferences } from "@/lib/preferences";
import { requireVerifiedProxyIdentity } from "@/features/auth/session";
import { getAdminOrganizations } from "@/features/organizations/management-repository";
import { AdminOrganizationTable } from "@/features/organizations/admin-organization-table";
import { localOrganizationContent } from "@/features/organizations/local-content";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
} from "@/components/ui/input-group";
import { LiveFilterForm } from "@/components/live-filter-form";
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
    q: z
      .string()
      .trim()
      .max(120)
      .catch("")
      .parse(query.q ?? ""),
    type: z
      .enum(["", "Club", "Council"])
      .catch("")
      .parse(query.type ?? ""),
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
        <Button nativeButton={false} render={<Link href="/manage/organizations/new" />}>
          <Plus />
          {en ? "Add organization" : "إضافة جهة"}
        </Button>
      </header>
      <LiveFilterForm className="flex flex-wrap items-center gap-3">
        <InputGroup className="min-w-0 flex-1 basis-64">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            name="q"
            defaultValue={filters.q}
            maxLength={120}
            aria-label={en ? "Search organizations" : "بحث عن جهة"}
            placeholder={en ? "Search organizations…" : "ابحث عن جهة…"}
          />
        </InputGroup>
        <NativeSelect
          className="w-full sm:w-44"
          name="type"
          defaultValue={filters.type}
          aria-label={en ? "Organization type" : "نوع الجهة"}
        >
          <option value="">{en ? "All types" : "كل الأنواع"}</option>
          <option value="Club">{en ? "Clubs" : "الأندية"}</option>
          <option value="Council">{en ? "Councils" : "المجالس"}</option>
        </NativeSelect>
        <NativeSelect
          className="w-full sm:w-44"
          name="status"
          defaultValue={filters.status}
          aria-label={en ? "Status" : "الحالة"}
        >
          <option value="">{en ? "All statuses" : "كل الحالات"}</option>
          <option value="Active">{en ? "Active" : "نشطة"}</option>
          <option value="Inactive">{en ? "Inactive" : "غير نشطة"}</option>
          <option value="Archived">{en ? "Archived" : "مؤرشفة"}</option>
        </NativeSelect>
      </LiveFilterForm>
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
