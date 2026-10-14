"use client";

import { useRouter } from "next/navigation";
import { FilterToggleGroup } from "@/components/ui/filter-toggle-group";
import type { Locale } from "@/lib/preferences";
import { applicationStatusTabs, type ApplicationStatusCounts, type ApplicationStatusFilter } from "./application-status";

function applicationsHref({ status, preview }: { status: ApplicationStatusFilter; preview: boolean }) {
  const params = new URLSearchParams({ tab: "applications" });
  if (preview) params.set("preview", "1");
  if (status !== "all") params.set("status", status);
  return `/applications?${params.toString()}`;
}

export function ApplicationStatusFilters({ status, counts, preview, locale }: {
  status: ApplicationStatusFilter;
  counts: ApplicationStatusCounts;
  preview: boolean;
  locale: Locale;
}) {
  const router = useRouter();
  const en = locale === "en";

  return <FilterToggleGroup
    value={status}
    ariaLabel={en ? "Filter applications by status" : "تصفية الطلبات حسب الحالة"}
    dir={en ? "ltr" : "rtl"}
    options={applicationStatusTabs.map(tab => ({
      value: tab.value,
      label: en ? tab.en : tab.ar,
      count: counts[tab.value] > 0 ? counts[tab.value] : undefined,
    }))}
    onValueChange={next => {
      const nextStatus = applicationStatusTabs.find(tab => tab.value === next)?.value;
      if (nextStatus && nextStatus !== status) router.push(applicationsHref({ status: nextStatus, preview }));
    }}
  />;
}
