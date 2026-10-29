import {t as translateUi} from "@/lib/i18n";
import { notFound } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {EventRegistrantPanel} from "@/features/events/registrant-panel";
import { eventDetail } from "@/features/events/repository";
import { EventContent } from "@/features/events/view";
import { loadManagementPageData } from "@/features/organizations/access";
import { getPreferences } from "@/lib/preferences";
export default async function ManagedEvent({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; event: string }>;
  searchParams: Promise<Record<string,string|undefined>>;
}) {
  const [{ id, event }, { locale }, query] = await Promise.all([
    params,
    getPreferences(),
    searchParams,
  ]);
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(event).success)
    notFound();
  const { user,data } = await loadManagementPageData((user) =>
    eventDetail(user, event),
  );
  if (
    !data ||
    data.event.organization_id !== id ||
    !(data.canManage || data.canAttend || data.canContribute)
  )
    notFound();
  return (
    <div className="workspace-content">
      <Button
        nativeButton={false}
        variant="ghost"
        className="self-start"
        render={<Link href={`/manage/organizations/${id}/events`} />}
      >
        {translateUi((locale === "en") ? "en" : "ar", "العودة للفعاليات", "Back to events")}
      </Button>
      <EventContent
        data={data}
        user
        management
        attendeesContent={<EventRegistrantPanel user={user.id} organization={id} event={event} search={query} locale={locale}/>}
        locale={locale}
        initialAction={
          query.action === "edit" || query.action === "settings"
            ? query.action
            : undefined
        }
      />
    </div>
  );
}
