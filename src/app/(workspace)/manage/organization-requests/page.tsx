import {t as translateUi} from "@/lib/i18n";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/features/auth/session";
import { isSuperAdminUser } from "@/features/auth/authorization";
import { getPreferences } from "@/lib/preferences";
import { localizedMetadata } from "@/lib/localized-metadata";
import { openingRequests } from "@/features/organization-requests/repository";
import { OpeningRequestList } from "@/features/organization-requests/request-list";
export async function generateMetadata() {
  return localizedMetadata("طلبات فتح الأندية", "Organization requests");
}
export default async function OrganizationRequests({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const [user, { locale }, query] = await Promise.all([
    requireUser(),
    getPreferences(),
    searchParams,
  ]);
  if (!(await isSuperAdminUser(user.id))) notFound();
  const status = z
      .enum(["Pending", "Accepted", "Rejected"])
      .catch("Pending")
      .parse(query.status),
    page = z.coerce
      .number()
      .int()
      .min(0)
      .max(10000)
      .catch(0)
      .parse(query.page ?? 0);
  const data = await openingRequests(user.id, false, status, page);
  return (
    <main
      id="main"
      className="workspace-page--wide min-w-0 flex flex-col gap-6"
    >
      <header className="workspace-page-header">
        <h1>
          {translateUi((locale === "en") ? "en" : "ar", "طلبات فتح الأندية", "Organization requests")}
        </h1>
      </header>
      <OpeningRequestList
        data={data}
        locale={locale}
        manage
        status={status}
        page={page}
      />
    </main>
  );
}
