"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Locale } from "@/lib/preferences";
import { requestsTabHref, type RequestsTab } from "./my-requests-navigation";

export function MyRequestsTabs({
  activeTab,
  preview = false,
  locale,
  children,
}: {
  activeTab: RequestsTab;
  preview?: boolean;
  locale: Locale;
  children: ReactNode;
}) {
  const router = useRouter();
  const en = locale === "en";

  return <Tabs
    value={activeTab}
    dir={en ? "ltr" : "rtl"}
    onValueChange={value => router.push(requestsTabHref(value as RequestsTab))}
    className="min-w-0 gap-4"
  >
    <TabsList variant="line" className="w-full justify-start gap-2 border-b border-border pb-0">
      <TabsTrigger
        value="applications"
        className="h-11 flex-none px-4"
        onClick={() => {
          if (preview && activeTab === "applications") router.push(requestsTabHref("applications"));
        }}
      >
        {en ? "Applications" : "طلبات الانضمام"}
      </TabsTrigger>
      <TabsTrigger value="renewals" className="h-11 flex-none px-4">
        {en ? "Renewals" : "طلبات التجديد"}
      </TabsTrigger>
    </TabsList>
    <TabsContent value={activeTab} dir={en ? "ltr" : "rtl"} className="min-w-0">
      {children}
    </TabsContent>
  </Tabs>;
}
