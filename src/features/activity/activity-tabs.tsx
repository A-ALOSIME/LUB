"use client"

import {t as translateUi} from "@/lib/i18n";
import {useSyncExternalStore} from "react"
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
  activeHref,
}: {
  initialTab: ActivityTab
  tasks: React.ReactNode
  events: React.ReactNode
  hours: React.ReactNode
  activeHref?: string
  locale: Locale
}) {
  const en = locale === "en"
  const tab=useSyncExternalStore(subscribe,()=>{
    const value=new URL(window.location.href).searchParams.get("tab");
    return value==="events"||value==="hours"?value:"tasks";
  },()=>initialTab);
  const hrefs={tasks:"/activity?tab=tasks",events:"/activity?tab=events",hours:"/activity?tab=hours",[initialTab]:activeHref??`/activity?tab=${initialTab}`};

  return <Tabs
    value={tab}
    dir={en ? "ltr" : "rtl"}
    onValueChange={value => {
      if (value !== "tasks" && value !== "events" && value !== "hours") return
      if(value===tab)return;
      window.history.pushState(window.history.state,"",hrefs[value]);
      window.dispatchEvent(new Event("activity-tab-change"));
    }}
    className="min-w-0 gap-4"
  >
    <TabsList className="workspace-segmented-control group-data-[orientation=horizontal]/tabs:h-auto grid w-full grid-cols-3 gap-1 rounded-lg border border-border/70 bg-card p-1 sm:w-fit">
      <TabsTrigger value="tasks" className="h-9 flex-none gap-2 px-3 data-active:bg-primary data-active:text-primary-foreground data-active:shadow-none">
        <ClipboardCheck aria-hidden="true" />{translateUi((en) ? "en" : "ar", "المهام", "Tasks")}
      </TabsTrigger>
      <TabsTrigger value="events" className="h-9 flex-none gap-2 px-3 data-active:bg-primary data-active:text-primary-foreground data-active:shadow-none">
        <CalendarDays aria-hidden="true" />{translateUi((en) ? "en" : "ar", "الفعاليات", "Events")}
      </TabsTrigger>
      <TabsTrigger value="hours" className="h-9 flex-none gap-2 px-3 data-active:bg-primary data-active:text-primary-foreground data-active:shadow-none">
        <Clock3 aria-hidden="true" />{translateUi((en) ? "en" : "ar", "الساعات", "Hours")}
      </TabsTrigger>
    </TabsList>
    <TabsContent keepMounted value="tasks" className="min-w-0">{tasks}</TabsContent>
    <TabsContent keepMounted value="events" className="min-w-0">{events}</TabsContent>
    <TabsContent keepMounted value="hours" className="min-w-0">{hours}</TabsContent>
  </Tabs>
}

function subscribe(notify:()=>void){window.addEventListener("popstate",notify);window.addEventListener("activity-tab-change",notify);return()=>{window.removeEventListener("popstate",notify);window.removeEventListener("activity-tab-change",notify);};}
