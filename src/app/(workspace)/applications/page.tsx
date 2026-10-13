import Link from "next/link";
import { z } from "zod";
import { checkReadiness } from "@/features/hours/view";
import { myRenewals } from "@/features/renewals/repository";
import { PersonalRenewalsView } from "@/features/renewals/view";
import { localizedMetadata } from "@/lib/localized-metadata";
import { requireStudentUser as requireUser } from "@/features/auth/authorization";
import { countOwnApplications, listApplications } from "@/features/forms/repository";
import { ApplicationList } from "@/features/forms/application-list";
import { previewApplications } from "@/features/forms/application-preview";
import { applicationStatusCode, applicationStatusTabs, countApplicationStatuses, matchesApplicationStatus } from "@/features/forms/application-status";
import { MyRequestsTabs } from "@/features/forms/my-requests-tabs";
import { resolveRequestsTab } from "@/features/forms/my-requests-navigation";
import { getPreferences } from "@/lib/preferences";
import { buttonVariants } from "@/components/ui/button";

export async function generateMetadata() {
  return localizedMetadata("طلباتي", "My applications");
}

export default async function Applications({ searchParams }: { searchParams: Promise<{ page?: string | string[]; preview?: string | string[]; status?: string | string[]; tab?: string | string[] }> }) {
  const [user, { locale }] = await Promise.all([requireUser(), getPreferences()]);
  const en = locale === "en";
  const query = await searchParams;
  const tab = resolveRequestsTab(query.tab);

  if (tab === "renewals") {
    const input = Array.isArray(query.page) ? query.page[0] : query.page;
    const page = z.coerce.number().int().min(0).max(10000).catch(0).parse(input ?? 0);
    const data = await myRenewals(user.id, page);
    checkReadiness(data?.account);
    if (!data) throw new Error("Renewal storage unavailable");

    return <main id="main" dir={en ? "ltr" : "rtl"} className="min-w-0">
      <MyRequestsTabs activeTab={tab} locale={locale}>
        <PersonalRenewalsView data={data} page={page} locale={locale} />
      </MyRequestsTabs>
    </main>;
  }

  const previewInput = Array.isArray(query.preview) ? query.preview[0] : query.preview;
  const statusInput = Array.isArray(query.status) ? query.status[0] : query.status;
  const pageInput = Array.isArray(query.page) ? query.page[0] : query.page;
  const preview = previewInput === "1";
  const page = Math.min(1000, Math.max(1, Math.floor(Number(pageInput) || 1)));
  const status = applicationStatusTabs.find(tab => tab.value === statusInput)?.value ?? "all";

  const [rows, counts] = preview
    ? (() => {
      const filtered = previewApplications.filter(application => matchesApplicationStatus(application.status_code, status));
      return [filtered.slice((page - 1) * 25, page * 25 + 1), countApplicationStatuses(previewApplications)] as const;
    })()
    : await Promise.all([
      listApplications(user.id, undefined, {
        page,
        q: "",
        status: applicationStatusCode(status),
        committee: "",
        major: "",
        level: "",
        from: "",
        to: "",
        lookup: "",
      }),
      countOwnApplications(user.id),
    ]);

  return <main id="main" dir={en ? "ltr" : "rtl"} className="min-w-0">
    <MyRequestsTabs activeTab={tab} preview={preview} locale={locale}>
      <div className="flex min-w-0 flex-col gap-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">{en ? "My applications" : "طلبات الانضمام"}</h1>
            <p className="text-sm text-muted-foreground">{en ? "Track the status of every application and manage it from one list." : "تابع حالة طلباتك وأدرها من قائمة واحدة."}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!preview && <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/applications?tab=applications&preview=1">{en ? "Preview table" : "معاينة شكل الجدول"}</Link>}
            <Link className={buttonVariants({ size: "sm" })} href="/organizations">{en ? "Explore organizations" : "استكشف الجهات"}</Link>
          </div>
        </header>

        <ApplicationList
          rows={rows.slice(0, 25)}
          counts={counts}
          locale={locale}
          preview={preview}
          status={status}
          page={page}
          hasNext={rows.length > 25}
        />
      </div>
    </MyRequestsTabs>
  </main>;
}
