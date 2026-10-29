import {t as translateUi} from "@/lib/i18n";
import { notFound } from "next/navigation";
import { localizedMetadata } from "@/lib/localized-metadata";
import { requireVerifiedProxyIdentity } from "@/features/auth/session";
import { getSuperAdmins } from "@/features/organizations/management-repository";
import {AdminAccessManager} from "@/features/organizations/admin-access-manager";
import { getPreferences } from "@/lib/preferences";

export async function generateMetadata() { return localizedMetadata("المشرفون العامون", "System administrators"); }

export default async function AdminsPage() {
  const [user, { locale }] = await Promise.all([requireVerifiedProxyIdentity(), getPreferences()]);
  const admins = await getSuperAdmins(user.id).catch(error => {
    if (error instanceof Error && error.message === "FORBIDDEN") notFound();
    throw error;
  });
  const en = locale === "en";

  return <div className="workspace-content">
    <header className="workspace-page-header">
      <div>
        <h1>{translateUi((en) ? "en" : "ar", "المشرفون العامون", "System administrators")}</h1>
      </div>
    </header>

    <AdminAccessManager admins={admins} currentUser={user.id} locale={locale}/>
  </div>;
}
