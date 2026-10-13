// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { NotificationInbox } from "./notification-inbox";
import { previewNotifications } from "./notification-preview";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => <a href={href} {...props}>{children}</a>,
}));
vi.mock("./actions", () => ({ mutateTask: vi.fn() }));

afterEach(cleanup);

it("shows sample notifications and lets the user inspect unread and read states without saving", () => {
  render(<NotificationInbox
    items={previewNotifications}
    counts={{ all: 6, unread: 4 }}
    filter="all"
    preview
    locale="ar"
  />);

  expect(screen.getByRole("note").textContent).toContain("لا تُحفظ في حسابك");
  expect(screen.getByRole("link", { name: "تم قبول طلبك في نادي الأمن السيبراني" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "فعالية جديدة: لقاء التقنية والابتكار" })).toBeTruthy();
  expect(screen.getByRole("list", { name: "الإشعارات" }).children).toHaveLength(6);

  fireEvent.click(screen.getByRole("button", { name: /تحديد الكل كمقروء/ }));
  fireEvent.click(screen.getByRole("button", { name: /غير مقروءة/ }));

  expect(screen.getByText("ما عندك إشعارات غير مقروءة.")).toBeTruthy();
  expect(within(screen.getByRole("navigation", { name: "تصفية الإشعارات" })).getByRole("button", { name: /غير مقروءة/ }).textContent).toContain("0");
});

it("filters the preview list while keeping English digit counts", () => {
  render(<NotificationInbox
    items={previewNotifications}
    counts={{ all: 6, unread: 4 }}
    filter="unread"
    preview
    locale="ar"
  />);

  expect(screen.getByRole("list", { name: "الإشعارات" }).children).toHaveLength(4);
  expect(within(screen.getByRole("navigation", { name: "تصفية الإشعارات" })).getByRole("button", { name: /الكل/ }).textContent).toContain("6");
  expect(within(screen.getByRole("navigation", { name: "تصفية الإشعارات" })).getByRole("button", { name: /غير مقروءة/ }).textContent).toContain("4");
});
