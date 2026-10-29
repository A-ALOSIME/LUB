"use client";

import {t as translateUi} from "@/lib/i18n";
import { useRouter } from "next/navigation";
import { FilterTabs, type FilterTabOption } from "@/components/ui/filter-tabs";
import type { Locale } from "@/lib/preferences";

export type ApplicationReviewStatusOption = FilterTabOption & { href: string };

export function ApplicationReviewStatusFilters({ value, options, locale,ariaLabel }: { value: string; options: ApplicationReviewStatusOption[]; locale: Locale;ariaLabel?:string }) {
  const router = useRouter();
  const en = locale === "en";
  return <FilterTabs
    value={value}
    ariaLabel={ariaLabel??(translateUi((en) ? "en" : "ar", "تصفية طلبات الأعضاء", "Filter organization applications"))}
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
