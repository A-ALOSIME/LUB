import {createTranslator} from "@/lib/i18n";
import {RoundForm} from "@/features/forms/round-actions";
import { FilePlus2, CalendarRange, ClipboardList } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ManagementActionSheet } from "@/components/management-action-sheet";
import { NativeSelect } from "@/components/ui/native-select";
import { localizedMetadata } from "@/lib/localized-metadata";
import { requireVerifiedProxyIdentity } from "@/features/auth/session";
import { renewalWorkspace } from "@/features/renewals/repository";
import { checkReadiness } from "@/features/hours/view";
import { HoursForm } from "@/features/hours/form";
import { DateRangeInput } from "@/features/forms/date-input";
import { RenewalWorkspaceView } from "@/features/renewals/view";
import { getPreferences } from "@/lib/preferences";
import { getWorkspace } from "@/features/forms/repository";
import { RegistrationManagement } from "@/features/forms/registration-management";
import { WorkflowForm } from "@/features/forms/mutation-form";
import { CombinedManagementList } from "@/features/renewals/combined-management-list";
import { RenewalCreationActions } from "@/features/renewals/creation-actions";
import { OrganizationSectionTabPanel, OrganizationSectionTabs } from "@/features/organizations/organization-section-tabs";
import { FormField } from "@/components/form-field";

export async function generateMetadata() { return localizedMetadata("التسجيل والتجديد", "Registration and renewal"); }

export default async function ManageRenewalsPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ section?: string; campaign?: string; template?: string; page?: string; memberPage?: string }>;
}) {
  const [user, { locale }, { id }, query] = await Promise.all([requireVerifiedProxyIdentity(), getPreferences(), params, searchParams]);
  if (!z.uuid().safeParse(id).success) notFound();
  const number = (value?: string) => z.coerce.number().int().min(0).max(10000).catch(0).parse(value ?? "0");
  const page = number(query.page), memberPage = number(query.memberPage);
  const campaign = z.uuid().nullable().catch(null).parse(query.campaign ?? null);
  const template = z.uuid().nullable().catch(null).parse(query.template ?? null);
  const [renewals, registration] = await Promise.all([
    renewalWorkspace(user.id, id, campaign, page, memberPage),
    getWorkspace(user.id, id, template),
  ]);
  if (renewals) checkReadiness(renewals.account);
  if (registration?.accountStatus === "Inactive") redirect("/account-unavailable");
  if (registration && !registration.onboarded) redirect("/onboarding");
  const registrationAllowed = !!registration?.allowed.some(code => ["FORMS_MANAGE", "REGISTRATION_ROUNDS_MANAGE"].includes(code));
  if (!renewals && !registrationAllowed) notFound();
  const en = locale === "en";
  const c = createTranslator(en ? "en" : "ar");
  const templates = registration?.templates.filter(item => item.organization_id === id) ?? [];
  const publishedTemplates = templates.filter(item => item.versions.some(version => version.status_code === "Published"));
  const rounds = registration?.rounds ?? [];
  const campaigns = renewals?.campaigns ?? [];
  const hasItems = rounds.length > 0 || campaigns.length > 0;
  const canCreateRound = !!registration?.allowed.includes("REGISTRATION_ROUNDS_MANAGE");
  const canCreateCampaign = !!renewals?.allowed;
  const canManageForms = !!registration?.allowed.includes("FORMS_MANAGE");
  const createRoundForm = <RoundForm organization={id} templates={publishedTemplates} locale={locale}/>;
  const createCampaignForm = renewals?.allowed && <HoursForm operation="campaign" fields={{ org: id }} label={c("إنشاء المسودة", "Create draft")} locale={locale}>
    <FormField  id="renewal-term" label={<>{c("الفصل الدراسي","Academic term")}</>}><NativeSelect id="renewal-term" name="term" required defaultValue=""><option value="">{c("اختر الفصل","Choose term")}</option>{renewals.terms.map(term=><option key={term.id} value={term.id}>{term.name_ar} · {term.academic_year}</option>)}</NativeSelect></FormField>
    <DateRangeInput startName="opens" endName="closes" label={c("فترة استقبال الردود", "Response period")} required includeTime locale={locale}/>
    <Field orientation="horizontal" className="items-center">
      <Checkbox id="renewal-campaign-leaders" name="leaders" value="on" />
      <FieldContent><FieldLabel htmlFor="renewal-campaign-leaders">{c("استثناء القادة والنواب من التجديد", "Exclude leaders and deputies from renewal")}</FieldLabel></FieldContent>
    </Field>
  </HoursForm>;
  const createActions = (mode: "cards" | "menu") => <RenewalCreationActions locale={locale} mode={mode} canCreateRound={canCreateRound} canCreateCampaign={canCreateCampaign} roundForm={createRoundForm} campaignForm={createCampaignForm}/>;
  const newFormAction = canManageForms && registration && <ManagementActionSheet label={c("نموذج جديد", "New form")} title={c("إنشاء نموذج", "Create a form")} locale={locale} variant="default" icon={<FilePlus2 aria-hidden="true" />} triggerSize="default" mobileBottomSheet>
    <WorkflowForm operation="create-form" fields={{ org: id }} label={c("إنشاء مسودة", "Create draft")} locale={locale}>
      <FieldGroup className="gap-4">
        <FormField  id="registration-form-title" label={<>{c("اسم النموذج", "Form name")}</>}><Input id="registration-form-title" name="title" dir={en ? "ltr" : "rtl"} required minLength={2} maxLength={120}/></FormField>
        <FormField  id="registration-form-source" label={<>{c("نسخ من نموذج", "Copy from form")}</>}><NativeSelect id="registration-form-source" name="source" dir={en ? "ltr" : "rtl"}><option value="">{c("نموذج من الصفر", "Start from scratch")}</option>{registration?.templates.map(item => <option key={item.id} value={item.id}>{item.name}{!item.organization_id ? c(" · نموذج لُبّ", " · LUB template") : ""}</option>)}</NativeSelect></FormField>
      </FieldGroup>
    </WorkflowForm>
  </ManagementActionSheet>;
  const sectionItems = [
    ...((registrationAllowed || renewals?.allowed) ? [{ id: "rounds", label: c("الجولات والحملات", "Rounds and campaigns"), icon: <CalendarRange aria-hidden="true" /> }] : []),
    ...(canManageForms ? [{ id: "forms", label: c("النماذج", "Forms"), icon: <ClipboardList aria-hidden="true" /> }] : []),
  ];
  const requestedSection = query.section === "forms" || query.section === "registration" ? "forms" : "rounds";
  const initialSection = sectionItems.some(item => item.id === requestedSection) ? requestedSection : sectionItems[0]?.id ?? "rounds";
  const roundActions = hasItems && (canCreateRound || canCreateCampaign) ? createActions("menu") : undefined;

  return <>
    <OrganizationSectionTabs items={sectionItems} initialSection={initialSection} defaultSection={sectionItems[0]?.id ?? "rounds"} sticky={false} label={c("التسجيل والتجديد", "Registration and renewal")} dir={en ? "ltr" : "rtl"} sectionActions={{ rounds: roundActions, forms: template?undefined:newFormAction }}>
      {sectionItems.some(item => item.id === "rounds") && <OrganizationSectionTabPanel id="rounds">
        <div className="min-w-0 space-y-6">
          <section aria-label={c("قائمة الجولات والحملات", "Rounds and campaigns list")} className="space-y-3">
            <CombinedManagementList rounds={rounds} templates={publishedTemplates} campaigns={campaigns} organization={id} locale={locale} canManageRounds={canCreateRound} emptyAction={!hasItems && (canCreateRound || canCreateCampaign) ? createActions("cards") : undefined}/>
          </section>
          {renewals?.selected && <ManagementActionSheet label="" title={`${c("حملة التجديد", "Renewal campaign")} · ${renewals.selected.name}`} locale={locale} presentation="sheet" initiallyOpen hideTrigger>
            <RenewalWorkspaceView data={renewals} org={id} page={page} memberPage={memberPage} locale={locale} hideNewCampaign hideCampaignList/>
          </ManagementActionSheet>}
        </div>
      </OrganizationSectionTabPanel>}
      {canManageForms && registration && <OrganizationSectionTabPanel id="forms">
        <RegistrationManagement workspace={registration} organization={id} selectedTemplate={template} locale={locale}/>
      </OrganizationSectionTabPanel>}
    </OrganizationSectionTabs>
  </>;
}
