"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { FilterToggleGroup } from "@/components/ui/filter-toggle-group";
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
    <FilterToggleGroup
      value={activeTab}
      ariaLabel={en ? "My request categories" : "أنواع طلباتي"}
      dir={en ? "ltr" : "rtl"}
      options={[
        { value: "applications", label: en ? "Applications" : "طلبات الانضمام" },
        { value: "renewals", label: en ? "Renewals" : "طلبات التجديد" },
      ]}
      size="default"
      activeTone="primary"
      onValueChange={next => {
        if ((next === "applications" || next === "renewals") && next !== activeTab) {
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
