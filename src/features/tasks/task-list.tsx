import Link from "next/link";
import {Badge} from "@/components/ui/badge";
import {Card,CardTitle,CardDescription,CardContent} from "@/components/ui/card";
import {formatHours,formatCount} from "@/lib/display";
import {formatTaskDate,formatTaskDateEn,taskLabels,taskLabelsEn} from "./display";
import {TaskDecision} from "./task-decision";
import {TaskPanelAction} from "./task-panel-action";
import {TaskComposer} from "./task-composer";
import type {TaskCard,TaskWorkspace} from "./repository";
import type {Locale} from "@/lib/preferences";
export function TaskList({items,mode,locale="ar",workspace}:{items:TaskCard[];mode:"available"|"mine"|"all";locale?:Locale;compact?:boolean;workspace?:TaskWorkspace}){
 const en=locale==="en",labels=en?taskLabelsEn:taskLabels,date=en?formatTaskDateEn:formatTaskDate;
 if(!items.length)return <p role="status" className="py-3 text-sm text-muted-foreground">{mode==="mine"?(en?"You have not joined any tasks yet.":"ما شاركت في أي مهمة حتى الآن."):mode==="available"?(en?"No tasks are open to join right now.":"لا توجد مهام متاحة للانضمام الآن."):(en?"No tasks found.":"لا توجد مهام.")}</p>;
 return <ul className="flex min-w-0 flex-col gap-4" aria-label={en?"Tasks":"المهام"}>{items.map(({task:t,org_name,participant:p,historical,latest_submission,approved_hours,can_manage,summary})=>{
  const manageable=mode==="all"&&can_manage&&!historical,editable=manageable&&["Draft","Open"].includes(t.status_code),withdrawable=!historical&&t.status_code==="Open"&&p&&["Joined","In_Progress","Submitted"].includes(p.status_code);
  return <li key={t.id}><Card><CardContent className="flex items-center gap-4"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><CardDescription>{org_name}</CardDescription><CardTitle className="mt-1 break-words"><Link href={`/tasks/${t.id}`}>{t.title}</Link></CardTitle></div><Badge variant={t.status_code==="Draft"?"secondary":"outline"}>{mode==="available"&&p?(en?"Joined":"منضم"):historical?(en?"Past record":"من سجلك السابق"):labels[t.status_code]??t.status_code}</Badge></div>
  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground"><span>{en?"Suggested: ":"الساعات المقترحة: "}{formatHours(t.default_hours,locale)}</span>{t.due_at&&<span>{en?"Due: ":"التسليم: "}{date(t.due_at)}</span>}{summary&&<span>{en?"Joined: ":"المنضمون: "}{formatCount(summary.participants,"members",locale)}</span>}{mode==="mine"&&p&&<><span>{en?"Participation: ":"حالة المشاركة: "}{labels[p.status_code]}</span>{latest_submission&&<span>{en?"Submission: ":"حالة التسليم: "}{labels[latest_submission.status_code]}</span>}{approved_hours!==null&&<span>{en?"Approved hours: ":"الساعات المعتمدة: "}{formatHours(approved_hours,locale)}</span>}</>}</div></div>
  <div className="task-card-actions flex shrink-0 flex-col items-center gap-1 sm:flex-row sm:gap-2"><TaskPanelAction task={t.id} title={t.title} locale={locale}/>{editable&&(workspace?<TaskComposer rowAction org={t.organization_id} task={t} workspace={workspace} locale={locale}/>:<TaskPanelAction task={t.id} title={t.title} locale={locale} edit/>)}{manageable&&t.status_code==="Draft"&&<TaskDecision kind="publish" task={t.id} revision={t.revision} title={t.title} locale={locale}/>} {editable&&<TaskDecision status={t.status_code==="Draft"?"Cancelled":"Completed"} kind="close" task={t.id} revision={t.revision} title={t.title} locale={locale}/>} {manageable&&<TaskDecision kind="delete" task={t.id} revision={t.revision} title={t.title} locale={locale}/>} {mode==="mine"&&withdrawable&&<><TaskPanelAction task={t.id} title={t.title} locale={locale} submission/><TaskDecision kind="withdraw" task={t.id} revision={t.revision} participant={p.id} title={t.title} locale={locale}/></>}</div></CardContent></Card></li>;
 })}</ul>;
}
export {TaskPagination} from "./task-pagination";
