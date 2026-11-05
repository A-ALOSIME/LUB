import {t as translateUi} from "@/lib/i18n";
import { localizedMetadata } from "@/lib/localized-metadata";
import {getOverviewUpdates,OverviewUpdatesView} from "@/features/organizations/overview-updates";
import { redirect } from "next/navigation";
import { requireStudentUser as requireUser } from "@/features/auth/authorization";
import { getMyPageData } from "@/features/organizations/my-page-repository";
import { StorageUnavailable } from "@/components/storage-unavailable";
import { isProfileStorageConfigured } from "@/lib/env";
import { getPreferences } from "@/lib/preferences";

export async function generateMetadata() { return localizedMetadata("صفحتي", "My page"); }

export default async function MyPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const preferences = await getPreferences();
  const locale = preferences.locale;
  const en = locale === "en";
  const user = await requireUser();

  if (!isProfileStorageConfigured()) return <StorageUnavailable />;

  const [{status,profile},updates]=await Promise.all([getMyPageData(user.id),getOverviewUpdates(user.id)]);
  if (status === "Inactive") redirect("/account-unavailable");
  if (!profile) redirect("/onboarding");

  const {notice}=await searchParams;

  return <main id="main" className="workspace-content my-page-content min-w-0">
      {notice === "profile-saved" && <p role="status" className="notice-success mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-action">{translateUi((en) ? "en" : "ar", "تم حفظ بياناتك.", "Your details were saved.")}</p>}
      {notice === "signout-failed" && <p role="alert" className="error-message mb-6">{translateUi((en) ? "en" : "ar", "تعذّر تسجيل الخروج. حاول مرة ثانية.", "Could not sign out. Please try again.")}</p>}

          <header id="overview" className="workspace-page-header scroll-mt-6">
            <h1>{translateUi((en) ? "en" : "ar", "أهلًا، ", "Hello, ")}<bdi>{profile.fullName}</bdi></h1>
          </header>

          <OverviewUpdatesView data={updates} locale={locale}/>
  </main>;
}
