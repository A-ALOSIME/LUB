"use client";

import {t as translateUi} from "@/lib/i18n";
import { createContext, useContext, type ReactNode } from "react";
import { Menu, PanelRightClose, PanelRightOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sidebar, SidebarInset, SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

type SidebarState = {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  openMobile: () => void;
  closeMobile: () => void;
};

const WorkspaceSidebarContext = createContext<SidebarState | null>(null);

export function useWorkspaceSidebar() {
  const context = useContext(WorkspaceSidebarContext);
  if (!context) throw new Error("useWorkspaceSidebar must be used within WorkspaceSidebarLayout.");
  return context;
}

function WorkspaceShell({
  header,
  navigation,
  children,
  management,
  dir,
}: {
  header: ReactNode;
  navigation: ReactNode;
  children: ReactNode;
  management: boolean;
  dir: "ltr" | "rtl";
}) {
  const sidebar = useSidebar();
  const workspaceSidebar: SidebarState = {
    collapsed: sidebar.state === "collapsed",
    setCollapsed: collapsed => sidebar.setOpen(!collapsed),
    openMobile: () => sidebar.setOpenMobile(true),
    closeMobile: () => sidebar.setOpenMobile(false),
  };

  return <WorkspaceSidebarContext.Provider value={workspaceSidebar}>
    <div className="workspace-app" data-workspace-shell="true" data-management={management || undefined} data-sidebar-collapsed={workspaceSidebar.collapsed}>
      <Sidebar side={dir === "rtl" ? "right" : "left"} variant="sidebar" collapsible="icon" dir={dir}>
        {navigation}
      </Sidebar>
      <SidebarInset className="workspace-main" dir={dir}>
        {header}
        {children}
      </SidebarInset>
    </div>
  </WorkspaceSidebarContext.Provider>;
}

export function WorkspaceSidebarLayout({
  header,
  navigation,
  children,
  management = false,
  dir = "rtl",
}: {
  header: ReactNode;
  navigation: ReactNode;
  children: ReactNode;
  management?: boolean;
  dir?: "ltr" | "rtl";
}) {
  return <SidebarProvider
    dir={dir}
    defaultOpen
    style={{ "--sidebar-width": "18rem", "--sidebar-width-icon": "4.4rem" } as React.CSSProperties}
  >
    <TooltipProvider delay={0}>
      <WorkspaceShell header={header} navigation={navigation} management={management} dir={dir}>{children}</WorkspaceShell>
    </TooltipProvider>
  </SidebarProvider>;
}

export function WorkspaceSidebarTrigger({ locale }: { locale: "ar" | "en" }) {
  const { openMobile } = useWorkspaceSidebar();
  const label = translateUi((locale === "en") ? "en" : "ar", "فتح القائمة", "Open navigation");

  return <Button
    type="button"
    variant="ghost"
    size="icon"
    className="workspace-mobile-menu-trigger h-9 w-9 rounded-md md:hidden"
    aria-label={label}
    title={label}
    onClick={openMobile}
  >
    <Menu aria-hidden="true" />
  </Button>;
}

export function WorkspaceSidebarCollapseButton({ locale }: { locale: "ar" | "en" }) {
  const { collapsed, setCollapsed } = useWorkspaceSidebar();
  const label = locale === "en"
    ? collapsed ? "Expand navigation" : "Collapse navigation"
    : collapsed ? "توسيع القائمة" : "طي القائمة";
  const Icon = collapsed ? PanelRightOpen : PanelRightClose;

  return <Button
    type="button"
    variant="ghost"
    size="icon-sm"
    className="workspace-sidebar-collapse"
    aria-label={label}
    title={label}
    aria-pressed={collapsed}
    onClick={() => setCollapsed(!collapsed)}
  >
    <Icon aria-hidden="true" />
  </Button>;
}
