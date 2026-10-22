"use client";

import { FilterTabs } from "@/components/ui/filter-tabs";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { WorkspaceEmptyState } from "@/components/workspace-empty-state";
import { buttonVariants } from "@/components/ui/button";
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
    <FilterTabs
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
    {items.length ? <TaskList items={items} mode={view} locale={locale} compact={compact} /> : <WorkspaceEmptyState
      icon={ClipboardCheck}
      title={view === "mine" ? en ? "No task participation yet" : "ما شاركت في أي مهمة حتى الآن" : en ? "No tasks available right now" : "لا توجد مهام متاحة الآن"}
      description={view === "mine" ? en ? "Browse open tasks to find your next activity." : "تصفح المهام المتاحة للعثور على نشاط جديد." : en ? "Check again later for new tasks." : "تفقّد الصفحة لاحقاً للاطلاع على المهام الجديدة."}
      action={view === "mine" ? <Link href="/activity?tab=tasks&taskFilter=available" className={buttonVariants({ size: "lg", className: "workspace-empty-state-action w-full sm:w-auto" })}><ClipboardCheck data-icon="inline-start" aria-hidden="true" />{en ? "Browse tasks" : "تصفح المهام"}</Link> : undefined}
    />}
    <TaskPagination page={page} more={Boolean(more)} base={base} query={{ ...baseQuery, ...(view === "mine" ? { taskFilter: "mine" } : {}) }} locale={locale} />
  </div>;
}
