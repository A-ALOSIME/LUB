"use client";

import { FilterToggleGroup } from "@/components/ui/filter-toggle-group";
import type { Locale } from "@/lib/preferences";
import { useState } from "react";
import { TaskList, TaskPagination } from "./task-list";
import type { TaskCard } from "./repository";

type View = "available" | "mine";

export function TaskBrowser({
  availableItems,
  mineItems,
  availableMore,
  mineMore,
  page = 0,
  initialView = "available",
  locale = "ar",
  base = "/tasks",
  baseQuery = {},
  compact = false,
}: {
  availableItems: TaskCard[];
  mineItems: TaskCard[];
  availableMore?: boolean;
  mineMore?: boolean;
  page?: number;
  initialView?: View;
  locale?: Locale;
  base?: string;
  baseQuery?: Record<string, string>;
  compact?: boolean;
}) {
  const en = locale === "en";
  const [view, setView] = useState<View>(initialView);
  const items = view === "available" ? availableItems : mineItems;
  const more = view === "available" ? availableMore : mineMore;

  return <div dir={en ? "ltr" : "rtl"} className="flex min-w-0 flex-col gap-4">
    <FilterToggleGroup
      ariaLabel={en ? "Task filters" : "تصفية المهام"}
      value={view}
      options={[
        { value: "available", label: en ? "Available" : "المتاحة" },
        { value: "mine", label: en ? "My participation" : "مشاركاتي" },
      ]}
      dir={en ? "ltr" : "rtl"}
      onValueChange={next => {
        if (next === "available" || next === "mine") setView(next);
      }}
    />
    <TaskList items={items} mode={view} locale={locale} compact={compact} />
    <TaskPagination page={page} more={Boolean(more)} base={base} query={{ ...baseQuery, ...(view === "mine" ? { taskFilter: "mine" } : {}) }} locale={locale} />
  </div>;
}
