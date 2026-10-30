"use client";
import {useRoutePrefetch} from "@/components/use-route-prefetch"

import {t as translateUi} from "@/lib/i18n";
import { useRouter } from "next/navigation"
import { FilterTabs } from "@/components/ui/filter-tabs"
import type { Locale } from "@/lib/preferences"

export type ActivityHourStatus = "all" | "approved" | "pending" | "rejected"

export function ActivityHourFilter({ value, locale,onChange }: { value: ActivityHourStatus; locale: Locale;onChange?:(value:ActivityHourStatus)=>void }) {
  const en = locale === "en"
  const router = useRouter()

  function href(next:string){const params=new URLSearchParams(window.location.search);params.set("tab","hours");params.delete("page");if(next==="all")params.delete("hourStatus");else params.set("hourStatus",next);return `/activity?${params.toString()}`;}
  useRoutePrefetch(onChange?undefined:router.prefetch,()=>["all","approved","pending","rejected"].map(href),locale);

  return <FilterTabs
    value={value}
    ariaLabel={translateUi((en) ? "en" : "ar", "حالة سجل الساعات", "Hour record status")}
    dir={en ? "ltr" : "rtl"}
    options={[
      { value: "all", label: translateUi((en) ? "en" : "ar", "الكل", "All") },
      { value: "approved", label: translateUi((en) ? "en" : "ar", "معتمدة", "Approved") },
      { value: "pending", label: translateUi((en) ? "en" : "ar", "بانتظار الاعتماد", "Pending approval") },
      { value: "rejected", label: translateUi((en) ? "en" : "ar", "مرفوضة", "Rejected") },
    ]}
    onValueChange={next => {
      if (next !== "all" && next !== "approved" && next !== "pending" && next !== "rejected") return
      if(onChange){onChange(next);return;}
      const params = new URLSearchParams(window.location.search)
      params.set("tab", "hours")
      params.delete("page")
      if (next === "all") params.delete("hourStatus")
      else params.set("hourStatus", next)
      router.push(`/activity?${params.toString()}`, { scroll: false })
    }}
  />
}
