import { ManagementActionSheet } from "@/components/management-action-sheet";
import { NativeSelect } from "@/components/ui/native-select";
import { DateRangeInput } from "@/features/forms/date-input";
import { TaskPagination } from "@/features/tasks/task-list";
import { HoursForm } from "./form";
import type { HoursFilters } from "./workspace-view";
import type { HoursWorkspace, HourRule } from "./repository";
import type { Locale } from "@/lib/preferences";
import { Pencil, Settings2 } from "lucide-react";

export function HoursSettingsAction({ data, org, filters, locale }: { data: HoursWorkspace; org: string; filters: HoursFilters; locale: Locale }) {
  const en = locale === "en";
  const c = (ar: string, english: string) => en ? english : ar;
  const ruleScopes = data.scopes.filter(scope => scope.rules);
  const canManageRules = ruleScopes.length > 0;
  if (!data.canPolicy && !canManageRules) return null;

  const { term, committee, memberPage, rulePage, status } = filters;
  const base = `/manage/organizations/${org}/tasks`;
  const query = { section: "hours", ...(term ? { term } : {}), ...(committee ? { committee } : {}), ...(status ? { hourStatus: status } : {}), memberPage: String(memberPage), rulePage: String(rulePage) };
  const ruleFields = (rule?: HourRule) => <>
    <label>{c("اسم القاعدة", "Rule name")}<input name="name" required minLength={2} maxLength={120} defaultValue={rule?.name ?? ""}/></label>
    <label>{c("الساعات الافتراضية", "Default hours")}<input name="hours" type="number" min={0} max={1000} step="0.01" required defaultValue={rule?.default_hours ?? "0"}/></label>
    <DateRangeInput startName="starts" endName="ends" label={c("فترة سريان القاعدة", "Rule effective dates")} startValue={rule?.effective_from ?? ""} endValue={rule?.effective_to ?? ""} required locale={locale}/>
    <label className="flex items-center gap-2"><input name="active" type="checkbox" className="size-4" defaultChecked={rule?.is_active ?? true}/>{c("قاعدة نشطة", "Active rule")}</label>
  </>;

  return <ManagementActionSheet label="" title={c("إعدادات الساعات", "Hours settings")} locale={locale} icon={<Settings2 aria-hidden="true" />} triggerSize="icon-sm" triggerAriaLabel={c("إعدادات الساعات", "Hours settings")} initiallyOpen={rulePage > 0}>
    <div className="space-y-7">
      {data.canPolicy && <section className="space-y-3" aria-labelledby="self-policy-title">
        <h2 id="self-policy-title" className="font-semibold">{c("طلب الساعات الذاتي", "Self-reported hours")}</h2>
        <HoursForm operation="self-policy" fields={{ org }} label={c("حفظ السياسة", "Save policy")} locale={locale}><label className="flex items-center gap-2"><input type="checkbox" name="enabled" className="size-4" defaultChecked={data.selfEnabled}/>{c("السماح للأعضاء بطلب ساعات للمراجعة", "Allow members to submit hours for review")}</label></HoursForm>
      </section>}
      {canManageRules && <section className="space-y-3" aria-labelledby="hours-rules-title">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="hours-rules-title" className="font-semibold">{c("قواعد الساعات", "Hours rules")}</h2>
          <ManagementActionSheet label={c("قاعدة جديدة", "New rule")} title={c("قاعدة ساعات جديدة", "New hours rule")} locale={locale}>
            <HoursForm operation="rule" fields={{ org }} label={c("إنشاء القاعدة", "Create rule")} locale={locale}>
              <label>{c("النطاق", "Scope")}<NativeSelect name="committee"><option value="">{c("الجهة بالكامل", "Whole organization")}</option>{ruleScopes.filter(scope => scope.id).map(scope => <option key={scope.id} value={scope.id!}>{scope.name}</option>)}</NativeSelect></label>
              <label>{c("قالب المهمة (اختياري)", "Task template (optional)")}<NativeSelect name="template"><option value="">{c("قاعدة عامة للنطاق", "General rule for scope")}</option>{data.templates.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}</NativeSelect></label>
              {ruleFields()}
            </HoursForm>
          </ManagementActionSheet>
        </div>
        {data.rules.length ? <ul className="divide-y divide-line">{data.rules.slice(0, 25).map(rule => <li key={rule.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0">
          <div className="min-w-0"><p className="truncate font-medium"><bdi>{rule.name}</bdi> · {rule.default_hours} {c("ساعة", "hours")}</p><p className="mt-1 text-xs text-muted">{rule.is_active ? c("نشطة", "Active") : c("موقوفة", "Paused")} · {rule.effective_from}{rule.effective_to && ` ${c("إلى", "to")} ${rule.effective_to}`}</p></div>
          {rule.canEdit && <ManagementActionSheet label={c("تعديل", "Edit")} title={c("تعديل قاعدة الساعات", "Edit hours rule")} locale={locale} icon={<Pencil aria-hidden="true" />}><HoursForm operation="rule" fields={{ org, rule: rule.id, committee: rule.committee_id ?? "", template: rule.task_template_id ?? "", revision: String(rule.revision) }} label={c("حفظ القاعدة", "Save rule")} locale={locale}>{ruleFields(rule)}</HoursForm></ManagementActionSheet>}
        </li>)}</ul> : <p className="text-sm text-muted">{c("لا توجد قواعد في هذا النطاق.", "No rules in this scope.")}</p>}
        <TaskPagination page={rulePage} more={data.rules.length > 25} base={base} query={query} pageParam="rulePage" locale={locale}/>
      </section>}
    </div>
  </ManagementActionSheet>;
}
