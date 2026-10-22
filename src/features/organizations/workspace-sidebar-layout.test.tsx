// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SidebarContent, SidebarFooter, SidebarHeader } from "@/components/ui/sidebar";
import { WorkspaceSidebarCollapseButton, WorkspaceSidebarLayout, WorkspaceSidebarTrigger, useWorkspaceSidebar } from "./workspace-sidebar-layout";

function CollapseState() {
  const { collapsed } = useWorkspaceSidebar();
  return <span data-testid="collapse-state">{String(collapsed)}</span>;
}

function MobileAwareLink() {
  const { closeMobile } = useWorkspaceSidebar();
  return <a href="/activity" onClick={event => { event.preventDefault(); closeMobile(); }}>نشاطي</a>;
}

function setViewport(isMobile: boolean) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: isMobile ? 390 : 1280 });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: isMobile,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

function renderWorkspace(children: ReactNode = <main>صفحة الحساب</main>) {
  return render(<WorkspaceSidebarLayout
    header={<WorkspaceSidebarTrigger locale="ar" />}
    navigation={<div className="workspace-sidebar-content" data-collapsed="false">
      <SidebarHeader><CollapseState /><WorkspaceSidebarCollapseButton locale="ar" /></SidebarHeader>
      <SidebarContent><MobileAwareLink /></SidebarContent>
      <SidebarFooter>اسم المستخدم</SidebarFooter>
    </div>}
  >{children}</WorkspaceSidebarLayout>);
}

afterEach(() => {
  cleanup();
});

describe("workspace sidebar layout", () => {
  it("collapses to icon navigation and expands again", () => {
    setViewport(false);
    renderWorkspace();
    const collapse = screen.getByRole("button", { name: "طي القائمة" });

    fireEvent.click(collapse);
    expect(screen.getByTestId("collapse-state").textContent).toBe("true");
    expect(screen.getByRole("button", { name: "توسيع القائمة" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "توسيع القائمة" }));
    expect(screen.getByTestId("collapse-state").textContent).toBe("false");
  });

  it("opens the mobile drawer and closes it after navigation", async () => {
    setViewport(true);
    renderWorkspace();
    await act(async () => {});
    fireEvent.click(screen.getByRole("button", { name: "فتح القائمة" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("link", { name: "نشاطي" })).toBeTruthy();
    fireEvent.click(screen.getByRole("link", { name: "نشاطي" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("uses the shadcn sidebar frame with explicit RTL direction", () => {
    setViewport(false);
    const { container } = renderWorkspace();

    expect(container.querySelector('[data-slot="sidebar-wrapper"]')?.getAttribute("dir")).toBe("rtl");
    expect(container.querySelector('[data-slot="sidebar"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="sidebar-content"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="sidebar-footer"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="sidebar-inset"]')).toBeTruthy();
  });
});
