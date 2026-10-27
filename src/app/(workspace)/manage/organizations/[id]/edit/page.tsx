import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { loadManagementPageData } from "@/features/organizations/access";
import { isSuperAdminUser } from "@/features/auth/authorization";
import { requireVerifiedProxyIdentity } from "@/features/auth/session";
import { getManagementOrganization } from "@/features/organizations/management-repository";
import { OrganizationProfileEditor } from "@/features/organizations/organization-profile-editor";
import { AdminOrganizationControls } from "@/features/organizations/admin-organization-controls";
import { getPreferences } from "@/lib/preferences";
import { localizedMetadata } from "@/lib/localized-metadata";
export async function generateMetadata() {
  return localizedMetadata("تعديل الجهة", "Edit organization");
}
export default async function AdminEditOrganization({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ section?: string }>;
}) {
  const [identity, { id }, { locale }, query] = await Promise.all([
    requireVerifiedProxyIdentity(),
    params,
    getPreferences(),
    searchParams,
  ]);
  if (!z.uuid().safeParse(id).success || !(await isSuperAdminUser(identity.id)))
    notFound();
  const { data: managed } = await loadManagementPageData((user) =>
    getManagementOrganization(user, id, true),
  );
  if (!managed?.organization.adminIdentity) notFound();
  return (
    <main id="main" className="flex min-w-0 flex-col gap-5">
      <Button
        variant="ghost"
        className="self-start"
        nativeButton={false}
        render={<Link href="/manage/organizations" />}
      >
        {locale === "en" ? "Back to organizations" : "رجوع للجهات"}
      </Button>
      <OrganizationProfileEditor
        managed={managed}
        locale={locale}
        section={query.section}
        adminControls={
          <AdminOrganizationControls
            locale={locale}
            organization={{
              ...managed.organization,
              leaderName: managed.organization.adminIdentity.leaderName,
            }}
          />
        }
      />
    </main>
  );
}
