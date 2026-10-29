import {t as translateUi} from "@/lib/i18n";
import Link from "next/link";
import { DisplayControls } from "./display-controls";
import { SiteHeader } from "./site-header";
import { getVerifiedProxyIdentity } from "@/features/auth/session";
import { isSuperAdminUser } from "@/features/auth/authorization";
import { getPreferences } from "@/lib/preferences";
import { signOut } from "@/features/auth/actions";
import { IntentPrefetchLink } from "@/features/organizations/intent-prefetch-link";

export async function PublicHeader() {
  const [user, preferences] = await Promise.all([getVerifiedProxyIdentity(), getPreferences()]);
  const en = preferences.locale === "en";
  const superAdmin = user ? await isSuperAdminUser(user.id) : false;
  return <SiteHeader en={en} accountActions={<>
    <DisplayControls {...preferences} />
    {user
      ? <><IntentPrefetchLink href={superAdmin ? "/manage" : "/me"} className="button button-compact whitespace-nowrap">{translateUi((en) ? "en" : "ar", "مساحتي", "My workspace")}</IntentPrefetchLink><form action={signOut}><button className="header-link whitespace-nowrap">{en ? "Log out" : <><span className="sm:hidden">خروج</span><span className="hidden sm:inline">تسجيل الخروج</span></>}</button></form></>
      : <><Link href="/login" prefetch={false} className="header-link whitespace-nowrap"><span className="sm:hidden">{translateUi((en) ? "en" : "ar", "دخول", "Log in")}</span><span className="hidden sm:inline">{translateUi((en) ? "en" : "ar", "تسجيل الدخول", "Log in")}</span></Link><Link href="/signup" prefetch={false} className="button button-compact whitespace-nowrap"><span className="sm:hidden">{translateUi((en) ? "en" : "ar", "حساب", "Sign up")}</span><span className="hidden sm:inline">{translateUi((en) ? "en" : "ar", "إنشاء حساب", "Sign up")}</span></Link></>}
  </>} />;
}
