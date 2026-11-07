import {createTranslator} from "@/lib/i18n";


import { Clock3, ClipboardCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { OrganizationSectionTabPanel, OrganizationSectionTabs } from "@/features/organizations/organization-section-tabs";
import { loadManagementPageData } from "@/features/organizations/access";
import {TaskComposer} from "@/features/tasks/task-composer";
import {TaskManagementList} from "@/features/tasks/management-list";
import { taskWorkspace, listTasks } from "@/features/tasks/repository";
import { hoursWorkspace } from "@/features/hours/repository";
import { HoursWorkspaceView } from "@/features/hours/workspace-view";


import { getPreferences } from "@/lib/preferences";
import { localizedMetadata } from "@/lib/localized-metadata";

export async function generateMetadata() {
  return localizedMetadata("المهام والساعات", "Tasks and hours");
}

export default async function ManageTasksPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    page?: string; taskPage?: string; section?: string;
    taskSearch?:string;taskStatus?:string;taskSort?:string;
  }>;
}) {
  const [{ locale }, { id }, query] = await Promise.all([getPreferences(), params, searchParams]);
  const en = locale === "en";
  const c = createTranslator(en ? "en" : "ar");
  if (!z.uuid().safeParse(id).success) notFound();

  const number = (value?: string) => z.coerce.number().int().min(0).max(10000).catch(0).parse(value ?? "0");
  const taskPage = number(query.taskPage ?? query.page);
  const taskFilters={q:(query.taskSearch??"").slice(0,120),status:["Draft","Open","Completed","Cancelled"].includes(query.taskStatus??"")?query.taskStatus!:"",page:taskPage,sort:query.taskSort==="asc"?"asc" as const:"desc" as const};
  const { data: [workspace, tasks, hours] } = await loadManagementPageData(userId => Promise.all([
    taskWorkspace(userId, id),
    listTasks(userId, { org: id, view: "all", ...taskFilters }),
    hoursWorkspace(userId, id),
  ]));
  const taskAccess = Boolean(workspace?.scopes.length);
  const hoursAccess = Boolean(hours);
  if (!taskAccess && !hoursAccess) notFound();

  const taskCreateAction = workspace && taskAccess && <TaskComposer org={id} workspace={workspace} locale={locale}/>;

  const items = [
    ...(taskAccess ? [{ id: "tasks", label: c("المهام", "Tasks"), icon: <ClipboardCheck aria-hidden="true" /> }] : []),
    ...(hoursAccess ? [{ id: "hours", label: c("الساعات", "Hours"), icon: <Clock3 aria-hidden="true" /> }] : []),
  ];
  const defaultSection = taskAccess ? "tasks" : "hours";
  const initialSection = query.section === "hours" && hoursAccess ? "hours" : defaultSection;

  const taskToolbarAction = taskCreateAction;

  return <div className="min-w-0 space-y-5">
    <OrganizationSectionTabs items={items} initialSection={initialSection} defaultSection={defaultSection} sticky={false} label={c("المهام والساعات", "Tasks and hours")} dir={en ? "ltr" : "rtl"}>
      {taskAccess && <OrganizationSectionTabPanel id="tasks">
        <section aria-label={c("قائمة مهام الجهة", "Organization task list")} className="space-y-4">
          <TaskManagementList initialFilters={taskFilters} organization={id} initial={tasks??{items:[],more:false}} page={taskPage} locale={locale} actions={taskToolbarAction}/>
        </section>
      </OrganizationSectionTabPanel>}
      {hoursAccess && <OrganizationSectionTabPanel id="hours">
        {hours ? <HoursWorkspaceView data={hours} org={id} locale={locale} /> : null}
      </OrganizationSectionTabPanel>}
    </OrganizationSectionTabs>
  </div>;
}
