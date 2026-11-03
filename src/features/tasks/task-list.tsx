"use client";
import {useOptimisticRows} from "@/lib/optimistic-rows";
import {useRouter} from "next/navigation";
import {ClipboardCheck,Eye,Pencil,Send,Lock,Trash2,LogOut} from "lucide-react";
import {ItemTable,ItemTitle} from "@/components/item-table";
import {ListThumbnail} from "@/components/list-thumbnail";
import {ContentText} from "@/components/content-text";
import {RowAction} from "@/components/row-action";
import {Badge} from "@/components/ui/badge";
import {formatHours,formatCount} from "@/lib/display";
import {t} from "@/lib/i18n";
import {formatTaskDate,formatTaskDateEn,taskLabels,taskLabelsEn} from "./display";
import {TaskParticipationBadge} from "./participation-badge";
import {TaskJoinAction} from "./task-join-action";
import {TaskDecision} from "./task-decision";
import {TaskEventLinkAction} from "./event-link";
import {TaskPanelAction} from "./task-panel-action";

import type {TaskCard,TaskWorkspace} from "./repository";
import type {Locale} from "@/lib/preferences";
export function TaskList({items,mode,locale="ar",activeStatus="",workspace,empty,pagination}:{pagination?:import("@/components/data-table").DataTablePagination;empty?:React.ReactNode;activeStatus?:string;items:TaskCard[];mode:"available"|"mine"|"all";locale?:Locale;compact?:boolean;workspace?:TaskWorkspace}){
 void workspace;
 const labels=locale==="en"?taskLabelsEn:taskLabels,date=locale==="en"?formatTaskDateEn:formatTaskDate,router=useRouter();
 const href=(row:TaskCard)=>mode==="all"?`/manage/organizations/${row.task.organization_id}/tasks/${row.task.id}`:`/tasks/${row.task.id}`,open=(row:TaskCard)=>router.push(href(row)),prefetch=(row:TaskCard)=>router.prefetch(href(row));
 const projection=useOptimisticRows(items,row=>row.task.id);
 const optimistic=(row:TaskCard)=>(status:string,remove?:boolean)=>projection.change(row.task.id,item=>remove?null:{...item,task:{...item.task,status_code:status}});
 const rows=projection.items.filter(item=>!activeStatus||item.task.status_code===activeStatus).map(row=>({...row,id:row.task.id}));
 function actions(row:TaskCard){const task=row.task,p=row.participant,manage=mode==="all"&&row.can_manage&&!row.historical,editable=manage&&["Draft","Open"].includes(task.status_code),withdrawable=!row.historical&&task.status_code==="Open"&&p&&["Joined","In_Progress","Submitted"].includes(p.status_code);
  if(row.historical)return null;
  return <div className="flex flex-wrap items-center gap-1"><RowAction label={t(locale,"عرض التفاصيل","View details")} onClick={()=>open(row)}><Eye/></RowAction>{mode==="all"?<>
  {editable?<TaskPanelAction task={task.id} title={task.title} locale={locale} edit/>:<RowAction label={t(locale,"تعديل المهمة","Edit task")} disabled hint={!manage?t(locale,"تحتاج صلاحية إدارة المهام","Task management permission is required"):t(locale,"لا يمكن تعديل المهمة المغلقة","Closed tasks cannot be edited")}><Pencil/></RowAction>}
  <TaskEventLinkAction task={task.id} enabled={Boolean(editable)} locale={locale}/>
  <span role="separator" aria-orientation="vertical" className="mx-1 h-5 border-s border-border"/>
  {manage&&task.status_code==="Draft"?<TaskDecision optimistic={optimistic(row)} kind="publish" task={task.id} revision={task.revision} title={task.title} locale={locale}/>:<RowAction label={t(locale,"نشر المهمة","Publish task")} disabled hint={!manage?t(locale,"تحتاج صلاحية إدارة المهام","Task management permission is required"):t(locale,"النشر متاح للمسودة فقط","Only drafts can be published")}><Send/></RowAction>}
  {editable?<TaskDecision optimistic={optimistic(row)} kind="close" status={task.status_code==="Draft"?"Cancelled":"Completed"} task={task.id} revision={task.revision} title={task.title} locale={locale}/>:<RowAction label={t(locale,"إغلاق المهمة","Close task")} disabled hint={!manage?t(locale,"تحتاج صلاحية إدارة المهام","Task management permission is required"):t(locale,"المهمة مغلقة بالفعل","This task is already closed")}><Lock/></RowAction>}
  {manage?<TaskDecision optimistic={optimistic(row)} kind="delete" task={task.id} revision={task.revision} title={task.title} locale={locale}/>:<RowAction label={t(locale,"حذف المهمة","Delete task")} danger disabled hint={t(locale,"تحتاج صلاحية إدارة المهام","Task management permission is required")}><Trash2/></RowAction>}
  </>:p?<><TaskPanelAction task={task.id} title={task.title} locale={locale} submission disabled={task.status_code!=="Open"||!["Joined","In_Progress"].includes(p.status_code)} hint={p.status_code==="Submitted"?t(locale,"لديك تسليم بانتظار المراجعة","You have a submission awaiting review"):t(locale,"التسليم غير متاح لحالة المهمة أو المشاركة الحالية","Submitting is unavailable for this task or participation status")}/>{withdrawable?<TaskDecision kind="withdraw" task={task.id} revision={task.revision} participant={p.id} title={task.title} locale={locale}/>:<RowAction label={t(locale,"الانسحاب","Withdraw")} disabled danger hint={t(locale,"الانسحاب متاح للمشاركة النشطة في مهمة مفتوحة فقط","Only active participation in an open task can be withdrawn")}><LogOut/></RowAction>}</>:task.status_code==="Open"?<TaskJoinAction task={task.id} locale={locale}/>:null}</div>;
 }
 return <><ItemTable pagination={pagination} items={rows} empty={empty} label={t(locale,"عرض تفاصيل المهمة","View task details")} onOpen={open} onPrefetch={prefetch} columns={[
 {id:"name",label:t(locale,"المهمة","Task"),render:row=><div className="flex min-w-0 items-center gap-3"><ListThumbnail icon={ClipboardCheck} src={row.task.image_asset_id?`/files/${row.task.image_asset_id}/preview?thumbnail=1`:row.task.event_id&&row.task.has_event_poster?`/event-posters/${row.task.event_id}?thumbnail=1`:null}/><div className="min-w-0 flex-1"><p className="truncate text-sm text-muted-foreground"><ContentText value={row.org_name}/>{row.historical&&<> · {t(locale,"من سجلك السابق","Past record")}</>}</p><ItemTitle><ContentText value={row.task.title}/></ItemTitle><p className="text-sm text-muted-foreground">{row.approved_hours!==null?<>{t(locale,"الساعات المعتمدة: ","Approved hours: ")}{formatHours(row.approved_hours,locale)}</>:formatHours(row.task.default_hours,locale)}{row.task.due_at&&<> · {date(row.task.due_at)}</>}{row.summary&&<> · {formatCount(row.summary.participants,"members",locale)}</>}</p></div></div>},
 {id:"status",label:t(locale,"الحالة","Status"),className:"w-32",render:row=>mode==="all"?<Badge variant={row.task.status_code==="Draft"?"secondary":"outline"}>{labels[row.task.status_code]??row.task.status_code}</Badge>:<TaskParticipationBadge status={row.participant?.status_code??"Not_Joined"} locale={locale}/>},
 ...(mode==="all"?[
 {id:"participants",label:t(locale,"المنضمون","Participants"),className:"w-24",render:(row:TaskCard)=>row.summary?.participants??0},
 {id:"submissionRate",label:t(locale,"نسبة التسليم","Submission rate"),className:"w-28",render:(row:TaskCard)=>`${row.summary?.participants?Math.round(row.summary.submitted/row.summary.participants*100):0}%`}
 ]:[]),
 {id:"actions",label:t(locale,"الإجراءات","Actions"),className:mode==="all"?"w-48":"w-32",render:actions}
 ]}/></>;
}
export {TaskPagination} from "./task-pagination";
