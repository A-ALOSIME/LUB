"use client";
import {useRoutePrefetch} from "@/components/use-route-prefetch";

import {t as translateUi} from "@/lib/i18n";
import { useRouter } from "next/navigation";
import { FilterTabs } from "@/components/ui/filter-tabs";
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

  useRoutePrefetch(router.prefetch,()=>applicationStatusTabs.map(tab=>applicationsHref({status:tab.value,preview})),locale);

  return <FilterTabs
    value={status}
    ariaLabel={translateUi((en) ? "en" : "ar", "تصفية الطلبات حسب الحالة", "Filter applications by status")}
    dir={en ? "ltr" : "rtl"}
    options={applicationStatusTabs.map(tab => ({
      value: tab.value,
      label: en ? tab.en : tab.ar,
      count: (counts[tab.value]??0) > 0 ? counts[tab.value] : undefined,
    }))}
    onValueChange={next => {
      const nextStatus = applicationStatusTabs.find(tab => tab.value === next)?.value;
      if (nextStatus && nextStatus !== status) router.push(applicationsHref({ status: nextStatus, preview }));
    }}
  />;
}
