import Link from "next/link";
import {formatTaskDate,formatTaskDateEn,taskLabels,taskLabelsEn} from "./display";
import type {TaskCard} from "./repository";
import type {Locale} from "@/lib/preferences";
export function TaskList({items,locale="ar"}:{items:TaskCard[];locale?:Locale}){
 const en=locale==="en",labels=en?taskLabelsEn:taskLabels,date=en?formatTaskDateEn:formatTaskDate;
 return items.length?<ul className="space-y-4">{items.map(({task,org_name,participant,historical})=><li key={task.id} className="panel p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p dir="auto" className="mb-2 text-sm text-muted">{org_name}</p><h2 dir="auto" className="break-words text-xl font-semibold"><Link className="text-link" href={`/tasks/${task.id}`}>{task.title}</Link></h2></div><span className="rounded-md bg-mist px-3 py-2 text-sm">{historical?en?"From your past record":"من سجلك السابق":task.status_code==="Open"&&task.due_at&&new Date(task.due_at)<new Date()?labels.Overdue:labels[task.status_code]}</span></div><p className="mt-4 text-sm leading-7 text-muted">{en?"Due: ":"موعد التسليم: "}{date(task.due_at)}{participant&&<> · {en?"Your participation: ":"مشاركتك: "}{labels[participant.status_code]}</>}</p></li>)}</ul>:<div className="panel p-6"><h2 className="font-semibold">{en?"No tasks to show right now.":"لا توجد مهام لعرضها الآن."}</h2><p className="mt-3 leading-8 text-muted">{en?"Tasks available to your memberships and past participation will appear here when created.":"تظهر هنا المهام المتاحة لعضويتك ومشاركاتك السابقة عندما تُنشأ."}</p></div>;
}
export function TaskPagination({page,more,base,query={},locale="ar"}:{page:number;more:boolean;base:string;query?:Record<string,string>;locale?:Locale}){
 const en=locale==="en";
 const url=(next:number)=>`${base}?${new URLSearchParams({...query,page:String(next)})}`;
 return <nav aria-label={en?"Record pages":"صفحات السجلات"} className="mt-6 flex flex-wrap items-center gap-4">{page>0&&<Link className="button button-secondary" href={url(page-1)}>{en?"Previous":"السابق"}</Link>}<span>{en?`Page ${page+1}`:`الصفحة ${page+1}`}</span>{more&&<Link className="button button-secondary" href={url(page+1)}>{en?"Next":"التالي"}</Link>}</nav>;
}
