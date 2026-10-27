import { StorageUnavailable } from "@/components/storage-unavailable";
import { requireStudentUser as requireUser } from "@/features/auth/authorization";
import { getAccountStatus, getAccountProfile,syncVerifiedAccountEmail } from "@/features/profile/repository";
import {getPendingEmailChange} from "@/features/profile/security-actions";
import { accountAvatarUrl } from "@/features/profile/avatar-storage";
import { ProfileForm } from "@/features/profile/profile-form";
import { isProfileStorageConfigured } from "@/lib/env";
import { localizedMetadata } from "@/lib/localized-metadata";
import { getPreferences } from "@/lib/preferences";
import { redirect } from "next/navigation";

export async function generateMetadata() {
  return localizedMetadata("بيانات الحساب", "Account details");
}

export default async function Account() {
  const locale = (await getPreferences()).locale;
  const en = locale === "en";
  const user = await requireUser();

  if (!isProfileStorageConfigured()) return <StorageUnavailable />;
  if ((await getAccountStatus(user.id)) === "Inactive") redirect("/account-unavailable");

  await syncVerifiedAccountEmail(user);
  const [profile, avatarUrl,pendingEmail] = await Promise.all([getAccountProfile(user),accountAvatarUrl(user.id),getPendingEmailChange()]);
  if (!profile) redirect("/onboarding");

  return (
    <main id="main" className="workspace-content account-settings-page" dir={en ? "ltr" : "rtl"}>
      <header className="workspace-page-header">
        <h1>{en ? "Account details" : "بيانات الحساب"}</h1>
      </header>

      <ProfileForm pendingEmail={pendingEmail} avatarUrl={avatarUrl} profile={profile} email={user.email} locale={locale} />
    </main>
  );
}
