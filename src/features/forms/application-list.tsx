"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {ClipboardList,Info,Plus} from "lucide-react";
import {DataTable,DataTableTitle} from "@/components/data-table";
import {ContentText} from "@/components/content-text";
import {buttonVariants} from "@/components/ui/button";
import {WorkspaceEmptyState} from "@/components/workspace-empty-state";
import {RequestStatusBadge} from "./request-status-badge";
import {ApplicationRowActions} from "./application-row-actions";
import {ApplicationStatusFilters} from "./application-status-filters";
import {canWithdrawApplication} from "./application-eligibility";
import {formatRiyadhDate,formatRiyadhTime} from "@/lib/datetime";
import {createTranslator} from "@/lib/i18n";
import type {Locale} from "@/lib/preferences";
import type {Application} from "./repository";
import type {ApplicationStatusCounts,ApplicationStatusFilter} from "./application-status";
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

export function ApplicationList({rows,counts,locale="ar",preview=false,status,page=1,hasNext=false}:{rows:Application[];counts:ApplicationStatusCounts;locale?:Locale;preview?:boolean;status:ApplicationStatusFilter;page?:number;hasNext?:boolean}){
 const c=createTranslator(locale),router=useRouter(),[selected,setSelected]=useState<string|null>(null);
 if(!rows.length&&!counts.all)return <WorkspaceEmptyState icon={ClipboardList} title={c("ما قدمت على أي جهة حتى الآن","No applications yet")} description={c("تصفح الأندية والمجالس واختر الجهة التي تناسبك.","Browse clubs and councils to find a community to join.")} action={<Link href="/organizations" className={buttonVariants({size:"lg"})}><Plus/>{c("تصفح الأندية والمجالس","Browse clubs and councils")}</Link>}/>;
 return <div className="flex min-w-0 flex-col gap-4">
  {preview&&<div role="note" className="flex items-center gap-2 text-sm text-muted-foreground"><Info className="size-4"/>{c("بيانات تجريبية للمعاينة فقط. لا يتم حفظ أي طلبات، وإجراءات الصفوف معطّلة.","Sample data for preview only. No applications are stored; row actions are disabled.")}</div>}
  <div className="flex flex-wrap items-center justify-between gap-3"><ApplicationStatusFilters status={status} counts={counts} preview={preview} locale={locale}/><Link href="/organizations" className={buttonVariants({size:"sm"})}><Plus/>{c("تقديم طلب جديد","Start a new application")}</Link></div>
  <DataTable tableKey="studentApplications" locale={locale} items={rows} label={c("طلبات الانضمام الخاصة بك","Your membership applications")} onOpen={preview?undefined:row=>setSelected(row.id)} empty={<WorkspaceEmptyState icon={ClipboardList} title={c("لا توجد طلبات مطابقة","No matching applications")} description={c("جرّب تغيير حالة الطلب.","Try changing the selected status.")}/>} pagination={{page:page-1,more:hasNext,onChange:value=>router.push(applicationsHref({status,preview,page:value+1}))}} columns={[
   {id:"organization",label:c("الجهة","Organization"),render:row=><div className="min-w-0"><DataTableTitle><ContentText value={row.organization_name}/></DataTableTitle><p className="text-sm text-muted-foreground"><ContentText value={row.title}/></p></div>},
   {id:"date",label:c("تاريخ التقديم","Applied on"),className:"w-40",render:row=><><time>{formatRiyadhDate(row.created_at,locale)}</time><p className="text-sm text-muted-foreground"><bdi>{formatRiyadhTime(row.created_at,locale)}</bdi></p></>},
   {id:"status",label:c("الحالة","Status"),className:"w-32",render:row=><RequestStatusBadge status={row.status_code} locale={locale}/>},
   {id:"actions",label:c("الإجراءات","Actions"),className:"w-28",render:row=><ApplicationRowActions applicationId={row.id} organization={row.organization_name} detailsHref={`/organizations/${row.slug}/apply/${row.round_id}`} canWithdraw={canWithdrawApplication(row)} locale={locale} preview={preview} open={selected===row.id} onOpenChange={value=>setSelected(value?row.id:null)}/>}
  ]}/>
 </div>;
}
