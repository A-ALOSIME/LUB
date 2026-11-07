import {TaskPoster} from "./task-poster";
import Link from "next/link";
import {ContentText} from "@/components/content-text";
import {Card,CardHeader,CardTitle,CardContent} from "@/components/ui/card";
import {Tooltip,TooltipTrigger,TooltipContent} from "@/components/ui/tooltip";
import {Button} from "@/components/ui/button";
import {Progress} from "@/components/ui/progress";
import {OrganizationSectionTabs,OrganizationSectionTabPanel} from "@/features/organizations/organization-section-tabs";
import {TaskPageForm,TaskSubmissionAction} from "./page-forms";
import {TaskParticipantsTable,TaskSubmissionsTable} from "./people-tables";
import {createTranslator} from "@/lib/i18n";
import {formatHours,formatCount} from "@/lib/display";
import {formatRiyadhDateTime} from "@/lib/datetime";
import type {TaskDetail,TaskWorkspace} from "./repository";
import type {Locale} from "@/lib/preferences";
export type TaskPanelQuery={page:number;teamPage:number;eventPage:number;participant:string|null;purpose?:"edit"|"link"|"view"|"student"};
export function TaskDetailView({detail:d,page,teamPage,participant,locale="ar",section,onSectionChange,onNavigate,embedded=false}:{detail:TaskDetail;page:number;teamPage:number;participant:string|null;eventPage?:number;section?:string;onSectionChange?:(section:string)=>void;embedded?:boolean;locale?:Locale;workspace?:TaskWorkspace;onNavigate?:(query:Partial<TaskPanelQuery>)=>void}){
 const t=createTranslator(locale),task=d.task,base=d.canManage?`/manage/organizations/${task.organization_id}/tasks/${task.id}`:`/tasks/${task.id}`;
 const poster = task.image_asset_id ? `/files/${task.image_asset_id}/preview` : task.event_id && task.has_event_poster ? `/event-posters/${task.event_id}` : null;
 const start=task.starts_at?Date.parse(task.starts_at):null,end=task.due_at?Date.parse(task.due_at):null,now=d.asOf?Date.parse(d.asOf):(start??0),progress=start!==null&&end!==null&&end>start?Math.max(0,Math.min(100,(now-start)/(end-start)*100)):null;
 const open=d.current&&task.status_code==="Open"&&(start===null||start<=now),canSubmit=open&&d.own&&["Joined","In_Progress"].includes(d.own.status_code),canJoin=open&&(!d.own||d.own.withdrawn_at);
 const unavailable=d.own?.status_code==="Submitted"?t("لديك تسليم بانتظار المراجعة.","You have a submission awaiting review."):d.own?.status_code==="Approved"?t("تم اعتماد تسليمك؛ لا يمكن إرسال تسليم آخر.","Your submission was approved; further submissions are unavailable."):t("التسليم غير متاح لحالة المهمة أو المشاركة الحالية.","Submitting is unavailable for the current task or participation status.");
 const remaining=end===null?null:now>=end?t("انتهت المهمة","The task has ended"):t(`متبقي ${formatCount(Math.ceil((end-now)/86400000),"days",locale)}`,`${formatCount(Math.ceil((end-now)/86400000),"days",locale)} remaining`);
 const taskTab={id:"task",label:t("المهمة","Task")},peopleTab={id:"participants",label:d.canManage?t("المنضمون للمهمة","Participants"):t("فريق المهمة","Task team")},submissionsTab={id:"submissions",label:d.canManage?t("كل التسليمات","All submissions"):t("تسليماتي","My submissions")};
 const sections=d.canManage?[taskTab,peopleTab,submissionsTab]:[taskTab,submissionsTab,peopleTab];
 return <div className="flex min-w-0 flex-col gap-6">
  {!embedded&&<header className="flex min-w-0 flex-col gap-3"><div className="flex flex-wrap items-center gap-3">{!embedded&&<h1 dir="auto" className="min-w-0 break-words text-3xl font-semibold leading-normal sm:text-4xl"><ContentText value={task.title}/></h1>}</div></header>}
  <OrganizationSectionTabs section={section} onSectionChange={onSectionChange} items={sections} initialSection="task" defaultSection="task" sticky={false} label={t("تفاصيل المهمة","Task details")} dir={locale==="ar"?"rtl":"ltr"}>
   <OrganizationSectionTabPanel id="task"><div className={poster?"grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]":"flex min-w-0 flex-col gap-6"}><div className="flex min-w-0 flex-col gap-6">
    <Card><CardHeader><CardTitle role="heading" aria-level={2}>{t("المطلوب","What to do")}</CardTitle></CardHeader><CardContent className="flex flex-col gap-4"><p dir="auto" className="max-w-[70ch] whitespace-pre-wrap break-words text-base leading-8"><ContentText value={task.description}/></p><p className="text-muted-foreground">{t("الساعات المكتسبة: ","Earned hours: ")}{formatHours(task.default_hours,locale)}</p></CardContent></Card>
    {poster&&<div className="lg:hidden"><TaskPoster src={poster} title={task.title} locale={locale}/></div>}
    {(start!==null||end!==null)&&<Card><CardHeader><CardTitle role="heading" aria-level={2}>{t("فترة المهمة","Task period")}</CardTitle></CardHeader><CardContent className="flex flex-col gap-4"><dl className="grid gap-4 sm:grid-cols-2">{start!==null&&<div><dt className="text-sm text-muted-foreground">{t("تاريخ البداية","Starts")}</dt><dd>{formatRiyadhDateTime(task.starts_at,locale)}</dd></div>}{end!==null&&<div><dt className="text-sm text-muted-foreground">{t("موعد التسليم","Due")}</dt><dd>{formatRiyadhDateTime(task.due_at,locale)}</dd></div>}</dl>{progress!==null&&<Progress value={progress} aria-label={t("تقدم فترة المهمة","Task period progress")}/>} {remaining&&<p className="text-sm text-muted-foreground">{remaining}</p>}</CardContent></Card>}
    <Card id="submissions"><CardHeader><CardTitle role="heading" aria-level={2}>{t("تسليم العمل","Submit work")}</CardTitle></CardHeader><CardContent className="flex flex-col gap-5">{!d.canManage&&canSubmit&&d.own?<TaskSubmissionAction key={`${d.own.id}-${d.lastRevision}`} participant={d.own.id} revision={task.revision} lastRevision={d.lastRevision} locale={locale}/>:!d.canManage&&canJoin?<><p className="text-muted-foreground">{t("انضم للمهمة ثم أرسل وصف عملك وملفاته للمراجعة.","Join the task, then submit your work and attachments for review.")}</p><TaskPageForm operation="join" fields={{task:task.id}} label={t("الانضمام للمهمة","Join task")} locale={locale}/></>:d.canManage?<div><p className="text-muted-foreground">{t("راجع أعمال الطلاب من تبويب كل التسليمات.","Review student work in the All submissions tab.")}</p>{onSectionChange?<Button variant="ghost" onClick={()=>onSectionChange("submissions")}>{t("كل التسليمات","All submissions")}</Button>:<Button variant="ghost" nativeButton={false} render={<Link href={`${base}?section=submissions`}/>}>{t("كل التسليمات","All submissions")}</Button>}</div>:<><Tooltip><TooltipTrigger render={<span className="inline-flex self-start"/>}><Button disabled aria-label={unavailable}>{t("تم الانضمام","Joined")}</Button></TooltipTrigger><TooltipContent>{unavailable}</TooltipContent></Tooltip><p className="text-muted-foreground">{unavailable}</p></>}</CardContent></Card>
   </div>{poster&&<aside className="hidden lg:block"><TaskPoster src={poster} title={task.title} locale={locale}/></aside>}</div></OrganizationSectionTabPanel>
   <OrganizationSectionTabPanel id="participants"><TaskParticipantsTable detail={d} base={base} page={teamPage} locale={locale} onSelectParticipant={onNavigate?id=>onNavigate({participant:id}):undefined}/></OrganizationSectionTabPanel>
   <OrganizationSectionTabPanel id="submissions">{participant&&d.canManage&&(onNavigate?<Button className="mb-4" variant="ghost" onClick={()=>onNavigate({participant:null})}>{t("عرض كل التسليمات","All submissions")}</Button>:<Button className="mb-4" variant="ghost" nativeButton={false} render={<Link href={`${base}?section=submissions`}/>}>{t("عرض كل التسليمات","All submissions")}</Button>)}<TaskSubmissionsTable detail={d} base={base} page={page} locale={locale}/></OrganizationSectionTabPanel>
  </OrganizationSectionTabs>
 </div>;
}
