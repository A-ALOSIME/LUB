import Link from "next/link";
import { CalendarDays, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "cn";
import type { Locale } from "@/lib/preferences";
import { canWithdrawApplication } from "./application-eligibility";
import { ApplicationRowActions } from "./application-row-actions";
import { applicationStatusTabs, type ApplicationStatusCounts, type ApplicationStatusFilter } from "./application-status";
import type { Application } from "./repository";

const statusLabels: Record<string, { ar: string; en: string; className: string }> = {
  Submitted: { ar: "قيد المراجعة", en: "Under review", className: "border-primary/40 bg-primary/5 text-primary" },
  Interview: { ar: "مقابلة", en: "Interview", className: "border-primary/40 bg-primary/5 text-primary" },
  Accepted: { ar: "مقبول", en: "Accepted", className: "border-primary/40 text-primary" },
  Rejected: { ar: "مرفوض", en: "Rejected", className: "border-destructive/40 bg-destructive/5 text-destructive" },
  Withdrawn: { ar: "مسحوب", en: "Withdrawn", className: "border-border text-muted-foreground" },
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

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function applicationsHref({ status, preview, page = 1 }: {
  status: ApplicationStatusFilter;
  preview: boolean;
  page?: number;
}) {
  const params = new URLSearchParams({ tab: "applications" });
  if (preview) params.set("preview", "1");
  if (status !== "all") params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `/applications?${search}` : "/applications";
}

function ApplicationStatusBadge({ application, locale }: { application: Application; locale: Locale }) {
  const en = locale === "en";
  const status = statusLabels[application.status_code] ?? statusLabels.Submitted;

  return <Badge variant="outline" className={cn("h-6 px-2", status.className)}>
    {en ? status.en : status.ar}
  </Badge>;
}

function ApplicationActions({ application, locale, preview }: { application: Application; locale: Locale; preview: boolean }) {
  return <ApplicationRowActions
    applicationId={application.id}
    organization={application.organization_name}
    detailsHref={`/organizations/${application.slug}/apply/${application.round_id}`}
    canWithdraw={canWithdrawApplication(application)}
    locale={locale}
    preview={preview}
  />;
}

function ApplicationTable({ rows, locale, preview, noApplications }: { rows: Application[]; locale: Locale; preview: boolean; noApplications: boolean }) {
  const en = locale === "en";

  return <div className="hidden lg:block">
    <Table className="min-w-[38rem]">
      <TableCaption className="sr-only">{en ? "Your membership applications" : "طلبات الانضمام الخاصة بك"}</TableCaption>
      <TableHeader>
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableHead className="w-[42%] px-4">{en ? "Organization" : "الجهة"}</TableHead>
          <TableHead className="w-[24%] px-4">{en ? "Applied on" : "تاريخ التقديم"}</TableHead>
          <TableHead className="w-[22%] px-4">{en ? "Status" : "الحالة"}</TableHead>
          <TableHead className="w-12 px-2 text-center">{en ? "Actions" : "إجراءات"}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length > 0 ? rows.map(application => <TableRow key={application.id}>
          <TableCell className="px-4 py-3.5">
            <div dir="auto" className="flex min-w-0 flex-col gap-0.5">
              <span className="font-medium">{application.organization_name}</span>
              <span className="truncate text-xs text-muted-foreground">{application.title}</span>
            </div>
          </TableCell>
          <TableCell className="px-4 py-3.5 text-muted-foreground">
            <time dateTime={application.created_at}>{formatApplicationDate(application.created_at, locale)}</time>
          </TableCell>
          <TableCell className="px-4 py-3.5"><ApplicationStatusBadge application={application} locale={locale} /></TableCell>
          <TableCell className="px-2 py-2 text-center">
            <ApplicationActions application={application} locale={locale} preview={preview} />
          </TableCell>
        </TableRow>) : <TableRow>
          <TableCell colSpan={4} className="h-32 whitespace-normal px-4 text-center text-muted-foreground">
            <div className="flex flex-col items-center gap-2">
              <p>{noApplications
                ? en ? "You have not applied to any organizations yet." : "ما قدمت على أي جهة حتى الآن."
                : en ? "No applications match these filters." : "ما فيه طلبات تطابق خيارات التصفية."}</p>
              {noApplications && <Link href="/organizations" className={buttonVariants({ variant: "outline", size: "sm" })}>{en ? "Explore organizations" : "استكشف الجهات"}</Link>}
            </div>
          </TableCell>
        </TableRow>}
      </TableBody>
    </Table>
  </div>;
}

function ApplicationCards({ rows, locale, preview, noApplications }: { rows: Application[]; locale: Locale; preview: boolean; noApplications: boolean }) {
  const en = locale === "en";

  return <div className="grid gap-2 p-3 lg:hidden">
    {rows.length > 0 ? rows.map(application => <article key={application.id} className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div dir="auto" className="min-w-0 space-y-0.5">
          <p className="truncate text-xs text-muted-foreground">{application.organization_name}</p>
          <h2 className="text-sm font-medium leading-5">{application.title}</h2>
        </div>
        <ApplicationActions application={application} locale={locale} preview={preview} />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <ApplicationStatusBadge application={application} locale={locale} />
        <time dateTime={application.created_at} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays aria-hidden="true" className="size-3.5" />
          {formatApplicationDate(application.created_at, locale)}
        </time>
      </div>
    </article>) : <div role="status" className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
      <p>{noApplications
        ? en ? "You have not applied to any organizations yet." : "ما قدمت على أي جهة حتى الآن."
        : en ? "No applications match these filters." : "ما فيه طلبات تطابق خيارات التصفية."}</p>
      {noApplications && <Link href="/organizations" className={buttonVariants({ variant: "outline", size: "sm" })}>{en ? "Explore organizations" : "استكشف الجهات"}</Link>}
    </div>}
  </div>;
}

export function ApplicationList({ rows, counts, locale = "ar", preview = false, status, page = 1, hasNext = false }: {
  rows: Application[];
  counts: ApplicationStatusCounts;
  locale?: Locale;
  preview?: boolean;
  status: ApplicationStatusFilter;
  page?: number;
  hasNext?: boolean;
}) {
  const en = locale === "en";
  const noApplications = counts.all === 0 && status === "all";

  return <div className="flex min-w-0 flex-col gap-4">
    {preview && <div role="note" className="flex items-start gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3.5 text-sm">
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
      <p>{en ? "Sample data for preview only. No applications are stored; row actions are disabled." : "بيانات تجريبية للمعاينة فقط. لا يتم حفظ أي طلبات، وإجراءات الصفوف معطّلة."}</p>
    </div>}

    <Card className="min-w-0 gap-0 py-0">
      <CardHeader className="gap-4 border-b p-4 sm:p-5">
        <nav aria-label={en ? "Filter applications by status" : "تصفية الطلبات حسب الحالة"} className="-mb-4 max-w-full overflow-x-auto">
          <ul className="flex min-w-max items-center gap-1 border-b border-border">
            {applicationStatusTabs.map(tab => {
              const active = status === tab.value;
              return <li key={tab.value}>
                <Link
                  href={applicationsHref({ status: tab.value, preview })}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-10 items-center gap-2 border-b-2 px-3 text-sm font-medium whitespace-nowrap transition-colors",
                    active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {en ? tab.en : tab.ar}
                  <Badge variant={active ? "secondary" : "outline"} className="h-5 min-w-5 justify-center px-1.5 text-[0.7rem] leading-none">
                    {formatCount(counts[tab.value])}
                  </Badge>
                </Link>
              </li>;
            })}
          </ul>
        </nav>
      </CardHeader>

      <CardContent className="p-0">
        <ApplicationTable rows={rows} locale={locale} preview={preview} noApplications={noApplications} />
        <ApplicationCards rows={rows} locale={locale} preview={preview} noApplications={noApplications} />
      </CardContent>

      {(page > 1 || hasNext) && <CardFooter className="justify-between gap-3 border-t px-4 py-3 sm:px-5">
        <span className="text-xs text-muted-foreground">{en ? `Page ${formatCount(page)}` : `الصفحة ${formatCount(page)}`}</span>
        <nav aria-label={en ? "Application pages" : "صفحات الطلبات"} className="flex items-center gap-2">
          {page > 1 && <Link href={applicationsHref({ status, preview, page: page - 1 })} className={buttonVariants({ variant: "outline", size: "sm" })}>
            {en ? "Previous" : "السابق"}
          </Link>}
          {hasNext && <Link href={applicationsHref({ status, preview, page: page + 1 })} className={buttonVariants({ variant: "outline", size: "sm" })}>
            {en ? "Next" : "التالي"}
          </Link>}
        </nav>
      </CardFooter>}
    </Card>
  </div>;
}
