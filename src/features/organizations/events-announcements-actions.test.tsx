// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/app/(workspace)/manage/organizations/[id]/announcement-dialog", () => ({ AnnouncementDialog: () => null }));
import { EventsAnnouncementsActions } from "./events-announcements-actions";

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/manage/organizations/org-1/events");
});

describe("event creation compatibility", () => {
  it("opens the centered event dialog from the old new-event anchor", () => {
    window.history.replaceState(null, "", "/manage/organizations/org-1/events#new-event");

    render(
      <EventsAnnouncementsActions organizationId="org-1" locale="ar" canCreateEvent canCreateAnnouncement={false}>
        <p>نموذج الفعالية الحالي</p>
      </EventsAnnouncementsActions>,
    );

    expect(screen.getByRole("dialog", { name: "فعالية جديدة" })).toBeTruthy();
    expect(screen.getByRole("dialog").className).toContain("max-w-2xl");
    expect(screen.getByText("نموذج الفعالية الحالي")).toBeTruthy();
  });
});
