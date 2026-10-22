import { LiveFilterForm } from "@/components/live-filter-form";
import { NativeSelect } from "@/components/ui/native-select";
import Link from "next/link";
import { HoursForm } from "./form";
import { TermSelect } from "./view";
import { HoursRecordTable } from "./hours-record-table";
import type { HoursWorkspace } from "./repository";
import { TaskPagination } from "@/features/tasks/task-list";
import type { Locale } from "@/lib/preferences";
import { Clock3, Plus } from "lucide-react";
import { WorkspaceEmptyState } from "@/components/workspace-empty-state";
import { buttonVariants } from "@/components/ui/button";
import { HoursStatusFilters, type HoursStatusFilter } from "./hours-status-filters";
import { HoursStatusSummary } from "./hours-status-summary";

export type HoursFilters = { term: string | null; committee: string | null; status: Exclude<HoursStatusFilter, "all"> | null; page: number; memberPage: number; rulePage: number };

export function HoursWorkspaceView({ data, org, filters, locale = "ar" }: { data: HoursWorkspace; org: string; filters: HoursFilters; locale?: Locale }) {
  const en = locale === "en", c = (ar: string, english: string) => en ? english : ar;
  const base = `/manage/organizations/${org}/tasks`;
  const membersHref = `/manage/organizations/${org}/members`;
  const { term, committee, page, memberPage, rulePage } = filters;
  const query = { section: "hours", ...(term ? { term } : {}), ...(committee ? { committee } : {}), ...(filters.status ? { hourStatus: filters.status } : {}), memberPage: String(memberPage), rulePage: String(rulePage) };
  const selected = data.scopes.find(scope => scope.id === committee);
  const canAddHours = data.scopes.some(scope => scope.manual);
  return <div className="min-w-0 space-y-4">
    <div className="grid min-w-0 grid-cols-1 items-end gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
      <LiveFilterForm className="grid min-w-0 grid-cols-1 gap-3 md:max-w-[34rem] md:grid-cols-[minmax(10rem,14rem)_minmax(10rem,13rem)] md:items-end">
        <input type="hidden" name="hoursPage" value="0"/><input type="hidden" name="memberPage" value={memberPage}/><input type="hidden" name="rulePage" value={rulePage}/><input type="hidden" name="section" value="hours"/>
        {filters.status && <input type="hidden" name="hourStatus" value={filters.status}/>}
        <TermSelect terms={data.terms} all value={term ?? ""} locale={locale} className="w-full min-w-0"/>
        <label className="min-w-0">{c("اللجنة", "Committee")}<NativeSelect name="committee" defaultValue={committee ?? ""}><option value="">{c("كل اللجان", "All committees")}</option>{data.scopes.filter(scope => scope.id).map(scope => <option key={scope.id} value={scope.id!}>{scope.name}</option>)}</NativeSelect></label>
      </LiveFilterForm>
      <div className="min-w-0 max-w-full overflow-x-auto"><HoursStatusFilters value={filters.status ?? "all"} locale={locale}/></div>
    </div>

    <HoursStatusSummary totals={data.hoursByStatus} locale={locale}/>

    {data.records.length
      ? <HoursRecordTable items={data.records} locale={locale}/>
      : <WorkspaceEmptyState icon={Clock3} title={c("لا توجد سجلات ساعات", "No hour records")} description={c("تُسجّل الساعات من صفحة الأعضاء.", "Hours are entered from the members page.")} action={canAddHours ? <Link href={membersHref} className={buttonVariants({ size: "lg", className: "workspace-empty-state-action w-full sm:w-auto" })}><Plus data-icon="inline-start" aria-hidden="true" />{c("إضافة ساعات", "Add hours")}</Link> : undefined} />}
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
