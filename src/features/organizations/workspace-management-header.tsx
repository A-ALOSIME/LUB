"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DisplayControls } from "@/components/display-controls";
import { NotificationBell } from "@/features/tasks/notification-bell";
import type { TaskNotification } from "@/features/tasks/repository";
import { WorkspaceSidebarTrigger } from "./workspace-sidebar-layout";
import type { Locale, Theme } from "@/lib/preferences";

type OrganizationCrumb = { id: string; nameAr: string };
type Crumb = { label: string; href?: string };

function pageTitle(pathname: string, locale: Locale) {
  const en = locale === "en";
  const labels: Record<string, [string, string]> = {
    "/me": ["نظرة عامة", "Overview"],
    "/account": ["بيانات الحساب", "Account details"],
    "/account/talent": ["ملفي المهاري", "Skills profile"],
    "/applications": ["طلباتي", "My requests"],
    "/activity": ["نشاطي", "My activity"],
    "/events/mine": ["فعالياتي", "My events"],
    "/hours": ["ساعاتي", "My hours"],
    "/notifications": ["الإشعارات", "Notifications"],
    "/renewals": ["تجديداتي", "My renewals"],
    "/tasks": ["مهامي", "My tasks"],
    "/manage": ["لوحة الإدارة", "Management overview"],
    "/manage/account": ["بيانات الحساب", "Account details"],
    "/manage/organizations": ["الجهات", "Organizations"],
    "/manage/organizations/new": ["جهة جديدة", "New organization"],
    "/manage/admins": ["المشرفون العامون", "Administrators"],
    "/manage/terms": ["الفصول الأكاديمية", "Academic terms"],
  };
  const pathLabels: Record<string, [string, string]> = {
    members: ["الأعضاء", "Members"], applications: ["الأعضاء", "Members"], permissions: ["الأعضاء", "Members"],
    renewals: ["التسجيل والتجديد", "Registration and renewal"], events: ["الفعاليات والإعلانات", "Events and announcements"],
    tasks: ["المهام والساعات", "Tasks and hours"], hours: ["المهام والساعات", "Tasks and hours"],
  };
  if (pathname.startsWith("/tasks/")) return en ? "Task details" : "تفاصيل المهمة";
  const exact = labels[pathname];
  if (exact) return exact[en ? 1 : 0];
  const section = pathname.split("/").filter(Boolean).at(-1) ?? "";
  const label = pathLabels[section];
  return label?.[en ? 1 : 0] ?? (en ? "Workspace" : "مساحتي");
}

export function WorkspaceManagementHeader({ locale, theme, organizations, notifications, unreadCount }: {
  locale: Locale;
  theme: Theme;
  organizations: OrganizationCrumb[];
  notifications: TaskNotification[];
  unreadCount: number;
}) {
  const pathname = usePathname() ?? "/me";
  const en = locale === "en";
  const c = (ar: string, english: string) => en ? english : ar;
  const page = pageTitle(pathname, locale);
  const organizationMatch = pathname === "/manage/organizations/new"
    ? null
    : pathname.match(/^\/manage\/organizations\/([^/]+)/);
  const orgId = organizationMatch?.[1];
  const organization = organizations.find(item => item.id === orgId);
  const workspaceHref = pathname === "/manage" || pathname.startsWith("/manage/") ? "/manage" : "/me";
  const workspaceLabel = c("مساحتي", "Workspace");
  const orgHref = orgId ? `/manage/organizations/${orgId}` : undefined;
  const crumbs: Crumb[] = orgId
    ? [
      { label: workspaceLabel, href: workspaceHref },
      { label: organization?.nameAr ?? c("الجهة", "Organization"), href: orgHref },
      ...(pathname !== orgHref ? [{ label: page }] : []),
    ]
    : pathname === workspaceHref
      ? [{ label: page }]
      : [{ label: workspaceLabel, href: workspaceHref }, { label: page }];
  return <header className="workspace-management-header" dir={en ? "ltr" : "rtl"}>
    <div className="workspace-management-breadcrumbs">
      <WorkspaceSidebarTrigger locale={locale} />
      <nav aria-label={c("مسار الصفحة", "Breadcrumbs")}>
        <ol>
          {crumbs.map((crumb, index) => <li key={`${crumb.label}-${index}`} title={crumb.label}>
            {index > 0 && <span aria-hidden="true" className="workspace-management-breadcrumb-separator">/</span>}
            {crumb.href && index < crumbs.length - 1
              ? <Link href={crumb.href}>{crumb.label}</Link>
              : <span aria-current={index === crumbs.length - 1 ? "page" : undefined}>{crumb.label}</span>}
          </li>)}
        </ol>
      </nav>
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
