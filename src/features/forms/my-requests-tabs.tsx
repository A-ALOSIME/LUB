"use client";

import {t as translateUi} from "@/lib/i18n";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { FilterTabs } from "@/components/ui/filter-tabs";
import type { Locale } from "@/lib/preferences";
import { requestsTabHref, type RequestsTab } from "./my-requests-navigation";

export function MyRequestsTabs({
  activeTab,
  preview = false,
  locale,
  children,
}: {
  activeTab: RequestsTab;
  preview?: boolean;
  locale: Locale;
  children: ReactNode;
}) {
  const router = useRouter();
  const en = locale === "en";

  return <div className="flex min-w-0 flex-col gap-4">
    <FilterTabs
      value={activeTab}
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
        if ((next === "applications" || next === "renewals" || next === "organizations") && next !== activeTab) {
          router.push(requestsTabHref(next));
        }
      }}
      onItemClick={next => {
        if (preview && next === "applications" && activeTab === "applications") {
          router.push(requestsTabHref("applications"));
        }
      }}
    />
    <div className="min-w-0">{children}</div>
  </div>;
}
