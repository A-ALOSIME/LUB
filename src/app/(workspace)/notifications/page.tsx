import {t as translateUi} from "@/lib/i18n";
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

  return <main id="main" dir={en ? "ltr" : "rtl"} className="min-w-0 space-y-5">
    <header className="workspace-page-header">
      <h1>{translateUi((en) ? "en" : "ar", "الإشعارات", "Notifications")}</h1>
      {!preview && <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/notifications?preview=1">{translateUi((en) ? "en" : "ar", "إشعارات نموذجية", "Sample notifications")}</Link>}
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
