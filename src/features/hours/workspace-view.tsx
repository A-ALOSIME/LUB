import {createTranslator} from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { formatHours,recordCount } from "@/lib/display";
import { LiveFilterForm } from "@/components/live-filter-form";
import Link from "next/link";
import { HoursForm } from "./form";
import { HoursRecordTable } from "./hours-record-table";
import type { HoursWorkspace } from "./repository";
import { TaskPagination } from "@/features/tasks/task-list";
import type { Locale } from "@/lib/preferences";
import { Clock3, Plus, Search } from "lucide-react";
import { WorkspaceEmptyState } from "@/components/workspace-empty-state";
import { buttonVariants } from "@/components/ui/button";
import { HoursStatusFilters, type HoursStatusFilter } from "./hours-status-filters";
import { HoursStatusSummary } from "./hours-status-summary";

export type HoursFilters = { term: string | null; committee: string | null; status: Exclude<HoursStatusFilter, "all"> | null; page: number; memberPage: number; rulePage: number; q?:string };

export function HoursWorkspaceView({ data, org, filters, locale = "ar" }: { data: HoursWorkspace; org: string; filters: HoursFilters; locale?: Locale }) {
  const en = locale === "en", c = createTranslator(en ? "en" : "ar");
  const base = `/manage/organizations/${org}/tasks`;
  const membersHref = `/manage/organizations/${org}/members`;
  const { term, committee, page, memberPage, rulePage } = filters;
  const query = { ...(filters.q?{q:filters.q}:{}), section: "hours", ...(term ? { term } : {}), ...(committee ? { committee } : {}), ...(filters.status ? { hourStatus: filters.status } : {}), memberPage: String(memberPage), rulePage: String(rulePage) };
  const selected = data.scopes.find(scope => scope.id === committee);
  const canAddHours = data.scopes.some(scope => scope.manual);
  return <div className="min-w-0 space-y-4">
    <LiveFilterForm className="hours-filters">
      <input type="hidden" name="section" value="hours"/><input type="hidden" name="hoursPage" value="0"/>{filters.status&&<input type="hidden" name="hourStatus" value={filters.status}/>}
      <div className="hours-search"><Search aria-hidden="true"/><Input type="search" name="q" defaultValue={filters.q??""} aria-label={c("البحث باسم العضو","Search by member name")} placeholder={c("ابحث بالاسم…","Search by name…")}/></div>
      {term&&<input type="hidden" name="term" value={term}/ >}{committee&&<input type="hidden" name="committee" value={committee}/ >}
      <div className="hours-filter-scroll border-s border-border ps-3"><HoursStatusFilters value={filters.status??"all"} locale={locale}/></div>
    </LiveFilterForm>

    <HoursStatusSummary totals={data.hoursByStatus} locale={locale}/>

    {data.records.length
      ? <HoursRecordTable items={data.records} locale={locale}/>
      : <WorkspaceEmptyState icon={Clock3} title={c("لا توجد سجلات ساعات", "No hour records")} description={c("تُسجّل الساعات من صفحة الأعضاء.", "Hours are entered from the members page.")} action={canAddHours ? <Link href={membersHref} className={buttonVariants({ size: "lg", className: "workspace-empty-state-action w-full sm:w-auto" })}><Plus data-icon="inline-start" aria-hidden="true" />{c("إضافة ساعات", "Add hours")}</Link> : undefined} />}
    <p className="text-sm text-muted-foreground">{c("الإجمالي","Total")} {formatHours(data.filteredTotal??data.records.slice(0,25).reduce((sum,record)=>sum+Number(record.hours),0),locale)} · {recordCount(data.filteredCount??Math.min(25,data.records.length),locale)}</p>
    <TaskPagination page={page} more={data.records.length > 25} base={base} query={query} locale={locale} pageParam="hoursPage"/>

    {selected?.manual && <nav aria-label={c("صفحات اختيار العضو", "Member selection pages")} className="flex flex-wrap gap-3 text-sm">
      {memberPage > 0 && <Link className="text-link" href={`${base}?${new URLSearchParams({ ...query, page: String(page), memberPage: String(memberPage - 1) })}`}>{c("الأعضاء السابقون", "Previous members")}</Link>}
      {data.members.length > 25 && <Link className="text-link" href={`${base}?${new URLSearchParams({ ...query, page: String(page), memberPage: String(memberPage + 1) })}`}>{c("أعضاء أكثر", "More members")}</Link>}
    </nav>}

    {data.imports.length > 0 && <section className="space-y-3" aria-labelledby="hour-import-title">
      <h2 id="hour-import-title" className="font-semibold">{c("مشاركات معتمدة سابقة بلا سجل ساعات", "Earlier approved participation without an hours record")}</h2>
      <ul className="divide-y divide-line">{data.imports.map(participation => <li key={participation.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0"><p dir="auto">{participation.name}</p><HoursForm operation="import" fields={{ participant: participation.id }} label={c("استيراد الساعات", "Import hours")} locale={locale}/></li>)}</ul>
    </section>}
  </div>;
}
