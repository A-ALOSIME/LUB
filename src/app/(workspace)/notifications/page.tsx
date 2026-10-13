import { localizedMetadata } from "@/lib/localized-metadata";
import { requireStudentManagementUser as requireManagementUser } from "@/features/organizations/access";
import { taskNotificationCounts, taskNotifications } from "@/features/tasks/repository";
import { previewNotifications } from "@/features/tasks/notification-preview";
import { NotificationInbox } from "@/features/tasks/notification-inbox";
import { getPreferences } from "@/lib/preferences";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { z } from "zod";

export async function generateMetadata() {
  return localizedMetadata("الإشعارات", "Notifications");
}

export default async function NotificationsPage({ searchParams }: {
  searchParams: Promise<{ page?: string; filter?: string; preview?: string }>;
}) {
  const [user, { locale }] = await Promise.all([requireManagementUser(), getPreferences()]);
  const en = locale === "en";
  const query = await searchParams;
  const preview = query.preview === "1";
  const filter = query.filter === "unread" ? "unread" : "all";
  const page = z.coerce.number().int().min(0).max(10000).catch(0).parse(query.page ?? 0);

  const [items, counts] = preview
    ? [previewNotifications, {
      all: previewNotifications.length,
      unread: previewNotifications.filter(notification => notification.read_at === null).length,
    }] as const
    : await Promise.all([
      taskNotifications(user.id, page, filter === "unread"),
      taskNotificationCounts(user.id),
    ]);

  return <main id="main" dir={en ? "ltr" : "rtl"} className="min-w-0 space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{en ? "Notifications" : "الإشعارات"}</h1>
        <p className="text-sm text-muted-foreground">{en ? "Follow updates about your applications, events, tasks, and hours." : "تابع تحديثات طلباتك وفعالياتك ومهامك وساعاتك."}</p>
      </div>
      {preview
        ? <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/notifications">{en ? "Back to my notifications" : "العودة إلى إشعاراتي"}</Link>
        : <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/notifications?preview=1">{en ? "Preview sample notifications" : "معاينة بإشعارات نموذجية"}</Link>}
    </header>

    <NotificationInbox
      items={items.slice(0, 25)}
      counts={counts}
      filter={filter}
      preview={preview}
      locale={locale}
      page={page}
      more={items.length > 25}
    />
  </main>;
}
