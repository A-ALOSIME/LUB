import Link from "next/link";
import { Building2, CalendarDays, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Locale } from "@/lib/preferences";
import { canReapplyToApplication, canWithdrawApplication } from "./application-eligibility";
import type { Application } from "./repository";
import { WorkflowForm } from "./mutation-form";

const statusLabels: Record<string, { ar: string; en: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  Submitted: { ar: "قيد المراجعة", en: "Under review", variant: "secondary" },
  Interview: { ar: "مقابلة", en: "Interview", variant: "default" },
  Accepted: { ar: "مقبول", en: "Accepted", variant: "default" },
  Rejected: { ar: "مرفوض", en: "Declined", variant: "destructive" },
  Withdrawn: { ar: "منسحب", en: "Withdrawn", variant: "outline" },
};

function formatApplicationDate(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ar-SA-u-nu-latn", {
    day: "numeric",
    month: "short",
    year: "numeric",
    calendar: "gregory",
    timeZone: "Asia/Riyadh",
  }).format(new Date(value));
}

function ApplicationCard({ application, locale, preview }: { application: Application; locale: Locale; preview: boolean }) {
  const en = locale === "en";
  const status = statusLabels[application.status_code] ?? statusLabels.Submitted;
  const canWithdraw = canWithdrawApplication(application);
  const canReapply = canReapplyToApplication(application);
  const applicationUrl = `/organizations/${application.slug}/apply/${application.round_id}`;

  return <Card size="sm" className="gap-0 rounded-xl bg-card ring-border/70 transition-colors hover:ring-foreground/20">
    <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Building2 aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">{application.organization_name}</span>
          <Badge variant={status.variant} className={application.status_code === "Accepted" ? "border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : undefined}>
            {en ? status.en : status.ar}
          </Badge>
          {application.round_open && <Badge variant="outline" className="text-muted-foreground">{en ? "Applications open" : "التسجيل مفتوح"}</Badge>}
        </div>
        <h2 dir="auto" className="text-base font-semibold leading-snug">{application.title}</h2>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays aria-hidden="true" className="size-3.5" />
            {en ? "Applied" : "تاريخ التقديم"} <time dateTime={application.created_at}>{formatApplicationDate(application.created_at, locale)}</time>
          </span>
          {application.committee && <span>{en ? "Committee:" : "اللجنة:"} {application.committee}</span>}
        </div>
        {canReapply && <p className="text-sm text-muted-foreground">{en ? "You can submit a new application while registration is open." : "تقدر تقدم طلبًا جديدًا ما دام التسجيل مفتوحًا."}</p>}
        {application.status_code === "Withdrawn" && !application.round_open && <p className="text-sm text-muted-foreground">{en ? "This round is closed." : "أُغلق التسجيل في هذه الجولة."}</p>}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
        {preview ? <Button variant="outline" size="sm" disabled>{en ? "View application" : "عرض الطلب"}</Button>
          : <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={applicationUrl}>{en ? "View application" : "عرض الطلب"}</Link>}
        {canWithdraw && (preview
          ? <Button variant="destructive" size="sm" disabled>{en ? "Withdraw" : "سحب الطلب"}</Button>
          : <WorkflowForm operation="withdraw" fields={{ application: application.id }} label={en ? "Withdraw" : "سحب الطلب"} locale={locale} buttonClassName={buttonVariants({ variant: "destructive", size: "sm" })} />)}
        {canReapply && (preview
          ? <Button size="sm" disabled>{en ? "Apply again" : "قدّم مرة أخرى"}</Button>
          : <Link className={buttonVariants({ size: "sm" })} href={applicationUrl}>{en ? "Apply again" : "قدّم مرة أخرى"}</Link>)}
      </div>
    </CardContent>
  </Card>;
}

export function ApplicationList({ rows, locale = "ar", preview = false }: { rows: Application[]; locale?: Locale; preview?: boolean }) {
  const en = locale === "en";

  return <div dir={en ? "ltr" : "rtl"} className="space-y-4">
    {preview && <div role="note" className="flex items-start gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3.5 text-sm">
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
      <p>{en ? "Sample data for preview only. No applications are stored, and all actions are disabled." : "بيانات تجريبية للمعاينة فقط. لا يتم حفظ أي طلبات، والأزرار هنا معطّلة."}</p>
    </div>}

    {rows.length > 0 ? <div className="space-y-3" aria-label={en ? "Applications list" : "قائمة الطلبات"}>
      {rows.map(application => <ApplicationCard key={application.id} application={application} locale={locale} preview={preview} />)}
    </div> : <Card size="sm" className="border-dashed bg-muted/20">
      <CardContent className="flex flex-col items-start gap-3 p-5">
        <p className="font-medium">{en ? "No applications yet" : "ما عندك طلبات حتى الآن"}</p>
        <p className="text-sm text-muted-foreground">{en ? "Applications you submit will appear here with their latest status." : "الطلبات التي تقدمها ستظهر هنا مع آخر حالة لها."}</p>
        <Link href="/organizations" className={buttonVariants({ size: "sm" })}>{en ? "Explore organizations" : "استكشف الجهات"}</Link>
      </CardContent>
    </Card>}
  </div>;
}
