import { Suspense } from "react";
import { localizedMetadata } from "@/lib/localized-metadata";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireVerifiedProxyIdentity } from "@/features/auth/session";
import { getManagementOverview } from "@/features/organizations/management-repository";
import { SuperAdminDashboard } from "@/features/organizations/admin-dashboard";
import { getPreferences } from "@/lib/preferences";
import Loading from "./loading";

type SearchParams = Promise<{ notice?: string }>;

export async function generateMetadata() { return localizedMetadata("إدارتي", "Management"); }

export default function ManagePage({ searchParams }: { searchParams: SearchParams }) {
  return <Suspense fallback={<Loading />}><ManagementLanding searchParams={searchParams} /></Suspense>;
}

async function ManagementLanding({ searchParams }: { searchParams: SearchParams }) {
  const [preferences, user, requestHeaders, params] = await Promise.all([
    getPreferences(),
    requireVerifiedProxyIdentity(),
    headers(),
    searchParams,
  ]);
  const dashboard = await getManagementOverview(user.id, requestHeaders.get("x-nonce") ?? undefined);

  if (dashboard.readiness.status === "Inactive") redirect("/account-unavailable");
  if (dashboard.access.superAdmin) {
    return <SuperAdminDashboard locale={preferences.locale} summary={dashboard.summary} notice={params.notice} />;
  }

  // Organization leaders enter their account and management workspace together.
  redirect("/me");
}
