import Link from "next/link";
import {CalendarDays, ClipboardList, Clock, Pencil} from "lucide-react";
import {ContentText} from "@/components/content-text";
import {Button} from "@/components/ui/button";
import {Card, CardHeader, CardTitle, CardContent} from "@/components/ui/card";
import {Progress} from "@/components/ui/progress";
import {Separator} from "@/components/ui/separator";
import {Tooltip, TooltipTrigger, TooltipContent} from "@/components/ui/tooltip";
import {OrganizationSectionTabs, OrganizationSectionTabPanel} from "@/features/organizations/organization-section-tabs";
import {OrganizationStatusBadge} from "@/features/organizations/organization-status-badge";
import {createTranslator} from "@/lib/i18n";
import {formatHours, formatCount} from "@/lib/display";
import {formatRiyadhDateTime} from "@/lib/datetime";
import {cn} from "@/lib/utils";
import {TaskPageForm, TaskPageSubmission, TaskSubmissionAction} from "./page-forms";
import {TaskParticipantsTable, TaskSubmissionsTable} from "./people-tables";
import {TaskParticipationBadge} from "./participation-badge";
import {taskLabels, taskLabelsEn} from "./display";
import {TaskPoster} from "./task-poster";
import type {TaskDetail} from "./repository";
import type {Locale} from "@/lib/preferences";

export type TaskPanelQuery = {page: number; teamPage: number; eventPage: number; participant: string | null; purpose?: "edit" | "link" | "view" | "student"};

export function TaskDetailView({
  detail, page, teamPage, participant, locale = "ar", section, onSectionChange, onNavigate, onEdit, embedded = false,
}: {
  detail: TaskDetail;
  page: number;
  teamPage: number;
  participant: string | null;
  locale?: Locale;
  section?: string;
  onSectionChange?: (section: string) => void;
  onNavigate?: (query: Partial<TaskPanelQuery>) => void;
  onEdit?: () => void;
  embedded?: boolean;
}) {
  const t = createTranslator(locale);
  const {task, own, canManage, approvedHours} = detail;
  const base = canManage ? `/manage/organizations/${task.organization_id}/tasks/${task.id}` : `/tasks/${task.id}`;
  const poster = task.image_asset_id ? `/files/${task.image_asset_id}/preview` : task.event_id && task.has_event_poster ? `/event-posters/${task.event_id}` : null;
  const start = task.starts_at ? Date.parse(task.starts_at) : null;
  const end = task.due_at ? Date.parse(task.due_at) : null;
  const now = detail.asOf ? Date.parse(detail.asOf) : (start ?? 0);
  const progress = start !== null && end !== null && end > start ? Math.max(0, Math.min(100, (now - start) / (end - start) * 100)) : null;
  const open = detail.current && task.status_code === "Open" && (start === null || start <= now);
  const canSubmit = open && own && ["Joined", "In_Progress"].includes(own.status_code);
  const canJoin = open && (!own || own.withdrawn_at);
  const unavailable = own?.status_code === "Submitted"
    ? t("لديك تسليم بانتظار المراجعة.", "You have a submission awaiting review.")
    : own?.status_code === "Approved"
      ? t("تم اعتماد تسليمك.", "Your submission was approved.")
      : t("التسليم غير متاح لحالة المهمة أو المشاركة الحالية.", "Submitting is unavailable for the current task or participation status.");
  const remaining = end === null ? null : now >= end
    ? t("انتهت مهلة التسليم", "The submission deadline has passed")
    : (() => {
      const remainingMs = end - now;
      const amount = remainingMs < 86400000
        ? formatHours(Math.ceil(remainingMs / 3600000), locale)
        : formatCount(Math.ceil(remainingMs / 86400000), "days", locale);
      return t(`متبقي ${amount}`, `${amount} remaining`);
    })();
  const taskTab = {id: "task", label: t("المهمة", "Task")};
  const peopleTab = {id: "participants", label: canManage ? t("المنضمون للمهمة", "Participants") : t("فريق المهمة", "Task team")};
  const submissionsTab = {id: "submissions", label: canManage ? t("كل التسليمات", "All submissions") : t("تسليماتي", "My submissions")};
  const sections = canManage ? [taskTab, peopleTab, submissionsTab] : [taskTab, submissionsTab, peopleTab];
  const submitProps = own && {participant: own.id, revision: task.revision, lastRevision: detail.lastRevision, locale};
  const dir = locale === "ar" ? "rtl" : "ltr";
  const statusBadge = canManage
    ? <OrganizationStatusBadge status={task.status_code === "Draft" ? "draft" : task.status_code === "Open" ? "open" : "closed"}>
        {(locale === "en" ? taskLabelsEn : taskLabels)[task.status_code] ?? task.status_code}
      </OrganizationStatusBadge>
    : own && !own.withdrawn_at && <TaskParticipationBadge status={own.status_code} locale={locale}/>;


  return (
    <div className="flex min-w-0 flex-col gap-5">
      {!embedded && <header dir={dir} className="flex min-w-0 flex-wrap items-center justify-start gap-x-3 gap-y-2 text-start">
        <h1 className="min-w-0 wrap-anywhere text-3xl font-semibold leading-normal sm:text-4xl"><bdi><ContentText value={task.title}/></bdi></h1>
        {statusBadge}
      </header>}
      <OrganizationSectionTabs section={section} onSectionChange={onSectionChange} items={sections} initialSection="task" defaultSection="task" sticky={false} label={t("تفاصيل المهمة", "Task details")} dir={dir}>
        <OrganizationSectionTabPanel id="task">
          <div className={cn("grid min-w-0 items-start gap-5", !embedded && "lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]")}>
            <Card className={cn("min-w-0", !embedded && "lg:col-start-1 lg:row-start-1")}>
              <CardHeader><CardTitle role="heading" aria-level={2}>{t("المطلوب من المهمة", "What to do")}</CardTitle></CardHeader>
              <CardContent className="min-w-0">
                <p dir="auto" className="max-w-[70ch] whitespace-pre-wrap wrap-anywhere text-base leading-8"><ContentText value={task.description}/></p>
                {poster && <div className="mt-5 max-w-sm"><TaskPoster src={poster} title={task.title} locale={locale}/></div>}
              </CardContent>
              <Separator/>
              <CardContent id="submissions" className="flex min-w-0 flex-col gap-4">
                <h2 className="font-semibold">{canManage ? t("إدارة المهمة", "Manage task") : t("تسليم العمل", "Submit work")}</h2>
                {canManage ? (
                  <div className="flex flex-wrap gap-2">
                    {onSectionChange
                      ? <Button onClick={() => onSectionChange("submissions")}><ClipboardList data-icon="inline-start"/>{submissionsTab.label}</Button>
                      : <Button nativeButton={false} render={<Link href={`${base}?section=submissions`}/> }><ClipboardList data-icon="inline-start"/>{submissionsTab.label}</Button>}
                    {onEdit && ["Draft", "Open"].includes(task.status_code) && <Button variant="outline" onClick={onEdit}><Pencil data-icon="inline-start"/>{t("تعديل المهمة", "Edit task")}</Button>}
                  </div>
                ) : canSubmit && submitProps ? (
                  embedded ? <TaskSubmissionAction key={`${submitProps.participant}-${detail.lastRevision}`} {...submitProps}/>
                    : <TaskPageSubmission key={`${submitProps.participant}-${detail.lastRevision}`} {...submitProps} inline/>
                ) : canJoin ? (
                  <>
                    <p className="text-sm text-muted-foreground">{t("انضم للمهمة ثم أرسل وصف عملك وملفاته للمراجعة.", "Join the task, then submit your work and attachments for review.")}</p>
                    <TaskPageForm operation="join" fields={{task: task.id}} label={t("الانضمام للمهمة", "Join task")} locale={locale}/>
                  </>
                ) : (
                  <>
                    {own && !own.withdrawn_at && (
                      <Tooltip>
                        <TooltipTrigger render={<span className="inline-flex self-start"/>}><Button disabled aria-label={unavailable}>{t("تم الانضمام", "Joined")}</Button></TooltipTrigger>
                        <TooltipContent>{unavailable}</TooltipContent>
                      </Tooltip>
                    )}
                    <p className="text-sm text-muted-foreground">{unavailable}</p>
                  </>
                )}
              </CardContent>
            </Card>

            <aside className={cn("min-w-0", !embedded && "row-start-1 lg:col-start-2")}>
              <Card>
                <CardContent className="flex min-w-0 flex-col gap-4">
                  <dl className="flex min-w-0 flex-col gap-3">
                    {statusBadge && <div className="flex flex-wrap items-center justify-between gap-2">
                      <dt className="text-sm text-muted-foreground">{canManage ? t("حالة المهمة", "Task status") : t("حالة المشاركة", "Participation status")}</dt>
                      <dd>{statusBadge}</dd>
                    </div>}
                    <div><dt className="flex items-center gap-2 text-sm text-muted-foreground"><Clock aria-hidden className="size-4"/>{t("الساعات المقترحة", "Suggested hours")}</dt>
                      <dd className="mt-1 text-xl font-semibold">{formatHours(task.default_hours, locale)}</dd></div>
                    {!canManage && approvedHours != null && <div>
                      <dt className="text-sm text-muted-foreground">{t("ساعاتك المعتمدة", "Your approved hours")}</dt>
                      <dd className="mt-1 font-semibold">{formatHours(approvedHours, locale)}</dd>
                    </div>}
                  </dl>
                  {(start !== null || end !== null) && <>
                    <Separator/>
                    <dl className="flex min-w-0 flex-col gap-2 text-sm">
                      <div>
                        <dt className="flex items-center gap-2 text-muted-foreground"><CalendarDays aria-hidden className="size-4"/>{end !== null ? t("موعد التسليم", "Due") : t("تاريخ البداية", "Starts")}</dt>
                        <dd className="mt-1 font-medium">{formatRiyadhDateTime(end !== null ? task.due_at : task.starts_at, locale)}</dd>
                      </div>
                      {start !== null && end !== null && <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <dt className="text-muted-foreground">{t("تاريخ البداية", "Starts")}</dt><dd>{formatRiyadhDateTime(task.starts_at, locale)}</dd>
                      </div>}
                    </dl>
                    {remaining && <p className="text-sm text-muted-foreground">{remaining}</p>}
                    {progress !== null && <Progress value={progress} aria-label={t("تقدم فترة المهمة", "Task period progress")}/>}
                  </>}
                </CardContent>
              </Card>
            </aside>
          </div>
        </OrganizationSectionTabPanel>
        <OrganizationSectionTabPanel id="participants">
          <TaskParticipantsTable detail={detail} base={base} page={teamPage} locale={locale} onSelectParticipant={onNavigate ? id => onNavigate({participant: id}) : undefined}/>
        </OrganizationSectionTabPanel>
        <OrganizationSectionTabPanel id="submissions">
          {participant && canManage && (onNavigate
            ? <Button className="mb-4" variant="ghost" onClick={() => onNavigate({participant: null})}>{t("عرض كل التسليمات", "All submissions")}</Button>
            : <Button className="mb-4" variant="ghost" nativeButton={false} render={<Link href={`${base}?section=submissions`}/>}>{t("عرض كل التسليمات", "All submissions")}</Button>)}
          <TaskSubmissionsTable detail={detail} base={base} page={page} locale={locale}/>
        </OrganizationSectionTabPanel>
      </OrganizationSectionTabs>
    </div>
  );
}
