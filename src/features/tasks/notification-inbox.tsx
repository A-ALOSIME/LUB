"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { useActionToast } from "@/components/action-toast";
import { Bell, CalendarDays, Check, ClipboardCheck, Clock3, MailCheck, Megaphone, UsersRound } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { cn } from "cn";
import { actionFeedback } from "@/lib/action-feedback";
import type { Locale } from "@/lib/preferences";
import { mutateTask, readTaskNotification, type TaskState } from "./actions";
import { navigateNotification } from "./notification-navigation";
import { notificationDate, notificationHref } from "./notification-display";
import type { TaskNotification } from "./repository";
export { notificationDate, notificationHref } from "./notification-display";

type Filter = "all" | "unread";
type Counts = { all: number; unread: number };

function countLabel(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function NotificationIcon({ notification }: { notification: TaskNotification }) {
  const Icon = notification.type_code.toLowerCase().includes("event") || notification.target_url.startsWith("/events")
    ? CalendarDays
    : notification.type_code.toLowerCase().includes("hour") || notification.target_url === "/hours"
      ? Clock3
      : notification.type_code.toLowerCase().includes("application") || notification.target_url.startsWith("/applications")
        ? UsersRound
        : notification.type_code.toLowerCase().includes("task") || notification.target_url.startsWith("/tasks")
          ? ClipboardCheck
          : notification.type_code.toLowerCase().includes("renew") || notification.target_url === "/renewals" || notification.target_url.includes("tab=renewals")
            ? MailCheck
            : Megaphone;

  return <span aria-hidden="true" className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-background text-primary">
    <Icon className="size-4" />
  </span>;
}

function NotificationMutationAction({
  operation,
  notification,
  locale,
  onMessage,
}: {
  operation: "read" | "read-all";
  notification?: string;
  locale: Locale;
  onMessage: (message: string) => void;
}) {
  const [state, action, pending] = useActionState<TaskState, FormData>(mutateTask, {});
  useActionToast(state, locale);
  const en = locale === "en";

  useEffect(() => {
    if (state.success) onMessage(en ? "Notifications marked as read." : "تم تحديد الإشعارات كمقروءة.");
    if (state.error) onMessage(actionFeedback(state.error, locale) ?? state.error);
  }, [en, locale, onMessage, state.error, state.success]);

  return <form action={action} className={operation === "read" ? "hidden sm:block sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100" : undefined}>
    <input type="hidden" name="operation" value={operation} />
    {notification && <input type="hidden" name="notification" value={notification} />}
    <Button type="submit" variant={operation === "read-all" ? "outline" : "ghost"} size={operation === "read-all" ? "sm" : "icon-sm"} disabled={pending} aria-label={operation === "read" ? en ? "Mark as read" : "تحديد كمقروء" : undefined} title={operation === "read" ? en ? "Mark as read" : "تحديد كمقروء" : undefined}>
      {operation === "read-all"
        ? <><Check aria-hidden="true" data-icon="inline-start" />{pending ? en ? "Saving…" : "جارٍ الحفظ…" : en ? "Mark all as read" : "تحديد الكل كمقروء"}</>
        : <Check aria-hidden="true" />}
    </Button>
  </form>;
}

function filterHref(filter: Filter, preview: boolean) {
  const params = new URLSearchParams();
  if (preview) params.set("preview", "1");
  if (filter !== "all") params.set("filter", filter);
  const query = params.toString();
  return query ? `/notifications?${query}` : "/notifications";
}

type NotificationInboxProps = {
  items: TaskNotification[];
  counts: Counts;
  filter: Filter;
  preview?: boolean;
  locale?: Locale;
  page?: number;
  more?: boolean;
};

export function NotificationInbox(props: NotificationInboxProps) {
  return <NotificationInboxState key={`${props.preview ? "preview" : "inbox"}:${props.filter}`} {...props} />;
}

function NotificationInboxState({
  items,
  counts,
  filter,
  preview = false,
  locale = "ar",
  page = 0,
  more = false,
}: NotificationInboxProps) {
  const en = locale === "en";
  const router = useRouter();
  const [sampleItems, setSampleItems] = useState(items);
  const [sampleFilter, setSampleFilter] = useState(filter);
  const [toast, setToast] = useState("");
  const touchStartX = useRef<number | null>(null);
  const swiped = useRef(false);
  const shownCounts = preview
    ? { all: sampleItems.length, unread: sampleItems.filter(item => item.read_at === null).length }
    : counts;
  const activeFilter = preview ? sampleFilter : filter;
  const visibleItems = (preview ? sampleItems : items).filter(item => activeFilter === "all" || item.read_at === null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function markPreviewRead(id?: string) {
    setSampleItems(current => current.map(item => id ? item.id === id ? { ...item, read_at: new Date().toISOString() } : item : { ...item, read_at: item.read_at ?? new Date().toISOString() }));
    setToast(en ? "Preview state updated. Nothing was saved." : "تغيّرت حالة المعاينة فقط؛ لم تُحفظ أي بيانات.");
  }

  async function markNotificationRead(id: string) {
    if (preview) {
      markPreviewRead(id);
      return true;
    }
    const result = await readTaskNotification(id);
    if (result.error) {
      setToast(actionFeedback(result.error, locale) ?? result.error);
      return false;
    }
    return true;
  }

  async function openNotification(notification: TaskNotification) {
    if (swiped.current) {
      swiped.current = false;
      return;
    }
    const href = notificationHref(notification.target_url);
    if (notification.read_at === null && !(await markNotificationRead(notification.id))) return;
    if (href) navigateNotification(href);
  }

  return <div className="flex min-w-0 flex-col gap-4">
    <Card className="min-w-0 gap-0 overflow-hidden py-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <FilterTabs
            value={activeFilter}
            ariaLabel={en ? "Notification filters" : "تصفية الإشعارات"}
            dir={en ? "ltr" : "rtl"}
            options={[
              { value: "all", label: en ? "All" : "الكل", count: shownCounts.all },
              { value: "unread", label: en ? "Unread" : "غير مقروءة", count: shownCounts.unread },
            ]}
            onValueChange={next => {
              if (next !== "all" && next !== "unread") return;
              if (preview) setSampleFilter(next);
              else if (next !== filter) router.push(filterHref(next, false));
            }}
          />
          {shownCounts.unread > 0 && (preview
            ? <Button type="button" variant="outline" size="sm" onClick={() => markPreviewRead()}><Check aria-hidden="true" data-icon="inline-start" />{en ? "Mark all as read" : "تحديد الكل كمقروء"}</Button>
            : <NotificationMutationAction operation="read-all" locale={locale} onMessage={setToast} />)}
        </div>
      </div>

      <CardContent className="p-0">
        {visibleItems.length > 0
          ? <ul aria-label={en ? "Notifications" : "الإشعارات"} className="divide-y divide-border">
            {visibleItems.map(notification => {
              const unread = notification.read_at === null;
              return <li
                key={notification.id}
                className={cn("group transition-colors", unread ? "bg-muted/30" : "text-muted-foreground")}
                onTouchStart={event => { touchStartX.current = event.touches[0]?.clientX ?? null; }}
                onTouchEnd={event => {
                  const start = touchStartX.current;
                  const end = event.changedTouches[0]?.clientX;
                  touchStartX.current = null;
                  if (unread && start !== null && end !== undefined && Math.abs(end - start) > 64) {
                    swiped.current = true;
                    void markNotificationRead(notification.id);
                  }
                }}
              >
                <div className="flex min-w-0 items-center gap-2 px-3 py-2 sm:gap-3 sm:px-5 sm:py-3">
                  <button type="button" onClick={() => void openNotification(notification)} dir={en ? "ltr" : "rtl"} className="flex min-w-0 flex-1 items-start gap-3 rounded-md p-1 text-start transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:gap-4">
                    <NotificationIcon notification={notification} />
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-2">
                        {unread && <span aria-label={en ? "Unread" : "غير مقروء"} title={en ? "Unread" : "غير مقروء"} className="size-2 shrink-0 rounded-full bg-primary" />}
                        <span dir="auto" className={cn("break-words text-sm font-medium leading-6", unread ? "text-foreground" : "text-muted-foreground")}>{notification.title}</span>
                      </span>
                      <span dir="auto" className="mt-1 block break-words text-sm leading-6 text-muted-foreground">{notification.body}</span>
                      <time dateTime={notification.created_at} className="mt-2 block text-xs text-muted-foreground">{notificationDate(notification.created_at, locale)}</time>
                    </span>
                  </button>
                  {unread && !preview && <NotificationMutationAction operation="read" notification={notification.id} locale={locale} onMessage={setToast} />}
                  {unread && preview && <Button type="button" variant="ghost" size="icon-sm" className="hidden sm:inline-flex sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100" aria-label={en ? "Mark as read" : "تحديد كمقروء"} title={en ? "Mark as read" : "تحديد كمقروء"} onClick={() => markPreviewRead(notification.id)}><Check aria-hidden="true" /></Button>}
                </div>
              </li>;
            })}
          </ul>
          : <div role="status" className="flex items-center gap-3 px-4 py-5 text-start">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"><Bell aria-hidden="true" className="size-4" /></span>
            <p className="m-0 text-sm text-muted-foreground">{activeFilter === "unread" ? en ? "You’re all caught up." : "ما عندك إشعارات غير مقروءة." : en ? "No notifications yet." : "لا توجد إشعارات حتى الآن."}</p>
          </div>}
      </CardContent>

      {(page > 0 || more) && <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/20 px-4 py-3 text-xs text-muted-foreground sm:px-5">
        <span>{en ? `Page ${countLabel(page + 1)}` : `الصفحة ${countLabel(page + 1)}`}</span>
        {!preview && <div className="flex items-center gap-2">
          {page > 0 && <Link href={`/notifications?${new URLSearchParams({ filter: activeFilter, page: String(page - 1) })}`} className={buttonVariants({ variant: "outline", size: "sm" })}>{en ? "Previous" : "السابق"}</Link>}
          {more && <Link href={`/notifications?${new URLSearchParams({ filter: activeFilter, page: String(page + 1) })}`} className={buttonVariants({ variant: "outline", size: "sm" })}>{en ? "Next" : "التالي"}</Link>}
        </div>}
      </div>}
    </Card>

    {toast && <div role="status" aria-live="polite" className="fixed inset-x-4 bottom-4 z-50 mx-auto w-fit max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-card px-4 py-3 text-sm text-card-foreground shadow-lg sm:inset-x-auto sm:end-6">{toast}</div>}
  </div>;
}
