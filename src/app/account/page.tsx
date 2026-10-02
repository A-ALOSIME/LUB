import {localizedMetadata} from "@/lib/localized-metadata";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/features/auth/session";
import { getStudentProfile, getAccountStatus } from "@/features/profile/repository";
import { ProfileForm } from "@/features/profile/profile-form";
import { AccountHeader } from "@/components/account-header";
import { StorageUnavailable } from "@/components/storage-unavailable";
import { isProfileStorageConfigured } from "@/lib/env";
import { getPreferences } from "@/lib/preferences";

export async function generateMetadata(){return localizedMetadata('الحساب والخصوصية','Account and privacy');}
export default async function Account() {
  const locale=(await getPreferences()).locale;const en=locale==="en";
  const user = await requireUser();
  if (!isProfileStorageConfigured()) return <><AccountHeader /><StorageUnavailable /></>;
  if (await getAccountStatus(user.id) === "Inactive") redirect("/account-unavailable");
  const profile = await getStudentProfile(user.id);
  if (!profile) redirect("/onboarding");
  return <><AccountHeader /><main id="main" className="mx-auto max-w-2xl px-5 py-10 sm:py-14"><h1 className="text-3xl font-bold">{en?"Account and privacy":"الحساب والخصوصية"}</h1><p className="mt-4 mb-8 leading-8 text-muted">{en?"Update your details and choose what appears on your public profile.":"حدّث بياناتك واختر ما يظهر في ملفك العام."}</p><Link href="/account/talent" className="button button-secondary mb-6">{en?"Skills profile, contact channels, and activity privacy":"الملف المهاري وقنوات التواصل وخصوصية المشاركات"}</Link><section className="panel p-6 sm:p-8"><ProfileForm profile={profile} email={user.email} locale={locale}/></section></main></>;
}
