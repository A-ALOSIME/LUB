import type { ReactNode } from "react";
import { Brand } from "./brand";
import {SiteNavigation} from "./site-navigation";

export function SiteHeader({
  en,
  accountActions,
  accountLabel,
}: {
  en: boolean;
  accountActions: ReactNode;
  accountLabel?: string;
}) {
  const actionsClassName = "site-header-tools flex items-center gap-3 py-2 text-base sm:gap-5";
  return <header className="site-header">
    <div dir={en?"ltr":"rtl"} className="site-header-inner mx-auto max-w-7xl px-5 sm:px-8">
      <div className="site-header-brand"><Brand en={en} /></div>
      <SiteNavigation en={en}/>
      {accountLabel
        ? <nav aria-label={accountLabel} className={actionsClassName}>{accountActions}</nav>
        : <div className={actionsClassName}>{accountActions}</div>}
    </div>
  </header>;
}
