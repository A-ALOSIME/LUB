import {pendingOpeningRequestCount} from "@/features/organization-requests/repository";
import { cache, Suspense } from "react";
import { headers } from "next/headers";
import { getPreferences } from "@/lib/preferences";
import { requireVerifiedProxyIdentity } from "@/features/auth/session";
import { hasSuperAdminNavigationAccess } from "@/features/organizations/management-navigation";
import { MyPageNavigation } from "@/features/organizations/my-page-navigation";
import { getAdminAccountProfile, getManagementOverview } from "@/features/organizations/management-repository";
import { taskNotificationCounts, taskNotifications } from "@/features/tasks/repository";
import { WorkspaceSidebarLayout } from "@/features/organizations/workspace-sidebar-layout";
import { WorkspaceManagementHeader } from "@/features/organizations/workspace-management-header";
import { SidebarContent, SidebarFooter, SidebarHeader } from "@/components/ui/sidebar";
import { Brand } from "@/components/brand";
import type { Locale } from "@/lib/preferences";

function WorkspaceHeaderLoading() {
  return <header className="workspace-management-header" aria-hidden="true">
    <div className="workspace-management-breadcrumbs"><div className="h-5 w-36 animate-pulse rounded bg-mist" /></div>
    <div className="workspace-management-actions"><div className="size-9 animate-pulse rounded-lg bg-mist" /></div>
  </header>;
}

function WorkspaceNavigationLoading({ locale }: { locale: Locale }) {
  return <div className="workspace-sidebar-content" aria-hidden="true">
    <SidebarHeader className="workspace-sidebar-header"><Brand en={locale === "en"} className="workspace-sidebar-brand" /></SidebarHeader>
    <SidebarContent className="workspace-sidebar-scroll"><div className="space-y-3 p-2">
      {["one", "two", "three", "four"].map(item => <div key={item} className="h-8 animate-pulse rounded-lg bg-mist" />)}
    </div></SidebarContent>
    <SidebarFooter className="workspace-sidebar-footer"><div className="h-9 w-full animate-pulse rounded bg-mist" /></SidebarFooter>
  </div>;
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
  const superAdmin = organizationsPage || superAdminAccess;
  let displayName = overview?.displayName ?? null;
  if (!displayName && superAdmin) {
    try {
      displayName = (await getAdminAccountProfile(user.id)).fullName;
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "FORBIDDEN") throw error;
    }
  }

  return {
    userId: user.id,
    locale: preferences.locale,
    theme: preferences.theme,
    en: preferences.locale === "en",
    superAdmin,
    managementArea: requestHeaders.get("x-lub-area") === "management",
    overview,
    displayName,
  };
});

async function WorkspaceHeader() {
  const { userId, locale, theme, overview } = await getWorkspaceState();
  const [items, counts] = await Promise.all([taskNotifications(userId, 0), taskNotificationCounts(userId)]);
  return <WorkspaceManagementHeader
    locale={locale}
    theme={theme}
    organizations={overview?.access.organizations ?? []}
    notifications={items.slice(0, 5)}
    unreadCount={counts.unread}
  />;
}

async function WorkspaceNavigation() {
  const {userId, locale, superAdmin, overview, displayName } = await getWorkspaceState();
  const pendingOrganizationRequests=superAdmin?await pendingOpeningRequestCount(userId):0;
  return <MyPageNavigation
    locale={locale}
    organizations={superAdmin ? [] : overview?.access.organizations ?? []}
    superAdmin={superAdmin}
    pendingOrganizationRequests={pendingOrganizationRequests}
    userName={displayName}
  />;
}

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { managementArea, locale } = await getWorkspaceState();
  return <WorkspaceSidebarLayout
    management={managementArea}
    dir={locale === "ar" ? "rtl" : "ltr"}
    header={<Suspense fallback={<WorkspaceHeaderLoading />}><WorkspaceHeader /></Suspense>}
    navigation={<Suspense fallback={<WorkspaceNavigationLoading locale={locale} />}><WorkspaceNavigation /></Suspense>}
  >
    <div className="workspace-layout-grid mx-auto w-full px-4 py-6 sm:px-8 sm:py-9 xl:px-10">
      <div className="workspace-stage min-w-0">{children}</div>
    </div>
  </WorkspaceSidebarLayout>;
}
