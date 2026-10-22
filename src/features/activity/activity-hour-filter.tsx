"use client"

import { useRouter } from "next/navigation"
import { FilterTabs } from "@/components/ui/filter-tabs"
import type { Locale } from "@/lib/preferences"

export type ActivityHourStatus = "all" | "approved" | "pending" | "rejected"

export function ActivityHourFilter({ value, locale }: { value: ActivityHourStatus; locale: Locale }) {
  const en = locale === "en"
  const router = useRouter()

  return <FilterTabs
    value={value}
    ariaLabel={en ? "Hour record status" : "حالة سجل الساعات"}
    dir={en ? "ltr" : "rtl"}
    options={[
      { value: "all", label: en ? "All" : "الكل" },
      { value: "approved", label: en ? "Approved" : "معتمدة" },
      { value: "pending", label: en ? "Pending approval" : "بانتظار الاعتماد" },
      { value: "rejected", label: en ? "Rejected" : "مرفوضة" },
    ]}
    onValueChange={next => {
      if (next !== "all" && next !== "approved" && next !== "pending" && next !== "rejected") return
      const params = new URLSearchParams(window.location.search)
      params.set("tab", "hours")
      params.delete("page")
      if (next === "all") params.delete("hourStatus")
      else params.set("hourStatus", next)
      router.push(`/activity?${params.toString()}`, { scroll: false })
    }}
  />
}
