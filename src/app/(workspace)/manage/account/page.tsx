import { notFound } from "next/navigation";
import { localizedMetadata } from "@/lib/localized-metadata";
import { getPreferences } from "@/lib/preferences";
import { requireVerifiedProxyIdentity } from "@/features/auth/session";
import { getAdminAccountProfile } from "@/features/organizations/management-repository";
import { AdminAccountForm } from "@/features/organizations/admin-account-form";

export async function generateMetadata() { return localizedMetadata("إعدادات الحساب الإداري", "Administrative account settings"); }

export default async function AdminAccountPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const [user, { locale }, query] = await Promise.all([requireVerifiedProxyIdentity(), getPreferences(), searchParams]);
  const profile = await getAdminAccountProfile(user.id).catch(error => {
    if (error instanceof Error && error.message === "FORBIDDEN") notFound();
    throw error;
  });
  const en = locale === "en";

  return <div className="workspace-content">
    <header className="workspace-page-header">
      <div>
        <h1>{en ? "Account settings" : "إعدادات الحساب"}</h1>
      </div>
    </header>
    {query.saved === "1" && <p role="status" className="panel p-4 text-action">{en ? "Name saved." : "تم حفظ الاسم."}</p>}
    <section className="panel max-w-2xl p-5 sm:p-7" aria-label={en ? "Administrative account details" : "بيانات الحساب الإداري"}>
      <AdminAccountForm fullName={profile.fullName} email={profile.email} locale={locale} />
    </section>
  </div>;
}
