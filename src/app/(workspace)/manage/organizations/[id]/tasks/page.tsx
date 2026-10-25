import { cloneElement } from "react";
import { RowAction } from "@/components/row-action";
import { formatHours } from "@/lib/display";
import { Clock3, ClipboardCheck, LayoutTemplate, Pencil, Copy, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ManagementActionSheet } from "@/components/management-action-sheet";
import { WorkspaceEmptyState } from "@/components/workspace-empty-state";
import { NativeSelect } from "@/components/ui/native-select";
import { OrganizationSectionTabPanel, OrganizationSectionTabs } from "@/features/organizations/organization-section-tabs";
import { loadManagementPageData } from "@/features/organizations/access";
import { TaskFields } from "@/features/tasks/task-fields";
import { TaskForm } from "@/features/tasks/task-form";
import { TaskList, TaskPagination } from "@/features/tasks/task-list";
import { taskWorkspace, listTasks } from "@/features/tasks/repository";
import { hoursWorkspace } from "@/features/hours/repository";
import { HoursWorkspaceView } from "@/features/hours/workspace-view";
import { HoursSettingsAction } from "@/features/hours/hours-settings-action";
import { HoursToolbarActions } from "@/features/hours/hours-toolbar-actions";
import { getPreferences } from "@/lib/preferences";
import { localizedMetadata } from "@/lib/localized-metadata";

export async function generateMetadata() {
  return localizedMetadata("المهام والساعات", "Tasks and hours");
}

export default async function ManageTasksPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    page?: string; taskPage?: string; hoursPage?: string; template?: string; section?: string;
    memberPage?: string; rulePage?: string; term?: string; committee?: string; hourStatus?: string; q?:string;
  }>;
}) {
  const [{ locale }, { id }, query] = await Promise.all([getPreferences(), params, searchParams]);
  const en = locale === "en";
  const c = (ar: string, english: string) => en ? english : ar;
  if (!z.uuid().safeParse(id).success) notFound();

  const number = (value?: string) => z.coerce.number().int().min(0).max(10000).catch(0).parse(value ?? "0");
  const uuid = (value?: string) => z.uuid().nullable().catch(null).parse(value ?? null);
  const hourStatus = (["Approved", "Pending", "Rejected"] as const).find(status => status === query.hourStatus) ?? null;
  const taskPage = number(query.taskPage ?? query.page);
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
    listTasks(userId, { org: id, view: "all", page: taskPage }),
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
  const scopeField = (scopes: NonNullable<typeof workspace>["scopes"], value?: string | null) => <label>{c("نطاق العمل", "Work scope")}<NativeSelect name="committee" defaultValue={value ?? ""}>{scopes.map(scope => <option key={scope.id ?? "organization"} value={scope.id ?? ""} dir="auto">{scope.name}</option>)}</NativeSelect></label>;

  const templatesAction = templateScopes.length > 0 && workspace && <ManagementActionSheet label={c("القوالب", "Templates")} title={c("إدارة قوالب المهام", "Manage task templates")} locale={locale} variant="outline" icon={<LayoutTemplate aria-hidden="true" />}>
    <section className="space-y-5" aria-label={c("قوالب المهام", "Task templates")}>
      <ManagementActionSheet label={c("قالب جديد", "New template")} title={c("إضافة قالب مهمة", "Add a task template")} locale={locale}>
        <TaskForm operation="template" fields={{ org: id }} label={c("إنشاء القالب", "Create template")} locale={locale}>{scopeField(templateScopes)}<TaskFields template locale={locale}/></TaskForm>
      </ManagementActionSheet>
      {workspace.templates.map(template => <article key={template.id} className="border-t border-line py-4 first:border-0">
        <div className="flex flex-wrap items-start justify-between gap-3"><h3 className="min-w-0 break-words font-semibold"><bdi>{template.name}</bdi></h3><span className="text-sm text-muted">{template.is_active ? c("نشط", "Active") : c("مؤرشف", "Archived")}</span></div>
        <p dir="auto" className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{template.description_template}</p>
        <p className="mt-1 text-xs text-muted">{c("الساعات المقترحة", "Suggested hours")}: {formatHours(template.default_hours,locale)}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {template.is_active && taskScopes.some(scope => template.committee_id === null || scope.id === template.committee_id) && <RowAction href={`${base}?template=${template.id}`} label={c("إنشاء مهمة من القالب","Create task from template")}><Plus/></RowAction>}
          {allowedTemplate(template.committee_id) && <ManagementActionSheet rowAction icon={<Pencil/>} label={c("تعديل", "Edit")} title={c("تعديل قالب المهمة", "Edit task template")} locale={locale}>
            <TaskForm operation="template" fields={{ org: id, template: template.id, committee: template.committee_id ?? "", revision: String(template.revision) }} label={c("حفظ القالب", "Save template")} locale={locale}><TaskFields value={template} template locale={locale}/></TaskForm>
          </ManagementActionSheet>}
          {allowedTemplate(template.committee_id) && templateScopes.length > 0 && <ManagementActionSheet rowAction icon={<Copy/>} label={c("نسخ", "Copy")} title={c("نسخة مستقلة من القالب", "Create an independent template copy")} locale={locale}>
            <TaskForm operation="template" fields={{ org: id, source: template.id, description: "", hours: "0", active: "on" }} label={c("نسخ القالب", "Copy template")} locale={locale}>{scopeField(templateScopes, template.committee_id)}<label>{c("اسم النسخة", "Copy name")}<input name="title" required minLength={2} maxLength={120} defaultValue={`${template.name.slice(0, 110)} (${c("نسخة", "copy")})`}/></label></TaskForm>
          </ManagementActionSheet>}
        </div>
      </article>)}
      {!workspace.templates.length && <p className="workspace-empty">{c("لا توجد قوالب متاحة ضمن صلاحياتك.", "No templates are available under your permissions.")}</p>}
    </section>
  </ManagementActionSheet>;

  const taskCreateAction = taskScopes.length > 0 && workspace && <ManagementActionSheet
    key={source?.id ?? "blank"}
    label={source ? c("إنشاء من القالب", "Create from template") : c("مهمة جديدة", "New task")}
    title={c("إنشاء مهمة", "Create task")}
    locale={locale}
    variant="default"
    triggerSize="lg"
    initiallyOpen={Boolean(source)}
  >
    {source && <p className="mb-4 text-sm text-muted">{c("من القالب", "From template")}: <bdi>{source.name}</bdi> · <Link className="text-link" href={`${base}?section=tasks`}>{c("ابدأ بدون قالب", "Start without a template")}</Link></p>}
    <TaskForm key={source?.id ?? "blank"} operation="save-task" fields={{ org: id, ...(source ? { template: source.id } : {}) }} label={c("إنشاء مسودة المهمة", "Create task draft")} locale={locale}>
      {scopeField(taskScopes, source?.committee_id)}
      <TaskFields value={source ? { title: source.name, description: source.description_template, default_hours: source.default_hours } : undefined} locale={locale} rules={workspace.hourRules.filter(rule => !rule.task_template_id || rule.task_template_id === source?.id)} templates={workspace.templates} selectedTemplate={source?.id} canSaveTemplate={templateScopes.length > 0}/>
    </TaskForm>
  </ManagementActionSheet>;
  const settingsAction = hours && <HoursSettingsAction data={hours} org={id} filters={filters} locale={locale}/>;
  const hoursToolbarAction = hours && <HoursToolbarActions
    org={id}
    committee={filters.committee}
    term={filters.term}
    status={filters.status}
    search={filters.q}
    exportScopes={hours.exportScopes}
    locale={locale}
    settingsAction={settingsAction}
    hasRecords={Boolean(hours.records.length)}
    canAddHours={Boolean(hours.scopes.some(scope => scope.manual))}
  />;

  const items = [
    ...(taskAccess ? [{ id: "tasks", label: c("المهام", "Tasks"), icon: <ClipboardCheck aria-hidden="true" /> }] : []),
    ...(hoursAccess ? [{ id: "hours", label: c("الساعات", "Hours"), icon: <Clock3 aria-hidden="true" /> }] : []),
  ];
  const defaultSection = taskAccess ? "tasks" : "hours";
  const initialSection = query.section === "hours" ? "hours" : defaultSection;
  const hasTasks = Boolean(tasks?.items.length);
  const taskToolbarAction = <div className="flex min-w-0 flex-wrap items-center gap-2">{taskCreateAction}{templatesAction}</div>;

  return <div className="min-w-0 space-y-5">
    <OrganizationSectionTabs items={items} initialSection={initialSection} defaultSection={defaultSection} sticky={false} label={c("المهام والساعات", "Tasks and hours")} dir={en ? "ltr" : "rtl"} sectionActions={{ tasks: taskToolbarAction, hours: hoursToolbarAction }}>
      {taskAccess && <OrganizationSectionTabPanel id="tasks">
        <section aria-label={c("قائمة مهام الجهة", "Organization task list")} className="space-y-4">
          {hasTasks && tasks ? <>
            <TaskList items={tasks.items} mode="all" locale={locale}/>
            <TaskPagination page={taskPage} more={tasks.more} base={base} query={{ section: "tasks" }} locale={locale}/>
          </> : <WorkspaceEmptyState icon={ClipboardCheck} title={c("لا توجد مهام بعد", "No tasks yet")} description={c("أنشئ أول مهمة للجهة.", "Create the organization's first task.")} action={taskCreateAction ? cloneElement(taskCreateAction,{initiallyOpen:false,key:"empty-task"}) : templatesAction} />}
        </section>
      </OrganizationSectionTabPanel>}
      {hoursAccess && <OrganizationSectionTabPanel id="hours">
        {hours ? <HoursWorkspaceView data={hours} org={id} filters={filters} locale={locale} /> : null}
      </OrganizationSectionTabPanel>}
    </OrganizationSectionTabs>
  </div>;
}
