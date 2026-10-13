import Link from "next/link";
import { DisplayControls } from "./display-controls";
import { SiteHeader } from "./site-header";
import { getVerifiedProxyIdentity } from "@/features/auth/session";
import { isSuperAdminUser } from "@/features/auth/authorization";
import { getPreferences } from "@/lib/preferences";
import { signOut } from "@/features/auth/actions";

export async function PublicHeader() {
  const [user, preferences] = await Promise.all([getVerifiedProxyIdentity(), getPreferences()]);
  const en = preferences.locale === "en";
  const superAdmin = user ? await isSuperAdminUser(user.id) : false;
  return <SiteHeader en={en} accountActions={<>
    <DisplayControls {...preferences} />
    {user
      ? <><Link href={superAdmin ? "/manage" : "/me"} prefetch={false} className="button button-compact whitespace-nowrap">{en ? "My workspace" : "مساحتي"}</Link><form action={signOut}><button className="header-link whitespace-nowrap">{en ? "Log out" : <><span className="sm:hidden">خروج</span><span className="hidden sm:inline">تسجيل الخروج</span></>}</button></form></>
      : <><Link href="/login" prefetch={false} className="header-link whitespace-nowrap"><span className="sm:hidden">{en ? "Log in" : "دخول"}</span><span className="hidden sm:inline">{en ? "Log in" : "تسجيل الدخول"}</span></Link><Link href="/signup" prefetch={false} className="button button-compact whitespace-nowrap"><span className="sm:hidden">{en ? "Sign up" : "حساب"}</span><span className="hidden sm:inline">{en ? "Sign up" : "إنشاء حساب"}</span></Link></>}
  </>} />;
}
