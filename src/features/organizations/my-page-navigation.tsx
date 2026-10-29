"use client";

import {createTranslator} from "@/lib/i18n";
import { Fragment, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Activity, BadgeCheck, Building2, CalendarDays, ChevronDown, ClipboardCheck,
  ClipboardList, Clock3, ContactRound, GraduationCap, LayoutDashboard,
  Landmark, LogOut, Network, Settings2, Shield, UserRound,
  Users, CircleUserRound, Send,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { LubWordmark } from "@/components/lub-wordmark";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SidebarContent, SidebarFooter, SidebarGroup, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { signOut } from "@/features/auth/actions";
import { IntentPrefetchLink } from "./intent-prefetch-link";
import { formatPersonalNumber } from "./personal-display";
import { useWorkspaceSidebar, WorkspaceSidebarCollapseButton } from "./workspace-sidebar-layout";
import type { Locale } from "@/lib/preferences";

export type ManagedOrganizationLink = {
  id: string;
  nameAr: string;
  statusCode: string;
  pendingApplications: number;
  canEdit: boolean;
  canManageCommittees: boolean;
  canApplications: boolean;
  canEvents: boolean;
  canReports: boolean;
  canHours: boolean;
  canRenewals: boolean;
  canTasks: boolean;
  canMembers: boolean;
  canGrant: boolean;
};

type SidebarGroup = "account" | "management" | "system";
type SidebarLink = { href: string; label: string; icon: typeof Building2; active: boolean; count?: number; children?: SidebarLink[] };

function normalizedPath(pathname: string) {
  return pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
}

function isWithinPath(pathname: string, basePath: string) {
  return pathname === basePath || pathname.startsWith(`${basePath}/`);
}

function organizationInitial(name: string) {
  const normalizedName = name.trim().replace(/^ال/u, "");
  return Array.from(normalizedName || name.trim())[0] ?? "م";
}

function activeGroupFor(pathname: string, organizations: ManagedOrganizationLink[], superAdmin: boolean): SidebarGroup {
  const path = normalizedPath(pathname);
  if (path === "/manage/account") return "account";
  if (organizations.some(organization => isWithinPath(path, `/manage/organizations/${organization.id}`))) return "management";
  if (superAdmin && path.startsWith("/manage")) return "system";
  return "account";
}

function SidebarLinkItem({ href, label, icon: Icon, active, count, locale }: SidebarLink & { locale: Locale }) {
  const { closeMobile } = useWorkspaceSidebar();

  return <SidebarMenuItem>
    <SidebarMenuButton
      isActive={active}
      tooltip={label}
      tooltipSide={locale === "ar" ? "left" : "right"}
      className={`workspace-sidebar-link${active ? " workspace-sidebar-link--active" : ""}`}
      render={<IntentPrefetchLink href={href} aria-current={active ? "page" : undefined} title={label} onClick={closeMobile} />}
    >
      <Icon aria-hidden="true" className="workspace-sidebar-icon" />
      <span className="workspace-sidebar-label" data-sidebar-label={label}>{label}</span>
      {count !== undefined && count > 0 && <span className="workspace-sidebar-badge" data-pending-count={count}>{formatPersonalNumber(count, locale)}</span>}
    </SidebarMenuButton>
  </SidebarMenuItem>;
}

function SidebarSectionHeading({
  label,
  icon: Icon,
  open,
  onToggle,
  locale,
}: {
  label: string;
  icon: typeof Building2;
  open: boolean;
  onToggle: () => void;
  locale: Locale;
}) {
  return <SidebarMenuItem>
    <SidebarMenuButton
      tooltip={label}
      tooltipSide={locale === "ar" ? "left" : "right"}
      className="workspace-sidebar-section-heading"
      aria-expanded={open}
      title={label}
      onClick={onToggle}
    >
      <Icon aria-hidden="true" className="workspace-sidebar-icon" />
      <span className="workspace-sidebar-label">{label}</span>
      <ChevronDown aria-hidden="true" className={`workspace-sidebar-chevron${open ? " is-open" : ""}`} />
    </SidebarMenuButton>
  </SidebarMenuItem>;
}

export function MyPageNavigation({
  locale,
  organizations,
  superAdmin = false,
  userName,
  pendingOrganizationRequests=0,
}: {
  locale: Locale;
  organizations: ManagedOrganizationLink[];
  superAdmin?: boolean;
  userName?: string | null;
  pendingOrganizationRequests?:number;
}) {
  const pathname = normalizedPath(usePathname() ?? "/");
  const { collapsed, closeMobile } = useWorkspaceSidebar();
  const en = locale === "en";
  const c = createTranslator(en ? "en" : "ar");
  const inferredOpenGroup = activeGroupFor(pathname, organizations, superAdmin);
  const [groupState, setGroupState] = useState(() => ({
    pathname,
    open: {
      account: inferredOpenGroup === "account",
      management: inferredOpenGroup === "management",
      system: inferredOpenGroup === "system",
    },
  }));
  const openGroups = groupState.pathname === pathname
    ? groupState.open
    : { ...groupState.open, [inferredOpenGroup]: true };
  const activeOrganizationId = pathname.match(/^\/manage\/organizations\/([^/]+)/)?.[1];
  const selectedOrganization = organizations.find(organization => organization.id === activeOrganizationId) ?? organizations[0];

  const toggleGroup = (group: SidebarGroup) => {
    setGroupState(current => {
      const open = current.pathname === pathname ? current.open : { ...current.open, [inferredOpenGroup]: true };
      return { pathname, open: { ...open, [group]: !open[group] } };
    });
  };

  const isAccountActivity = ["/activity", "/tasks", "/hours", "/events/mine"].some(path => pathname === path || pathname.startsWith(`${path}/`));
  const accountLinks: SidebarLink[] = superAdmin
    ? [{ href: "/manage/account", label: c("بيانات الحساب", "Account details"), icon: UserRound, active: pathname === "/manage/account" }]
    : [
      { href: "/account", label: c("بيانات الحساب", "Account details"), icon: ContactRound, active: pathname === "/account" },
      { href: "/account/talent", label: c("ملفي المهاري", "Skills profile"), icon: BadgeCheck, active: pathname === "/account/talent" },
      { href: "/applications", label: c("طلباتي", "My requests"), icon: Send, active: pathname === "/applications" },
      { href: "/activity", label: c("نشاطي", "My activity"), icon: Activity, active: pathname === "/activity" || isAccountActivity },
    ];

  const overviewHref = superAdmin ? "/manage" : "/me";
  const systemLinks: SidebarLink[] = [
    { href: "/manage/organizations", label: c("الجهات", "Organizations"), icon: Network, active: isWithinPath(pathname,"/manage/organizations") },
    {href:"/manage/organization-requests",label:c("طلبات فتح الأندية","Organization requests"),icon:Send,active:pathname==="/manage/organization-requests",count:pendingOrganizationRequests},
    { href: "/manage/admins", label: c("المشرفون العامون", "Administrators"), icon: Shield, active: pathname === "/manage/admins" },
    { href: "/manage/terms", label: c("الفصول الأكاديمية", "Academic terms"), icon: GraduationCap, active: pathname === "/manage/terms" },
  ];

  const organizationRoot = selectedOrganization ? `/manage/organizations/${selectedOrganization.id}` : "";
  const organizationLinks: SidebarLink[] = selectedOrganization ? [
    {
      href: organizationRoot,
      label: c("الجهة", "Organization"),
      icon: Landmark,
      active: pathname === organizationRoot,
    },
    ...(selectedOrganization.canMembers || selectedOrganization.canGrant ? [{
      href: `${organizationRoot}/members`,
      label: c("الأعضاء", "Members"),
      icon: Users,
      active: pathname === `${organizationRoot}/members` || pathname === `${organizationRoot}/permissions` || isWithinPath(pathname, `${organizationRoot}/applications`),
      count: selectedOrganization.pendingApplications,
    }] : []),
    ...(selectedOrganization.canRenewals || selectedOrganization.canApplications ? [{ href: `${organizationRoot}/renewals`, label: c("التسجيل والتجديد", "Registration and renewal"), icon: ClipboardList, active: pathname === `${organizationRoot}/renewals` }] : []),
    ...(selectedOrganization.canEvents || selectedOrganization.canEdit ? [{ href: `${organizationRoot}/events`, label: c("الفعاليات والإعلانات", "Events and announcements"), icon: CalendarDays, active: pathname === `${organizationRoot}/events` }] : []),
    ...(selectedOrganization.canTasks || selectedOrganization.canHours || selectedOrganization.canReports ? [{
      href: selectedOrganization.canTasks ? `${organizationRoot}/tasks` : selectedOrganization.canHours ? `${organizationRoot}/hours` : `${organizationRoot}/hours`,
      label: c("المهام والساعات", "Tasks and hours"),
      icon: selectedOrganization.canTasks ? ClipboardCheck : Clock3,
      active: ["tasks", "hours"].some(section => pathname === `${organizationRoot}/${section}`),
    }] : []),
  ] : [];

  const initial = userName?.trim().slice(0, 1) || c("م", "U");
  const displayName = userName?.trim() || c("حسابي", "My account");
  const accountHref = superAdmin ? "/manage/account" : "/account";

  return <div className="workspace-sidebar-content" dir={en ? "ltr" : "rtl"} data-collapsed={collapsed}>
    <SidebarHeader className="workspace-sidebar-header">
      {collapsed
        ? <IntentPrefetchLink href={overviewHref} className="workspace-sidebar-brand workspace-sidebar-brand--collapsed" aria-label={c("مساحة عمل لُبّ", "LUB workspace")}><LubWordmark /></IntentPrefetchLink>
        : <Brand en={en} href={overviewHref} className="workspace-sidebar-brand" />}
      <WorkspaceSidebarCollapseButton locale={locale} />
    </SidebarHeader>
    <SidebarContent className="workspace-sidebar-scroll">
      <nav aria-label={c("تنقل مساحة العمل", "Workspace navigation")}>
      <SidebarMenu className="workspace-sidebar-list">
        <SidebarLinkItem href={overviewHref} label={c("نظرة عامة", "Overview")} icon={LayoutDashboard} active={pathname === overviewHref} locale={locale} />
      </SidebarMenu>

      <SidebarGroup role="region" className="workspace-sidebar-group p-0" aria-label={c("حسابي", "My account")}>
        <SidebarMenu className="workspace-sidebar-list">
          <SidebarSectionHeading label={c("حسابي", "My account")} icon={CircleUserRound} open={openGroups.account} onToggle={() => toggleGroup("account")} locale={locale} />
          {openGroups.account && accountLinks.map(item => <SidebarLinkItem key={item.href} {...item} locale={locale} />)}
        </SidebarMenu>
      </SidebarGroup>

      {!superAdmin && organizations.length > 0 && <SidebarGroup role="region" className="workspace-sidebar-group p-0" aria-label={c("إدارة الجهات", "Organization management")}>
        <SidebarMenu className="workspace-sidebar-list">
          <SidebarSectionHeading label={c("إدارة الجهات", "Organization management")} icon={Building2} open={openGroups.management} onToggle={() => toggleGroup("management")} locale={locale} />
        </SidebarMenu>
        {openGroups.management && selectedOrganization && <div className="workspace-sidebar-management">
          {organizations.length === 1
            ? <div className="workspace-sidebar-organization workspace-sidebar-organization-heading" title={selectedOrganization.nameAr}>
              <span className="workspace-sidebar-organization-mark" aria-hidden="true">{organizationInitial(selectedOrganization.nameAr)}</span>
              <span className="workspace-sidebar-label" dir="auto">{selectedOrganization.nameAr}</span>
            </div>
            : <DropdownMenu>
              <DropdownMenuTrigger render={<button type="button" className="workspace-sidebar-organization" aria-label={c("اختيار الجهة", "Choose organization")} title={selectedOrganization.nameAr} />}>
                <span className="workspace-sidebar-organization-mark" aria-hidden="true">{organizationInitial(selectedOrganization.nameAr)}</span>
                <span className="workspace-sidebar-label" dir="auto">{selectedOrganization.nameAr}</span>
                <ChevronDown aria-hidden="true" className="workspace-sidebar-chevron" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>{c("الجهة", "Organization")}</DropdownMenuLabel>
                  {organizations.map(organization => <DropdownMenuItem key={organization.id} render={<IntentPrefetchLink href={`/manage/organizations/${organization.id}`} onClick={closeMobile} />}>
                    <span className="workspace-sidebar-organization-mark" aria-hidden="true">{organizationInitial(organization.nameAr)}</span>
                    <span dir="auto" className="truncate">{organization.nameAr}</span>
                  </DropdownMenuItem>)}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>}

          <SidebarMenu className="workspace-sidebar-list workspace-sidebar-management-list">
            {organizationLinks.map(({ children, ...item }) => <Fragment key={item.href}>
              <SidebarLinkItem {...item} locale={locale} />
              {children && children.length > 0 && <SidebarMenu className="workspace-sidebar-list workspace-sidebar-sublist">
                {children.map(child => <SidebarLinkItem key={child.href} {...child} locale={locale} />)}
              </SidebarMenu>}
            </Fragment>)}
          </SidebarMenu>
        </div>}
      </SidebarGroup>}

      {superAdmin && <SidebarGroup role="region" className="workspace-sidebar-group p-0" aria-label={c("إدارة النظام", "System administration")}>
        <SidebarMenu className="workspace-sidebar-list">
          <SidebarSectionHeading label={c("إدارة النظام", "System administration")} icon={Settings2} open={openGroups.system} onToggle={() => toggleGroup("system")} locale={locale} />
          {openGroups.system && systemLinks.map(item => <SidebarLinkItem key={item.href} {...item} locale={locale} />)}
        </SidebarMenu>
      </SidebarGroup>}
      </nav>
    </SidebarContent>

    <SidebarFooter className="workspace-sidebar-footer">
      <DropdownMenu>
        <DropdownMenuTrigger render={<button type="button" className="workspace-sidebar-user" aria-label={c(`قائمة حساب ${displayName}`, `${displayName} account menu`)} title={displayName} />}>
          <Avatar><AvatarFallback className="font-semibold text-foreground">{initial}</AvatarFallback></Avatar>
          <span className="workspace-sidebar-label" dir="auto">{displayName}</span>
          <ChevronDown aria-hidden="true" className="workspace-sidebar-chevron" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="min-w-48">
          <DropdownMenuGroup>
            <DropdownMenuLabel dir="auto">{displayName}</DropdownMenuLabel>
            <DropdownMenuItem render={<IntentPrefetchLink href={accountHref} onClick={closeMobile} />}>
              <UserRound aria-hidden="true" />{c("بيانات الحساب", "Account details")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => { closeMobile(); void signOut(); }}>
            <LogOut aria-hidden="true" />{c("تسجيل الخروج", "Log out")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarFooter>
  </div>;
}
