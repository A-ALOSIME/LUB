"use client";

import {ContentText} from "@/components/content-text";

import {formatNumber,t as translateUi} from "@/lib/i18n";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, CalendarDays, Check, ClipboardCheck, Clock3, MailCheck, Megaphone, UsersRound } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { cn } from "cn";
import { actionFeedback } from "@/lib/action-feedback";
import type { Locale } from "@/lib/preferences";
import { mutateTask, readTaskNotification } from "./actions";
import { navigateNotification } from "./notification-navigation";
import { notificationDate, notificationHref } from "./notification-display";
import type { TaskNotification } from "./repository";
export { notificationDate, notificationHref } from "./notification-display";

type Filter = "all" | "unread";
type Counts = { all: number; unread: number };



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

function filterHref(filter: Filter, preview: boolean, page=0) {
  const params = new URLSearchParams();
  if (preview) params.set("preview", "1");
  if (filter !== "all") params.set("filter", filter);
  if(page>0)params.set("page",String(page));
  const query = params.toString();
  return query ? `/notifications?${query}` : "/notifications";
}

type NotificationInboxProps = {
  items: TaskNotification[];
  unreadItems?: TaskNotification[];
  unreadMore?: boolean;
  pages?: Record<Filter,number>;
  counts: Counts;
  filter: Filter;
  preview?: boolean;
  locale?: Locale;
  page?: number;
  more?: boolean;
};

export function NotificationInbox(props: NotificationInboxProps) {
  return <NotificationInboxState key={props.preview ? "preview" : "inbox"} {...props} />;
}

function NotificationInboxState({
  items,
  unreadItems,
  unreadMore,
  pages,
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
  const touchStartX = useRef<number | null>(null);
  const swiped = useRef(false);
  const [readOverrides,setReadOverrides]=useState<Record<string,string>>({});
  const [allRead,setAllRead]=useState<string|null>(null);
  const pendingReads=useRef(new Set<string>()),pendingAll=useRef(false);
  const known=new Map([...items,...(unreadItems??[])].map(item=>[item.id,item]));
  const snapshot=JSON.stringify([counts,...[...known.values()].map(item=>[item.id,item.read_at])]);
  const delta=Object.keys(readOverrides).filter(id=>known.get(id)?.read_at===null).length;
  const shownCounts = preview
    ? { all: sampleItems.length, unread: sampleItems.filter(item => item.read_at === null).length }
    : {all:counts.all,unread:allRead===snapshot?0:Math.max(0,counts.unread-delta)};
  const activeFilter = sampleFilter;
  const activePage=pages?.[activeFilter]??page;
  const activeMore=activeFilter==="unread"?(unreadMore??more):more;
  const baseItems=preview?sampleItems:activeFilter==="unread"?(unreadItems??items):items;
  const visibleItems=baseItems.map(item=>!preview&&(readOverrides[item.id]||allRead===snapshot)?{...item,read_at:readOverrides[item.id]??"read"}:item).filter(item=>activeFilter==="all"||item.read_at===null);
  const [previousFilter,setPreviousFilter]=useState(filter);
  if(previousFilter!==filter){setPreviousFilter(filter);setSampleFilter(filter);}
  useEffect(()=>{const restore=()=>setSampleFilter(new URL(window.location.href).searchParams.get("filter")==="unread"?"unread":"all");window.addEventListener("popstate",restore);return()=>window.removeEventListener("popstate",restore);},[]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function markPreviewRead(id?: string) {
    setSampleItems(current => current.map(item => id ? item.id === id ? { ...item, read_at: new Date().toISOString() } : item : { ...item, read_at: item.read_at ?? new Date().toISOString() }));
    setToast(translateUi((en) ? "en" : "ar", "تغيّرت حالة المعاينة فقط؛ لم تُحفظ أي بيانات.", "Preview state updated. Nothing was saved."));
  }

  async function markNotificationRead(id: string) {
    if (preview) {
      markPreviewRead(id);
      return true;
    }
    if(pendingReads.current.has(id))return false;
    pendingReads.current.add(id);
    setReadOverrides(current=>({...current,[id]:new Date().toISOString()}));
    try{
      const result=await readTaskNotification(id);
      if(result.error)throw new Error(result.error);
      return true;
    }catch(error){
      setReadOverrides(current=>{const next={...current};delete next[id];return next;});
      setToast(actionFeedback(error instanceof Error?error.message:"تعذّر تحديث الإشعار. حدّث الصفحة وحاول مرة ثانية.",locale)??"");
      return false;
    }finally{pendingReads.current.delete(id);}
  }
  async function markAllRead(){
    if(preview){markPreviewRead();return;}
    if(pendingAll.current)return;
    pendingAll.current=true;setAllRead(snapshot);
    try{const form=new FormData();form.set("operation","read-all");const result=await mutateTask({},form);if(result.error)throw new Error(result.error);setToast(translateUi(locale,"تم تحديد الإشعارات كمقروءة.","Notifications marked as read."));}
    catch(error){setAllRead(null);setToast(actionFeedback(error instanceof Error?error.message:"تعذّر تحديث الإشعار. حدّث الصفحة وحاول مرة ثانية.",locale)??"");}
    finally{pendingAll.current=false;}
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
            ariaLabel={translateUi((en) ? "en" : "ar", "تصفية الإشعارات", "Notification filters")}
            dir={en ? "ltr" : "rtl"}
            options={[
              { value: "all", label: translateUi((en) ? "en" : "ar", "الكل", "All"), count: shownCounts.all },
              { value: "unread", label: translateUi((en) ? "en" : "ar", "غير مقروءة", "Unread"), count: shownCounts.unread },
            ]}
            onValueChange={next => {
              if (next !== "all" && next !== "unread") return;
              setSampleFilter(next);
              if(!preview)window.history.pushState(window.history.state,"",filterHref(next,false,pages?.[next]??0));
            }}
          />
          {shownCounts.unread>0&&<Button type="button" variant="outline" size="sm" onClick={()=>void markAllRead()}><Check aria-hidden="true" data-icon="inline-start"/>{translateUi(locale,"تحديد الكل كمقروء","Mark all as read")}</Button>}
        </div>
      </div>

      <CardContent className="p-0">
        {visibleItems.length > 0
          ? <ul aria-label={translateUi((en) ? "en" : "ar", "الإشعارات", "Notifications")} className="divide-y divide-border">
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
                        {unread && <span aria-label={translateUi((en) ? "en" : "ar", "غير مقروء", "Unread")} title={translateUi((en) ? "en" : "ar", "غير مقروء", "Unread")} className="size-2 shrink-0 rounded-full bg-primary" />}
                        <span dir="auto" className={cn("break-words text-sm font-medium leading-6", unread ? "text-foreground" : "text-muted-foreground")}><ContentText value={notification.title}/></span>
                      </span>
                      <span dir="auto" className="mt-1 block break-words text-sm leading-6 text-muted-foreground"><ContentText value={notification.body}/></span>
                      <time dateTime={notification.created_at} className="mt-2 block text-xs text-muted-foreground">{notificationDate(notification.created_at, locale)}</time>
                    </span>
                  </button>
                  {unread && <Button type="button" variant="ghost" size="icon-sm" className="hidden sm:inline-flex sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100" aria-label={translateUi((en) ? "en" : "ar", "تحديد كمقروء", "Mark as read")} title={translateUi((en) ? "en" : "ar", "تحديد كمقروء", "Mark as read")} onClick={() => void markNotificationRead(notification.id)}><Check aria-hidden="true" /></Button>}
                </div>
              </li>;
            })}
          </ul>
          : <div role="status" className="flex items-center gap-3 px-4 py-5 text-start">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"><Bell aria-hidden="true" className="size-4" /></span>
            <p className="m-0 text-sm text-muted-foreground">{activeFilter === "unread" ? translateUi((en) ? "en" : "ar", "ما عندك إشعارات غير مقروءة.", "You’re all caught up.") : translateUi((en) ? "en" : "ar", "لا توجد إشعارات حتى الآن.", "No notifications yet.")}</p>
          </div>}
      </CardContent>

      {(activePage > 0 || activeMore) && <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/20 px-4 py-3 text-xs text-muted-foreground sm:px-5">
        <span>{translateUi((en) ? "en" : "ar", `الصفحة ${formatNumber(activePage + 1,locale)}`, `Page ${formatNumber(activePage + 1,locale)}`)}</span>
        {!preview && <div className="flex items-center gap-2">
          {activePage > 0 && <Link href={`/notifications?${new URLSearchParams({ filter: activeFilter, page: String(activePage - 1) })}`} className={buttonVariants({ variant: "outline", size: "sm" })}>{translateUi((en) ? "en" : "ar", "السابق", "Previous")}</Link>}
          {activeMore && <Link href={`/notifications?${new URLSearchParams({ filter: activeFilter, page: String(activePage + 1) })}`} className={buttonVariants({ variant: "outline", size: "sm" })}>{translateUi((en) ? "en" : "ar", "التالي", "Next")}</Link>}
        </div>}
      </div>}
    </Card>

    {toast && <div role="status" aria-live="polite" className="fixed inset-x-4 bottom-4 z-50 mx-auto w-fit max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-card px-4 py-3 text-sm text-card-foreground shadow-lg sm:inset-x-auto sm:end-6">{toast}</div>}
  </div>;
}
