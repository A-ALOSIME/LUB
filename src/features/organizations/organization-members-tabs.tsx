"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("section");
  const value: MemberTab = showApplications && requestedTab === "applications" ? "applications" : initialTab;

  return <Tabs
    value={value}
    dir={en ? "ltr" : "rtl"}
    onValueChange={next => {
      if (next === "applications" && showApplications) router.push(`${pathname}?section=applications`, { scroll: false });
      else if (next === "members" && showMembers) router.push(pathname, { scroll: false });
    }}
    className="min-w-0 gap-4"
  >
    <TabsList aria-label={en ? "Organization members" : "الأعضاء وطلبات الانضمام"} className="workspace-segmented-control group-data-[orientation=horizontal]/tabs:h-auto grid w-full grid-cols-2 gap-1 rounded-lg border border-border/70 bg-card p-1 sm:w-fit">
      {showMembers && <TabsTrigger value="members" className="h-9 flex-none gap-2 px-3 data-active:bg-primary data-active:text-primary-foreground data-active:shadow-none">{en ? "Current members" : "الأعضاء الحاليون"}</TabsTrigger>}
      {showApplications && <TabsTrigger value="applications" aria-label={pendingCount > 0 ? en ? `Join requests, ${pendingCount} pending` : `طلبات الانضمام، ${pendingCount} طلبات معلقة` : undefined} className="h-9 flex-none gap-2 px-3 data-active:bg-primary data-active:text-primary-foreground data-active:shadow-none">
        {en ? "Join requests" : "طلبات الانضمام"}
        {pendingCount > 0 && <Badge variant="secondary" className="h-5 min-w-5 justify-center px-1.5">{pendingCount}</Badge>}
      </TabsTrigger>}
    </TabsList>
    {showMembers && <TabsContent value="members" className="min-w-0">{memberPanel}</TabsContent>}
    {showApplications && <TabsContent value="applications" className="min-w-0">{applicationsPanel}</TabsContent>}
  </Tabs>;
}
