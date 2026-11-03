"use client";
import {useEffect,useMemo} from "react";
import {useQuery,useQueryClient,keepPreviousData,queryOptions} from "@tanstack/react-query";
import {Search} from "lucide-react";
import {DataTable} from "@/components/data-table";
import {SearchFilterToolbar} from "@/components/search-filter-toolbar";
import {InputGroup,InputGroupInput,InputGroupAddon} from "@/components/ui/input-group";
import {FilterTabs} from "@/components/ui/filter-tabs";
import {Badge} from "@/components/ui/badge";
import {Alert,AlertDescription} from "@/components/ui/alert";
import {OrganizationStatusBadge} from "@/features/organizations/organization-status-badge";
import {useQueryActor} from "@/components/private-query-provider";
import {useListQuery} from "@/lib/list-query";
import {privateJson} from "@/lib/private-query";
import {createTranslator} from "@/lib/i18n";
import {academicLevel,majorLabel} from "@/lib/display";
import {formatRiyadhDate,formatRiyadhTime} from "@/lib/datetime";
import type {Locale} from "@/lib/preferences";
import {renewalParticipantFilters,type RenewalParticipantFilters,type RenewalParticipantPage} from "./participant-types";
function pageQuery(actor:string|null,id:string,f:RenewalParticipantFilters){return queryOptions({queryKey:["renewal-participants",actor,id,f],queryFn:({signal})=>privateJson<RenewalParticipantPage>(`/api/registration/renewals/${id}?${new URLSearchParams({...f,page:String(f.page)})}`,signal)});}
export function RenewalParticipantTable({campaign,initial,initialFilters,locale}:{campaign:string;initial:RenewalParticipantPage;initialFilters:RenewalParticipantFilters;locale:Locale}){
 const actor=useQueryActor(),client=useQueryClient(),{params,change}=useListQuery(),t=createTranslator(locale);
 const filters=useMemo(()=>renewalParticipantFilters.parse({q:params.get("q")??"",status:params.get("status")??"all",page:params.get("page")??0}),[params]);
 const query=useQuery({...pageQuery(actor,campaign,filters),placeholderData:keepPreviousData,initialData:JSON.stringify(filters)===JSON.stringify(initialFilters)?initial:undefined}),data=query.data??initial;
 const statuses=["all","Pending","Renewed","Declined","No_Response"],labels:Record<string,string>={all:t("الكل","All"),Pending:t("انتظار الرد","Awaiting response"),Renewed:t("قبل","Accepted"),Declined:t("رفض","Declined"),No_Response:t("لم يُرد","No response")};
 useEffect(()=>{for(const status of ["all","Pending","Renewed","Declined","No_Response"])void client.prefetchQuery(pageQuery(actor,campaign,{q:"",status:status as RenewalParticipantFilters["status"],page:0}));},[actor,campaign,client]);
 useEffect(()=>()=>{void client.cancelQueries({queryKey:["renewal-participants",actor,campaign]});},[actor,campaign,client]);
 return <section className="flex min-w-0 flex-col gap-4"><h2 className="text-lg font-semibold">{t("نتائج التجديد","Renewal results")}</h2><div className="flex flex-wrap gap-2">{statuses.slice(1).map(status=><Badge key={status} variant="outline">{labels[status]} · {data.counts[status]??0}</Badge>)}</div>
 <SearchFilterToolbar search={<InputGroup><InputGroupAddon><Search/></InputGroupAddon><InputGroupInput type="search" value={filters.q} aria-label={t("بحث الطلاب","Search students")} placeholder={t("ابحث عن طالب","Search students")} onChange={event=>change({q:event.target.value,page:null},true)}/></InputGroup>}><FilterTabs value={filters.status} onValueChange={status=>change({status,page:null})} dir={locale==="ar"?"rtl":"ltr"} ariaLabel={t("حالة التجديد","Renewal status")} options={statuses.map(value=>({value,label:labels[value]}))}/></SearchFilterToolbar>
 {query.isError&&<Alert><AlertDescription>{t("تعذّر تحديث النتائج. حاول مجددًا.","Results could not be updated. Try again.")}</AlertDescription></Alert>}
 <DataTable items={data.items} locale={locale} selection={false} tableKey="renewals" label={t("دعوة التجديد","Renewal invitation")} empty={<p className="text-muted-foreground">{t("لا توجد نتائج مطابقة.","No matching results.")}</p>} pagination={{page:filters.page,more:data.more,onChange:page=>change({page:String(page)})}} columns={[
 {id:"student",label:t("الطالب","Student"),render:row=><><p className="font-medium"><bdi>{row.name}</bdi></p><p className="text-sm text-muted-foreground">{majorLabel(row.major,locale)} · {academicLevel(row.level,locale)}</p></>},
 {id:"status",label:t("الحالة","Status"),className:"w-40",render:row=><OrganizationStatusBadge status={row.status==="Renewed"?"accepted":row.status==="Declined"?"rejected":"inactive"}>{labels[row.status]??row.status}</OrganizationStatusBadge>},
 {id:"date",label:t("التاريخ","Date"),className:"w-44",render:row=><><time>{formatRiyadhDate(row.at,locale)}</time><p className="text-sm text-muted-foreground"><bdi>{formatRiyadhTime(row.at,locale)}</bdi></p></>}
 ]}/></section>;
}
