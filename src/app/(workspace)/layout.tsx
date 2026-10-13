import { cache, Suspense } from "react";
import { headers } from "next/headers";
import { AccountHeader } from "@/components/account-header";
import { getPreferences } from "@/lib/preferences";
import { requireVerifiedProxyIdentity } from "@/features/auth/session";
import { hasSuperAdminNavigationAccess } from "@/features/organizations/management-navigation";
import { MyPageNavigation } from "@/features/organizations/my-page-navigation";
import { getManagementOverview } from "@/features/organizations/management-repository";

function AccountHeaderLoading() {
  return <header className="site-header" aria-hidden="true">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-8 px-5 sm:px-8">
      <div className="h-9 w-24 animate-pulse rounded bg-mist" />
      <div className="flex items-center gap-3 py-2">
        <div className="h-9 w-28 animate-pulse rounded-lg bg-mist" />
        <div className="h-9 w-20 animate-pulse rounded-lg bg-mist" />
      </div>
    </div>
  </header>;
}

function WorkspaceNavigationLoading() {
  return <aside className="workspace-sidebar panel" aria-hidden="true">
    <div className="h-5 w-28 animate-pulse rounded bg-mist" />
    <div className="mt-5 space-y-3">
      {["one", "two", "three", "four"].map(item => <div key={item} className="h-10 animate-pulse rounded-lg bg-mist" />)}
    </div>
  </aside>;
}

const getWorkspaceState = cache(async () => {
  const [preferences, requestHeaders, user] = await Promise.all([getPreferences(), headers(), requireVerifiedProxyIdentity()]);
  const managementView = requestHeaders.get("x-lub-management-view");
  const organizationsPage = managementView === "organizations";
  const requestNonce = requestHeaders.get("x-nonce") ?? undefined;
  const overview = !organizationsPage && managementView !== "account"
    ? await getManagementOverview(user.id, requestNonce)
    : null;
  const superAdminAccess = managementView === "account"
    ? await hasSuperAdminNavigationAccess(managementView, user.id, requestNonce)
    : overview?.access.superAdmin ?? false;

  return {
    locale: preferences.locale,
    en: preferences.locale === "en",
    superAdmin: organizationsPage || superAdminAccess,
    overview,
  };
});

async function WorkspaceHeader() {
  const { superAdmin } = await getWorkspaceState();
  return <AccountHeader isSuperAdmin={superAdmin} />;
}

async function WorkspaceNavigation() {
  const { locale, superAdmin, overview } = await getWorkspaceState();
  return <MyPageNavigation
    locale={locale}
    organizations={superAdmin ? [] : overview?.access.organizations ?? []}
    sectionBase="/me"
    superAdmin={superAdmin}
  />;
}

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <>
    <Suspense fallback={<AccountHeaderLoading />}><WorkspaceHeader /></Suspense>
    <div className="workspace-layout-grid mx-auto grid w-full items-start gap-5 px-4 py-6 sm:px-8 sm:py-9 xl:px-10">
      <Suspense fallback={<WorkspaceNavigationLoading />}><WorkspaceNavigation /></Suspense>
      <div className="workspace-stage min-w-0">{children}</div>
    </div>
  </>;
}
