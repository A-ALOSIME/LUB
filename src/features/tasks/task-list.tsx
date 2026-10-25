import { RowAction } from "@/components/row-action";
import { Eye } from "lucide-react";
import { formatHours } from "@/lib/display";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck } from "lucide-react";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import {formatTaskDate,formatTaskDateEn,taskLabels,taskLabelsEn} from "./display";
import type {TaskCard} from "./repository";
import type {Locale} from "@/lib/preferences";
export function TaskList({items,mode,locale="ar",compact=false}:{items:TaskCard[];mode:"available"|"mine"|"all";locale?:Locale;compact?:boolean}){
 const en=locale==="en",labels=en?taskLabelsEn:taskLabels,date=en?formatTaskDateEn:formatTaskDate;
 if(!items.length)return <p role="status" className="px-1 py-3 text-sm text-muted-foreground">{mode==="mine"
  ?en?"You have not joined any tasks yet.":"ما شاركت في أي مهمة حتى الآن."
  :mode==="available"
  ?en?"No tasks are open to join right now.":"لا توجد مهام متاحة للانضمام الآن."
  :en?"No tasks found.":"لا توجد مهام."}</p>;
 if(compact)return <ItemGroup role="list" aria-label={en?mode==="available"?"Available tasks":mode==="mine"?"My task participation":"Tasks":mode==="available"?"المهام المتاحة":mode==="mine"?"مشاركاتي":"المهام"} className="min-w-0">{items.map(({task,org_name,participant,historical,latest_submission:latestSubmission,approved_hours:approvedHours})=>{
  const overdue=task.status_code==="Open"&&task.due_at&&new Date(task.due_at)<new Date();
  const taskStatus=historical?en?"From your past record":"من سجلك السابق":overdue?labels.Overdue:labels[task.status_code]??task.status_code;
  return <Item key={task.id} role="listitem" size="sm">
   <ItemMedia variant="icon"><ClipboardCheck aria-hidden="true"/></ItemMedia>
   <ItemContent>
    <ItemTitle><Link className="text-foreground hover:underline" href={`/tasks/${task.id}`} dir="auto">{task.title}</Link></ItemTitle>
    <ItemDescription className="flex flex-wrap gap-x-2">
     <span dir="auto">{org_name}</span><span aria-hidden="true">·</span><span>{en?"Due: ":"موعد التسليم: "}{date(task.due_at)}</span>
     {mode==="mine"&&participant&&<><span aria-hidden="true">·</span><span>{labels[participant.status_code]??participant.status_code}</span><span aria-hidden="true">·</span><span>{latestSubmission?labels[latestSubmission.status_code]??latestSubmission.status_code:en?"Not submitted":"لم يُرسل بعد"}</span>{approvedHours!==null&&<><span aria-hidden="true">·</span><span>{en?"Approved hours: ":"الساعات المعتمدة: "}{formatHours(approvedHours,locale)}</span></>}</>}
    </ItemDescription>
   </ItemContent>
   <ItemActions><Badge variant={participant&&mode==="available"?"secondary":task.status_code==="Cancelled"?"destructive":"outline"}>{mode==="available"&&participant?en?"Joined":"منضم":taskStatus}</Badge></ItemActions>
  </Item>;
 })}</ItemGroup>;
 return <ul aria-label={en?mode==="available"?"Available tasks":mode==="mine"?"My task participation":"Tasks":mode==="available"?"المهام المتاحة":mode==="mine"?"مشاركاتي":"المهام"} className="flex min-w-0 flex-col gap-3">{items.map(({task,org_name,participant,historical,latest_submission:latestSubmission,approved_hours:approvedHours})=>{
  const overdue=task.status_code==="Open"&&task.due_at&&new Date(task.due_at)<new Date();
  const taskStatus=historical?en?"From your past record":"من سجلك السابق":overdue?labels.Overdue:labels[task.status_code]??task.status_code;
  return <li key={task.id} className="panel min-w-0 p-4"><div className="flex min-w-0 flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p dir="auto" className="mb-1 text-xs text-muted-foreground">{org_name}</p><h2 dir="auto" className="break-words text-base font-semibold"><Link className="text-link" href={`/tasks/${task.id}`}>{task.title}</Link></h2></div><div className="flex shrink-0 flex-wrap items-center gap-2"><Badge variant={participant&&mode==="available"?"secondary":"outline"}>{mode==="available"&&participant?en?"Joined":"منضم":taskStatus}</Badge><RowAction href={`/tasks/${task.id}`} label={en?"View details":"عرض التفاصيل"}><Eye/></RowAction></div></div>
   <div className="mt-3 flex min-w-0 flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground"><span>{en?"Due: ":"موعد التسليم: "}{date(task.due_at)}</span>{mode==="mine"&&participant&&<><span>{en?"Participation: ":"حالة المشاركة: "}{labels[participant.status_code]??participant.status_code}</span><span>{en?"Submission: ":"حالة التسليم: "}{latestSubmission?labels[latestSubmission.status_code]??latestSubmission.status_code:en?"Not submitted":"لم يُرسل بعد"}</span>{approvedHours!==null&&<span>{en?"Approved hours: ":"الساعات المعتمدة: "}{formatHours(approvedHours,locale)}</span>}</>}</div>
  </li>;
 })}</ul>;
}
export function TaskPagination({page,more,base,query={},locale="ar",pageParam="page"}:{page:number;more:boolean;base:string;query?:Record<string,string>;locale?:Locale;pageParam?:string}){
 const en=locale==="en";
 const url=(next:number)=>`${base}?${new URLSearchParams({...query,[pageParam]:String(next)})}`;
 if(page===0&&!more)return null;
 return <nav aria-label={en?"Record pages":"صفحات السجلات"} className="mt-6 flex flex-wrap items-center gap-4">{page>0&&<Link className="button button-secondary" href={url(page-1)}>{en?"Previous":"السابق"}</Link>}<span>{en?`Page ${page+1}`:`الصفحة ${page+1}`}</span>{more&&<Link className="button button-secondary" href={url(page+1)}>{en?"Next":"التالي"}</Link>}</nav>;
}
