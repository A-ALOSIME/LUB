"use client";

import {NumberText} from "@/components/number-text";
import {createTranslator} from "@/lib/i18n";
import { NativeSelect } from "@/components/ui/native-select";
import { useState } from "react";
import { DateInput } from "@/features/forms/date-input";
import { WorkflowForm } from "@/features/forms/mutation-form";
import { mutateOrganizationMembers } from "@/features/organizations/members-actions";
import type { OrganizationPermissionWorkspace } from "@/features/organizations/management-repository";
import type { Locale } from "@/lib/preferences";
import { formatRiyadhDate } from "@/lib/datetime";
import { FormField } from "@/components/form-field";

export const permissionLabels: Record<string, [string, string]> = {
  ORG_PROFILE_MANAGE: ["تعديل بيانات الجهة", "Edit organization profile"],
  COMMITTEE_MANAGE: ["إدارة اللجان", "Manage committees"],
  COMMITTEE_PROFILE_MANAGE: ["تعديل بيانات اللجنة", "Edit committee profile"],
  MEMBERS_VIEW: ["عرض قاعدة الأعضاء", "View member directory"],
  MEMBERS_MANAGE: ["إدارة العضويات", "Manage memberships"],
  FORMS_MANAGE: ["إدارة النماذج", "Manage forms"],
  REGISTRATION_ROUNDS_MANAGE: ["إدارة جولات التسجيل", "Manage registration rounds"],
  APPLICATIONS_VIEW: ["عرض الطلبات", "View applications"],
  APPLICATIONS_REVIEW: ["مراجعة الطلبات", "Review applications"],
  APPLICATIONS_BULK_ACTION: ["الإجراءات الجماعية للطلبات", "Bulk application actions"],
  TASKS_MANAGE: ["إدارة المهام", "Manage tasks"],
  TASK_TEMPLATES_MANAGE: ["إدارة قوالب المهام", "Manage task templates"],
  HOUR_RULES_MANAGE: ["إدارة قواعد الساعات", "Manage hour rules"],
  HOURS_APPROVE: ["اعتماد الساعات", "Approve hours"],
  HOURS_MANUAL_ADD: ["إضافة الساعات يدويًا", "Add hours manually"],
  RENEWALS_MANAGE: ["إدارة تجديد العضويات", "Manage renewals"],
  REPORTS_GENERATE: ["إعداد التقارير", "Generate reports"],
  EVENTS_MANAGE: ["إدارة الفعاليات", "Manage events"],
  EVENT_ATTENDANCE_MANAGE: ["إدارة حضور الفعاليات", "Manage event attendance"],
  EVENT_CONTRIBUTIONS_MANAGE: ["توثيق المساهمات", "Verify contributions"],
};
export const scopedPermissions = new Set(["COMMITTEE_PROFILE_MANAGE", "MEMBERS_VIEW", "APPLICATIONS_VIEW", "APPLICATIONS_REVIEW", "APPLICATIONS_BULK_ACTION", "TASKS_MANAGE", "TASK_TEMPLATES_MANAGE", "HOUR_RULES_MANAGE", "HOURS_APPROVE", "HOURS_MANUAL_ADD", "REPORTS_GENERATE"]);

export function PermissionEditor({ organization, workspace, committees, locale }: {
  organization: string;
  workspace: OrganizationPermissionWorkspace;
  committees: Array<{ id: string; name: string }>;
  locale: Locale;
}) {
  const [capability, setCapability] = useState("MEMBERS_VIEW");
  const en = locale === "en";
  const c = createTranslator(en ? "en" : "ar");

  return <div className="space-y-6">
    <section className="panel p-5 sm:p-7">
      <div className="mb-6"><h2 className="text-xl font-bold">{c("منح صلاحية لعضو","Grant a member access")}</h2></div>
      <WorkflowForm operation="grant" fields={{ org: organization }} label={c("حفظ التفويض","Save permission")} mutation={mutateOrganizationMembers} locale={locale}>
        <FormField  label={<>{c("العضو","Member")}</>}><NativeSelect name="member" required defaultValue="" disabled={!workspace.members.length}><option value="" disabled>{c("اختر عضوًا نشطًا","Choose an active member")}</option>{workspace.members.map(member => <option key={member.id} value={member.id} dir="auto">{member.name}</option>)}</NativeSelect></FormField>
        <FormField  label={<>{c("الصلاحية","Capability")}</>}><NativeSelect name="capability" value={capability} onChange={event => setCapability(event.target.value)}>{Object.entries(permissionLabels).map(([code, value]) => <option key={code} value={code}>{value[en ? 1 : 0]}</option>)}</NativeSelect></FormField>
        {scopedPermissions.has(capability) ? <FormField  label={<>{c("النطاق","Scope")}</>}><NativeSelect name="committee" defaultValue=""><option value="">{c("الجهة بالكامل","Whole organization")}</option>{committees.map(committee => <option key={committee.id} value={committee.id} dir="auto">{committee.name}</option>)}</NativeSelect></FormField> : <input type="hidden" name="committee" value=""/>}
        <DateInput name="ends" label={c("انتهاء التفويض (اختياري)","Permission expires (optional)")} locale={locale}/>
      </WorkflowForm>
    </section>

    <section className="panel p-5 sm:p-7" aria-labelledby="active-permissions-title">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><h2 id="active-permissions-title" className="text-xl font-bold">{c("التفويضات الحالية","Current permissions")}</h2><span className="rounded-full bg-mist px-3 py-1 text-sm font-semibold"><NumberText value={workspace.grants.length}/></span></div>
      {workspace.grants.length ? <ul className="divide-y divide-line">{workspace.grants.map(grant => <li key={grant.id} className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
        <div className="min-w-0"><p className="font-semibold"><bdi>{grant.member}</bdi></p><p className="mt-1 text-sm text-muted">{permissionLabels[grant.code]?.[en ? 1 : 0] ?? grant.code} · <bdi>{grant.committee ?? c("الجهة بالكامل","Whole organization")}</bdi>{grant.ends && <> · {c("ينتهي","Ends")} <time dateTime={grant.ends}>{formatRiyadhDate(grant.ends, locale)}</time></>}</p></div>
        <WorkflowForm operation="end-grant" fields={{ org: organization, grant: grant.id }} label={c("إنهاء التفويض","End permission")} mutation={mutateOrganizationMembers} locale={locale}><label className="text-sm"><input type="checkbox" name="confirm" required/> {c("أؤكد الإنهاء","Confirm ending")}</label></WorkflowForm>
      </li>)}</ul> : <p className="workspace-empty">{c("لا توجد تفويضات نشطة.","No active permissions.")}</p>}
    </section>
  </div>;
}
