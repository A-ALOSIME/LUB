import { localizedMetadata } from "@/lib/localized-metadata"
import { z } from "zod"
import { requireStudentUser } from "@/features/auth/authorization"
import { getPreferences } from "@/lib/preferences"
import { checkReadiness } from "@/features/hours/view"
import { listTasks } from "@/features/tasks/repository"
import { myEvents } from "@/features/events/repository"
import { myHours } from "@/features/hours/repository"
import { myDocuments } from "@/features/documents/repository"
import { ActivityTabs, type ActivityTab } from "@/features/activity/activity-tabs"
import { ActivityEventRows, ActivityHours } from "@/features/activity/activity-views"
import { TaskBrowser } from "@/features/tasks/task-browser"

export async function generateMetadata() {
  return localizedMetadata("نشاطي", "My activity")
}

type ActivitySearchParams = {
  tab?: string | string[]
  page?: string | string[]
  term?: string | string[]
  hourStatus?: string | string[]
  taskFilter?: string | string[]
  mine?: string | string[]
  documents?: string | string[]
  docPage?: string | string[]
}

const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value

export default async function ActivityPage({ searchParams }: { searchParams: Promise<ActivitySearchParams> }) {
  const [user, { locale }] = await Promise.all([requireStudentUser(), getPreferences()])
  const query = await searchParams
  const requestedTab = first(query.tab)
  const initialTab: ActivityTab = requestedTab === "events" || requestedTab === "hours" ? requestedTab : "tasks"
  const page = z.coerce.number().int().min(0).max(10000).catch(0).parse(first(query.page) ?? 0)
  const documentsPage = z.coerce.number().int().min(0).max(10000).catch(0).parse(first(query.docPage) ?? 0)
  const term = z.uuid().nullable().catch(null).parse(first(query.term) ?? null)
  const requestedStatus = first(query.hourStatus)
  const hourStatus = requestedStatus === "approved" || requestedStatus === "pending" || requestedStatus === "rejected" ? requestedStatus : "all"
  const hourStatusCode = hourStatus === "approved" ? "Approved" : hourStatus === "pending" ? "Pending" : hourStatus === "rejected" ? "Rejected" : null
  const taskFilter = first(query.taskFilter) === "mine" || first(query.mine) === "1" ? "mine" : "available"

  const [availableTasks, myTasks, eventData, hoursData, documentData] = await Promise.all([
    listTasks(user.id, { view: "available", page }),
    listTasks(user.id, { view: "mine", page }),
    myEvents(user.id, page),
    myHours(user.id, term, page, hourStatusCode),
    myDocuments(user.id, documentsPage),
  ])

  checkReadiness(eventData)
  checkReadiness(hoursData?.account)
  checkReadiness(documentData?.account)
  if (!hoursData) throw new Error("Hours storage unavailable")
  if (!documentData) throw new Error("Documents storage unavailable")

  const en = locale === "en"
  return <main id="main" dir={en ? "ltr" : "rtl"} className="mx-auto flex w-full min-w-0 max-w-4xl flex-col gap-4 pb-20 lg:pb-0">
    <header className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold tracking-tight">{en ? "My activity" : "نشاطي"}</h1>
      <p className="text-sm text-muted-foreground">{en ? "Tasks, event registrations, and approved hours in one place." : "مهامك وفعالياتك وساعاتك في مكان واحد."}</p>
    </header>
    <ActivityTabs
      initialTab={initialTab}
      locale={locale}
      tasks={<TaskBrowser
        key={`${page}:${taskFilter}`}
        initialView={taskFilter}
        page={page}
        availableItems={availableTasks.items}
        availableMore={availableTasks.more}
        mineItems={myTasks.items}
        mineMore={myTasks.more}
        locale={locale}
        base="/activity"
        baseQuery={{ tab: "tasks" }}
        compact
      />}
      events={<ActivityEventRows events={eventData.events} page={page} locale={locale} />}
      hours={<ActivityHours
        data={hoursData}
        page={page}
        term={term}
        status={hourStatus}
        documents={documentData.items}
        documentsPage={documentsPage}
        locale={locale}
      />}
    />
  </main>
}
