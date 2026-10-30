// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import {readTaskNotification} from "./actions";
import { NotificationInbox, notificationDate, notificationHref } from "./notification-inbox";
import { previewNotifications } from "./notification-preview";

const { push, routerPush } = vi.hoisted(() => ({ push: vi.fn(), routerPush: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => <a href={href} {...props}>{children}</a>,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: routerPush }) }));
vi.mock("./notification-navigation", () => ({ navigateNotification: push }));
vi.mock("./actions", () => ({ mutateTask: vi.fn(), readTaskNotification: vi.fn().mockResolvedValue({ success: "ok" }) }));

afterEach(() => {
  cleanup();
  push.mockClear();
  routerPush.mockClear();
});

it("shows sample notifications and lets the user inspect unread and read states without saving", () => {
  render(<NotificationInbox
    items={previewNotifications}
    counts={{ all: 6, unread: 4 }}
    filter="all"
    preview
    locale="ar"
  />);

  expect(screen.queryByRole("note")).toBeNull();
  expect(screen.getByRole("button", { name: /تم قبول طلبك في نادي الأمن السيبراني/ })).toBeTruthy();
  expect(screen.getByRole("button", { name: /فعالية جديدة: لقاء التقنية والابتكار/ })).toBeTruthy();
  expect(screen.queryByText("جديد")).toBeNull();
  expect(screen.queryByText("مقروء")).toBeNull();
  expect(screen.getByRole("list", { name: "الإشعارات" }).children).toHaveLength(6);

  fireEvent.click(screen.getByRole("button", { name: /تحديد الكل كمقروء/ }));
  fireEvent.click(screen.getByRole("tab", { name: /غير مقروءة/ }));

  expect(screen.getByText("ما عندك إشعارات غير مقروءة.")).toBeTruthy();
  expect(within(screen.getByRole("tablist", { name: "تصفية الإشعارات" })).getByRole("tab", { name: /غير مقروءة/ }).textContent).toContain("0");
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
  expect(within(screen.getByRole("tablist", { name: "تصفية الإشعارات" })).getByRole("tab", { name: /الكل/ }).textContent).toContain("6");
  expect(within(screen.getByRole("tablist", { name: "تصفية الإشعارات" })).getByRole("tab", { name: /غير مقروءة/ }).textContent).toContain("4");
});

it("uses the shared segmented filter and keeps unread filtering in the URL", () => {
  render(<NotificationInbox
    items={previewNotifications}
    counts={{ all: 6, unread: 4 }}
    filter="all"
    locale="ar"
  />);

  const group = screen.getByRole("tablist", { name: "تصفية الإشعارات" });
  expect(group.parentElement?.getAttribute("dir")).toBe("rtl");
  fireEvent.click(within(group).getByRole("tab", { name: /غير مقروءة/ }));
  expect(routerPush).not.toHaveBeenCalled();
  expect(window.location.search).toBe("?filter=unread");
});

it("loads preview examples when navigating from an empty inbox without a full reload", async () => {
  const view = render(<NotificationInbox
    items={[]}
    counts={{ all: 0, unread: 0 }}
    filter="all"
    locale="ar"
  />);

  view.rerender(<NotificationInbox
    items={previewNotifications}
    counts={{ all: 6, unread: 4 }}
    filter="all"
    preview
    locale="ar"
  />);

  await waitFor(() => expect(screen.getByRole("list", { name: "الإشعارات" }).children).toHaveLength(6));
  expect(screen.queryByRole("note")).toBeNull();
});

it("opens the notification target after marking it read", async () => {
  render(<NotificationInbox items={previewNotifications} counts={{ all: 6, unread: 4 }} filter="all" preview locale="ar" />);
  fireEvent.click(screen.getByRole("button", { name: /تم قبول طلبك في نادي الأمن السيبراني/ }));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/applications"));
});

it("marks an unlinked notification read without navigating", async () => {
  const unlinked = { ...previewNotifications[0], target_url: "" };
  render(<NotificationInbox items={[unlinked]} counts={{ all: 1, unread: 1 }} filter="all" preview locale="ar" />);
  fireEvent.click(screen.getByRole("button", { name: /تم قبول طلبك في نادي الأمن السيبراني/ }));
  await waitFor(() => expect(screen.getByText("تغيّرت حالة المعاينة فقط؛ لم تُحفظ أي بيانات.")).toBeTruthy());
  expect(push).not.toHaveBeenCalled();
});

it("normalizes legacy renewal notification links and keeps only safe internal destinations", () => {
  expect(notificationHref("/renewals")).toBe("/applications?tab=renewals");
  expect(notificationHref("/applications?tab=renewals")).toBe("/applications?tab=renewals");
  expect(notificationHref("/tasks")).toBe("/activity?tab=tasks");
  expect(notificationHref("/tasks?mine=1&page=2")).toBe("/activity?tab=tasks&taskFilter=mine&page=2");
  expect(notificationHref("/events/mine?page=1")).toBe("/activity?tab=events&page=1");
  expect(notificationHref("/events")).toBe("/activity?tab=events");
  expect(notificationHref("/hours?term=term-id&page=3")).toBe("/activity?tab=hours&page=3&term=term-id");
  expect(notificationHref("/documents")).toBe("/activity?tab=hours");
  expect(notificationHref("https://example.com")).toBeNull();
  expect(notificationHref(null)).toBeNull();
});

it("uses relative dates for recent notifications and full dates after a week", () => {
  const now = Date.parse("2026-10-14T12:00:00+03:00");
  expect(notificationDate("2026-10-14T10:00:00+03:00", "en", now)).toBe("2 hours ago");
  expect(notificationDate("2026-10-01T10:00:00+03:00", "en", now)).toContain("1 October 2026, 10:00 am");
});

it("uses the prefetched unread list without navigating again",()=>{
 window.history.replaceState(null,"","/notifications");
 render(<NotificationInbox items={[{...previewNotifications[0],read_at:"2026-10-01"}]} unreadItems={[previewNotifications[1]]} counts={{all:2,unread:1}} filter="all" locale="en"/>);
 fireEvent.click(screen.getByRole("tab",{name:/Unread/}));
 expect(routerPush).not.toHaveBeenCalled();expect(window.location.search).toBe("?filter=unread");
 expect(screen.getByRole("list",{name:"Notifications"}).textContent).toContain(previewNotifications[1].title);
});
it("marks a notification read immediately and rolls back a failed save",async()=>{
 let finish!:(result:{error:string})=>void;
 vi.mocked(readTaskNotification).mockReturnValueOnce(new Promise(resolve=>{finish=resolve;}));
 render(<NotificationInbox items={[{...previewNotifications[0],target_url:""}]} counts={{all:1,unread:1}} filter="all" locale="en"/>);
 fireEvent.click(screen.getByRole("button",{name:"Mark as read"}));
 expect(screen.getByRole("tab",{name:/Unread/}).textContent).toContain("0");
 finish({error:"تعذّر تحديث الإشعار. حدّث الصفحة وحاول مرة ثانية."});
 await waitFor(()=>expect(screen.getByRole("tab",{name:/Unread/}).textContent).toContain("1"));
});
