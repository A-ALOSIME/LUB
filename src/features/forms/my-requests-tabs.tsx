"use client";

import {t as translateUi} from "@/lib/i18n";
import { useRouter } from "next/navigation";
import {useSyncExternalStore,type ReactNode } from "react";
import { FilterTabs } from "@/components/ui/filter-tabs";
import type { Locale } from "@/lib/preferences";
import { resolveRequestsTab, requestsTabHref, type RequestsTab } from "./my-requests-navigation";

export function MyRequestsTabs({
  activeTab,
  preview = false,
  locale,
  panels,
  activeHref,
}: {
  activeTab: RequestsTab;
  preview?: boolean;
  locale: Locale;
  panels: Record<RequestsTab,ReactNode>;
  activeHref?: string;
}) {
  const router = useRouter();
  const en = locale === "en";
  const value=useSyncExternalStore(subscribe,()=>resolveRequestsTab(new URL(window.location.href).searchParams.get("tab")??undefined),()=>activeTab);
  const hrefs={applications:requestsTabHref("applications"),renewals:requestsTabHref("renewals"),organizations:requestsTabHref("organizations"),[activeTab]:activeHref??requestsTabHref(activeTab)};
  function switchTab(next: RequestsTab){
    window.history.pushState(window.history.state,"",hrefs[next]);
    window.dispatchEvent(new Event("my-requests-tab-change"));
  }

  return <div className="flex min-w-0 flex-col gap-4">
    <FilterTabs
      value={value}
      ariaLabel={translateUi((en) ? "en" : "ar", "أنواع طلباتي", "My request categories")}
      dir={en ? "ltr" : "rtl"}
      options={[
        { value: "applications", label: translateUi((en) ? "en" : "ar", "طلبات الانضمام", "Applications") },
        { value: "renewals", label: translateUi((en) ? "en" : "ar", "طلبات التجديد", "Renewals") },
        { value: "organizations", label: translateUi((en) ? "en" : "ar", "طلبات فتح الأندية", "Organization requests") },
      ]}
      size="sm"
      activeTone="primary"
      className="workspace-segmented-control"
      onValueChange={next => {
        if ((next === "applications" || next === "renewals" || next === "organizations") && next !== value) {
          switchTab(next);
        }
      }}
      onItemClick={next => {
        if (preview && next === "applications" && value === "applications") {
          router.push(requestsTabHref("applications"));
        }
      }}
    />
    {(Object.keys(panels) as RequestsTab[]).map(tab=><div key={tab} hidden={value!==tab} className="min-w-0">{panels[tab]}</div>)}
  </div>;
}

function subscribe(notify:()=>void){window.addEventListener("popstate",notify);window.addEventListener("my-requests-tab-change",notify);return()=>{window.removeEventListener("popstate",notify);window.removeEventListener("my-requests-tab-change",notify);};}
