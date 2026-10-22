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

    return <main id="main" dir={en ? "ltr" : "rtl"} className="workspace-page--wide min-w-0 space-y-5 pb-20 lg:pb-0">
      <header className="workspace-page-header">
        <h1>{en ? "My requests" : "طلباتي"}</h1>
      </header>
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

  return <main id="main" dir={en ? "ltr" : "rtl"} className="workspace-page--wide min-w-0 space-y-5 pb-20 lg:pb-0">
    <header className="workspace-page-header">
      <h1>{en ? "My requests" : "طلباتي"}</h1>
    </header>
    <MyRequestsTabs activeTab={tab} preview={preview} locale={locale}>
      <ApplicationList
        rows={rows.slice(0, 25)}
        counts={counts}
        locale={locale}
        preview={preview}
        status={status}
        page={page}
        hasNext={rows.length > 25}
      />
    </MyRequestsTabs>
  </main>;
}
