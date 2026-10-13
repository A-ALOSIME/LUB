"use client";

import { useMemo, useState } from "react";
import { HoursFields } from "@/features/hours/view";
import { HoursForm } from "@/features/hours/form";
import { WorkflowForm } from "@/features/forms/mutation-form";
import { mutateOrganizationMembers } from "@/features/organizations/members-actions";
import type { OrganizationMemberWorkspace } from "@/features/organizations/management-repository";
import type { Locale } from "@/lib/preferences";

const roleNames: Record<string, [string, string]> = { OL: ["قائد الجهة", "Organization leader"], OD: ["نائب القائد", "Deputy leader"], CL: ["قائد لجنة", "Committee leader"], CD: ["نائب لجنة", "Committee deputy"] };
function date(value: string, locale: Locale) { return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar-SA", { dateStyle: "medium", calendar: "gregory", numberingSystem: "latn", timeZone: "Asia/Riyadh" }).format(new Date(`${value}T12:00:00+03:00`)); }

export function MemberDirectory({ organization, workspace, locale }: { organization: string; workspace: OrganizationMemberWorkspace; locale: Locale }) {
  const [query, setQuery] = useState("");
  const en = locale === "en";
  const c = (ar: string, english: string) => en ? english : ar;
  const members = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return workspace.members;
    return workspace.members.filter(member => [member.name, member.major, member.level, ...member.committees.map(x => x.name), ...member.roles.map(x => roleNames[x.code]?.[en ? 1 : 0] ?? x.code)].join(" ").toLocaleLowerCase().includes(normalized));
  }, [en, query, workspace.members]);

  return <>
    <section className="panel mb-6 p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-action">{c("قاعدة بيانات الجهة","Organization directory")}</p><h2 className="mt-1 text-xl font-bold">{c("الأعضاء","Members")}</h2><p className="mt-1 text-sm text-muted">{c("الأسماء والتخصصات والأدوار والساعات المعتمدة فقط.","Names, majors, roles and approved hours.")}</p></div><span className="rounded-full bg-mist px-3 py-1 text-sm font-semibold">{members.length} / {workspace.members.length}</span></div>
      <label className="mt-5 block max-w-xl">{c("بحث في الأعضاء","Search members")}<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={c("الاسم أو التخصص أو اللجنة","Name, major or committee")}/></label>
    </section>

    {members.length ? <>
      <div className="hidden overflow-hidden rounded-2xl border border-line bg-[var(--surface)] md:block">
        <div className="overflow-x-auto"><table className="member-directory-table w-full min-w-[760px] text-start"><thead><tr><th>{c("الطالب","Student")}</th><th>{c("العضوية","Membership")}</th><th>{c("الدور واللجان","Role and committees")}</th><th>{c("الساعات المعتمدة","Approved hours")}</th><th>{c("الإجراءات","Actions")}</th></tr></thead><tbody>{members.map(member => <tr key={member.id}>
          <td><p className="font-semibold"><bdi>{member.name}</bdi></p><p className="mt-1 text-sm text-muted"><bdi>{member.major}</bdi> · {member.level}</p></td>
          <td><span className="font-medium">{member.status === "Active" ? c("نشطة","Active") : member.status === "Ended" ? c("منتهية","Ended") : c("غير نشطة","Inactive")}</span><p className="mt-1 text-sm text-muted">{date(member.startDate, locale)}{member.endDate ? ` · ${date(member.endDate, locale)}` : ""}</p></td>
          <td><div className="space-y-1">{member.roles.length ? member.roles.map((role, i) => <p key={i} className="text-sm">{roleNames[role.code]?.[en ? 1 : 0] ?? role.code}{role.committee && <> · <bdi>{role.committee}</bdi></>}</p>) : <p className="text-sm text-muted">{c("عضو","Member")}</p>}{member.committees.length > 0 && <p className="text-sm text-muted"><bdi>{member.committees.map(x => x.name).join("، ")}</bdi></p>}</div></td>
          <td className="whitespace-nowrap font-bold">{member.hours} {c("ساعة","hours")}</td>
          <td><MemberActions organization={organization} member={member} workspace={workspace} locale={locale}/></td>
        </tr>)}</tbody></table></div>
      </div>
      <ul className="grid gap-4 md:hidden">{members.map(member => <li key={member.id} className="panel min-w-0 p-5">
        <div className="flex items-start justify-between gap-4"><div className="min-w-0"><h3 className="break-words font-bold"><bdi>{member.name}</bdi></h3><p className="mt-1 text-sm text-muted"><bdi>{member.major}</bdi> · {member.level}</p></div><span className="shrink-0 rounded-full bg-mist px-2.5 py-1 text-xs">{member.status === "Active" ? c("نشطة","Active") : member.status === "Ended" ? c("منتهية","Ended") : c("غير نشطة","Inactive")}</span></div>
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm"><div><dt className="text-muted">{c("منذ","Since")}</dt><dd className="mt-1 font-medium">{date(member.startDate, locale)}</dd></div><div><dt className="text-muted">{c("الساعات","Hours")}</dt><dd className="mt-1 font-bold">{member.hours}</dd></div></dl>
        <div className="mt-3 flex flex-wrap gap-2">{member.roles.map((role,i)=><span key={i} className="rounded-full bg-mist px-2.5 py-1 text-xs">{roleNames[role.code]?.[en?1:0]??role.code}{role.committee?` · ${role.committee}`:""}</span>)}{member.committees.map(committee=><span key={committee.id} className="rounded-full border border-line px-2.5 py-1 text-xs"><bdi>{committee.name}</bdi></span>)}</div>
        <div className="mt-4 border-t border-line pt-4"><MemberActions organization={organization} member={member} workspace={workspace} locale={locale}/></div>
      </li>)}</ul>
    </> : <p className="panel p-6 text-muted">{c("لا يوجد أعضاء مطابقون للبحث.","No members match this search.")}</p>}
  </>;
}

function MemberActions({ organization, member, workspace, locale }: { organization: string; member: OrganizationMemberWorkspace["members"][number]; workspace: OrganizationMemberWorkspace; locale: Locale }) {
  const en = locale === "en";
  const c = (ar: string, english: string) => en ? english : ar;
  const canAddHours = workspace.canAddHours || member.hourScopes.length > 0;
  return <div className="flex flex-wrap items-center gap-2">
    {member.status === "Active" && canAddHours && workspace.terms.length > 0 && <details className="w-full max-w-sm"><summary className="cursor-pointer text-sm font-semibold text-action">{c("إضافة ساعات","Add hours")}</summary><div className="mt-3 rounded-xl bg-mist p-4"><HoursForm operation="add" fields={{ member: member.id }} label={c("حفظ الساعات","Save hours")} locale={locale}>
      {(workspace.canAddHours || member.hourScopes.length > 0) && <label>{c("اللجنة (اختياري)","Committee (optional)")}<select name="committee" required={!workspace.canAddHours} defaultValue=""><option value="">{workspace.canAddHours ? c("الجهة بالكامل","Whole organization") : c("اختر لجنة","Choose a committee")}</option>{member.hourScopes.map(scope => <option key={scope.id} value={scope.id} dir="auto">{scope.name}</option>)}</select></label>}
      <HoursFields terms={workspace.terms.map(term => ({ id: term.id, name_ar: term.name, academic_year: term.year, term_code: term.termCode, start_date: term.startDate, end_date: term.endDate }))} locale={locale}/>
    </HoursForm></div></details>}
    {member.canManage && <details className="w-full max-w-sm"><summary className="cursor-pointer text-sm font-semibold text-red-700">{c("إنهاء العضوية","End membership")}</summary><div className="mt-3 rounded-xl border border-line bg-mist p-4"><p className="mb-3 text-sm leading-6 text-muted">{c("ستنتهي أدوار العضو وتفويضاته النشطة، مع الاحتفاظ بسجله وساعاته.","Active roles and grants will end while the membership and hours history remain.")}</p><WorkflowForm operation="end-member" fields={{ org: organization, member: member.id }} label={c("إنهاء العضوية","End membership")} mutation={mutateOrganizationMembers} locale={locale}><label>{c("سبب الإنهاء","Reason")}<textarea name="reason" minLength={3} maxLength={500} rows={3} required/></label><label className="text-sm"><input type="checkbox" name="confirm" required/> {c("أؤكد إنهاء العضوية","Confirm ending this membership")}</label></WorkflowForm></div></details>}
  </div>;
}
