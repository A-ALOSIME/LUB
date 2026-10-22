"use client";

import { useRouter } from "next/navigation";
import { FilterTabs } from "@/components/ui/filter-tabs";
import type { Locale } from "@/lib/preferences";

export type HoursStatusFilter = "all" | "Approved" | "Pending" | "Rejected";

export function HoursStatusFilters({ value, locale = "ar" }: { value: HoursStatusFilter; locale?: Locale }) {
  const router = useRouter();
  const en = locale === "en";
  const c = (ar: string, english: string) => en ? english : ar;

  return <FilterTabs
      value={value}
      ariaLabel={c("تصفية سجلات الساعات حسب الحالة", "Filter hour records by status")}
      dir={en ? "ltr" : "rtl"}
      size="sm"
      activeTone="primary"
      options={[
        { value: "all", label: c("الكل", "All") },
        { value: "Approved", label: c("معتمدة", "Approved") },
        { value: "Pending", label: c("بانتظار الاعتماد", "Pending approval") },
        { value: "Rejected", label: c("مرفوضة", "Rejected") },
      ]}
      onValueChange={next => {
        if (next !== "all" && next !== "Approved" && next !== "Pending" && next !== "Rejected") return;
        const params = new URLSearchParams(window.location.search);
        params.set("section", "hours");
        params.delete("hoursPage");
        if (next === "all") params.delete("hourStatus");
        else params.set("hourStatus", next);
        router.push(`${window.location.pathname}?${params.toString()}`, { scroll: false });
      }}
    />;
}
