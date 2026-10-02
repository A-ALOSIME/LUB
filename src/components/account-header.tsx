import Link from "next/link";
import { Brand } from "./brand";
import { DisplayControls } from "./display-controls";
import { signOut } from "@/features/auth/actions";
import { getPreferences } from "@/lib/preferences";

export async function AccountHeader() {
  const preferences = await getPreferences();
  const en = preferences.locale === "en";
  return <header className="site-header"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-8 px-5 sm:px-8"><Brand en={en} /><nav aria-label={en ? "Account navigation" : "تنقل الحساب"} className="site-nav flex flex-wrap items-center gap-4 py-3 text-sm sm:gap-7"><Link href="/organizations">{en ? "Clubs and councils" : "الأندية والمجالس"}</Link><Link href="/me">{en ? "My page" : "صفحتي"}</Link><Link href="/account">{en ? "Account" : "الحساب"}</Link><DisplayControls {...preferences} /><form action={signOut}><button className="header-link">{en ? "Log out" : "تسجيل الخروج"}</button></form></nav></div></header>;
}
