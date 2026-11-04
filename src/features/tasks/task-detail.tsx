import Image from "next/image";
import Link from "next/link";
import {ChevronDown} from "lucide-react";
import {ContentText} from "@/components/content-text";
import {Card,CardHeader,CardTitle,CardContent} from "@/components/ui/card";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Progress} from "@/components/ui/progress";
import {Collapsible,CollapsibleTrigger,CollapsibleContent} from "@/components/ui/collapsible";
import {OrganizationSectionTabs,OrganizationSectionTabPanel} from "@/features/organizations/organization-section-tabs";
import {TaskPageForm,TaskPageSubmission} from "./page-forms";
import {TaskParticipantsTable,TaskSubmissionsTable} from "./people-tables";
import {createTranslator} from "@/lib/i18n";
import {formatHours} from "@/lib/display";
import {formatRiyadhDateTime} from "@/lib/datetime";
import {taskLabels,taskLabelsEn} from "./display";
import type {TaskDetail,TaskWorkspace} from "./repository";
import type {Locale} from "@/lib/preferences";
export type TaskPanelQuery={page:number;teamPage:number;eventPage:number;participant:string|null;purpose?:"edit"|"link"};
export function TaskDetailView({detail:d,page,teamPage,participant,locale="ar"}:{detail:TaskDetail;page:number;teamPage:number;participant:string|null;eventPage?:number;locale?:Locale;workspace?:TaskWorkspace;onNavigate?:(query:Partial<TaskPanelQuery>)=>void}){
 const t=createTranslator(locale),task=d.task,labels=locale==="ar"?taskLabels:taskLabelsEn,base=d.canManage?`/manage/organizations/${task.organization_id}/tasks/${task.id}`:`/tasks/${task.id}`;
 const start=task.starts_at?Date.parse(task.starts_at):null,end=task.due_at?Date.parse(task.due_at):null,now=d.asOf?Date.parse(d.asOf):(start??0),progress=start!==null&&end!==null&&end>start?Math.max(0,Math.min(100,(now-start)/(end-start)*100)):null;
 const open=d.current&&task.status_code==="Open"&&(start===null||start<=now),canSubmit=open&&d.own&&["Joined","In_Progress"].includes(d.own.status_code),canJoin=open&&(!d.own||d.own.withdrawn_at);
 const taskTab={id:"task",label:t("المهمة","Task")},peopleTab={id:"participants",label:d.canManage?t("المنضمون للمهمة","Participants"):t("فريق المهمة","Task team")},submissionsTab={id:"submissions",label:d.canManage?t("كل التسليمات","All submissions"):t("تسليماتي","My submissions")};
 const sections=d.canManage?[taskTab,peopleTab,submissionsTab]:[taskTab,submissionsTab,peopleTab];
 return <div className="flex min-w-0 flex-col gap-6">
  <header className="flex min-w-0 flex-col items-start justify-between gap-5 sm:flex-row"><div className="flex min-w-0 flex-1 flex-col gap-3"><h1 dir="auto" className="break-words text-3xl font-semibold leading-normal sm:text-4xl"><ContentText value={task.title}/></h1>{d.canManage&&<Badge variant="outline" className="self-start">{labels[task.status_code]??task.status_code}</Badge>}</div>{task.image_asset_id&&<Image src={`/files/${task.image_asset_id}/preview`} width={1000} height={700} unoptimized alt={task.title} className="h-auto max-h-80 w-auto max-w-full rounded-lg object-contain sm:max-w-[40%]"/>}</header>
  <OrganizationSectionTabs items={sections} initialSection="task" defaultSection="task" sticky={false} label={t("تفاصيل المهمة","Task details")} dir={locale==="ar"?"rtl":"ltr"}>
   <OrganizationSectionTabPanel id="task"><div className="flex min-w-0 flex-col gap-6">
    <Card><CardHeader><CardTitle role="heading" aria-level={2}>{t("المطلوب","What to do")}</CardTitle></CardHeader><CardContent className="flex flex-col gap-4"><p dir="auto" className="whitespace-pre-wrap break-words leading-relaxed"><ContentText value={task.description}/></p><p className="text-muted-foreground">{formatHours(task.default_hours,locale)}</p></CardContent></Card>
    {(start!==null||end!==null)&&<Card><CardHeader><CardTitle role="heading" aria-level={2}>{t("فترة المهمة","Task period")}</CardTitle></CardHeader><CardContent className="flex flex-col gap-4"><dl className="grid gap-4 sm:grid-cols-2">{start!==null&&<div><dt className="text-sm text-muted-foreground">{t("تاريخ البداية","Starts")}</dt><dd>{formatRiyadhDateTime(task.starts_at,locale)}</dd></div>}{end!==null&&<div><dt className="text-sm text-muted-foreground">{t("موعد التسليم","Due")}</dt><dd>{formatRiyadhDateTime(task.due_at,locale)}</dd></div>}</dl>{progress!==null&&<Progress value={progress} aria-label={t("تقدم فترة المهمة","Task period progress")}/>}</CardContent></Card>}
    <Card id="submissions"><CardHeader><CardTitle role="heading" aria-level={2}>{t("تسليم العمل","Submit work")}</CardTitle></CardHeader><CardContent className="flex flex-col gap-5">{!d.canManage&&canSubmit&&d.own?<TaskPageSubmission key={`${d.own.id}-${d.lastRevision}`} participant={d.own.id} revision={task.revision} lastRevision={d.lastRevision} locale={locale}/>:!d.canManage&&canJoin?<TaskPageForm operation="join" fields={{task:task.id}} label={t("الانضمام للمهمة","Join task")} locale={locale}/>:<p className="text-muted-foreground">{d.canManage?t("راجع أعمال الطلاب من تبويب كل التسليمات.","Review student work in the All submissions tab."):d.own?.status_code==="Submitted"?t("لديك تسليم بانتظار المراجعة.","You have a submission awaiting review."):d.own?.status_code==="Approved"?t("تم اعتماد تسليمك.","Your submission has been approved."):t("التسليم غير متاح لحالة المهمة أو المشاركة الحالية.","Submitting is unavailable for the current task or participation status.")}</p>}</CardContent></Card>
    {d.canManage&&d.history.length>0&&<Collapsible><CollapsibleTrigger render={<Button variant="ghost"/>}><ChevronDown/>{t("سجل نسخ المهمة","Task version history")}</CollapsibleTrigger><CollapsibleContent className="pt-4"><ul className="flex flex-col gap-4">{d.history.slice(0,20).map(revision=><li key={revision.id}><p className="text-sm text-muted-foreground">{t("نسخة","Version")} {revision.revision_number} · {formatRiyadhDateTime(revision.changed_at,locale)}</p><p className="whitespace-pre-wrap break-words"><ContentText value={revision.snapshot_json.description}/></p></li>)}</ul></CollapsibleContent></Collapsible>}
   </div></OrganizationSectionTabPanel>
   <OrganizationSectionTabPanel id="participants"><TaskParticipantsTable detail={d} base={base} page={teamPage} locale={locale}/></OrganizationSectionTabPanel>
   <OrganizationSectionTabPanel id="submissions">{participant&&d.canManage&&<Button className="mb-4" variant="ghost" nativeButton={false} render={<Link href={`${base}?section=submissions`}/>}>{t("عرض كل التسليمات","All submissions")}</Button>}<TaskSubmissionsTable detail={d} base={base} page={page} locale={locale}/></OrganizationSectionTabPanel>
  </OrganizationSectionTabs>
 </div>;
}
