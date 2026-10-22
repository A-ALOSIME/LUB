"use client";

import { useRouter } from "next/navigation";
import { FilterTabs, type FilterTabOption } from "@/components/ui/filter-tabs";
import type { Locale } from "@/lib/preferences";

export type ApplicationReviewStatusOption = FilterTabOption & { href: string };

export function ApplicationReviewStatusFilters({ value, options, locale }: { value: string; options: ApplicationReviewStatusOption[]; locale: Locale }) {
  const router = useRouter();
  const en = locale === "en";
  return <FilterTabs
    value={value}
    ariaLabel={en ? "Filter organization applications" : "تصفية طلبات الأعضاء"}
    dir={en ? "ltr" : "rtl"}
    size="sm"
    activeTone="primary"
    options={options.map(option => ({ ...option, count: option.count && option.count > 0 ? option.count : undefined }))}
    onValueChange={next => {
      const option = options.find(candidate => candidate.value === next);
      if (option) router.push(option.href);
    }}
  />;
}
