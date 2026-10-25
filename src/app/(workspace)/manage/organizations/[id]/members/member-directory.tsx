"use client";

import { academicLevel,formatHours } from "@/lib/display";
import { Tooltip,TooltipTrigger,TooltipContent } from "@/components/ui/tooltip";
import { NativeSelect } from "@/components/ui/native-select";
import { ManagementActionSheet } from "@/components/management-action-sheet";
import { useMemo, useState } from "react";
import { HoursFields } from "@/features/hours/view";
import { HoursForm } from "@/features/hours/form";
import { WorkflowForm } from "@/features/forms/mutation-form";
import { mutateOrganizationMembers } from "@/features/organizations/members-actions";
import { Badge } from "@/components/ui/badge";
import { RowAction } from "@/components/row-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DateInput } from "@/features/forms/date-input";
import { Clock, Search, ShieldCheck, ShieldPlus, UserRoundMinus } from "lucide-react";
import type { OrganizationMemberWorkspace, OrganizationPermissionWorkspace } from "@/features/organizations/management-repository";
import type { Locale } from "@/lib/preferences";
import { permissionLabels, scopedPermissions } from "../permissions/permission-editor";
import { OrganizationStatusBadge } from "@/features/organizations/organization-status-badge";
import { formatRiyadhDate } from "@/lib/datetime";

const roleNames: Record<string, [string, string]> = { OL: ["قائد الجهة", "Organization leader"], OD: ["نائب القائد", "Deputy leader"], CL: ["قائد لجنة", "Committee leader"], CD: ["نائب لجنة", "Committee deputy"] };
function date(value: string, locale: Locale) { return formatRiyadhDate(value, locale); }

export function MemberDirectory({ organization, workspace, permissions, locale }: { organization: string; workspace: OrganizationMemberWorkspace; permissions?: OrganizationPermissionWorkspace; locale: Locale }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const en = locale === "en";
  const c = (ar: string, english: string) => en ? english : ar;
  const members = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return workspace.members.filter(member => {
      const matchesQuery = !normalized || [member.name, member.major, member.level, ...member.committees.map(x => x.name), ...member.roles.map(x => roleNames[x.code]?.[en ? 1 : 0] ?? x.code)].join(" ").toLocaleLowerCase().includes(normalized);
      const matchesStatus = status === "all" || member.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [en, query, status, workspace.members]);

  return <>
    <div className="member-directory-toolbar" dir={en ? "ltr" : "rtl"}>
      <div className="member-directory-search-wrap">
        <Search aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input type="text" role="searchbox" dir={en ? "ltr" : "rtl"} value={query} onChange={event => setQuery(event.target.value)} placeholder={c("الاسم أو التخصص أو اللجنة","Name, major or committee")} aria-label={c("بحث الأعضاء","Search members")} className="member-directory-search ps-9" />
      </div>
      <FilterTabs value={status} ariaLabel={c("تصفية الأعضاء حسب الحالة", "Filter members by status")} dir={en ? "ltr" : "rtl"} size="sm" activeTone="primary" onValueChange={setStatus} options={[
        { value: "all", label: c("الكل", "All") },
        { value: "Active", label: c("نشطة", "Active") },
        { value: "Ended", label: c("منتهية", "Ended") },
      ]} />
      {permissions && <ActiveDelegations organization={organization} data={permissions} locale={locale}/>}
    </div>

    {members.length ? <>
      <div className="hidden overflow-hidden rounded-2xl border border-line bg-[var(--surface)] lg:block">
        <div className="overflow-x-auto"><table className="member-directory-table w-full min-w-[1200px] text-start"><thead><tr><th>{c("الطالب","Student")}</th><th>{c("العضوية","Membership")}</th><th>{c("الدور واللجان","Role and committees")}</th><th>{c("الساعات المعتمدة","Approved hours")}</th><th>{c("الإجراءات","Actions")}</th></tr></thead><tbody>{members.map(member => <tr key={member.id}>
          <td><div className="member-directory-identity"><Avatar><AvatarFallback>{member.name.trim().slice(0, 1) || "؟"}</AvatarFallback></Avatar><div className="min-w-0"><p className="font-semibold"><bdi>{member.name}</bdi></p><p className="mt-1 text-sm text-muted"><bdi>{member.major}</bdi> · {academicLevel(member.level,locale)}</p></div></div></td>
          <td><OrganizationStatusBadge status={member.status === "Active" ? "active" : member.status === "Ended" ? "ended" : "inactive"}>{member.status === "Active" ? c("نشطة","Active") : member.status === "Ended" ? c("منتهية","Ended") : c("غير نشطة","Inactive")}</OrganizationStatusBadge><p className="mt-1 text-sm text-muted">{c("منذ", "Since")} {date(member.startDate, locale)}</p></td>
          <td><div className="member-directory-tags">{member.roles.length ? member.roles.map((role, i) => <Badge key={i} variant="secondary">{roleNames[role.code]?.[en ? 1 : 0] ?? role.code}{role.committee && <> · <bdi>{role.committee}</bdi></>}</Badge>) : <span className="text-sm text-muted">{c("عضو","Member")}</span>}{!member.committees.length&&<span className="text-sm text-muted-foreground">{c("بدون لجنة","No committee")}</span>}{member.committees.map(committee => <Badge key={committee.id} variant="outline"><bdi>{committee.name}</bdi></Badge>)}{permissions?.grants.filter(grant => grant.membership === member.id).map(grant => <Badge key={grant.id} variant="secondary">{permissionLabels[grant.code]?.[en ? 1 : 0] ?? grant.code}</Badge>)}</div></td>
          <td className="whitespace-nowrap">{formatHours(member.hours,locale)}</td>
          <td><MemberActions organization={organization} member={member} workspace={workspace} committees={permissions?.committees ?? []} locale={locale}/></td>
        </tr>)}</tbody></table></div>
      </div>
      <ul className="grid gap-3 lg:hidden">{members.map(member => <li key={member.id} className="member-directory-card panel min-w-0 p-4">
        <div className="flex items-start justify-between gap-3"><div className="member-directory-identity min-w-0"><Avatar><AvatarFallback>{member.name.trim().slice(0, 1) || "؟"}</AvatarFallback></Avatar><div className="min-w-0"><h3 className="break-words font-bold"><bdi>{member.name}</bdi></h3><p className="mt-1 text-sm text-muted"><bdi>{member.major}</bdi> · {academicLevel(member.level,locale)}</p></div></div><OrganizationStatusBadge status={member.status === "Active" ? "active" : member.status === "Ended" ? "ended" : "inactive"}>{member.status === "Active" ? c("نشطة","Active") : member.status === "Ended" ? c("منتهية","Ended") : c("غير نشطة","Inactive")}</OrganizationStatusBadge></div>
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm"><div><dt className="text-muted">{c("تاريخ الانضمام","Joined")}</dt><dd className="mt-1 font-medium">{c("منذ", "Since")} {date(member.startDate, locale)}</dd></div><div><dt className="text-muted">{c("الساعات","Hours")}</dt><dd className="mt-1">{formatHours(member.hours,locale)}</dd></div></dl>
        <div className="mt-3 flex flex-wrap gap-2">{member.roles.map((role,i)=><Badge key={i} variant="secondary">{roleNames[role.code]?.[en?1:0]??role.code}{role.committee?` · ${role.committee}`:""}</Badge>)}{permissions?.grants.filter(grant => grant.membership === member.id).map(grant => <Badge key={grant.id} variant="secondary">{permissionLabels[grant.code]?.[en ? 1 : 0] ?? grant.code}</Badge>)}{!member.committees.length&&<span className="text-sm text-muted-foreground">{c("بدون لجنة","No committee")}</span>}{member.committees.map(committee=><Badge key={committee.id} variant="outline"><bdi>{committee.name}</bdi></Badge>)}</div>
        <div className="mt-4 lg:hidden"><MemberActions organization={organization} member={member} workspace={workspace} committees={permissions?.committees ?? []} locale={locale} mobile /></div>
      </li>)}</ul>
    </> : <p className="workspace-empty">{c("لا يوجد أعضاء مطابقون للبحث.","No members match this search.")}</p>}
  </>;
}

function MemberActions({ organization, member, workspace, committees, locale, mobile = false }: { organization: string; member: OrganizationMemberWorkspace["members"][number]; workspace: OrganizationMemberWorkspace; committees: OrganizationPermissionWorkspace["committees"]; locale: Locale; mobile?: boolean }) {
  const en = locale === "en";
  const c = (ar: string, english: string) => en ? english : ar;
  const canAddHours = workspace.canAddHours || member.hourScopes.length > 0;
  const [action, setAction] = useState<"hours" | "grant" | "end" | null>(null);
  const canGrant = workspace.canGrant && member.status === "Active";
  return <>
    <div className={`member-directory-actions${mobile ? " member-directory-actions--mobile" : ""}`}>
      <RowAction label={c("منح صلاحية","Grant permission")} disabled={!canGrant} onClick={()=>setAction("grant")}><ShieldPlus/></RowAction>
      <RowAction label={c("إضافة ساعات","Add hours")} disabled={member.status!=="Active"||!canAddHours} onClick={()=>setAction("hours")}><Clock/></RowAction>
      <RowAction danger className="member-directory-action--end" label={c("إنهاء العضوية","End membership")} disabled={member.status!=="Active"||!member.canManage} onClick={()=>setAction("end")}><UserRoundMinus/></RowAction>
    </div>
    {action === "grant" && <PermissionGrantDialog organization={organization} member={member} committees={committees} locale={locale} open onOpenChange={open => { if (!open) setAction(null); }} hideTrigger/>}
    {action === "hours" && <ManagementActionSheet label="" title={c("إضافة ساعات للعضو","Add member hours")} locale={locale} open onOpenChange={open => { if (!open) setAction(null); }} hideTrigger><HoursForm operation="add" fields={{ member: member.id }} label={c("حفظ الساعات","Save hours")} locale={locale}>
      {(workspace.canAddHours || member.hourScopes.length > 0) && <label>{c("اللجنة (اختياري)","Committee (optional)")}<NativeSelect name="committee" required={!workspace.canAddHours} defaultValue=""><option value="">{workspace.canAddHours ? c("الجهة بالكامل","Whole organization") : c("اختر لجنة","Choose a committee")}</option>{member.hourScopes.map(scope => <option key={scope.id} value={scope.id} dir="auto">{scope.name}</option>)}</NativeSelect></label>}
      <HoursFields locale={locale}/>
    </HoursForm></ManagementActionSheet>}
    {action === "end" && <ManagementActionSheet label="" title={c(`إنهاء عضوية ${member.name}؟`,`End membership for ${member.name}?`)} locale={locale} icon={<UserRoundMinus aria-hidden="true" />} variant="destructive" open onOpenChange={open => { if (!open) setAction(null); }} hideTrigger><p className="mb-3 text-sm leading-6 text-muted">{c("ستنتهي أدوار العضو وصلاحياته النشطة، مع الاحتفاظ بسجله وساعاته.","Active roles and grants will end while the membership and hours history remain.")}</p><WorkflowForm operation="end-member" buttonClassName="button-danger" fields={{ org: organization, member: member.id }} label={c("إنهاء العضوية","End membership")} mutation={mutateOrganizationMembers} locale={locale}><label>{c("سبب الإنهاء","Reason")}<textarea name="reason" minLength={3} maxLength={500} rows={3} required/></label><label className="text-sm"><input type="checkbox" name="confirm" required/> {c("أؤكد إنهاء العضوية","Confirm ending this membership")}</label></WorkflowForm></ManagementActionSheet>}
  </>;
}

function PermissionGrantDialog({ organization, member, committees, locale, open, onOpenChange, hideTrigger = false }: { organization: string; member: OrganizationMemberWorkspace["members"][number]; committees: OrganizationPermissionWorkspace["committees"]; locale: Locale; open?: boolean; onOpenChange?: (open: boolean) => void; hideTrigger?: boolean }) {
  const [capability, setCapability] = useState("MEMBERS_VIEW");
  const en = locale === "en", c = (ar: string, english: string) => en ? english : ar;
  return <ManagementActionSheet label={c("منح صلاحية", "Grant access")} title={c(`تفويض ${member.name}`, `Grant access to ${member.name}`)} locale={locale} icon={<ShieldPlus aria-hidden="true" />} open={open} onOpenChange={onOpenChange} hideTrigger={hideTrigger}>
    <WorkflowForm operation="grant" fields={{ org: organization, member: member.id }} label={c("حفظ التفويض", "Save permission")} mutation={mutateOrganizationMembers} locale={locale}>
      <label>{c("الصلاحية", "Permission")}<NativeSelect name="capability" value={capability} onChange={event => setCapability(event.target.value)}>{Object.entries(permissionLabels).map(([code, labels]) => <option key={code} value={code}>{labels[en ? 1 : 0]}</option>)}</NativeSelect></label>
      {scopedPermissions.has(capability) ? <label>{c("النطاق", "Scope")}<NativeSelect name="committee" defaultValue=""><option value="">{c("الجهة بالكامل", "Entire organization")}</option>{committees.map(committee => <option key={committee.id} value={committee.id} dir="auto">{committee.name}</option>)}</NativeSelect></label> : <input type="hidden" name="committee" value=""/>}
      <DateInput name="ends" label={c("تاريخ الانتهاء (اختياري)", "Expiry date (optional)")} locale={locale}/>
    </WorkflowForm>
  </ManagementActionSheet>;
}

function ActiveDelegations({ organization, data, locale }: { organization: string; data: OrganizationPermissionWorkspace; locale: Locale }) {
  const en = locale === "en", c = (ar: string, english: string) => en ? english : ar;
  const date = (value: string) => formatRiyadhDate(value, locale);
  return <Popover>
    <Tooltip><TooltipTrigger render={<span className="inline-flex" tabIndex={0}/>}>
    <PopoverTrigger render={<Button type="button" variant="outline" size="sm" disabled={!data.grants.length}><ShieldCheck aria-hidden="true" />{c("عرض التفويضات النشطة", "View active permissions")} {data.grants.length>0&&<Badge variant="secondary">{data.grants.length}</Badge>}</Button>} /></TooltipTrigger><TooltipContent>{c("التفويض يمنح عضوًا صلاحية محددة لفترة أو نطاق معين.","Delegation grants a member a specific permission for a scope or period.")}</TooltipContent></Tooltip>
    <PopoverContent align={en ? "end" : "start"} className="max-h-[min(70vh,32rem)] w-[min(24rem,calc(100vw-2rem))] overflow-y-auto">
      {data.grants.length ? <ul className="divide-y divide-border">{data.grants.map(grant => <li key={grant.id} className="grid gap-1 py-3 first:pt-0">
        <p className="font-medium"><bdi>{grant.member}</bdi></p>
        <p className="text-xs text-muted-foreground">{permissionLabels[grant.code]?.[en ? 1 : 0] ?? grant.code} · <bdi>{grant.committee ?? c("كل الجهة", "Organization")}</bdi>{grant.ends && ` · ${c("حتى", "until")} ${date(grant.ends)}`}</p>
        <WorkflowForm operation="end-grant" fields={{ org: organization, grant: grant.id }} label={c("إنهاء التفويض", "End permission")} mutation={mutateOrganizationMembers} locale={locale}><label className="flex items-center gap-2 text-xs"><input type="checkbox" name="confirm" required/>{c("أؤكد الإنهاء", "Confirm ending")}</label></WorkflowForm>
      </li>)}</ul> : <p className="py-2 text-sm text-muted-foreground">{c("لا توجد تفويضات نشطة.", "No active permissions.")}</p>}
    </PopoverContent>
  </Popover>;
}
