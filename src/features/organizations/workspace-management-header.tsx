"use client";

import {ContentText} from "@/components/content-text";

import {createTranslator} from "@/lib/i18n";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {Fragment,useSyncExternalStore} from "react";
import {Breadcrumb,BreadcrumbList,BreadcrumbItem,BreadcrumbLink,BreadcrumbPage,BreadcrumbSeparator} from "@/components/ui/breadcrumb";
import { House } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DisplayControls } from "@/components/display-controls";
import { NotificationBell } from "@/features/tasks/notification-bell";
import type { TaskNotification } from "@/features/tasks/repository";
import { WorkspaceSidebarTrigger } from "./workspace-sidebar-layout";
import type { Locale, Theme } from "@/lib/preferences";

import {workspaceBreadcrumbs} from "./workspace-breadcrumbs";
import {useWorkspaceBreadcrumbDetail} from "./workspace-breadcrumb-detail";
import {IntentPrefetchLink} from "./intent-prefetch-link";
import type {ManagedOrganizationLink} from "./my-page-navigation";

const changeEvents=["popstate","list-query-change","activity-tab-change","organization-section-change"];
function subscribeToSearch(listener:()=>void){
  for(const event of changeEvents)window.addEventListener(event,listener);
  return ()=>{for(const event of changeEvents)window.removeEventListener(event,listener);};
}

export function WorkspaceManagementHeader({ locale, theme, organizations, notifications, unreadCount }: {
  locale: Locale;
  theme: Theme;
  organizations: ManagedOrganizationLink[];
  notifications: TaskNotification[];
  unreadCount: number;
}) {
  const pathname = usePathname() ?? "/me";
  const en = locale === "en";
  const c = createTranslator(locale);
  const search=useSyncExternalStore(subscribeToSearch,()=>window.location.search,()=>"");
  const crumbs = workspaceBreadcrumbs(pathname,locale,organizations,useWorkspaceBreadcrumbDetail(),search);
  return <header className="workspace-management-header" dir={en ? "ltr" : "rtl"}>
    <div className="workspace-management-breadcrumbs">
      <WorkspaceSidebarTrigger locale={locale} />
      <Breadcrumb aria-label={c("مسار الصفحة","Breadcrumbs")} className="min-w-0"><BreadcrumbList className="flex-nowrap overflow-hidden">
        {crumbs.map((crumb,index)=>{
          const current=index===crumbs.length-1;
          return <Fragment key={index}>
            {index>0&&<BreadcrumbSeparator className="shrink-0"/>}
            <BreadcrumbItem title={crumb.label} className={current?"min-w-0 shrink":"min-w-0 max-w-28 shrink md:max-w-56"}>
              {current?<BreadcrumbPage className="truncate"><ContentText value={crumb.label}/></BreadcrumbPage>
                :crumb.href?<BreadcrumbLink className="truncate" render={<IntentPrefetchLink href={crumb.href}/>}><ContentText value={crumb.label}/></BreadcrumbLink>
                :<span className="truncate"><ContentText value={crumb.label}/></span>}
            </BreadcrumbItem>
          </Fragment>;
        })}
      </BreadcrumbList></Breadcrumb>
    </div>
    <div className="workspace-management-actions">
      <NotificationBell items={notifications} unreadCount={unreadCount} locale={locale} />
      <DisplayControls locale={locale} theme={theme} />
      <Button
        render={<Link href="/" aria-label={c("العودة إلى الموقع العام", "Return to the public site")} />}
        variant="ghost"
        size="sm"
        className="workspace-management-public-link h-9 rounded-md"
      >
        <House aria-hidden="true" />
        <span className="workspace-management-public-label">{c("الرئيسية", "Home")}</span>
      </Button>
    </div>
  </header>;
}
