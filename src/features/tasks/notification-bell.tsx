"use client"

import {ContentText} from "@/components/content-text";

import {formatNumber,t as translateUi} from "@/lib/i18n";
import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, CalendarDays, ClipboardCheck, Clock3, MailCheck, Megaphone, UsersRound } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import type { Locale } from "@/lib/preferences"
import { readTaskNotification } from "./actions"
import { notificationDate, notificationHref } from "./notification-display"
import type { TaskNotification } from "./repository"

function NotificationIcon({ notification }: { notification: TaskNotification }) {
  const url = notification.target_url
  const type = notification.type_code.toLowerCase()
  const Icon = type.includes("event") || url.startsWith("/events")
    ? CalendarDays
    : type.includes("hour") || url.startsWith("/hours")
      ? Clock3
      : type.includes("application") || url.startsWith("/applications")
        ? UsersRound
        : type.includes("task") || url.startsWith("/tasks")
          ? ClipboardCheck
          : type.includes("renew") || url.startsWith("/renewals")
            ? MailCheck
            : Megaphone
  return <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"><Icon /></span>
}

export function NotificationBell({ items, unreadCount, locale }: { items: TaskNotification[]; unreadCount: number; locale: Locale }) {
  const en = locale === "en"
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState("")
  const [readIds,setReadIds]=useState<Set<string>>(()=>new Set());
  const count=Math.max(0,unreadCount-items.filter(n=>n.read_at===null&&readIds.has(n.id)).length);
  const visibleItems=items.map(n=>readIds.has(n.id)?{...n,read_at:n.read_at??"read"}:n);
  const number = formatNumber(count,locale)

  async function openNotification(notification: TaskNotification) {
    setError("")
    if (notification.read_at === null) {
      setReadIds(current=>new Set(current).add(notification.id));
      const result = await readTaskNotification(notification.id).catch(()=>({error:"unavailable"}))
      if (result.error) {
        setReadIds(current=>{const next=new Set(current);next.delete(notification.id);return next;});
        setError(translateUi((en) ? "en" : "ar", "تعذّر تحديث الإشعار.", "Could not update this notification."))
        return
      }
    }
    setOpen(false)
    const href = notificationHref(notification.target_url)
    if (href) router.push(href)
  }

  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger render={<Button type="button" variant="ghost" size="icon" aria-label={count ? (translateUi((en) ? "en" : "ar", `${number} إشعارات غير مقروءة`, `${number} unread notifications`)) : (translateUi((en) ? "en" : "ar", "الإشعارات", "Notifications"))} className="relative h-9 w-9 rounded-md hover:bg-accent" />}>
      <Bell aria-hidden="true" />
      {count > 0 && <span dir="ltr" aria-hidden="true" className="absolute -end-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">{count > 99 ? "99+" : number}</span>}
    </PopoverTrigger>
    <PopoverContent dir={en ? "ltr" : "rtl"} align="end" sideOffset={8} className="w-[min(23rem,calc(100vw-2rem))] gap-0 overflow-hidden p-0">
      <PopoverHeader className="border-b border-border/70 p-3">
        <PopoverTitle className="flex items-center justify-between gap-2">
          <span>{translateUi((en) ? "en" : "ar", "الإشعارات", "Notifications")}</span>
          <Badge variant={count ? "secondary" : "outline"}>{number}</Badge>
        </PopoverTitle>
        <PopoverDescription>{translateUi((en) ? "en" : "ar", "آخر تحديثات نشاطك.", "Your latest updates.")}</PopoverDescription>
      </PopoverHeader>
      {visibleItems.length > 0 ? <ul aria-label={translateUi((en) ? "en" : "ar", "آخر الإشعارات", "Latest notifications")} className="flex max-h-80 flex-col overflow-y-auto divide-y divide-border/70">
        {visibleItems.slice(0, 5).map(notification => <li key={notification.id}>
          <button type="button" onClick={() => void openNotification(notification)} className="flex w-full min-w-0 items-start gap-2.5 px-3 py-2.5 text-start transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
            <NotificationIcon notification={notification} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                {notification.read_at === null && <span aria-label={translateUi((en) ? "en" : "ar", "غير مقروء", "Unread")} className="size-1.5 shrink-0 rounded-full bg-primary" />}
                <span dir="auto" className="line-clamp-1 text-sm font-medium"><ContentText value={notification.title}/></span>
              </span>
              <span dir="auto" className="mt-0.5 line-clamp-2 block text-xs leading-5 text-muted-foreground"><ContentText value={notification.body}/></span>
              <time dateTime={notification.created_at} className="mt-1 block text-[11px] text-muted-foreground">{notificationDate(notification.created_at, locale)}</time>
            </span>
          </button>
        </li>)}
      </ul> : <p role="status" className="px-3 py-3 text-sm text-muted-foreground">{translateUi((en) ? "en" : "ar", "لا توجد إشعارات حتى الآن.", "No notifications yet.")}</p>}
      {error && <p role="alert" className="px-3 py-2 text-xs text-destructive">{error}</p>}
      <div className="border-t border-border/70 p-2">
        <Link href="/notifications" onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 text-center text-sm font-medium text-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{translateUi((en) ? "en" : "ar", "عرض الكل", "View all")}</Link>
      </div>
    </PopoverContent>
  </Popover>
}
