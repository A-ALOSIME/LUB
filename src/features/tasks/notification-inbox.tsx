"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { Bell, CalendarDays, Check, ClipboardCheck, Clock3, MailCheck, Megaphone, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "cn";
import { actionFeedback } from "@/lib/action-feedback";
import type { Locale } from "@/lib/preferences";
import { mutateTask, type TaskState } from "./actions";
import type { TaskNotification } from "./repository";

type Filter = "all" | "unread";
type Counts = { all: number; unread: number };

function countLabel(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function notificationDate(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ar-SA-u-nu-latn", {
    dateStyle: "medium",
    timeStyle: "short",
    calendar: "gregory",
    timeZone: "Asia/Riyadh",
  }).format(new Date(value));
}

function NotificationIcon({ notification }: { notification: TaskNotification }) {
  const Icon = notification.type_code.toLowerCase().includes("event") || notification.target_url.startsWith("/events")
    ? CalendarDays
    : notification.type_code.toLowerCase().includes("hour") || notification.target_url === "/hours"
      ? Clock3
      : notification.type_code.toLowerCase().includes("application") || notification.target_url === "/applications"
        ? UsersRound
        : notification.type_code.toLowerCase().includes("task") || notification.target_url.startsWith("/tasks")
          ? ClipboardCheck
          : notification.type_code.toLowerCase().includes("renew") || notification.target_url === "/renewals"
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
  const en = locale === "en";

  useEffect(() => {
    if (state.success) onMessage(en ? "Notifications marked as read." : "تم تحديد الإشعارات كمقروءة.");
    if (state.error) onMessage(actionFeedback(state.error, locale) ?? state.error);
  }, [en, locale, onMessage, state.error, state.success]);

  return <form action={action}>
    <input type="hidden" name="operation" value={operation} />
    {notification && <input type="hidden" name="notification" value={notification} />}
    <Button type="submit" variant={operation === "read-all" ? "outline" : "ghost"} size={operation === "read-all" ? "sm" : "icon-sm"} disabled={pending} aria-label={operation === "read" ? en ? "Mark as read" : "تحديد كمقروء" : undefined}>
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
  const [sampleItems, setSampleItems] = useState(items);
  const [sampleFilter, setSampleFilter] = useState(filter);
  const [toast, setToast] = useState("");
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

  return <div className="flex min-w-0 flex-col gap-4">
    {preview && <div role="note" className="flex items-start gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3.5 text-sm text-muted-foreground">
      <Bell aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
      <p>{en ? "Sample notifications for preview. They are not stored in your account; actions change this preview only." : "إشعارات نموذجية للمعاينة فقط. لا تُحفظ في حسابك، والتغييرات هنا تخص المعاينة فقط."}</p>
    </div>}

    <Card className="min-w-0 gap-0 overflow-hidden py-0">
      <CardHeader className="gap-4 border-b p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>{en ? "Your inbox" : "صندوق الإشعارات"}</CardTitle>
            <p className="text-sm text-muted-foreground">{en ? "Updates about your applications, events, tasks, and hours." : "آخر المستجدات عن طلباتك وفعالياتك ومهامك وساعاتك."}</p>
          </div>
          {shownCounts.unread > 0 && (preview
            ? <Button type="button" variant="outline" size="sm" onClick={() => markPreviewRead()}><Check aria-hidden="true" data-icon="inline-start" />{en ? "Mark all as read" : "تحديد الكل كمقروء"}</Button>
            : <NotificationMutationAction operation="read-all" locale={locale} onMessage={setToast} />)}
        </div>

        <nav aria-label={en ? "Notification filters" : "تصفية الإشعارات"} className="-mb-4 max-w-full overflow-x-auto">
          <ul className="flex min-w-max items-center gap-1 border-b border-border">
            {(["all", "unread"] as const).map(value => {
              const active = activeFilter === value;
              const label = value === "all" ? en ? "All" : "الكل" : en ? "Unread" : "غير مقروءة";
              const count = value === "all" ? shownCounts.all : shownCounts.unread;
              return <li key={value}>
                {preview
                  ? <button type="button" aria-pressed={active} onClick={() => setSampleFilter(value)} className={cn("inline-flex h-10 items-center gap-2 border-b-2 px-3 text-sm font-medium whitespace-nowrap transition-colors", active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
                    {label}<Badge variant={active ? "secondary" : "outline"} className="h-5 min-w-5 justify-center px-1.5 text-[0.7rem] leading-none">{countLabel(count)}</Badge>
                  </button>
                  : <Link href={filterHref(value, false)} aria-current={active ? "page" : undefined} className={cn("inline-flex h-10 items-center gap-2 border-b-2 px-3 text-sm font-medium whitespace-nowrap transition-colors", active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
                    {label}<Badge variant={active ? "secondary" : "outline"} className="h-5 min-w-5 justify-center px-1.5 text-[0.7rem] leading-none">{countLabel(count)}</Badge>
                  </Link>}
              </li>;
            })}
          </ul>
        </nav>
      </CardHeader>

      <CardContent className="p-0">
        {visibleItems.length > 0
          ? <ul aria-label={en ? "Notifications" : "الإشعارات"} className="divide-y divide-border">
            {visibleItems.map(notification => {
              const unread = notification.read_at === null;
              return <li key={notification.id} className={cn("transition-colors", unread && "bg-primary/[0.035]")}>
                <div className="flex items-start gap-3 px-4 py-4 sm:gap-4 sm:px-5">
                  <NotificationIcon notification={notification} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={notification.target_url} dir="auto" className="break-words text-sm font-medium leading-6 hover:text-primary hover:underline hover:underline-offset-4">{notification.title}</Link>
                      <Badge variant="outline" className={cn("h-5 px-2 text-xs", unread ? "border-primary/40 bg-primary/5 text-primary" : "text-muted-foreground")}>
                        {unread ? en ? "Unread" : "جديد" : en ? "Read" : "مقروء"}
                      </Badge>
                    </div>
                    <p dir="auto" className="mt-1 break-words text-sm leading-6 text-muted-foreground">{notification.body}</p>
                    <time dateTime={notification.created_at} className="mt-2 block text-xs text-muted-foreground">{notificationDate(notification.created_at, locale)}</time>
                  </div>
                  {unread && (preview
                    ? <Button type="button" variant="ghost" size="icon-sm" aria-label={en ? "Mark as read" : "تحديد كمقروء"} onClick={() => markPreviewRead(notification.id)}><Check aria-hidden="true" /></Button>
                    : <NotificationMutationAction operation="read" notification={notification.id} locale={locale} onMessage={setToast} />)}
                </div>
              </li>;
            })}
          </ul>
          : <div role="status" className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground"><Bell aria-hidden="true" className="size-5" /></span>
            <h2 className="text-sm font-medium">{activeFilter === "unread" ? en ? "You’re all caught up." : "ما عندك إشعارات غير مقروءة." : en ? "No notifications yet." : "لا توجد إشعارات حتى الآن."}</h2>
            <p className="max-w-sm text-sm text-muted-foreground">{activeFilter === "unread" ? en ? "New updates will appear here." : "ستظهر هنا عندما يصلك تحديث جديد." : en ? "Updates about your activity will appear here." : "تظهر هنا التحديثات المتعلقة بنشاطك."}</p>
          </div>}
      </CardContent>

      {(preview || page > 0 || more) && <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/20 px-4 py-3 text-xs text-muted-foreground sm:px-5">
        {preview
          ? <span>{en ? "Preview examples" : "أمثلة للمعاينة"}</span>
          : <span>{en ? `Page ${countLabel(page + 1)}` : `الصفحة ${countLabel(page + 1)}`}</span>}
        {!preview && <div className="flex items-center gap-2">
          {page > 0 && <Link href={`/notifications?${new URLSearchParams({ filter: activeFilter, page: String(page - 1) })}`} className={buttonVariants({ variant: "outline", size: "sm" })}>{en ? "Previous" : "السابق"}</Link>}
          {more && <Link href={`/notifications?${new URLSearchParams({ filter: activeFilter, page: String(page + 1) })}`} className={buttonVariants({ variant: "outline", size: "sm" })}>{en ? "Next" : "التالي"}</Link>}
        </div>}
      </div>}
    </Card>

    {toast && <div role="status" aria-live="polite" className="fixed inset-x-4 bottom-4 z-50 mx-auto w-fit max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-card px-4 py-3 text-sm text-card-foreground shadow-lg sm:inset-x-auto sm:end-6">{toast}</div>}
  </div>;
}
