"use client";
import {useEffect,useMemo} from "react";
import {queryOptions,useQuery,useQueryClient,keepPreviousData} from "@tanstack/react-query";
import {useQueryActor} from "@/components/private-query-provider";
import {useListQuery} from "@/lib/list-query";
import {completeList} from "@/lib/complete-list";
import {ListEmpty} from "@/components/list-empty";
import {HoursToolbarActions} from "./hours-toolbar-actions";
import {NativeSelect} from "@/components/ui/native-select";
import {SelfReportPolicy} from "./self-report-policy";
import {SearchFilterToolbar} from "@/components/search-filter-toolbar";
import {createTranslator} from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { academicTerm } from "@/lib/display";
import { HoursForm } from "./form";
import { HoursRecordTable } from "./hours-record-table";
import type { HoursWorkspace } from "./repository";
import type { Locale } from "@/lib/preferences";
import { Clock3, Search } from "lucide-react";
import { WorkspaceEmptyState } from "@/components/workspace-empty-state";
import { HoursStatusFilters, type HoursStatusFilter } from "./hours-status-filters";
import { HoursStatusSummary } from "./hours-status-summary";

export type HoursFilters = { term: string | null; committee: string | null; status: Exclude<HoursStatusFilter, "all"> | null; page: number; memberPage: number; q?:string };

function hoursListQuery(actor:string|null,org:string,f:HoursFilters){return queryOptions({queryKey:["organization-hours",actor,org,{term:f.term,committee:f.committee,status:f.status,q:f.q??"",page:f.page}],queryFn:({signal})=>{const query=new URLSearchParams({q:f.q??"",page:String(f.page)});if(f.term)query.set("term",f.term);if(f.committee)query.set("committee",f.committee);if(f.status)query.set("status",f.status);return completeList<Pick<HoursWorkspace,"records"|"hoursByStatus"|"total"|"filteredCount"|"filteredTotal">>(`/api/organizations/${org}/hours?${query}`,signal);}});}
export function HoursWorkspaceView({ data:initial, org, filters:initialFilters, locale = "ar" }: { data: HoursWorkspace; org: string; filters: HoursFilters; locale?: Locale }) {
  const actor=useQueryActor(),client=useQueryClient(),{params,change}=useListQuery(`?${new URLSearchParams({q:initialFilters.q??"",hoursPage:String(initialFilters.page),...(initialFilters.term?{term:initialFilters.term}:{}),...(initialFilters.committee?{committee:initialFilters.committee}:{}),...(initialFilters.status?{hourStatus:initialFilters.status}:{})})}`);
  const termValue=params.get("term"),committeeValue=params.get("committee"),qValue=params.get("q")??"",statusValue=params.get("hourStatus"),pageValue=0;
  const filters=useMemo<HoursFilters>(()=>({...initialFilters,term:termValue,committee:committeeValue,q:qValue,status:statusValue==="Approved"||statusValue==="Pending"||statusValue==="Rejected"?statusValue:null,page:pageValue}),[initialFilters,termValue,committeeValue,qValue,statusValue,pageValue]);

  const result=useQuery({...hoursListQuery(actor,org,filters),placeholderData:keepPreviousData,initialData:initial.records.length<=25&&JSON.stringify(filters)===JSON.stringify(initialFilters)?initial:undefined}),data={...initial,...result.data};
  const update=(values:Record<string,string|null>,replace=false)=>change({hoursPage:null,...values},replace);
  useEffect(()=>{for(const status of [null,"Approved","Pending","Rejected"] as const)void client.prefetchQuery(hoursListQuery(actor,org,{...filters,q:"",page:0,status}));},[actor,client,org,filters]);
  useEffect(()=>()=>{void client.cancelQueries({queryKey:["organization-hours",actor,org]});},[actor,client,org]);
  useEffect(()=>{const changed=()=>{void client.invalidateQueries({queryKey:["organization-hours",actor,org]});};window.addEventListener("activity-changed",changed);return()=>window.removeEventListener("activity-changed",changed);},[actor,client,org]);
  const en = locale === "en", c = createTranslator(en ? "en" : "ar");
  const { term, committee, page } = filters;
  const canAddHours = data.scopes.some(scope => scope.manual);
  return <div className="min-w-0 space-y-4">
    <SearchFilterToolbar search={<div className="hours-search"><Search aria-hidden="true"/><Input type="search" value={filters.q??""} onChange={event=>update({q:event.target.value},true)} aria-label={c("البحث باسم العضو","Search by member name")} placeholder={c("ابحث بالاسم…","Search by name…")}/></div>}>
      <HoursStatusFilters value={filters.status??"all"} locale={locale} onChange={value=>update({hourStatus:value==="all"?null:value})}/>
      <NativeSelect value={term??""} aria-label={c("الفصل الدراسي","Academic term")} onChange={event=>update({term:event.target.value||null})}><option value="">{c("كل الفصول","All terms")}</option>{data.terms.map(item=><option key={item.id} value={item.id}>{academicTerm(item.name_ar,locale)} · {item.academic_year}</option>)}</NativeSelect>
      <NativeSelect value={committee??""} aria-label={c("اللجنة","Committee")} onChange={event=>update({committee:event.target.value||null})}><option value="">{c("كل اللجان","All committees")}</option>{data.scopes.filter(scope=>scope.id).map(scope=><option key={scope.id} value={scope.id!}>{scope.name}</option>)}</NativeSelect>
      {data.canPolicy&&<SelfReportPolicy org={org} enabled={data.selfEnabled} locale={locale}/>}
      <HoursToolbarActions org={org} committee={committee} term={term} status={filters.status} search={filters.q} exportScopes={data.exportScopes} locale={locale} hasRecords={Boolean(data.records.length)} canAddHours={canAddHours}/>

    </SearchFilterToolbar>

    <HoursStatusSummary totals={data.hoursByStatus} locale={locale}/>

    {data.records.length
      ? <HoursRecordTable pagination={{page,more:data.records.length>25,onChange:value=>change({hoursPage:String(value)})}} items={data.records} locale={locale}/>
      : (filters.q||filters.term||filters.committee||filters.status)?<ListEmpty filtered clear={()=>update({q:null,term:null,committee:null,hourStatus:null})} icon={Clock3} title="" description=""/>:<WorkspaceEmptyState icon={Clock3} title={c("لا توجد سجلات ساعات", "No hour records")} description={c("تُسجّل الساعات من صفحة الأعضاء.", "Hours are entered from the members page.")}  />}

    {data.imports.length > 0 && <section className="space-y-3" aria-labelledby="hour-import-title">
      <h2 id="hour-import-title" className="font-semibold">{c("مشاركات معتمدة سابقة بلا سجل ساعات", "Earlier approved participation without an hours record")}</h2>
      <ul className="divide-y divide-line">{data.imports.map(participation => <li key={participation.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0"><p dir="auto">{participation.name}</p><HoursForm operation="import" fields={{ participant: participation.id }} label={c("استيراد الساعات", "Import hours")} locale={locale}/></li>)}</ul>
    </section>}
  </div>;
}
