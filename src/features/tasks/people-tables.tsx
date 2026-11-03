"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {Check,Eye,FileText,RotateCcw,SlidersHorizontal,X} from "lucide-react";
import {ContentText} from "@/components/content-text";
import {DataTable} from "@/components/data-table";
import {RowAction} from "@/components/row-action";
import {ManagementActionProvider,ManagementActionSheet} from "@/components/management-action-sheet";
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription} from "@/components/ui/alert-dialog";
import {Textarea} from "@/components/ui/textarea";
import {FormField} from "@/components/form-field";
import {OrganizationStatusBadge} from "@/features/organizations/organization-status-badge";
import {HourAdjustment} from "@/features/hours/hour-adjustment";
import {createTranslator} from "@/lib/i18n";
import {academicLevel,majorLabel} from "@/lib/display";
import {displayFileName} from "@/lib/file-name";
import {formatRiyadhDate,formatRiyadhTime,formatRiyadhDateTime} from "@/lib/datetime";
import type {Locale} from "@/lib/preferences";
import {TaskForm} from "./task-form";
import {TaskParticipationBadge} from "./participation-badge";
import type {TaskDetail,Submission} from "./repository";

function navigate(base:string,values:Record<string,string|null>){const url=new URL(window.location.href);url.pathname=base;for(const[key,value]of Object.entries(values))if(value===null)url.searchParams.delete(key);else url.searchParams.set(key,value);return `${url.pathname}${url.search}`;}
function Student({name,major,level,locale}:{name:string;major?:string;level?:string;locale:Locale}){return <div className="min-w-0"><p className="font-medium"><bdi><ContentText value={name}/></bdi></p><p className="text-sm text-muted-foreground">{[major&&majorLabel(major,locale),level&&academicLevel(level,locale)].filter(Boolean).join(" · ")}</p></div>;}
function DateCell({at,locale}:{at:string|undefined;locale:Locale}){return <><time>{formatRiyadhDate(at,locale)}</time><p className="text-sm text-muted-foreground"><bdi>{formatRiyadhTime(at,locale)}</bdi></p></>;}
export function TaskSubmissionStatus({submission,locale}:{submission:Submission;locale:Locale}){const t=createTranslator(locale),status=submission.displayStatus??submission.status_code;return <OrganizationStatusBadge status={status==="Approved"?"accepted":status==="Rejected"?"rejected":status==="Submitted"||status==="Changes_Requested"?"review":"inactive"}>{({Submitted:t("قيد المراجعة","Under review"),Approved:t("معتمد","Approved"),Rejected:t("مرفوض","Rejected"),Changes_Requested:t("طلب تعديل","Changes requested"),Withdrawn:t("مسحوب","Withdrawn")})[status]??status}</OrganizationStatusBadge>;}

export function TaskParticipantsTable({detail,base,page,locale}:{detail:TaskDetail;base:string;page:number;locale:Locale}){
 const router=useRouter(),t=createTranslator(locale),[adjust,setAdjust]=useState<TaskDetail["team"][number]|null>(null);
 if(!detail.canManage)return <DataTable items={detail.team.slice(0,25)} locale={locale} tableKey="task-team" label={t("فريق المهمة","Task team")} empty={<p className="text-muted-foreground">{t("لم ينضم أحد بعد.","No one has joined yet.")}</p>} pagination={{page,more:detail.team.length>25,onChange:value=>router.push(navigate(base,{teamPage:String(value)}))}} columns={[
 {id:"name",label:t("الطالب","Student"),render:row=><Student name={row.name} locale={locale}/>},
 {id:"status",label:t("الحالة","Status"),className:"w-36",render:row=><TaskParticipationBadge status={row.status} locale={locale}/>}
 ]}/>;
 const open=(row:TaskDetail["team"][number])=>router.push(navigate(base,{section:"submissions",participant:row.id,page:null}));
 return <><DataTable items={detail.team.slice(0,25)} locale={locale} tableKey="task-participants" label={t("عرض تفاصيل المشاركة","View participation details")} onOpen={open} empty={<p className="text-muted-foreground">{t("لم ينضم أحد بعد.","No one has joined yet.")}</p>} pagination={{page,more:detail.team.length>25,onChange:value=>router.push(navigate(base,{teamPage:String(value)}))}} columns={[
 {id:"name",label:t("الطالب","Student"),render:row=><Student name={row.name} major={row.major} level={row.level} locale={locale}/>},
 {id:"joined",label:t("تاريخ الانضمام","Joined on"),className:"w-44",render:row=><DateCell at={row.joinedAt} locale={locale}/>},
 {id:"status",label:t("الحالة","Status"),className:"w-36",render:row=><TaskParticipationBadge status={row.status} locale={locale}/>},
 {id:"actions",label:t("الإجراءات","Actions"),className:"w-28",render:row=><div className="flex flex-wrap items-center gap-1"><RowAction label={t("عرض التفاصيل","View details")} onClick={()=>open(row)}><Eye/></RowAction><RowAction label={t("تعديل الساعات","Adjust hours")} disabled={!row.hourRecord?.canAdjust} hint={t("يتطلب سجل ساعات معتمدًا وصلاحية تعديل الساعات.","Requires an approved hours record and permission to adjust it.")} onClick={()=>setAdjust(row)}><SlidersHorizontal/></RowAction></div>}
 ]}/>{adjust?.hourRecord&&<ManagementActionSheet label="" title={t("تعديل ساعات المشاركة","Adjust participation hours")} locale={locale} open hideTrigger mobileBottomSheet onOpenChange={open=>{if(!open)setAdjust(null);}}><HourAdjustment record={adjust.hourRecord} locale={locale} onSuccess={()=>{setAdjust(null);router.refresh();}}/></ManagementActionSheet>}</>;
}

function ReviewAction({submission,decision,enabled,locale}:{submission:Submission;decision:"Approved"|"Changes_Requested"|"Rejected";enabled:boolean;locale:Locale}){
 const [open,setOpen]=useState(false),router=useRouter(),t=createTranslator(locale),label=decision==="Approved"?t("اعتماد","Approve"):decision==="Changes_Requested"?t("طلب تعديل وإعادة تسليم","Request changes and resubmission"):t("رفض","Reject"),Icon=decision==="Approved"?Check:decision==="Changes_Requested"?RotateCcw:X;
 const description=decision==="Approved"?t("سيُعتمد التسليم وتُحسب الساعات حسب إعدادات المهمة والمشاركة.","Approve this submission and award hours according to its task and participation settings."):decision==="Changes_Requested"?t("يُعاد التسليم للطالب ليستكمله ويرسل نسخة جديدة.","Return this submission to the student to improve and submit a new version."):t("يُرفض التسليم وتُغلق المشاركة مع الاحتفاظ بالسجل السابق.","Reject this submission and close the participation while preserving its history.");
 return <><RowAction label={label} danger={decision==="Rejected"} disabled={!enabled} hint={t("المراجعة متاحة للتسليم المعلّق عندما تكون المهمة مفتوحة فقط.","Only pending submissions in an open task can be reviewed.")} onClick={()=>setOpen(true)}><Icon/></RowAction><AlertDialog open={open} onOpenChange={setOpen}><AlertDialogContent dir={locale==="ar"?"rtl":"ltr"}><ManagementActionProvider locale={locale} close={()=>setOpen(false)}><AlertDialogHeader><AlertDialogTitle>{label} · {submission.name??t("الطالب","Student")}؟</AlertDialogTitle><AlertDialogDescription>{description}</AlertDialogDescription></AlertDialogHeader><TaskForm operation="review-decision" fields={{submission:submission.id,decision}} label={t("تأكيد","Confirm")} locale={locale} onSuccess={()=>router.refresh()}><FormField label={decision==="Approved"?t("الملاحظة (اختياري)","Note (optional)"):t("الملاحظة","Note")} required={decision!=="Approved"}><Textarea name="note" rows={3} maxLength={3000} required={decision!=="Approved"}/></FormField></TaskForm></ManagementActionProvider></AlertDialogContent></AlertDialog></>;
}

export function TaskSubmissionsTable({detail,base,page,locale,canReview=detail.canManage}:{detail:TaskDetail;base:string;page:number;locale:Locale;canReview?:boolean}){
 const [selected,setSelected]=useState<Submission|null>(null),router=useRouter(),t=createTranslator(locale);
 return <><DataTable items={detail.submissions.slice(0,20)} locale={locale} tableKey="task-submissions" label={t("عرض تفاصيل التسليم","View submission details")} onOpen={setSelected} empty={<p className="text-muted-foreground">{t("لا توجد تسليمات.","No submissions.")}</p>} pagination={{page,more:detail.submissions.length>20,onChange:value=>router.push(navigate(base,{page:String(value)}))}} columns={[
 {id:"student",label:t("الطالب","Student"),render:row=><Student name={row.name??t("الطالب","Student")} major={row.major} level={row.level} locale={locale}/>},
 {id:"date",label:t("وقت التسليم","Submitted on"),className:"w-44",render:row=><DateCell at={row.submitted_at} locale={locale}/>},
 {id:"status",label:t("الحالة","Status"),className:"w-36",render:row=><TaskSubmissionStatus submission={row} locale={locale}/>},
 {id:"actions",label:t("الإجراءات","Actions"),className:canReview?"w-44":"w-16",render:row=><div className="flex flex-wrap items-center gap-1"><RowAction label={t("عرض الملف","View file")} disabled={!row.assets.length} hint={t("لا يوجد ملف مرفق بهذا التسليم.","This submission has no attachment.")} onClick={()=>setSelected(row)}><FileText/></RowAction>{canReview&&(["Approved","Changes_Requested","Rejected"] as const).map(decision=><ReviewAction key={decision} submission={row} decision={decision} enabled={detail.task.status_code==="Open"&&(row.displayStatus??row.status_code)==="Submitted"} locale={locale}/>)}</div>}
 ]}/>{selected&&<ManagementActionSheet label="" title={`${t("تسليم","Submission")} ${selected.revision_number} · ${selected.name??t("الطالب","Student")}`} locale={locale} open hideTrigger mobileBottomSheet onOpenChange={open=>{if(!open)setSelected(null);}}><div className="flex min-w-0 flex-col gap-5"><TaskSubmissionStatus submission={selected} locale={locale}/><p className="text-sm text-muted-foreground">{formatRiyadhDateTime(selected.submitted_at,locale)}</p><p className="whitespace-pre-wrap break-words leading-relaxed">{selected.message}</p>{selected.assets.length>0&&<ul className="flex flex-col gap-2">{selected.assets.map(file=><li key={file.id}><a href={`/files/${file.id}`} target="_blank" rel="noopener noreferrer" className="text-link inline-flex max-w-full items-start gap-2"><FileText className="size-4 shrink-0"/><bdi className="break-all">{displayFileName(file.name)}</bdi></a></li>)}</ul>}{selected.review_note&&<p className="whitespace-pre-wrap break-words">{selected.review_note}</p>}</div></ManagementActionSheet>}</>;
}
