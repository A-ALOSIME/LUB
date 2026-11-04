"use client";
import {SelectionActionBar} from "@/components/selection-action-bar";
import {useListQuery} from "@/lib/list-query";
import {SearchFilterToolbar} from "@/components/search-filter-toolbar";
import {formatCount,majorLabel} from "@/lib/display";
import {NumberText} from "@/components/number-text";
import {createTranslator} from "@/lib/i18n";
import {useRouter} from "next/navigation";
import {Alert,AlertDescription} from "@/components/ui/alert";
import {Checkbox} from "@/components/ui/checkbox";
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogCancel} from "@/components/ui/alert-dialog";

import { academicLevel,formatHours } from "@/lib/display";
import { Tooltip,TooltipTrigger,TooltipContent } from "@/components/ui/tooltip";
import { NativeSelect } from "@/components/ui/native-select";
import { ManagementActionSheet } from "@/components/management-action-sheet";
import { useEffect, useState,useMemo } from "react";
import {useQuery,useQueryClient,keepPreviousData} from "@tanstack/react-query";
import {useQueryActor} from "@/components/private-query-provider";
import {memberListQuery,memberDetailQuery,memberPreview} from "@/features/organizations/member-queries";
import {initialMemberFilters,type MemberFilters} from "@/features/organizations/member-types";
import {MemberExportButton} from "@/features/organizations/member-export-button";
import {MemberDetailSheet} from "@/features/organizations/member-detail-sheet";
import {DataTable,type DataTableColumn} from "@/components/data-table";
import {Empty,EmptyHeader,EmptyTitle,EmptyDescription,EmptyMedia} from "@/components/ui/empty";
import {Users,Eye,Plus,X} from "lucide-react";
import { HoursFields } from "@/features/hours/view";
import { HoursForm } from "@/features/hours/form";
import { WorkflowForm } from "@/features/forms/mutation-form";
import { mutateOrganizationMembers } from "@/features/organizations/members-actions";
import { Badge } from "@/components/ui/badge";
import { RowAction } from "@/components/row-action";
import { Button } from "@/components/ui/button";
import {InputGroup,InputGroupInput,InputGroupAddon} from "@/components/ui/input-group";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DateInput } from "@/features/forms/date-input";
import { FolderInput, Clock, Search, ShieldCheck, ShieldPlus, UserRoundMinus } from "lucide-react";
import type { OrganizationMemberWorkspace, OrganizationPermissionWorkspace } from "@/features/organizations/management-repository";
import type { Locale } from "@/lib/preferences";
import { permissionLabels, scopedPermissions } from "../permissions/permission-editor";
import { OrganizationStatusBadge } from "@/features/organizations/organization-status-badge";
import { formatRiyadhDate } from "@/lib/datetime";
import { FormField } from "@/components/form-field";

const roleNames: Record<string, [string, string]> = { OL: ["قائد الجهة", "Organization leader"], OD: ["نائب القائد", "Deputy leader"], CL: ["قائد لجنة", "Committee leader"], CD: ["نائب لجنة", "Committee deputy"] };
function date(value: string, locale: Locale) { return formatRiyadhDate(value, locale); }

export function MemberDirectory({ organization, workspace, permissions, locale,initialFilters=initialMemberFilters }: {initialFilters?:MemberFilters; organization: string; workspace: OrganizationMemberWorkspace; permissions?: OrganizationPermissionWorkspace; locale: Locale }) {
  const {params,change}=useListQuery(`?${new URLSearchParams({memberSort:initialFilters.sort??"name:asc",memberSearch:initialFilters.q,memberStatus:initialFilters.status,memberCommittee:initialFilters.committee??"",memberPage:String(initialFilters.page??0)})}`);
  const filters=useMemo<MemberFilters>(()=>({sort:(["name:asc","name:desc","date:asc","date:desc"] as const).find(value=>value===params.get("memberSort"))??"name:asc",page:Math.max(0,Math.min(10000,Number(params.get("memberPage"))||0)),q:params.get("memberSearch")??"",status:(["Active","Ended","Inactive"] as const).find(value=>value===params.get("memberStatus"))??"all",committee:workspace.committees.some(item=>item.id===params.get("memberCommittee"))?params.get("memberCommittee"):null}),[params,workspace.committees]);
  const setFilters=(next:MemberFilters)=>{setChecked(new Set());change({memberSort:next.sort??"name:asc",memberSearch:next.q,memberStatus:next.status,memberCommittee:next.committee,memberPage:String(next.page??0)},true);};
  const isInitial=(filters.sort??"name:asc")===(initialFilters.sort??"name:asc")&&filters.q===initialFilters.q&&filters.status===initialFilters.status&&filters.committee===initialFilters.committee&&(filters.page??0)===(initialFilters.page??0);
  const actor=useQueryActor(),client=useQueryClient();
  const [selected,setSelected]=useState<string|null>(null);
  const router=useRouter();
  function refreshMembers(){void client.invalidateQueries({queryKey:["members",actor,organization]});router.refresh();}
  const [checked,setChecked]=useState<Set<string>>(()=>new Set());
  const list=useQuery({...memberListQuery(actor,organization,filters),placeholderData:keepPreviousData,initialData:isInitial&&(workspace.rowTotal??workspace.members.length)<=workspace.members.length?workspace:undefined});
  useEffect(()=>{if((workspace.rowTotal??workspace.members.length)<=workspace.members.length)client.setQueryData(memberListQuery(actor,organization,initialFilters).queryKey,workspace);},[actor,client,organization,workspace,initialFilters]);
  const data=list.data??workspace,failed=list.isError,en=locale==="en",c=createTranslator(locale);
  const preview=data.members.find(row=>row.id===selected);
  const detail=useQuery({...memberDetailQuery(actor,organization,selected),enabled:selected!==null,placeholderData:preview?memberPreview(preview):undefined});
  const record=detail.data??null,recordError=detail.isError;
  function prefetchMember(id:string){void client.prefetchQuery(memberDetailQuery(actor,organization,id));}
  function openMember(id:string){setSelected(id);}
  const members=data.members;
  const selectedMembers=members.filter(member=>checked.has(member.id)),bulkScopes=[...(data.canAddHours?[{id:"",name:c("الجهة بالكامل","Entire organization")}]:[]),...(selectedMembers[0]?.hourScopes??[]).filter(scope=>selectedMembers.every(member=>member.hourScopes.some(item=>item.id===scope.id)))];
  useEffect(()=>{for(const status of ["all","Active","Ended","Inactive"] as const)void client.prefetchQuery(memberListQuery(actor,organization,{q:"",status,committee:null,page:0}));},[actor,client,organization]);
  function stateBadge(status:string){return <OrganizationStatusBadge status={status==="Active"?"active":status==="Ended"?"ended":"inactive"}>{status==="Active"?c("نشطة","Active"):status==="Ended"?c("منتهية","Ended"):c("غير نشطة","Inactive")}</OrganizationStatusBadge>;}
  function roleTags(member:OrganizationMemberWorkspace["members"][number]){return <div className="member-directory-tags">{member.roles.length?member.roles.map((role,i)=><Badge key={i} variant={role.code==="OL"?"default":"secondary"}>{roleNames[role.code]?.[en?1:0]??role.code}{role.committee&&<> · <bdi>{role.committee}</bdi></>}</Badge>):<span className="text-sm text-muted-foreground">{c("عضو","Member")}</span>}{!member.committees.length&&<span className="text-sm text-muted-foreground">{c("بدون لجنة","No committee")}</span>}{member.committees.map(x=><Badge key={x.id} variant="outline">{x.name}</Badge>)}{permissions?.grants.filter(x=>x.membership===member.id).map(x=><Badge key={x.id} variant="secondary">{permissionLabels[x.code]?.[en?1:0]??x.code}</Badge>)}</div>;}
  const columns:DataTableColumn<OrganizationMemberWorkspace["members"][number]>[]=[
    {id:"name",sortKey:"name",label:c("الطالب","Student"),render:member=><div className="min-w-0"><p className="font-medium"><bdi>{member.name}</bdi></p><p className="text-sm text-muted-foreground">{majorLabel(member.major,locale)} · {academicLevel(member.level,locale)}</p></div>},
    {id:"university",label:c("الرقم الجامعي","University ID"),className:"w-32",render:member=><bdi dir="ltr">{member.universityId??c("غير مسجل","Not recorded")}</bdi>},
    {id:"membership",sortKey:"date",label:c("العضوية","Membership"),className:"w-40",render:member=><>{stateBadge(member.status)}<p className="text-sm text-muted-foreground">{c("منذ","Since")} {date(member.startDate,locale)}</p></>},
    {id:"roles",label:c("الدور واللجان","Role and committees"),className:"w-48",render:roleTags},
    {id:"hours",label:c("الساعات المعتمدة","Approved hours"),className:"w-28",render:member=>formatHours(member.hours,locale)},
    {id:"actions",label:c("الإجراءات","Actions"),className:"w-52",renderMobile:member=><MemberActions organization={organization} member={member} workspace={data} onView={()=>openMember(member.id)} committees={permissions?.committees??[]} locale={locale} mobile/>,render:member=><MemberActions organization={organization} member={member} workspace={data} onView={()=>openMember(member.id)} committees={permissions?.committees??[]} locale={locale}/>}
  ];
  return <>
    <SearchFilterToolbar className="member-directory-toolbar mb-4" search={
      <InputGroup className="member-directory-search-wrap"><InputGroupAddon><Search/></InputGroupAddon><InputGroupInput role="searchbox" dir={en?"ltr":"rtl"} value={filters.q} onChange={event=>setFilters({...filters,page:0,q:event.target.value})} placeholder={c("الاسم أو التخصص أو اللجنة","Name, major or committee")} aria-label={c("بحث الأعضاء","Search members")} className="member-directory-search"/></InputGroup>}>

      <FilterTabs value={filters.status} ariaLabel={c("تصفية الأعضاء حسب الحالة","Filter members by status")} dir={en?"ltr":"rtl"} onValueChange={status=>setFilters({...filters,page:0,status:status as MemberFilters['status']})} options={[{value:"all",label:c("الكل","All")},{value:"Active",label:c("نشطة","Active")},{value:"Ended",label:c("منتهية","Ended")}]} />
      <NativeSelect className="w-auto" aria-label={c("تصفية حسب اللجنة","Filter by committee")} value={filters.committee??""} onChange={event=>setFilters({...filters,page:0,committee:event.target.value||null})}><option value="">{c("كل اللجان","All committees")}</option>{workspace.committees.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</NativeSelect>
      {permissions&&<ActiveDelegations organization={organization} data={permissions} locale={locale}/>}
      <MemberExportButton organization={organization} filters={filters} locale={locale} leader={workspace.canGrant}/>
    </SearchFilterToolbar>

    {failed&&<Alert className="mb-4"><AlertDescription>{c("تعذّر تحديث النتائج. حاول مجددًا.","Results could not be updated. Try again.")}</AlertDescription></Alert>}
    <SelectionActionBar visible={checked.size>0} locale={locale} message={<>{c("تم تحديد ","Selected: ")}{formatCount(checked.size,"students",locale)}</>} actions={<><ManagementActionSheet rowAction disabled={!bulkScopes.length} icon={<Plus/>} label={c("إضافة ساعات للمحددين","Add hours to selected students")} title={c(`إضافة ساعات إلى ${checked.size} طالب؟`,`Add hours to ${checked.size} students?`)} locale={locale}><HoursForm operation="add-selected" fields={{org:organization,members:JSON.stringify([...checked])}} label={c("تأكيد إضافة الساعات","Confirm hours")} locale={locale} onSuccess={()=>{setChecked(new Set());refreshMembers();}}><FormField label={c("نطاق الساعات","Hours scope")}><NativeSelect name="committee">{bulkScopes.map(scope=><option key={scope.id} value={scope.id}>{scope.name}</option>)}</NativeSelect></FormField><HoursFields locale={locale}/></HoursForm></ManagementActionSheet><RowAction label={c("إلغاء التحديد","Clear selection")} onClick={()=>setChecked(new Set())}><X/></RowAction></>}/>
    {members.length?<DataTable selection={{selected:checked,onChange:setChecked,disabled:row=>row.status!=="Active"||(!data.canAddHours&&!row.hourScopes.length),reason:()=>c("يتطلب عضوية نشطة وصلاحية إضافة الساعات","Requires active membership and permission to add hours")}} footer={formatCount(members.length,"students",locale,"nominative","number")} items={members} columns={columns} tableKey="members" locale={locale} showColumnsControl={false} sort={{value:filters.sort??"name:asc",onChange:value=>setFilters({...filters,page:0,sort:value as MemberFilters["sort"]})}} label={c("عرض تفاصيل العضو","View member details")} onOpen={member=>openMember(member.id)} onPrefetch={member=>prefetchMember(member.id)} pagination={{page:filters.page??0,more:(data.rowTotal??data.counts?.total??0)>((filters.page??0)+1)*25,onChange:page=>setFilters({...filters,page})}}/>
    :<Empty><EmptyHeader><EmptyMedia variant="icon"><Users/></EmptyMedia><EmptyTitle>{filters.q||filters.status!=="all"||filters.committee?c("لا توجد نتائج مطابقة","No matching results"):c("لا يوجد أعضاء بعد","No members yet")}</EmptyTitle><EmptyDescription>{filters.q||filters.status!=="all"||filters.committee?c("جرّب تغيير البحث أو الفلاتر.","Try another search or filter."):c("ستظهر بيانات الطلاب هنا عند انضمامهم للجهة.","Students will appear here when they join the organization.")}</EmptyDescription></EmptyHeader>{(filters.q||filters.status!=="all"||filters.committee)&&<Button variant="outline" onClick={()=>setFilters(initialMemberFilters)}>{c("مسح الفلاتر","Clear filters")}</Button>}</Empty>}
    <MemberDetailSheet open={selected!==null} onOpenChange={open=>{if(!open)setSelected(null);}} record={record} error={recordError} locale={locale}/>
  </>;
}

function MemberActions({ organization, member, workspace, committees, locale, onView, mobile = false }: { organization: string; member: OrganizationMemberWorkspace["members"][number]; workspace: OrganizationMemberWorkspace; committees: OrganizationPermissionWorkspace["committees"]; locale: Locale; onView:()=>void; mobile?: boolean }) {
  const en = locale === "en";
  const c = createTranslator(en ? "en" : "ar");
  const canAddHours = workspace.canAddHours || member.hourScopes.length > 0;
  const [action, setAction] = useState<"hours" | "grant" | "move" | "end" | null>(null);
  const router=useRouter(),client=useQueryClient(),actor=useQueryActor();
  function refreshMembers(){void client.invalidateQueries({queryKey:["members",actor,organization]});router.refresh();}
  const hasCommitteeRole=member.roles.some(role=>["CL","CD"].includes(role.code));
  const canGrant = workspace.canGrant && member.status === "Active";
  return <>
    <div onClick={event=>event.stopPropagation()} onKeyDown={event=>event.stopPropagation()} className={`member-directory-actions${mobile ? " member-directory-actions--mobile" : ""}`}>
      <RowAction label={c("عرض التفاصيل","View details")} onClick={onView}><Eye/></RowAction>
      <RowAction label={c("منح صلاحية","Grant permission")} disabled={!canGrant} hint={c("تحتاج صلاحية منح التفويضات","Permission to grant access is required")} onClick={()=>setAction("grant")}><ShieldPlus/></RowAction>
      <span role="separator" aria-orientation="vertical" className="mx-1 h-5 border-s border-border"/>
      <RowAction label={c("إضافة ساعات","Add hours")} disabled={member.status!=="Active"||!canAddHours} hint={member.status!=="Active"?c("العضوية غير نشطة","The membership is inactive"):c("تحتاج صلاحية إضافة الساعات","Permission to add hours is required")} onClick={()=>setAction("hours")}><Clock/></RowAction>
      <RowAction label={c("نقل إلى لجنة","Move to committee")} disabled={member.status!=="Active"||!member.canManage} hint={member.status!=="Active"?c("العضوية غير نشطة","The membership is inactive"):c("تحتاج صلاحية إدارة العضوية","Permission to manage this membership is required")} onClick={()=>setAction("move")}><FolderInput/></RowAction>
      <RowAction danger className="member-directory-action--end" label={c("إنهاء العضوية","End membership")} disabled={member.status!=="Active"||!member.canManage} hint={member.status!=="Active"?c("العضوية غير نشطة","The membership is inactive"):c("تحتاج صلاحية إدارة العضوية","Permission to manage this membership is required")} onClick={()=>setAction("end")}><UserRoundMinus/></RowAction>
    </div>
    {action==="move"&&<ManagementActionSheet label="" title={c(`نقل ${member.name} إلى لجنة`,`Move ${member.name} to a committee`)} locale={locale} open hideTrigger mobileBottomSheet onOpenChange={open=>{if(!open)setAction(null);}}><WorkflowForm operation="move-member" fields={{org:organization,member:member.id}} label={c("تأكيد النقل","Confirm move")} mutation={mutateOrganizationMembers} locale={locale} onSuccess={()=>{setAction(null);refreshMembers();}}><FormField label={c("اللجنة","Committee")}><NativeSelect name="committee" defaultValue={member.committees[0]?.id??""}><option value="">{c("بدون لجنة","No committee")}</option>{committees.map(committee=><option key={committee.id} value={committee.id}>{committee.name}</option>)}</NativeSelect></FormField>{member.committees.length>1&&<p className="text-sm text-muted-foreground">{c("سيحل الاختيار محل لجان العضو الحالية.","This selection replaces the member's current committees.")}</p>}{hasCommitteeRole&&<><Alert><AlertDescription>{c("النقل ينهي أي دور قيادي أو تفويض في اللجان السابقة؛ لا يمنح دورًا قياديًا تلقائيًا في اللجنة الجديدة.","Moving ends leadership and scoped permissions in previous committees; it does not grant leadership in the new committee.")}</AlertDescription></Alert><label className="flex items-center gap-2"><Checkbox name="confirmRoleChange" value="on" required/>{c("أوافق على تغيير أدوار اللجان السابقة","Confirm previous committee role changes")}</label></>}</WorkflowForm></ManagementActionSheet>}
    {action === "grant" && <PermissionGrantDialog organization={organization} member={member} committees={committees} locale={locale} open onOpenChange={open => { if (!open) setAction(null); }} onSuccess={()=>{setAction(null);refreshMembers();}} hideTrigger/>}
    {action === "hours" && <ManagementActionSheet label="" title={c("إضافة ساعات للعضو","Add member hours")} locale={locale} open onOpenChange={open => { if (!open) setAction(null); }} hideTrigger><HoursForm operation="add" fields={{ member: member.id }} label={c("حفظ الساعات","Save hours")} locale={locale} onSuccess={()=>{setAction(null);refreshMembers();}}>
      {(workspace.canAddHours || member.hourScopes.length > 0) && <FormField  label={<>{c("اللجنة (اختياري)","Committee (optional)")}</>}><NativeSelect name="committee" required={!workspace.canAddHours} defaultValue=""><option value="">{workspace.canAddHours ? c("الجهة بالكامل","Whole organization") : c("اختر لجنة","Choose a committee")}</option>{member.hourScopes.map(scope => <option key={scope.id} value={scope.id} dir="auto">{scope.name}</option>)}</NativeSelect></FormField>}
      <HoursFields locale={locale}/>
    </HoursForm></ManagementActionSheet>}
    <AlertDialog open={action==="end"} onOpenChange={open=>{if(!open)setAction(null);}}><AlertDialogContent dir={en?"ltr":"rtl"}>
      <AlertDialogHeader><AlertDialogTitle>{c(`إنهاء عضوية ${member.name}؟`,`End membership for ${member.name}?`)}</AlertDialogTitle><AlertDialogDescription>{c("ستنتهي أدوار العضو وصلاحياته النشطة، مع الاحتفاظ بسجله وساعاته.","Active roles and grants will end while membership and hours history remain.")}</AlertDialogDescription></AlertDialogHeader>
      <WorkflowForm operation="end-member" buttonClassName="button-danger" fields={{org:organization,member:member.id,confirm:"on"}} label={c("إنهاء العضوية","End membership")} mutation={mutateOrganizationMembers} locale={locale} onSuccess={()=>{setAction(null);refreshMembers();}} secondaryAction={<AlertDialogCancel>{c("إلغاء","Cancel")}</AlertDialogCancel>}>
        <FormField label={c("سبب الإنهاء","Reason")} required><textarea name="reason" minLength={3} maxLength={500} rows={3} required/></FormField>
      </WorkflowForm>
    </AlertDialogContent></AlertDialog>
  </>;
}

function PermissionGrantDialog({ organization, member, committees, locale, open, onOpenChange, onSuccess, hideTrigger = false }: { organization: string; member: OrganizationMemberWorkspace["members"][number]; committees: OrganizationPermissionWorkspace["committees"]; locale: Locale; open?: boolean; onOpenChange?: (open: boolean) => void; onSuccess?:()=>void; hideTrigger?: boolean }) {
  const [capability, setCapability] = useState("MEMBERS_VIEW");
  const en = locale === "en", c = createTranslator(en ? "en" : "ar");
  return <ManagementActionSheet label={c("منح صلاحية", "Grant access")} title={c(`تفويض ${member.name}`, `Grant access to ${member.name}`)} locale={locale} icon={<ShieldPlus aria-hidden="true" />} open={open} onOpenChange={onOpenChange} hideTrigger={hideTrigger}>
    <WorkflowForm operation="grant" fields={{ org: organization, member: member.id }} label={c("حفظ التفويض", "Save permission")} mutation={mutateOrganizationMembers} locale={locale} onSuccess={onSuccess}>
      <FormField  label={<>{c("الصلاحية", "Permission")}</>}><NativeSelect name="capability" value={capability} onChange={event => setCapability(event.target.value)}>{Object.entries(permissionLabels).map(([code, labels]) => <option key={code} value={code}>{labels[en ? 1 : 0]}</option>)}</NativeSelect></FormField>
      {scopedPermissions.has(capability) ? <FormField  label={<>{c("النطاق", "Scope")}</>}><NativeSelect name="committee" defaultValue=""><option value="">{c("الجهة بالكامل", "Entire organization")}</option>{committees.map(committee => <option key={committee.id} value={committee.id} dir="auto">{committee.name}</option>)}</NativeSelect></FormField> : <input type="hidden" name="committee" value=""/>}
      <DateInput name="ends" label={c("تاريخ الانتهاء (اختياري)", "Expiry date (optional)")} locale={locale}/>
    </WorkflowForm>
  </ManagementActionSheet>;
}

function ActiveDelegations({ organization, data, locale }: { organization: string; data: OrganizationPermissionWorkspace; locale: Locale }) {
  const en = locale === "en", c = createTranslator(en ? "en" : "ar");
  const date = (value: string) => formatRiyadhDate(value, locale);
  return <Popover>
    <Tooltip><TooltipTrigger render={<span className="inline-flex" tabIndex={0}/>}>
    <PopoverTrigger render={<Button type="button" variant="outline" size="default"><ShieldCheck aria-hidden="true" />{c("عرض التفويضات النشطة", "View active permissions")} {data.grants.length>0&&<Badge variant="secondary"><NumberText value={data.grants.length}/></Badge>}</Button>} /></TooltipTrigger><TooltipContent>{c("التفويض يمنح عضوًا صلاحية محددة لفترة أو نطاق معين.","Delegation grants a member a specific permission for a scope or period.")}</TooltipContent></Tooltip>
    <PopoverContent align={en ? "end" : "start"} className="max-h-[min(70vh,32rem)] w-[min(24rem,calc(100vw-2rem))] overflow-y-auto">
      {data.grants.length ? <ul className="divide-y divide-border">{data.grants.map(grant => <li key={grant.id} className="grid gap-1 py-3 first:pt-0">
        <p className="font-medium"><bdi>{grant.member}</bdi></p>
        <p className="text-xs text-muted-foreground">{permissionLabels[grant.code]?.[en ? 1 : 0] ?? grant.code} · <bdi>{grant.committee ?? c("كل الجهة", "Organization")}</bdi>{grant.ends && ` · ${c("حتى", "until")} ${date(grant.ends)}`}</p>
        <WorkflowForm operation="end-grant" fields={{ org: organization, grant: grant.id }} label={c("إنهاء التفويض", "End permission")} mutation={mutateOrganizationMembers} locale={locale}><label className="flex items-center gap-2 text-xs"><input type="checkbox" name="confirm" required/>{c("أؤكد الإنهاء", "Confirm ending")}</label></WorkflowForm>
      </li>)}</ul> : <p className="py-2 text-sm text-muted-foreground">{c("لا توجد تفويضات نشطة.", "No active permissions.")}</p>}
    </PopoverContent>
  </Popover>;
}
