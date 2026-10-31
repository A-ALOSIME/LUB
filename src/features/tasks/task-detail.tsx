import {Fragment} from "react";
import {NumberText} from "@/components/number-text";
import {ContentText} from "@/components/content-text";
import {displayFileName} from "@/lib/file-name";
import {createTranslator} from "@/lib/i18n";
import Image from "next/image";
import Link from "next/link";
import {Badge} from "@/components/ui/badge";
import {Card,CardContent} from "@/components/ui/card";
import {Separator} from "@/components/ui/separator";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {OrganizationStatusBadge} from "@/features/organizations/organization-status-badge";
import {Button} from "@/components/ui/button";
import {Collapsible,CollapsibleTrigger,CollapsibleContent} from "@/components/ui/collapsible";
import {NativeSelect} from "@/components/ui/native-select";
import {ChevronDown,FileText} from "lucide-react";
import {TaskParticipationBadge} from "./participation-badge";
import {TaskComposer} from "./task-composer";
import {TaskDecision} from "./task-decision";
import {TaskForm} from "./task-form";
import {SubmissionForm} from "./submission-form";
import {TaskPagination} from "./task-pagination";
import {TaskEventLink} from "./event-link";
import type {TaskDetail,TaskWorkspace} from "./repository";
import {formatHours,formatCount} from "@/lib/display";
import {formatTaskDate,formatTaskDateEn,taskLabels,taskLabelsEn} from "./display";
import type {Locale} from "@/lib/preferences";
import {FormField} from "@/components/form-field";
export type TaskPanelQuery={page:number;teamPage:number;eventPage:number;participant:string|null};
export function TaskDetailView({detail:d,page,teamPage,participant,eventPage=0,locale="ar",workspace,onNavigate}:{detail:TaskDetail;page:number;teamPage:number;participant:string|null;eventPage?:number;locale?:Locale;workspace?:TaskWorkspace;onNavigate?:(query:Partial<TaskPanelQuery>)=>void}){
 const en=locale==="en",c=createTranslator(locale),labels=en?taskLabelsEn:taskLabels,date=en?formatTaskDateEn:formatTaskDate,t=d.task;
 const editable=d.canManage&&["Draft","Open"].includes(t.status_code),overdue=d.current&&t.status_code==="Open"&&t.due_at&&new Date(t.due_at)<new Date();
 const ownEditable=d.current&&t.status_code==="Open"&&d.own&&["Joined","In_Progress"].includes(d.own.status_code);
 const query={...(participant?{participant}:{}),teamPage:String(teamPage),eventPage:String(eventPage)};
 const navigation=(changes:Partial<TaskPanelQuery>)=>onNavigate?{onClick:()=>onNavigate(changes)}:{render:<Link href={`/tasks/${t.id}?${new URLSearchParams({...query,page:String(page),...Object.fromEntries(Object.entries(changes).filter(([,v])=>v!==null).map(([k,v])=>[k,String(v)]))})}`}/>,nativeButton:false,role:"link" as const};
 const participants=<><ul className="divide-y divide-border">{d.team.slice(0,100).map(p=><li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span><bdi>{p.name}</bdi> · {labels[p.status]}</span>{d.canManage&&<Button variant="ghost" {...navigation({participant:p.id,page:0})}>{c("مراجعة المشاركة","Review participation")}</Button>}</li>)}</ul>{!d.team.length&&<p className="text-muted-foreground">{c("لم ينضم أحد بعد.","No one has joined yet.")}</p>}<nav className="flex flex-wrap gap-3" aria-label={c("صفحات فريق المهمة","Task team pages")}>{teamPage>0&&<Button variant="outline" {...navigation({teamPage:teamPage-1})}>{c("السابق","Previous")}</Button>}{d.team.length>100&&<Button variant="outline" {...navigation({teamPage:teamPage+1})}>{c("التالي","Next")}</Button>}</nav></>;
 return <div className="flex min-w-0 flex-col gap-8">
  {t.image_asset_id&&<Image src={`/files/${t.image_asset_id}/preview`} width={1000} height={700} unoptimized alt={t.title} className="h-auto w-full rounded-lg"/>}
  <header className="flex flex-col gap-3"><h1 dir="auto" className="break-words text-3xl font-bold leading-normal sm:text-4xl"><ContentText value={t.title}/></h1><div className="flex flex-wrap items-center gap-3">{d.canManage&&<Badge variant="outline">{!d.current?c("من سجلك السابق","Past record"):overdue?labels.Overdue:labels[t.status_code]}</Badge>}{d.canManage&&<span className="text-sm text-muted-foreground">{c("نسخة المهمة","Task version")} <NumberText value={t.revision}/></span>}</div>
  {editable&&<div aria-label={c("إجراءات المهمة","Task actions")} className="flex flex-wrap gap-2">{t.status_code==="Draft"&&<TaskDecision full kind="publish" task={t.id} revision={t.revision} title={t.title} locale={locale}/>} {workspace&&<TaskComposer org={t.organization_id} task={t} workspace={workspace} locale={locale}/>}<TaskDecision full status={t.status_code==="Draft"?"Cancelled":"Completed"} kind="close" task={t.id} revision={t.revision} title={t.title} locale={locale}/></div>}
  </header>
  {d.canManage&&d.summary&&<dl className="grid grid-cols-2 gap-4 rounded-lg border p-4"><div><dt className="text-sm text-muted-foreground">{c("المنضمون","Participants")}</dt><dd className="font-semibold">{formatCount(d.summary.participants,"members",locale)}</dd></div><div><dt className="text-sm text-muted-foreground">{c("نسبة التسليم","Submission rate")}</dt><dd className="font-semibold"><NumberText value={d.summary.participants?Math.round(d.summary.submitted/d.summary.participants*100):0}/>%</dd></div></dl>}
  {!d.current&&<p className="panel p-5 leading-8">{c("هذه نسخة محفوظة من مشاركتك السابقة. تفاصيل الفريق والتغييرات اللاحقة متاحة للأعضاء الحاليين فقط.","This is a saved copy of your earlier participation. Team details and later changes are available only to current members.")}</p>}
  <section className="panel flex flex-col gap-4 p-6"><h2 className="text-xl font-semibold">{c("المطلوب","What to do")}</h2><p dir="auto" className="whitespace-pre-wrap break-words leading-8"><ContentText value={t.description}/></p><dl className="grid gap-4 sm:grid-cols-3"><div><dt className="text-sm text-muted-foreground">{c("بداية الانضمام","Joining starts")}</dt><dd>{date(t.starts_at)}</dd></div><div><dt className="text-sm text-muted-foreground">{c("موعد التسليم","Due date")}</dt><dd>{date(t.due_at)}</dd></div><div><dt className="text-sm text-muted-foreground">{c("الساعات المقترحة","Suggested hours")}</dt><dd>{formatHours(t.default_hours,locale)}</dd></div></dl>{overdue&&<p className="text-sm text-muted-foreground">{c("تجاوزت الموعد، لكنها تظل مفتوحة حتى إغلاقها يدويًا.","The due date passed, but the task remains open until manually closed.")}</p>}</section>
  {d.current&&d.canManage&&<div className="panel p-6"><TaskEventLink detail={d} eventPage={eventPage} query={{...query,page:String(page)}} locale={locale} onEventPageChange={onNavigate?(eventPage)=>onNavigate({eventPage}):undefined}/></div>}
  <section className="panel flex flex-col gap-4 p-6"><h2 className="text-xl font-semibold">{d.canManage?c("المنضمون للمهمة","Task participants"):c("مشاركتي","My participation")}</h2>{d.canManage?participants:d.own?<><div className="flex flex-wrap items-center gap-2 text-sm"><span>{c("حالة المشاركة","Participation status")}</span><TaskParticipationBadge status={d.own.status_code} locale={locale}/></div>{d.own.approved_hours_override!==null&&<p>{c("الساعات المحددة للمشاركة","Hours set for this participation")}: {formatHours(d.own.approved_hours_override,locale)} · {c("لم تُضف إلى رصيد الساعات بعد.","Not yet added to the hours balance.")}</p>}{ownEditable&&d.own.status_code==="Joined"&&<TaskForm operation="start" fields={{participant:d.own.id}} label={c("بدء العمل","Start work")} locale={locale}/>} {d.current&&t.status_code==="Open"&&["Joined","In_Progress","Submitted"].includes(d.own.status_code)&&<TaskDecision full kind="withdraw" task={t.id} revision={t.revision} participant={d.own.id} title={t.title} locale={locale}/>}</>:d.current&&t.status_code==="Open"&&(!t.starts_at||new Date(t.starts_at)<=new Date())?<TaskForm operation="join" fields={{task:t.id}} label={c("الانضمام للمهمة","Join task")} locale={locale}/>:<p className="text-muted-foreground">{c("الانضمام غير متاح الآن.","Joining is unavailable now.")}</p>}</section>
  <section id="submissions" className="flex flex-col gap-6 pt-2">{!d.canManage&&ownEditable&&d.own?<Collapsible><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">{d.canManage?(participant?c("تسليمات المشاركة المختارة","Selected participant submissions"):c("كل التسليمات","All submissions")):c("تسليماتي","My submissions")}</h2><CollapsibleTrigger render={<Button variant="outline"/>}>{c("إضافة تسليم","Add submission")}</CollapsibleTrigger></div><CollapsibleContent className="pt-6"><SubmissionForm key={`${d.own.id}-${d.lastRevision}`} participant={d.own.id} revision={t.revision} lastRevision={d.lastRevision} locale={locale}/></CollapsibleContent></Collapsible>:<div className="flex flex-wrap items-center gap-3"><h2 className="text-xl font-semibold">{d.canManage?(participant?c("تسليمات المشاركة المختارة","Selected participant submissions"):c("كل التسليمات","All submissions")):c("تسليماتي","My submissions")}</h2>{participant&&d.canManage&&<Button variant="ghost" {...(onNavigate?{onClick:()=>onNavigate({participant:null,page:0})}:{render:<Link href={`/tasks/${t.id}`}/>,nativeButton:false,role:"link" as const})}>{c("عرض كل التسليمات","All submissions")}</Button>}</div>}
  {!d.submissions.length&&<p className="text-sm text-muted-foreground">{c("لا توجد تسليمات.","No submissions.")}</p>}
  {d.submissions.length>0&&<Card className="gap-0 py-0"><CardContent className="p-0">
   {d.submissions.slice(0,20).map((s,index)=><Fragment key={s.id}>
    {index>0&&<div className="px-6"><Separator className="h-px"/></div>}
    <article className="flex min-w-0 flex-col gap-4 p-6">
     <header className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3"><h3 className="font-semibold">{c("تسليم","Submission")} <NumberText value={s.revision_number}/></h3>
       <OrganizationStatusBadge status={s.status_code==="Submitted"?"review":s.status_code==="Approved"?"accepted":"rejected"}>{s.status_code==="Approved"?c("معتمد","Approved"):s.status_code==="Rejected"?c("مرفوض","Rejected"):labels[s.status_code]}</OrganizationStatusBadge>
      </div>
      <p className="text-sm text-muted-foreground">{date(s.submitted_at)}</p>
     </header>
     <p dir="auto" className="mb-2 whitespace-pre-wrap break-words leading-8">{s.message}</p>
     {s.assets.length>0&&<ul className="flex flex-col gap-2">{s.assets.map(a=><li key={a.id}><a className="text-link inline-flex max-w-full items-start gap-2" href={`/files/${a.id}`}><FileText aria-hidden="true" className="mt-1 size-4 shrink-0"/><bdi className="break-all">{displayFileName(a.name)}</bdi></a></li>)}</ul>}
     {s.review_note&&<div className="flex flex-col gap-1"><p className="text-sm text-muted-foreground">{c("ملاحظة المراجعة","Review note")}</p><p dir="auto" className="whitespace-pre-wrap break-words leading-8">{s.review_note}</p></div>}
     {d.canManage&&<Collapsible>
      <CollapsibleTrigger render={<Button size="sm" variant="ghost"/>}><ChevronDown/>{c("تفاصيل تقنية","Technical details")}</CollapsibleTrigger>
      <CollapsibleContent className="pt-3"><div className="flex flex-col gap-3 text-sm text-muted-foreground">
       <p>{c("نسخة المهمة","Task version")} <NumberText value={s.task_revision_number}/></p>
       <p>{c("وصف المهمة وقت التسليم","Task description at submission")}</p>
       <p dir="auto" className="whitespace-pre-wrap break-words leading-8"><ContentText value={s.task_snapshot.description}/></p>
       <p>{c("الموعد","Due")}: {date(s.task_snapshot.due_at)} · {c("الساعات المقترحة","Suggested hours")}: {formatHours(s.task_snapshot.default_hours,locale)}</p>
      </div></CollapsibleContent>
     </Collapsible>}
     {d.canManage&&t.status_code==="Open"&&s.status_code==="Submitted"&&<div className="border-t border-border pt-5">
      <TaskForm operation="review" fields={{submission:s.id}} label={c("حفظ قرار المراجعة","Save review decision")} locale={locale}>
       <FormField label={c("القرار","Decision")}><NativeSelect name="status"><option value="Approved">{c("اعتماد المخرج","Approve deliverable")}</option><option value="Rejected">{c("طلب تعديل وإعادة تسليم","Request changes and resubmission")}</option></NativeSelect></FormField>
       <FormField label={c("ملاحظة المراجعة","Review note")}><Textarea name="note" maxLength={3000} rows={3}/></FormField>
       <FormField label={c("ساعات المشاركة عند الاعتماد (اختياري)","Participation hours on approval (optional)")} hint={c("عدد الساعات المعتمدة للطالب في هذه المهمة. اتركها فارغة لاستخدام الساعات المحددة للمهمة أو المشاركة.","Approved hours for this student in this task. Leave blank to use the hours set for the task or participation.")}><Input name="hours" type="number" min={0} max={1000} step="0.01"/></FormField>
      </TaskForm>
     </div>}
    </article>
   </Fragment>)}
  </CardContent></Card>}


  {d.canManage&&t.status_code==="Open"&&d.selected&&["Joined","In_Progress","Submitted"].includes(d.selected.status_code)&&<TaskForm operation="close" fields={{participant:d.selected.id,confirm:"on"}} label={c("إغلاق هذه المشاركة","Close this participation")} confirmDescription={c("ستغلق المشاركة المحددة فقط، مع حفظ تسليماتها السابقة.","Close only the selected participation while preserving its submissions.")} locale={locale}/>}
  </section>
  {d.current&&<section className="panel flex flex-col gap-4 p-6"><h2 className="text-xl font-semibold">{c("فريق المهمة","Task team")}</h2><p className="text-sm text-muted-foreground">{c("المخرجات والمرفقات متاحة لصاحب المشاركة والمراجع المخوّل فقط.","Deliverables and attachments are available only to their participant and authorized reviewers.")}</p>{d.canManage?<ul className="flex flex-wrap gap-3">{d.team.slice(0,100).map(p=><li key={p.id}><bdi>{p.name}</bdi></li>)}</ul>:participants}</section>}
  {d.canManage&&<Collapsible className="panel p-6"><CollapsibleTrigger render={<Button variant="ghost"/>}><ChevronDown/>{c("سجل نسخ المهمة","Task version history")}</CollapsibleTrigger><CollapsibleContent className="pt-4">{d.history.slice(0,20).map(r=><details key={r.id}><summary className="cursor-pointer leading-8">{c("نسخة","Version")} <NumberText value={r.revision_number}/> · {date(r.changed_at)} · {labels[r.snapshot_json.status_code]}</summary><p className="mt-3 whitespace-pre-wrap break-words leading-8"><ContentText value={r.snapshot_json.description}/></p><p className="mt-3 text-sm text-muted-foreground">{c("الموعد","Due")}: {date(r.snapshot_json.due_at)} · {c("الساعات المقترحة","Suggested hours")}: {formatHours(r.snapshot_json.default_hours,locale)}</p></details>)}</CollapsibleContent></Collapsible>}
  <TaskPagination page={page} more={d.submissions.length>20||(d.canManage&&d.history.length>20)} base={`/tasks/${t.id}`} query={query} locale={locale} onPageChange={onNavigate?(page)=>onNavigate({page}):undefined}/>
 </div>;
}
