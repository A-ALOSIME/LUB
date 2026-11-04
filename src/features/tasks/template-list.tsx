"use client";

import {useState} from "react";
import {useRouter} from "next/navigation";
import {Copy,LayoutTemplate,Pencil,Plus,Power,Search} from "lucide-react";
import {DataTable,DataTableTitle} from "@/components/data-table";
import {ListThumbnail} from "@/components/list-thumbnail";
import {ListEmpty} from "@/components/list-empty";
import {RowAction} from "@/components/row-action";
import {ManagementActionSheet} from "@/components/management-action-sheet";
import {Badge} from "@/components/ui/badge";
import {FilterTabs} from "@/components/ui/filter-tabs";
import {NativeSelect} from "@/components/ui/native-select";
import {InputGroup,InputGroupInput,InputGroupAddon} from "@/components/ui/input-group";
import {SearchFilterToolbar} from "@/components/search-filter-toolbar";
import {FormField} from "@/components/form-field";
import {Input} from "@/components/ui/input";
import {formatHours} from "@/lib/display";
import {createTranslator} from "@/lib/i18n";
import {useListQuery} from "@/lib/list-query";
import type {Locale} from "@/lib/preferences";
import {TaskForm} from "./task-form";
import {TaskFields} from "./task-fields";
import type {TaskTemplate,TaskWorkspace} from "./repository";

export function TaskTemplateList({org,workspace,locale}:{org:string;workspace:TaskWorkspace;locale:Locale}){
 const router=useRouter(),c=createTranslator(locale),{params,change}=useListQuery();
 const [editing,setEditing]=useState<TaskTemplate|null>(null);
 const scopes=workspace.scopes.filter(scope=>scope.templates),canEdit=(row:TaskTemplate)=>scopes.some(scope=>scope.id===row.committee_id);
 const q=(params.get("templateSearch")??"").slice(0,120),status=params.get("templateStatus")??"all",sort=params.get("templateSort")??"name:asc",page=Math.max(0,Number(params.get("templatePage"))||0);
 const filtered=workspace.templates.filter(row=>(!q||`${row.name} ${row.description_template}`.toLocaleLowerCase().includes(q.toLocaleLowerCase()))&&(status==="all"||row.is_active===(status==="active"))).sort((a,b)=>a.name.localeCompare(b.name,locale)*(sort==="name:desc"?-1:1)),rows=filtered;
 const update=(patch:Record<string,string|null>,replace=false)=>change({templatePage:null,...patch},replace);
 const scopeField=(value?:string|null)=><FormField label={c("نطاق العمل","Work scope")}><NativeSelect name="committee" defaultValue={value??scopes[0]?.id??""}>{scopes.map(scope=><option key={scope.id??"org"} value={scope.id??""}>{scope.name}</option>)}</NativeSelect></FormField>;
 const editForm=(row?:TaskTemplate)=><TaskForm operation="template" fields={{org,...(row?{template:row.id,committee:row.committee_id??"",revision:String(row.revision)}:{})}} locale={locale} label={c("حفظ القالب","Save template")} onSuccess={()=>router.refresh()}><TaskFields template organization={org} committee={row?.committee_id} value={row} locale={locale} scopeField={row?null:scopeField()}/></TaskForm>;
 const empty=<ListEmpty icon={LayoutTemplate} filtered={Boolean(q||status!=="all")} clear={()=>update({templateSearch:null,templateStatus:null})} title={c("لا توجد قوالب بعد","No templates yet")} description={c("احفظ تفاصيل المهام المتكررة في قالب.","Save recurring task details in a template.")}/>;
 return <section className="flex min-w-0 flex-col gap-4" aria-label={c("قوالب المهام","Task templates")}>
  <SearchFilterToolbar search={<InputGroup><InputGroupAddon><Search/></InputGroupAddon><InputGroupInput value={q} type="search" aria-label={c("بحث القوالب","Search templates")} placeholder={c("ابحث عن قالب","Search templates")} onChange={event=>update({templateSearch:event.target.value},true)}/></InputGroup>}>
   <FilterTabs value={status} dir={locale==="ar"?"rtl":"ltr"} ariaLabel={c("حالة القالب","Template status")} options={[{value:"all",label:c("الكل","All")},{value:"active",label:c("نشط","Active")},{value:"inactive",label:c("موقوف","Inactive")}]} onValueChange={value=>update({templateStatus:value==="all"?null:value})}/>
   {scopes.length>0&&<ManagementActionSheet label={c("قالب جديد","New template")} title={c("إضافة قالب مهمة","Add a task template")} locale={locale} triggerSize="default" variant="default" icon={<Plus/>}>{editForm()}</ManagementActionSheet>}
  </SearchFilterToolbar>
  <DataTable canOpen={canEdit} tableKey="templates" label={c("قوالب المهام","Task templates")} locale={locale} items={rows} empty={empty} onOpen={row=>{if(canEdit(row))setEditing(row);}} sort={{value:sort,onChange:value=>update({templateSort:value})}} pagination={{page,more:(page+1)*25<filtered.length,onChange:value=>change({templatePage:String(value)})}} columns={[
   {id:"name",label:c("القالب","Template"),sortKey:"name",render:row=><div className="flex min-w-0 items-center gap-3"><ListThumbnail icon={LayoutTemplate} src={row.image_asset_id?`/files/${row.image_asset_id}/preview?thumbnail=1`:null}/><div className="min-w-0"><DataTableTitle>{row.name}</DataTableTitle><p className="line-clamp-2 text-sm text-muted-foreground" dir="auto">{row.description_template}</p></div></div>},
   {id:"scope",label:c("النطاق","Scope"),className:"w-32",render:row=>workspace.scopes.find(scope=>scope.id===row.committee_id)?.name??c("الجهة بالكامل","Entire organization")},
   {id:"hours",label:c("الساعات","Hours"),className:"w-28",render:row=>formatHours(row.default_hours,locale)},
   {id:"status",label:c("الحالة","Status"),className:"w-28",render:row=><Badge variant={row.is_active?"secondary":"outline"}>{row.is_active?c("نشط","Active"):c("موقوف","Inactive")}</Badge>},
   {id:"actions",label:c("الإجراءات","Actions"),className:"w-40",render:row=><div className="flex flex-wrap items-center gap-1">
    <RowAction label={c("تعديل القالب","Edit template")} disabled={!canEdit(row)} hint={c("تحتاج صلاحية إدارة القالب في نطاقه","Template management permission is required in this scope")} onClick={()=>setEditing(row)}><Pencil/></RowAction>
    {canEdit(row)?<ManagementActionSheet rowAction icon={<Copy/>} label={c("نسخ القالب","Copy template")} title={c("نسخة مستقلة من القالب","Independent template copy")} locale={locale}><TaskForm operation="template" fields={{org,source:row.id,description:"",hours:"0",active:"on"}} locale={locale} label={c("نسخ القالب","Copy template")} onSuccess={()=>router.refresh()}>{scopeField(row.committee_id)}<FormField label={c("اسم النسخة","Copy name")} required><Input name="title" required minLength={2} maxLength={120} defaultValue={`${row.name.slice(0,110)} (${c("نسخة","copy")})`}/></FormField></TaskForm></ManagementActionSheet>:<RowAction label={c("نسخ القالب","Copy template")} disabled hint={c("تحتاج صلاحية إدارة القالب في نطاقه","Template management permission is required in this scope")}><Copy/></RowAction>}
    {canEdit(row)?<ManagementActionSheet rowAction icon={<Power/>} label={row.is_active?c("إيقاف القالب","Deactivate template"):c("تفعيل القالب","Activate template")} title={row.is_active?c("إيقاف القالب؟","Deactivate template?"):c("تفعيل القالب؟","Activate template?")} locale={locale}><TaskForm operation="template" fields={{org,template:row.id,committee:row.committee_id??"",revision:String(row.revision),title:row.name,description:row.description_template,hours:row.default_hours,...(!row.is_active?{active:"on"}:{})}} locale={locale} label={c("تأكيد","Confirm")} onSuccess={()=>router.refresh()}/></ManagementActionSheet>:<RowAction label={c("تغيير حالة القالب","Change template status")} disabled hint={c("تحتاج صلاحية إدارة القالب في نطاقه","Template management permission is required in this scope")}><Power/></RowAction>}
    <RowAction href={`/manage/organizations/${org}/tasks?section=tasks&template=${row.id}`} label={c("إنشاء مهمة من القالب","Create task from template")} disabled={!row.is_active||!workspace.scopes.some(scope=>scope.tasks&&(row.committee_id===null||scope.id===row.committee_id))} hint={!row.is_active?c("فعّل القالب قبل استخدامه","Activate the template before using it"):c("تحتاج صلاحية إنشاء المهام في نطاق القالب","Task creation permission is required in this scope")}><Plus/></RowAction>
   </div>}
  ]}/>
  <ManagementActionSheet label={c("تعديل القالب","Edit template")} title={c("تعديل قالب المهمة","Edit task template")} hideTrigger open={Boolean(editing)} onOpenChange={open=>{if(!open)setEditing(null);}} locale={locale} mobileBottomSheet>{editing&&editForm(editing)}</ManagementActionSheet>
 </section>;
}
