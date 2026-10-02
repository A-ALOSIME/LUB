import {localizedMetadata} from "@/lib/localized-metadata";
import { safeReturnPath } from "@/features/auth/return-path";
import { redirect } from "next/navigation";
import { requireUser } from "@/features/auth/session";
import { getStudentProfile, getAccountStatus } from "@/features/profile/repository";
import { ProfileForm } from "@/features/profile/profile-form";
import { AccountHeader } from "@/components/account-header";
import { StorageUnavailable } from "@/components/storage-unavailable";
import { isProfileStorageConfigured } from "@/lib/env";
import { getPreferences } from "@/lib/preferences";

export async function generateMetadata(){return localizedMetadata('إكمال بياناتك','Complete your details');}
export default async function Onboarding({searchParams}:{searchParams:Promise<{next?:string}>}) {
  const locale=(await getPreferences()).locale;const en=locale==="en";
  const returnTo=safeReturnPath((await searchParams).next);
  const user = await requireUser();
  if (!isProfileStorageConfigured()) return <><AccountHeader /><StorageUnavailable /></>;
  if (await getAccountStatus(user.id) === "Inactive") redirect("/account-unavailable");
  if (await getStudentProfile(user.id)) redirect(returnTo);
  return <><AccountHeader /><main id="main" className="mx-auto max-w-2xl px-5 py-10 sm:py-14"><h1 className="text-3xl font-bold">{en?"Let's get to know you once.":"نتعرّف عليك مرة واحدة."}</h1><p className="mt-4 mb-8 leading-8 text-muted">{en?"Complete your basic details once. We use them for applications and participation records.":"أكمل بياناتك الأساسية؛ نستخدمها في طلباتك وسجلات مشاركتك، بدل ما تعيدها كل مرة."}</p><section className="panel p-6 sm:p-8"><ProfileForm returnTo={returnTo} email={user.email} locale={locale}/></section></main></>;
}
