"use client";

import {formatNumber,t as translateUi} from "@/lib/i18n";
import {NumberText} from "@/components/number-text";
import {useSyncExternalStore,type ReactNode} from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Locale } from "@/lib/preferences";

type MemberTab = "members" | "applications";

export function OrganizationMembersTabs({
  locale,
  initialTab,
  pendingCount,
  memberPanel,
  applicationsPanel,
  showMembers = true,
  showApplications = true,
}: {
  locale: Locale;
  initialTab: MemberTab;
  pendingCount: number;
  memberPanel: ReactNode;
  applicationsPanel: ReactNode;
  showMembers?: boolean;
  showApplications?: boolean;
}) {
  const en = locale === "en";
  const value=useSyncExternalStore(subscribe,()=>{
    const tab=new URL(window.location.href).searchParams.get("section");
    return showApplications&&tab==="applications"?"applications":showMembers?"members":"applications";
  },()=>initialTab);

  return <Tabs
    value={value}
    dir={en ? "ltr" : "rtl"}
    onValueChange={next => {
      if(next===value||next!=="applications"&&next!=="members"||next==="applications"&&!showApplications||next==="members"&&!showMembers)return;
      const url=new URL(window.location.href);
      if(next==="members")url.searchParams.delete("section");else url.searchParams.set("section",next);
      window.history.pushState(window.history.state,"",url.pathname+url.search+url.hash);
      window.dispatchEvent(new Event("organization-members-tab-change"));
    }}
    className="min-w-0 gap-4"
  >
    <TabsList aria-label={translateUi((en) ? "en" : "ar", "الأعضاء وطلبات الانضمام", "Organization members")} className="workspace-segmented-control group-data-[orientation=horizontal]/tabs:h-auto grid w-full grid-cols-2 gap-1 rounded-lg border border-border/70 bg-card p-1 sm:w-fit">
      {showMembers && <TabsTrigger value="members" className="h-9 flex-none gap-2 px-3 data-active:bg-primary data-active:text-primary-foreground data-active:shadow-none">{translateUi((en) ? "en" : "ar", "الأعضاء الحاليون", "Current members")}</TabsTrigger>}
      {showApplications && <TabsTrigger value="applications" aria-label={pendingCount > 0 ? translateUi((en) ? "en" : "ar", `طلبات الانضمام، ${formatNumber(pendingCount,locale)} طلبات جديدة`, `Join requests, ${pendingCount} new`) : undefined} className="h-9 flex-none gap-2 px-3 data-active:bg-primary data-active:text-primary-foreground data-active:shadow-none">
        {translateUi((en) ? "en" : "ar", "طلبات الانضمام", "Join requests")}
        {pendingCount > 0 && <Badge variant="secondary" className="h-5 min-w-5 justify-center px-1.5"><NumberText value={pendingCount}/></Badge>}
      </TabsTrigger>}
    </TabsList>
    {showMembers && <TabsContent keepMounted value="members" className="min-w-0">{memberPanel}</TabsContent>}
    {showApplications && <TabsContent keepMounted value="applications" className="min-w-0">{applicationsPanel}</TabsContent>}
  </Tabs>;
}

function subscribe(notify:()=>void){window.addEventListener("popstate",notify);window.addEventListener("organization-members-tab-change",notify);return()=>{window.removeEventListener("popstate",notify);window.removeEventListener("organization-members-tab-change",notify);};}
