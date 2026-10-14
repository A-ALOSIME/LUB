import Link from "next/link";
import { DisplayControls } from "./display-controls";
import { SiteHeader } from "./site-header";
import { signOut } from "@/features/auth/actions";
import { getPreferences } from "@/lib/preferences";
import { getVerifiedAccountAccess } from "@/features/auth/verified-account";
import { NotificationBell } from "@/features/tasks/notification-bell";
import type { TaskNotification } from "@/features/tasks/repository";

export async function AccountHeader({ isSuperAdmin, notifications, unreadNotificationCount }: { isSuperAdmin?: boolean; notifications?: TaskNotification[]; unreadNotificationCount?: number } = {}) {
  const [preferences, account] = await Promise.all([
    getPreferences(),
    isSuperAdmin === undefined ? getVerifiedAccountAccess() : Promise.resolve(null),
  ]);
  const en = preferences.locale === "en";
  const superAdmin = isSuperAdmin ?? account?.isSuperAdmin ?? false;
  return <SiteHeader en={en} accountLabel={en ? "Account navigation" : "تنقل الحساب"} accountActions={<>
    <DisplayControls {...preferences} />
    {notifications && <NotificationBell items={notifications} unreadCount={unreadNotificationCount ?? 0} locale={preferences.locale} />}
    <Link href={superAdmin ? "/manage" : "/me"} prefetch={false} className="button button-compact whitespace-nowrap">{en ? "My workspace" : "مساحتي"}</Link>
    <form action={signOut}><button className="header-link whitespace-nowrap">{en ? "Log out" : <><span className="sm:hidden">خروج</span><span className="hidden sm:inline">تسجيل الخروج</span></>}</button></form>
  </>} />;
}
