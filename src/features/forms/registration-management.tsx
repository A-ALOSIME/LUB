import {NumberText} from "@/components/number-text";
import {createTranslator} from "@/lib/i18n";
import Link from "next/link";
import {Badge} from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Files } from "lucide-react";
import { FormEditor } from "@/features/forms/editor";
import {OpenPublishedEditor} from "./open-published-editor";
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
  const c = createTranslator(en ? "en" : "ar");
  const templates = workspace.templates.filter(template => template.organization_id === organization);
  const selected = templates.find(template => template.id === selectedTemplate);
  const version = selected?.versions.find(item => item.status_code === "Draft") ?? selected?.versions[0];

  if(selected&&version)return <div className="min-w-0 flex flex-col gap-3">
    <Button nativeButton={false} variant="ghost" render={<Link href={`/manage/organizations/${organization}/renewals?section=forms`}/>} className="self-start"><ArrowRight/>{c("رجوع للنماذج","Back to forms")}</Button>
    <div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold"><bdi>{selected.name}</bdi></h2><Badge variant="secondary">{en?version.status_code:statuses[version.status_code]}</Badge><span className="text-sm text-muted-foreground">{c("النسخة","Version")} <NumberText value={version.version_number}/></span></div>
    {version.status_code==="Draft"?<> {selected.versions.some(item=>item.status_code==="Published")&&<Badge variant="outline" className="self-start">{c("تعديلات غير منشورة","Unpublished changes")}</Badge>}{(selected.round_count??0)>0&&<p className="text-sm text-muted-foreground">{c("هذا النموذج مستخدم في جولة. النسخة الجديدة تُستخدم للطلبات الجديدة بعد النشر؛ الإجابات السابقة تبقى كما قُدّمت.","This form is used by a round. New applications use the new version after publication; existing answers stay unchanged.")}</p>}<FormEditor key={version.id} returnHref={`/manage/organizations/${organization}/renewals?section=forms`} version={version.id} revision={version.revision} initial={version.definition} locale={locale}/></>:<OpenPublishedEditor template={selected.id} locale={locale}/>}

  </div>;
  return <div className="min-w-0">{templates.length>0?<ul className="registration-template-list sm:grid sm:grid-cols-[minmax(0,max-content)_auto] divide-y divide-border rounded-xl border border-border overflow-hidden bg-card">{templates.map(template=><RegistrationTemplateRow key={template.id} template={template} organization={organization} locale={locale}/>)}</ul>:<WorkspaceEmptyState icon={Files} title={c("لا توجد نماذج بعد","No forms yet")} description={c("أنشئ نموذجاً لبدء استقبال طلبات التسجيل.","Create a form to begin accepting registration applications.")}/>}</div>;
}
