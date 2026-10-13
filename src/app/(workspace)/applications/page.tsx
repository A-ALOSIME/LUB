import Link from "next/link";
import { localizedMetadata } from "@/lib/localized-metadata";
import { requireStudentUser as requireUser } from "@/features/auth/authorization";
import { countOwnApplications, listApplications } from "@/features/forms/repository";
import { ApplicationList } from "@/features/forms/application-list";
import { previewApplications } from "@/features/forms/application-preview";
import { applicationStatusCode, applicationStatusTabs, countApplicationStatuses, matchesApplicationStatus } from "@/features/forms/application-status";
import { getPreferences } from "@/lib/preferences";
import { buttonVariants } from "@/components/ui/button";

export async function generateMetadata() {
  return localizedMetadata("طلباتي", "My applications");
}

export default async function Applications({ searchParams }: { searchParams: Promise<{ page?: string; preview?: string; status?: string; q?: string }> }) {
  const [user, { locale }] = await Promise.all([requireUser(), getPreferences()]);
  const en = locale === "en";
  const { page: input, preview: previewInput, status: statusInput, q: queryInput } = await searchParams;
  const preview = previewInput === "1";
  const page = Math.min(1000, Math.max(1, Math.floor(Number(input) || 1)));
  const status = applicationStatusTabs.find(tab => tab.value === statusInput)?.value ?? "all";
  const query = (queryInput ?? "").trim().slice(0, 100);

  const [rows, counts] = preview
    ? (() => {
      const filtered = previewApplications.filter(application => {
        const matchesQuery = !query || `${application.organization_name} ${application.title}`.toLocaleLowerCase().includes(query.toLocaleLowerCase());
        return matchesApplicationStatus(application.status_code, status) && matchesQuery;
      });
      return [filtered.slice((page - 1) * 25, page * 25 + 1), countApplicationStatuses(previewApplications)] as const;
    })()
    : await Promise.all([
      listApplications(user.id, undefined, {
        page,
        q: query,
        status: applicationStatusCode(status),
        applicationSearch: true,
        committee: "",
        major: "",
        level: "",
        from: "",
        to: "",
        lookup: "",
      }),
      countOwnApplications(user.id),
    ]);

  return <main id="main" dir={en ? "ltr" : "rtl"} className="min-w-0 space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{en ? "My applications" : "طلبات الانضمام"}</h1>
        <p className="text-sm text-muted-foreground">{en ? "Track the status of every application and manage it from one list." : "تابع حالة طلباتك وأدرها من قائمة واحدة."}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {preview
          ? <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/applications">{en ? "Back to my applications" : "العودة إلى طلباتي"}</Link>
          : <>
            <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/applications?preview=1">{en ? "Preview table" : "معاينة شكل الجدول"}</Link>
            <Link className={buttonVariants({ size: "sm" })} href="/organizations">{en ? "Explore organizations" : "استكشف الجهات"}</Link>
          </>}
      </div>
    </header>

    <ApplicationList
      rows={rows.slice(0, 25)}
      counts={counts}
      locale={locale}
      preview={preview}
      status={status}
      query={query}
      page={page}
      hasNext={rows.length > 25}
    />
  </main>;
}
