import Link from "next/link";
import { CalendarDays, ClipboardList, Info, Plus } from "lucide-react";
import {RequestStatusBadge} from "./request-status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WorkspaceEmptyState } from "@/components/workspace-empty-state";
import type { Locale } from "@/lib/preferences";
import { canWithdrawApplication } from "./application-eligibility";
import { ApplicationRowActions } from "./application-row-actions";
import type { ApplicationStatusCounts, ApplicationStatusFilter } from "./application-status";
import type { Application } from "./repository";
import { ApplicationStatusFilters } from "./application-status-filters";
import { formatRiyadhDateTime } from "@/lib/datetime";


function formatApplicationDate(value: string, locale: Locale) {
  return formatRiyadhDateTime(value, locale);
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

function ApplicationStatusBadge({application,locale}:{application:Application;locale:Locale}){return <RequestStatusBadge status={application.status_code} locale={locale}/>;}

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

function ApplicationTable({ rows, locale, preview }: { rows: Application[]; locale: Locale; preview: boolean }) {
  const en = locale === "en";

  return <div className="hidden lg:block">
    <Table className="min-w-[38rem]">
      <TableCaption className="sr-only">{en ? "Your membership applications" : "طلبات الانضمام الخاصة بك"}</TableCaption>
      <TableHeader>
        <TableRow className="border-border/60 bg-card hover:bg-card">
          <TableHead className="w-[42%] px-4">{en ? "Organization" : "الجهة"}</TableHead>
          <TableHead className="w-[24%] px-4">{en ? "Applied on" : "تاريخ التقديم"}</TableHead>
          <TableHead className="w-[22%] px-4">{en ? "Status" : "الحالة"}</TableHead>
          <TableHead className="w-12 px-2 text-center">{en ? "Actions" : "الإجراءات"}</TableHead>
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
          <TableCell colSpan={4} className="whitespace-normal px-4 py-3">
            <WorkspaceEmptyState icon={ClipboardList} title={en ? "No matching applications" : "لا توجد طلبات مطابقة"} description={en ? "Try changing the selected status." : "جرّب تغيير حالة الطلب."} />
          </TableCell>
        </TableRow>}
      </TableBody>
    </Table>
  </div>;
}

function ApplicationCards({ rows, locale, preview }: { rows: Application[]; locale: Locale; preview: boolean }) {
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
    </article>) : <WorkspaceEmptyState icon={ClipboardList} title={en ? "No matching applications" : "لا توجد طلبات مطابقة"} description={en ? "Try changing the selected status." : "جرّب تغيير حالة الطلب."} />}
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
  const noApplications = counts.all === 0;

  return <div className="flex min-w-0 flex-col gap-4">
    {noApplications ? <WorkspaceEmptyState
      icon={ClipboardList}
      title={en ? "No applications yet" : "ما قدمت على أي جهة حتى الآن"}
      description={en ? "Browse clubs and councils to find a community to join." : "تصفح الأندية والمجالس واختر الجهة التي تناسبك."}
      action={<Link href="/organizations" className={buttonVariants({ size: "lg", className: "workspace-empty-state-action w-full sm:w-auto" })}><Plus data-icon="inline-start" aria-hidden="true" />{en ? "Browse clubs and councils" : "تصفح الأندية والمجالس"}</Link>}
    /> : <>
    {preview && <div role="note" className="flex items-start gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3.5 text-sm">
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
      <p>{en ? "Sample data for preview only. No applications are stored; row actions are disabled." : "بيانات تجريبية للمعاينة فقط. لا يتم حفظ أي طلبات، وإجراءات الصفوف معطّلة."}</p>
    </div>}

    <Card className="min-w-0 gap-0 py-0">
      <CardHeader className="gap-3 px-4 pt-4 pb-0 sm:px-5 sm:pt-5">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <ApplicationStatusFilters status={status} counts={counts} preview={preview} locale={locale} />
          <Link href="/organizations" className={buttonVariants({ size: "sm", className: "w-full sm:w-auto" })}><Plus data-icon="inline-start" aria-hidden="true" />{en ? "Start a new application" : "تقديم طلب جديد"}</Link>
        </div>
      </CardHeader>

      <CardContent className="p-0 pt-2">
        <ApplicationTable rows={rows} locale={locale} preview={preview} />
        <ApplicationCards rows={rows} locale={locale} preview={preview} />
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
    </>}
  </div>;
}
