import type { ReactNode } from "react";
import Link from "next/link";
import { Brand } from "./brand";
import { LubWordmark } from "./lub-wordmark";

export function SiteHeader({
  en,
  accountActions,
  accountLabel,
}: {
  en: boolean;
  accountActions: ReactNode;
  accountLabel?: string;
}) {
  const actionsClassName = "site-header-tools flex items-center gap-3 py-2 text-sm sm:gap-5";
  return <header className="site-header">
    <div dir="ltr" className="site-header-inner mx-auto max-w-7xl px-5 sm:px-8">
      <div className="site-header-brand"><Brand en={en} /></div>
      <nav dir={en ? "ltr" : "rtl"} aria-label={en ? "Main navigation" : "التنقل الرئيسي"} className="site-nav site-header-nav text-sm">
        <Link href="/organizations" prefetch>{en ? "Clubs and councils" : "الأندية والمجالس"}</Link>
        <Link href="/events/discover" prefetch>{en ? "Events" : "الفعاليات"}</Link>
        <Link href="/talent" prefetch>{en ? "Talent" : "المواهب"}</Link>
        <Link href="/ai" prefetch={false} aria-label={en ? undefined : "اسأل لُبّ"}>{en ? "Ask LUB" : <span className="site-nav-ai-name" aria-hidden="true"><span>اسأل</span><LubWordmark /></span>}</Link>
      </nav>
      {accountLabel
        ? <nav aria-label={accountLabel} className={actionsClassName}>{accountActions}</nav>
        : <div className={actionsClassName}>{accountActions}</div>}
    </div>
  </header>;
}
