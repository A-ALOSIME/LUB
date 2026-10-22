"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { CalendarDays, ClipboardCheck, Clock3 } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Locale } from "@/lib/preferences"

export type ActivityTab = "tasks" | "events" | "hours"

export function ActivityTabs({
  initialTab,
  tasks,
  events,
  hours,
  locale,
}: {
  initialTab: ActivityTab
  tasks: React.ReactNode
  events: React.ReactNode
  hours: React.ReactNode
  locale: Locale
}) {
  const en = locale === "en"
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedTab = searchParams.get("tab")
  const tab: ActivityTab = requestedTab === "events" || requestedTab === "hours" ? requestedTab : initialTab

  return <Tabs
    value={tab}
    dir={en ? "ltr" : "rtl"}
    onValueChange={value => {
      if (value !== "tasks" && value !== "events" && value !== "hours") return
      router.push(`/activity?tab=${value}`, { scroll: false })
    }}
    className="min-w-0 gap-4"
  >
    <TabsList className="workspace-segmented-control group-data-[orientation=horizontal]/tabs:h-auto grid w-full grid-cols-3 gap-1 rounded-lg border border-border/70 bg-card p-1 sm:w-fit">
      <TabsTrigger value="tasks" className="h-9 flex-none gap-2 px-3 data-active:bg-primary data-active:text-primary-foreground data-active:shadow-none">
        <ClipboardCheck aria-hidden="true" />{en ? "Tasks" : "المهام"}
      </TabsTrigger>
      <TabsTrigger value="events" className="h-9 flex-none gap-2 px-3 data-active:bg-primary data-active:text-primary-foreground data-active:shadow-none">
        <CalendarDays aria-hidden="true" />{en ? "Events" : "الفعاليات"}
      </TabsTrigger>
      <TabsTrigger value="hours" className="h-9 flex-none gap-2 px-3 data-active:bg-primary data-active:text-primary-foreground data-active:shadow-none">
        <Clock3 aria-hidden="true" />{en ? "Hours" : "الساعات"}
      </TabsTrigger>
    </TabsList>
    <TabsContent value="tasks" className="min-w-0">{tasks}</TabsContent>
    <TabsContent value="events" className="min-w-0">{events}</TabsContent>
    <TabsContent value="hours" className="min-w-0">{hours}</TabsContent>
  </Tabs>
}
