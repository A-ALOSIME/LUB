// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { OrganizationSectionTabPanel, OrganizationSectionTabs } from "./organization-section-tabs";

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/organizations/test-club");
});

function renderTabs(initialSection = "about") {
  return render(
    <OrganizationSectionTabs
      items={[
        { id: "about", label: "عن النادي" },
        { id: "structure", label: "اللجان" },
        { id: "programs", label: "البرامج" },
      ]}
      initialSection={initialSection}
      label="أقسام النادي"
      dir="rtl"
    >
      <OrganizationSectionTabPanel id="about"><p>تعريف النادي</p></OrganizationSectionTabPanel>
      <OrganizationSectionTabPanel id="structure"><p>اللجان المتاحة</p></OrganizationSectionTabPanel>
      <OrganizationSectionTabPanel id="programs"><p>برامج النادي</p></OrganizationSectionTabPanel>
    </OrganizationSectionTabs>,
  );
}

describe("organization profile section navigation", () => {
  it("switches sections locally and keeps the selected section in the URL", () => {
    window.history.replaceState(null, "", "/organizations/test-club?committeePage=2");
    renderTabs();

    fireEvent.click(screen.getByRole("tab", { name: "اللجان" }));

    expect(screen.getByRole("tab", { name: "اللجان" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel", { name: "اللجان" }).hidden).toBe(false);
    expect(document.getElementById("organization-section-panel-about")?.hidden).toBe(true);
    expect(window.location.search).toBe("?committeePage=2&section=structure");
  });

  it("moves through the tabs with RTL arrow keys", () => {
    renderTabs();
    const aboutTab = screen.getByRole("tab", { name: "عن النادي" });

    fireEvent.keyDown(aboutTab, { key: "ArrowLeft" });

    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "اللجان" }));
    expect(screen.getByRole("tab", { name: "اللجان" }).getAttribute("aria-selected")).toBe("true");
    expect(window.location.search).toBe("?section=structure");
  });

  it("can center the section bar in its available width", () => {
    render(
      <OrganizationSectionTabs
        items={[{ id: "about", label: "عن النادي" }, { id: "fields", label: "المجالات" }]}
        initialSection="about"
        label="أقسام النادي"
        dir="rtl"
        centered
      >
        <OrganizationSectionTabPanel id="about"><p>تعريف النادي</p></OrganizationSectionTabPanel>
        <OrganizationSectionTabPanel id="fields"><p>مجالات النادي</p></OrganizationSectionTabPanel>
      </OrganizationSectionTabs>,
    );

    expect(screen.getByRole("navigation", { name: "أقسام النادي" }).parentElement?.className).toContain("organization-section-nav-center");
  });

  it("restores the selected section when browser history changes", () => {
    renderTabs("structure");
    window.history.pushState(null, "", "?section=programs");
    fireEvent.popState(window);

    expect(screen.getByRole("tab", { name: "البرامج" }).getAttribute("aria-selected")).toBe("true");
    expect(document.getElementById("organization-section-panel-programs")?.hidden).toBe(false);
  });

  it("clears the query parameter when selecting a non-about default section", () => {
    window.history.replaceState(null, "", "/manage/organizations/org-1/events?section=announcements&page=2");
    render(
      <OrganizationSectionTabs
        items={[{ id: "events", label: "الفعاليات" }, { id: "announcements", label: "الإعلانات" }]}
        initialSection="announcements"
        defaultSection="events"
        label="الفعاليات والإعلانات"
        dir="rtl"
      >
        <OrganizationSectionTabPanel id="events"><p>قائمة الفعاليات</p></OrganizationSectionTabPanel>
        <OrganizationSectionTabPanel id="announcements"><p>قائمة الإعلانات</p></OrganizationSectionTabPanel>
      </OrganizationSectionTabs>,
    );

    fireEvent.click(screen.getByRole("tab", { name: "الفعاليات" }));

    expect(window.location.search).toBe("?page=2");
    expect(screen.getByRole("tabpanel", { name: "الفعاليات" }).hidden).toBe(false);
  });

  it("opens the matching section for the old committee anchor link", () => {
    window.history.replaceState(null, "", "/manage/organizations/org-1#committees");
    render(
      <OrganizationSectionTabs
        items={[{ id: "about", label: "عن الجهة" }, { id: "committees", label: "اللجان" }]}
        initialSection="about"
        label="أقسام الجهة"
        dir="rtl"
        legacyHashSections={{ "#committees": "committees" }}
      >
        <OrganizationSectionTabPanel id="about"><p>النبذة</p></OrganizationSectionTabPanel>
        <OrganizationSectionTabPanel id="committees" legacyId="committees"><p>قائمة اللجان</p></OrganizationSectionTabPanel>
      </OrganizationSectionTabs>,
    );

    expect(screen.getByRole("tab", { name: "اللجان" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel", { name: "اللجان" }).hidden).toBe(false);
    expect(window.location.search).toBe("?section=committees");
    expect(window.location.hash).toBe("#committees");
  });
});
