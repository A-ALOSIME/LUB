"use client";

import { useState } from "react";
import { DateInput } from "@/features/forms/date-input";
import { WorkflowForm } from "@/features/forms/mutation-form";
import { mutateOrganizationMembers } from "@/features/organizations/members-actions";
import type { OrganizationPermissionWorkspace } from "@/features/organizations/management-repository";
import type { Locale } from "@/lib/preferences";

const labels: Record<string, [string, string]> = {
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
const scoped = new Set(["COMMITTEE_PROFILE_MANAGE", "MEMBERS_VIEW", "APPLICATIONS_VIEW", "APPLICATIONS_REVIEW", "APPLICATIONS_BULK_ACTION", "TASKS_MANAGE", "TASK_TEMPLATES_MANAGE", "HOUR_RULES_MANAGE", "HOURS_APPROVE", "HOURS_MANUAL_ADD", "REPORTS_GENERATE"]);

export function PermissionEditor({ organization, workspace, committees, locale }: {
  organization: string;
  workspace: OrganizationPermissionWorkspace;
  committees: Array<{ id: string; name: string }>;
  locale: Locale;
}) {
  const [capability, setCapability] = useState("MEMBERS_VIEW");
  const en = locale === "en";
  const c = (ar: string, english: string) => en ? english : ar;

  return <div className="space-y-6">
    <section className="panel p-5 sm:p-7">
      <div className="mb-6"><p className="text-sm font-semibold text-action">{c("وصول واحد لكل التفويضات","One place for all permissions")}</p><h2 className="mt-1 text-xl font-bold">{c("منح صلاحية لعضو","Grant a member access")}</h2><p className="mt-2 text-sm leading-7 text-muted">{c("اختر العضو والصلاحية، ثم حدّد اللجنة أو الجهة. تظهر خيارات النطاق حسب الصلاحية المختارة.","Choose a member and capability, then set its organization or committee scope. Scope choices follow the selected capability.")}</p></div>
      <WorkflowForm operation="grant" fields={{ org: organization }} label={c("حفظ التفويض","Save permission")} mutation={mutateOrganizationMembers} locale={locale}>
        <label>{c("العضو","Member")}<select name="member" required defaultValue="" disabled={!workspace.members.length}><option value="" disabled>{c("اختر عضوًا نشطًا","Choose an active member")}</option>{workspace.members.map(member => <option key={member.id} value={member.id} dir="auto">{member.name}</option>)}</select></label>
        <label>{c("الصلاحية","Capability")}<select name="capability" value={capability} onChange={event => setCapability(event.target.value)}>{Object.entries(labels).map(([code, value]) => <option key={code} value={code}>{value[en ? 1 : 0]}</option>)}</select></label>
        {scoped.has(capability) ? <label>{c("النطاق","Scope")}<select name="committee" defaultValue=""><option value="">{c("الجهة بالكامل","Whole organization")}</option>{committees.map(committee => <option key={committee.id} value={committee.id} dir="auto">{committee.name}</option>)}</select></label> : <><input type="hidden" name="committee" value=""/><p className="rounded-lg bg-mist px-4 py-3 text-sm text-muted">{c("هذه الصلاحية تشمل الجهة بالكامل.","This capability applies to the whole organization.")}</p></>}
        <DateInput name="ends" label={c("انتهاء التفويض (اختياري)","Permission expires (optional)")} locale={locale}/>
      </WorkflowForm>
    </section>

    <section className="panel p-5 sm:p-7" aria-labelledby="active-permissions-title">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h2 id="active-permissions-title" className="text-xl font-bold">{c("التفويضات الحالية","Current permissions")}</h2><p className="mt-1 text-sm text-muted">{c("إنهاء التفويض يحفظ أثره في السجل.","Ending access preserves its history.")}</p></div><span className="rounded-full bg-mist px-3 py-1 text-sm font-semibold">{workspace.grants.length}</span></div>
      {workspace.grants.length ? <ul className="divide-y divide-line">{workspace.grants.map(grant => <li key={grant.id} className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
        <div className="min-w-0"><p className="font-semibold"><bdi>{grant.member}</bdi></p><p className="mt-1 text-sm text-muted">{labels[grant.code]?.[en ? 1 : 0] ?? grant.code} · <bdi>{grant.committee ?? c("الجهة بالكامل","Whole organization")}</bdi>{grant.ends && <> · {c("ينتهي","Ends")} <time dateTime={grant.ends}>{new Intl.DateTimeFormat(en ? "en-GB" : "ar-SA", { dateStyle: "medium", calendar: "gregory", numberingSystem: "latn", timeZone: "Asia/Riyadh" }).format(new Date(grant.ends))}</time></>}</p></div>
        <WorkflowForm operation="end-grant" fields={{ org: organization, grant: grant.id }} label={c("إنهاء التفويض","End permission")} mutation={mutateOrganizationMembers} locale={locale}><label className="text-sm"><input type="checkbox" name="confirm" required/> {c("أؤكد الإنهاء","Confirm ending")}</label></WorkflowForm>
      </li>)}</ul> : <p className="rounded-xl bg-mist p-5 text-muted">{c("لا توجد تفويضات نشطة الآن.","There are no active delegated permissions.")}</p>}
    </section>
  </div>;
}
