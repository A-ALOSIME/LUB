import {t as translateUi} from "@/lib/i18n";
import { AccountHeader } from "@/components/account-header";
import { StorageUnavailable } from "@/components/storage-unavailable";
import { requireStudentUser as requireUser } from "@/features/auth/authorization";
import { safeReturnPath } from "@/features/auth/return-path";
import { ProfileForm } from "@/features/profile/profile-form";
import { getAccountStatus, getStudentProfile } from "@/features/profile/repository";
import { isProfileStorageConfigured } from "@/lib/env";
import { localizedMetadata } from "@/lib/localized-metadata";
import { getPreferences } from "@/lib/preferences";
import { redirect } from "next/navigation";

export async function generateMetadata() {
  return localizedMetadata("إكمال بياناتك", "Complete your details");
}

export default async function Onboarding({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const locale = (await getPreferences()).locale;
  const en = locale === "en";
  const returnTo = safeReturnPath((await searchParams).next);
  const user = await requireUser();

  if (!isProfileStorageConfigured()) {
    return (
      <>
        <AccountHeader />
        <StorageUnavailable />
      </>
    );
  }
  if ((await getAccountStatus(user.id)) === "Inactive") redirect("/account-unavailable");
  if (await getStudentProfile(user.id)) redirect(returnTo);

  return (
    <>
      <AccountHeader />
      <main id="main" className="mx-auto max-w-2xl px-5 py-10 sm:py-14">
        <h1 className="text-3xl font-bold">
          {translateUi((en) ? "en" : "ar", "نتعرّف عليك مرة واحدة.", "Let's get to know you once.")}
        </h1>
        <p className="mt-4 mb-8 leading-8 text-muted">
          {translateUi((en) ? "en" : "ar", "أكمل بياناتك الأساسية؛ نستخدمها في طلباتك وسجلات مشاركتك، بدل ما تعيدها كل مرة.", "Complete your basic details once. We use them for applications and participation records.")}
        </p>
        <ProfileForm returnTo={returnTo} email={user.email} locale={locale} />
      </main>
    </>
  );
}
