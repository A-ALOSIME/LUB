import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Files } from "lucide-react";
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

  if(selected&&version)return <div className="min-w-0 flex flex-col gap-5">
    <Button nativeButton={false} variant="ghost" render={<Link href={`/manage/organizations/${organization}/renewals?section=forms`}/>} className="self-start"><ArrowRight/>{c("رجوع للنماذج","Back to forms")}</Button>
    <div className="flex flex-col gap-2"><h2 className="text-xl font-semibold"><bdi>{selected.name}</bdi></h2><p className="text-sm text-muted-foreground">{c("النسخة","Version")} {version.version_number} · {en?version.status_code:statuses[version.status_code]}</p></div>
    {version.status_code==="Draft"?<FormEditor key={version.id} template={selected.id} version={version.id} revision={version.revision} initial={version.definition} locale={locale}/>:<><ul className="flex flex-col gap-3">{version.definition.sections.flatMap(section=>section.fields).map(field=><li key={field.id} dir="auto">{field.label}{field.required?" *":""}</li>)}</ul><WorkflowForm operation="draft-form" fields={{template:selected.id}} label={c("بدء مسودة نسخة جديدة","Start a new draft version")} locale={locale}/></>}
  </div>;
  return <div className="min-w-0">{templates.length>0?<ul className="registration-template-list divide-y divide-border rounded-xl border border-border bg-card px-4 sm:px-5">{templates.map(template=><RegistrationTemplateRow key={template.id} template={template} organization={organization} locale={locale}/>)}</ul>:<WorkspaceEmptyState icon={Files} title={c("لا توجد نماذج بعد","No forms yet")} description={c("أنشئ نموذجاً لبدء استقبال طلبات التسجيل.","Create a form to begin accepting registration applications.")}/>}</div>;
}
