import { DisplayControls } from "./display-controls";
import { SiteHeader } from "./site-header";
import { signOut } from "@/features/auth/actions";
import { getPreferences } from "@/lib/preferences";
import { getVerifiedAccountAccess } from "@/features/auth/verified-account";
import { NotificationBell } from "@/features/tasks/notification-bell";
import type { TaskNotification } from "@/features/tasks/repository";
import { IntentPrefetchLink } from "@/features/organizations/intent-prefetch-link";
import { WorkspaceSidebarTrigger } from "@/features/organizations/workspace-sidebar-layout";

export async function AccountHeader({ isSuperAdmin, notifications, unreadNotificationCount, workspaceNavigation = false }: { isSuperAdmin?: boolean; notifications?: TaskNotification[]; unreadNotificationCount?: number; workspaceNavigation?: boolean } = {}) {
  const [preferences, account] = await Promise.all([
    getPreferences(),
    isSuperAdmin === undefined ? getVerifiedAccountAccess() : Promise.resolve(null),
  ]);
  const en = preferences.locale === "en";
  const superAdmin = isSuperAdmin ?? account?.isSuperAdmin ?? false;
  return <SiteHeader en={en} accountLabel={en ? "Account navigation" : "تنقل الحساب"} accountActions={<>
    {workspaceNavigation && <WorkspaceSidebarTrigger locale={preferences.locale} />}
    <DisplayControls {...preferences} />
    {notifications && <NotificationBell items={notifications} unreadCount={unreadNotificationCount ?? 0} locale={preferences.locale} />}
    <IntentPrefetchLink href={superAdmin ? "/manage" : "/me"} className="button button-compact whitespace-nowrap">{en ? "My workspace" : "مساحتي"}</IntentPrefetchLink>
    <form action={signOut}><button className="header-link whitespace-nowrap">{en ? "Log out" : <><span className="sm:hidden">خروج</span><span className="hidden sm:inline">تسجيل الخروج</span></>}</button></form>
  </>} />;
}
