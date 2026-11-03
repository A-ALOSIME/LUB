import {createTranslator} from "@/lib/i18n";


import { RowAction } from "@/components/row-action";
import { formatHours } from "@/lib/display";
import { Clock3, ClipboardCheck, LayoutTemplate, Pencil, Copy, Plus } from "lucide-react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ManagementActionSheet } from "@/components/management-action-sheet";
import { WorkspaceEmptyState } from "@/components/workspace-empty-state";
import { NativeSelect } from "@/components/ui/native-select";
import { OrganizationSectionTabPanel, OrganizationSectionTabs } from "@/features/organizations/organization-section-tabs";
import { loadManagementPageData } from "@/features/organizations/access";
import {Badge} from "@/components/ui/badge";
import {TaskComposer} from "@/features/tasks/task-composer";
import { TaskFields } from "@/features/tasks/task-fields";
import { TaskForm } from "@/features/tasks/task-form";
import {TaskManagementList} from "@/features/tasks/management-list";
import { taskWorkspace, listTasks } from "@/features/tasks/repository";
import { hoursWorkspace } from "@/features/hours/repository";
import { HoursWorkspaceView } from "@/features/hours/workspace-view";


import { getPreferences } from "@/lib/preferences";
import { localizedMetadata } from "@/lib/localized-metadata";
import { FormField } from "@/components/form-field";

export async function generateMetadata() {
  return localizedMetadata("المهام والساعات", "Tasks and hours");
}

export default async function ManageTasksPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    page?: string; taskPage?: string; hoursPage?: string; template?: string; section?: string;
    taskSearch?:string;taskStatus?:string;taskSort?:string;memberPage?: string; rulePage?: string; term?: string; committee?: string; hourStatus?: string; q?:string;
  }>;
}) {
  const [{ locale }, { id }, query] = await Promise.all([getPreferences(), params, searchParams]);
  const en = locale === "en";
  const c = createTranslator(en ? "en" : "ar");
  if (!z.uuid().safeParse(id).success) notFound();

  const number = (value?: string) => z.coerce.number().int().min(0).max(10000).catch(0).parse(value ?? "0");
  const uuid = (value?: string) => z.uuid().nullable().catch(null).parse(value ?? null);
  const hourStatus = (["Approved", "Pending", "Rejected"] as const).find(status => status === query.hourStatus) ?? null;
  const taskPage = number(query.taskPage ?? query.page);
  const taskFilters={q:(query.taskSearch??"").slice(0,120),status:["Draft","Open","Completed","Cancelled"].includes(query.taskStatus??"")?query.taskStatus!:"",page:taskPage,sort:query.taskSort==="asc"?"asc" as const:"desc" as const};
  const filters = {
    page: number(query.hoursPage),
    memberPage: number(query.memberPage),
    rulePage: number(query.rulePage),
    term: uuid(query.term),
    committee: uuid(query.committee),
    status: hourStatus,
    q:typeof query.q==="string"?query.q.trim().slice(0,120):"",
  };
  const { data: [workspace, tasks, hoursResult] } = await loadManagementPageData(userId => Promise.all([
    taskWorkspace(userId, id),
    listTasks(userId, { org: id, view: "all", ...taskFilters }),
    hoursWorkspace(userId, id, filters).then(value => ({ status: "fulfilled" as const, value }), () => ({ status: "rejected" as const })),
  ]));
  const hours = hoursResult.status === "fulfilled" ? hoursResult.value : undefined;
  const taskAccess = Boolean(workspace?.scopes.some(scope => scope.tasks || scope.templates));
  const hoursAccess = Boolean(hours);
  if (!taskAccess && !hoursAccess) notFound();

  const taskScopes = workspace?.scopes.filter(scope => scope.tasks) ?? [];
  const templateScopes = workspace?.scopes.filter(scope => scope.templates) ?? [];
  const source = workspace?.templates.find(template => template.id === query.template && template.is_active);
  const base = `/manage/organizations/${id}/tasks`;
  const allowedTemplate = (committee: string | null) => templateScopes.some(scope => scope.id === committee);
  const scopeField = (scopes: NonNullable<typeof workspace>["scopes"], value?: string | null) => <FormField  label={<>{c("نطاق العمل", "Work scope")}</>}><NativeSelect name="committee" defaultValue={value ?? ""}>{scopes.map(scope => <option key={scope.id ?? "organization"} value={scope.id ?? ""} dir="auto">{scope.name}</option>)}</NativeSelect></FormField>;

  const templatesAction = templateScopes.length > 0 && workspace && <ManagementActionSheet label={c("القوالب", "Templates")} title={c("إدارة قوالب المهام", "Manage task templates")} locale={locale} triggerSize="default" variant="outline" icon={<LayoutTemplate aria-hidden="true" />} headerAction={<ManagementActionSheet label={c("قالب جديد", "New template")} title={c("إضافة قالب مهمة", "Add a task template")} locale={locale} variant="default" triggerSize="default">
        <TaskForm operation="template" fields={{ org: id }} label={c("إنشاء القالب", "Create template")} locale={locale}>{scopeField(templateScopes)}<TaskFields template locale={locale}/></TaskForm>
      </ManagementActionSheet>}>
    <section className="space-y-5" aria-label={c("قوالب المهام", "Task templates")}>

      {workspace.templates.map(template => <article key={template.id} className="border-t border-line py-4 first:border-0">
        <div className="flex flex-wrap items-start justify-between gap-3"><h3 className="min-w-0 break-words font-semibold"><bdi>{template.name}</bdi></h3><Badge variant={template.is_active?"secondary":"outline"}>{template.is_active ? c("نشط", "Active") : c("موقوف", "Inactive")}</Badge></div>
        <p dir="auto" className="mt-2 line-clamp-2 break-words text-sm leading-6">{template.description_template}</p>
        <p className="mt-2 text-sm text-muted-foreground">{c("الساعات المقترحة", "Suggested hours")}: {formatHours(template.default_hours,locale)}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {template.is_active && taskScopes.some(scope => template.committee_id === null || scope.id === template.committee_id) && <RowAction href={`${base}?template=${template.id}`} label={c("إنشاء مهمة من القالب","Create task from template")}><Plus/></RowAction>}
          {allowedTemplate(template.committee_id) && <ManagementActionSheet rowAction icon={<Pencil/>} label={c("تعديل", "Edit")} title={c("تعديل قالب المهمة", "Edit task template")} locale={locale}>
            <TaskForm operation="template" fields={{ org: id, template: template.id, committee: template.committee_id ?? "", revision: String(template.revision) }} label={c("حفظ القالب", "Save template")} locale={locale}><TaskFields value={template} template locale={locale}/></TaskForm>
          </ManagementActionSheet>}
          {allowedTemplate(template.committee_id) && templateScopes.length > 0 && <ManagementActionSheet rowAction icon={<Copy/>} label={c("نسخ", "Copy")} title={c("نسخة مستقلة من القالب", "Create an independent template copy")} locale={locale}>
            <TaskForm operation="template" fields={{ org: id, source: template.id, description: "", hours: "0", active: "on" }} label={c("نسخ القالب", "Copy template")} locale={locale}>{scopeField(templateScopes, template.committee_id)}<FormField  label={<>{c("اسم النسخة", "Copy name")}</>}><input name="title" required minLength={2} maxLength={120} defaultValue={`${template.name.slice(0, 110)} (${c("نسخة", "copy")})`}/></FormField></TaskForm>
          </ManagementActionSheet>}
        </div>
      </article>)}
      {!workspace.templates.length && <WorkspaceEmptyState icon={LayoutTemplate} title={c("لا توجد قوالب بعد", "No templates yet")} description={c("أنشئ قالبًا لحفظ تفاصيل المهام المتكررة.", "Create a template for recurring tasks.")}/>}
    </section>
  </ManagementActionSheet>;

  const taskCreateAction = taskScopes.length > 0 && workspace && <TaskComposer org={id} workspace={workspace} source={source} locale={locale} initiallyOpen={Boolean(source)}/>;

  const items = [
    ...(taskAccess ? [{ id: "tasks", label: c("المهام", "Tasks"), icon: <ClipboardCheck aria-hidden="true" /> }] : []),
    ...(hoursAccess ? [{ id: "hours", label: c("الساعات", "Hours"), icon: <Clock3 aria-hidden="true" /> }] : []),
  ];
  const defaultSection = taskAccess ? "tasks" : "hours";
  const initialSection = query.section === "hours" ? "hours" : defaultSection;

  const taskToolbarAction = <div className="flex min-w-0 flex-wrap items-center gap-2">{taskCreateAction}{templatesAction}</div>;

  return <div className="min-w-0 space-y-5">
    <OrganizationSectionTabs items={items} initialSection={initialSection} defaultSection={defaultSection} sticky={false} label={c("المهام والساعات", "Tasks and hours")} dir={en ? "ltr" : "rtl"}>
      {taskAccess && <OrganizationSectionTabPanel id="tasks">
        <section aria-label={c("قائمة مهام الجهة", "Organization task list")} className="space-y-4">
          <TaskManagementList initialFilters={taskFilters} organization={id} initial={tasks??{items:[],more:false}} page={taskPage} locale={locale} actions={taskToolbarAction}/>
        </section>
      </OrganizationSectionTabPanel>}
      {hoursAccess && <OrganizationSectionTabPanel id="hours">
        {hours ? <HoursWorkspaceView data={hours} org={id} filters={filters} locale={locale} /> : null}
      </OrganizationSectionTabPanel>}
    </OrganizationSectionTabs>
  </div>;
}
