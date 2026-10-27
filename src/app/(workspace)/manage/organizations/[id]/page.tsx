import { notFound } from "next/navigation";
import { z } from "zod";
import { loadManagementPageData } from "@/features/organizations/access";
import { getManagementOrganization } from "@/features/organizations/management-repository";
import { OrganizationProfileEditor } from "@/features/organizations/organization-profile-editor";
import { localizedMetadata } from "@/lib/localized-metadata";
import { getPreferences } from "@/lib/preferences";
export async function generateMetadata() {
  return localizedMetadata("بيانات الجهة", "Organization details");
}
export default async function ManageOrganizationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ section?: string }>;
}) {
  const [{ id }, { locale }, search] = await Promise.all([
    params,
    getPreferences(),
    searchParams,
  ]);
  if (!z.uuid().safeParse(id).success) notFound();
  const { data: managed } = await loadManagementPageData((user) =>
    getManagementOrganization(user, id),
  );
  if (!managed) notFound();
  return (
    <OrganizationProfileEditor
      managed={managed}
      locale={locale}
      section={search.section}
    />
  );
}
