import Link from "next/link";
import { Brand } from "./brand";
import { LubWordmark } from "./lub-wordmark";
import { DisplayControls } from "./display-controls";
import { getVerifiedUser } from "@/features/auth/session";
import { getPreferences } from "@/lib/preferences";

export async function PublicHeader() {
  const [user, preferences] = await Promise.all([getVerifiedUser(), getPreferences()]);
  const en = preferences.locale === "en";
  return <header className="site-header">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-8 px-5 sm:px-8">
      <Brand en={en} />
      <nav aria-label={en ? "Main navigation" : "التنقل الرئيسي"} className="site-nav order-2 flex w-full flex-wrap items-center gap-x-5 gap-y-2 border-t border-line py-3 text-sm sm:gap-x-8 lg:w-auto lg:border-0 lg:py-0">
        <Link href="/organizations">{en ? "Clubs and councils" : "الأندية والمجالس"}</Link><Link href="/events">{en ? "Events" : "الفعاليات"}</Link><Link href="/talent">{en ? "Talent" : "المواهب"}</Link><Link href="/ai" aria-label={en ? undefined : "اسأل لُبّ"}>{en ? "Ask LUB" : <span className="site-nav-ai-name" aria-hidden="true"><span>اسأل</span><LubWordmark /></span>}</Link>
      </nav>
      <div className="order-3 flex items-center gap-3 py-2 text-sm sm:gap-5"><DisplayControls {...preferences} />{user ? <><Link href="/account" className="header-link">{en ? "Account" : "الحساب"}</Link><Link href="/me" className="button button-compact">{en ? "My page" : "صفحتي"}</Link></> : <><Link href="/login" className="header-link">{en ? "Log in" : "تسجيل الدخول"}</Link><Link href="/signup" className="button button-compact">{en ? "Sign up" : "إنشاء حساب"}</Link></>}</div>
    </div>
  </header>;
}
