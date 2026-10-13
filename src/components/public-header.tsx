import Link from "next/link";
import { DisplayControls } from "./display-controls";
import { SiteHeader } from "./site-header";
import { getVerifiedProxyIdentity } from "@/features/auth/session";
import { isSuperAdminUser } from "@/features/auth/authorization";
import { getPreferences } from "@/lib/preferences";

export async function PublicHeader() {
  const [user, preferences] = await Promise.all([getVerifiedProxyIdentity(), getPreferences()]);
  const en = preferences.locale === "en";
  const superAdmin = user ? await isSuperAdminUser(user.id) : false;
  return <SiteHeader en={en} accountActions={<>
    <DisplayControls {...preferences} />
    {user
      ? <Link href={superAdmin ? "/manage" : "/me"} prefetch={false} className="button button-compact whitespace-nowrap">{en ? "My workspace" : "مساحتي"}</Link>
      : <><Link href="/login" prefetch={false} className="header-link">{en ? "Log in" : "تسجيل الدخول"}</Link><Link href="/signup" prefetch={false} className="button button-compact">{en ? "Sign up" : "إنشاء حساب"}</Link></>}
  </>} />;
}
