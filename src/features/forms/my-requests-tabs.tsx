"use client";

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
      ariaLabel={en ? "My request categories" : "أنواع طلباتي"}
      dir={en ? "ltr" : "rtl"}
      options={[
        { value: "applications", label: en ? "Applications" : "طلبات الانضمام" },
        { value: "renewals", label: en ? "Renewals" : "طلبات التجديد" },
        { value: "organizations", label: en ? "Organization requests" : "طلبات فتح الأندية" },
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
