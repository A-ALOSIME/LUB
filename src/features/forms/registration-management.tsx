import { Files } from "lucide-react";
import { FormEditor } from "@/features/forms/editor";
import { WorkflowForm } from "@/features/forms/mutation-form";
import { WorkspaceEmptyState } from "@/components/workspace-empty-state";
import { RegistrationTemplateRow } from "./registration-template-row";
import type { OrganizationRegistrationWorkspace } from "./repository";
import { statuses } from "./repository";
import type { Locale } from "@/lib/preferences";

export function RegistrationManagement({ workspace, organization, selectedTemplate, locale }: {
  workspace: OrganizationRegistrationWorkspace;
  organization: string;
  selectedTemplate: string | null;
  locale: Locale;
}) {
  const en = locale === "en";
  const c = (ar: string, english: string) => en ? english : ar;
  const templates = workspace.templates.filter(template => template.organization_id === organization);
  const selected = templates.find(template => template.id === selectedTemplate);
  const version = selected?.versions.find(item => item.status_code === "Draft") ?? selected?.versions[0];

  return <div className="min-w-0 space-y-5">
    {templates.length > 0 ? <ul className="divide-y divide-border rounded-xl border border-border bg-card px-4 sm:px-5">
      {templates.map(template => <RegistrationTemplateRow key={template.id} template={template} organization={organization} locale={locale} />)}
    </ul> : <WorkspaceEmptyState icon={Files} title={c("لا توجد نماذج بعد", "No forms yet")} description={c("أنشئ نموذجاً لبدء استقبال طلبات التسجيل.", "Create a form to begin accepting registration applications.")} />}

    {selected && version && <div className="min-w-0 space-y-5 border-t border-border pt-5">
      <h3 className="font-semibold"><bdi>{selected.name}</bdi> · {c("النسخة", "Version")} {version.version_number} · {en ? version.status_code : statuses[version.status_code]}</h3>
      {version.status_code === "Draft" ? <>
        <FormEditor key={version.id} version={version.id} revision={version.revision} initial={version.definition} locale={locale} />
        <WorkflowForm operation="publish-form" fields={{ version: version.id }} label={c("نشر النسخة المحفوظة", "Publish saved version")} locale={locale}>
          <p className="text-sm text-muted-foreground">{c("احفظ تعديلاتك أولاً. النشر يثبّت النسخة المحفوظة ولا يغيّر طلبات الطلاب السابقة.", "Save edits first. Publishing locks this saved version and does not change earlier applications.")}</p>
        </WorkflowForm>
      </> : <>
        <ul className="space-y-2">{version.definition.sections.flatMap(section => section.fields).map(field => <li key={field.id} dir="auto">{field.label}{field.required ? " *" : ""}</li>)}</ul>
        <WorkflowForm operation="draft-form" fields={{ template: selected.id }} label={c("بدء مسودة نسخة جديدة", "Start a new draft version")} locale={locale} />
      </>}
    </div>}
  </div>;
}
