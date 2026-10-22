"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/preferences";

const HeaderActionContext = createContext<(action: ReactNode | null) => void>(() => {});

export function OrganizationManagementHeaderAction({ children }: { children: ReactNode }) {
  const setAction = useContext(HeaderActionContext);
  useEffect(() => {
    setAction(children);
    return () => setAction(null);
  }, [children, setAction]);
  return null;
}

type PageCopy = { title: string };

const ar: Record<string, PageCopy> = {
  organization: { title: "الجهة" },
  members: { title: "الأعضاء" },
  permissions: { title: "الأعضاء" },
  applications: { title: "الأعضاء" },
  renewals: { title: "التسجيل والتجديد" },
  events: { title: "الفعاليات والإعلانات" },
  tasks: { title: "المهام والساعات" },
  hours: { title: "المهام والساعات" },
};

const en: Record<string, PageCopy> = {
  organization: { title: "Organization" },
  members: { title: "Members" },
  permissions: { title: "Members" },
  applications: { title: "Members" },
  renewals: { title: "Registration and renewal" },
  events: { title: "Events and announcements" },
  tasks: { title: "Tasks and hours" },
  hours: { title: "Tasks and hours" },
};

export function organizationManagementPage(pathname: string, locale: Locale): PageCopy {
  const section = pathname.split("/").filter(Boolean).slice(3)[0] ?? "organization";
  const key = section === "applications" ? "members" : section;
  return (locale === "en" ? en : ar)[key] ?? (locale === "en" ? en : ar).organization;
}

export function OrganizationManagementFrame({ locale, children }: { locale: Locale; children: ReactNode }) {
  const [headerAction, setHeaderAction] = useState<ReactNode>(null);
  const setAction = useCallback((action: ReactNode | null) => setHeaderAction(() => action), []);
  const pathname = usePathname() ?? "";
  const segments = pathname.split("/").filter(Boolean);
  const page = organizationManagementPage(pathname, locale);
  const organizationOverview = segments.length === 3;
  const wide = ["members", "applications", "renewals", "hours", "tasks"].includes(segments[3] ?? "");
  return <HeaderActionContext.Provider value={setAction}>
    <main className={`organization-management-page workspace-content min-w-0${organizationOverview ? " organization-management-page--overview" : ""}${wide ? " organization-management-page--wide" : ""}`}>
      {!organizationOverview && <header className="workspace-page-header">
        <h1>{page.title}</h1>
        {headerAction && <div className="organization-management-header-action">{headerAction}</div>}
      </header>}
      {children}
    </main>
  </HeaderActionContext.Provider>;
}
