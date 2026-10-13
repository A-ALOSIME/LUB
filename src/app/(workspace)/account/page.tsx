import { ArrowUpLeft } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { StorageUnavailable } from "@/components/storage-unavailable";
import { requireStudentUser as requireUser } from "@/features/auth/authorization";
import { getAccountStatus, getStudentProfile } from "@/features/profile/repository";
import { ProfileForm } from "@/features/profile/profile-form";
import { isProfileStorageConfigured } from "@/lib/env";
import { localizedMetadata } from "@/lib/localized-metadata";
import { getPreferences } from "@/lib/preferences";
import { cn } from "cn";
import { redirect } from "next/navigation";

export async function generateMetadata() {
  return localizedMetadata("الحساب والخصوصية", "Account and privacy");
}

export default async function Account() {
  const locale = (await getPreferences()).locale;
  const en = locale === "en";
  const user = await requireUser();

  if (!isProfileStorageConfigured()) return <StorageUnavailable />;
  if ((await getAccountStatus(user.id)) === "Inactive") redirect("/account-unavailable");

  const profile = await getStudentProfile(user.id);
  if (!profile) redirect("/onboarding");

  return (
    <main id="main" className="account-settings-page" dir={en ? "ltr" : "rtl"}>
      <header className="account-settings-page-header">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight">
            {en ? "Account and privacy" : "الحساب والخصوصية"}
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-7 text-muted-foreground">
            {en
              ? "Update your account details and choose what appears on your public profile."
              : "حدّث بيانات حسابك واختر ما يظهر في ملفك العام."}
          </p>
        </div>
        <Link
          href="/account/talent"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "account-settings-talent-link"
          )}
        >
          <span>
            {en
              ? "Skills profile, contact channels, and activity privacy"
              : "الملف المهاري وقنوات التواصل وخصوصية المشاركات"}
          </span>
          <ArrowUpLeft data-icon="inline-end" aria-hidden="true" />
        </Link>
      </header>

      <ProfileForm profile={profile} email={user.email} locale={locale} />
    </main>
  );
}
