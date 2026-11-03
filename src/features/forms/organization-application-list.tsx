"use client";
import {useEffect,useMemo,useTransition,type ReactNode} from "react";
import {queryOptions,useQuery,useQueryClient,keepPreviousData} from "@tanstack/react-query";
import {Search,ClipboardList} from "lucide-react";
import {useQueryActor} from "@/components/private-query-provider";
import {SearchFilterToolbar} from "@/components/search-filter-toolbar";
import {InputGroup,InputGroupInput,InputGroupAddon} from "@/components/ui/input-group";
import {StatusFilter} from "@/components/status-filter";
import {ListEmpty} from "@/components/list-empty";
import {useListQuery} from "@/lib/list-query";
import {privateJson} from "@/lib/private-query";
import {createTranslator} from "@/lib/i18n";
import {searchApplications} from "./search-action";
import {ApplicationSelection} from "./application-selection";
import type {Filters,Application,OrganizationApplicationStatusCounts} from "./repository";
import type {Locale} from "@/lib/preferences";
type Page={items:Application[];counts:OrganizationApplicationStatusCounts;more:boolean};
function options(actor:string|null,org:string,f:Filters,searchContext:string){const {lookup,...publicFilters}=f;const values={...publicFilters,page:String(f.page)};return queryOptions({queryKey:["organization-applications",actor,org,{...values,lookup:!!lookup,searchContext}],queryFn:({signal})=>privateJson<Page>(`/manage/organizations/${org}/applications/data?${new URLSearchParams(values)}`,signal)});}
export function OrganizationApplicationList({organization,initial,initialFilters,locale,canBulk,extraFilters,selectedId,searchContext=""}:{searchContext?:string;organization:string;initial:Page;initialFilters:Filters;locale:Locale;canBulk:boolean;extraFilters:ReactNode;selectedId?:string}){
 const [,start]=useTransition();
 const c=createTranslator(locale),actor=useQueryActor(),client=useQueryClient(),{params,change}=useListQuery(`?${new URLSearchParams({...initialFilters,page:String(initialFilters.page)})}`);
 const filters=useMemo<Filters>(()=>({...initialFilters,q:(params.get("q")??"").slice(0,120),status:["Submitted","Interview","Accepted","Rejected","Withdrawn"].includes(params.get("status")??"")?params.get("status")!:"",committee:params.get("committee")??"",major:params.get("major")??"",level:params.get("level")??"",round:params.get("round")??"",from:params.get("from")??"",to:params.get("to")??"",activity:params.get("activity")??"",page:Math.max(1,Math.min(1000,Number(params.get("page"))||1))}),[initialFilters,params]);
 const result=useQuery({...options(actor,organization,filters,searchContext),placeholderData:keepPreviousData,initialData:JSON.stringify(filters)===JSON.stringify(initialFilters)?initial:undefined}),data=result.data??initial;
 useEffect(()=>{for(const status of ["","Submitted","Interview","Accepted","Rejected","Withdrawn"])void client.prefetchQuery(options(actor,organization,{...initialFilters,q:"",status,page:1},searchContext));},[actor,client,organization,initialFilters,searchContext]);
 useEffect(()=>()=>{void client.cancelQueries({queryKey:["organization-applications",actor,organization]});},[actor,client,organization]);
 useEffect(()=>{if(data.more)void client.prefetchQuery(options(actor,organization,{...filters,page:filters.page+1},searchContext));},[actor,client,organization,filters,data.more,searchContext]);
 const update=(values:Record<string,string|null>,replace=false)=>change({page:"1",...values},replace),filtered=Boolean(filters.q||filters.status||filters.committee||filters.major||filters.level||filters.round||filters.from||filters.to||filters.activity||searchContext);
 const labels=[{value:"",label:c("الكل","All"),count:data.counts.all},{value:"Submitted",label:c("قيد المراجعة","Under review"),count:data.counts.submitted},{value:"Interview",label:c("مقابلة","Interview"),count:data.counts.interview},{value:"Accepted",label:c("مقبول","Accepted"),count:data.counts.accepted},{value:"Rejected",label:c("مرفوض","Rejected"),count:data.counts.rejected},{value:"Withdrawn",label:c("مسحوب","Withdrawn"),count:data.counts.withdrawn??0}];
 return <div className="flex min-w-0 flex-col gap-4"><SearchFilterToolbar search={<InputGroup><InputGroupAddon><Search/></InputGroupAddon><InputGroupInput type="search" value={filters.q} placeholder={c("ابحث بالاسم…","Search by name…")} aria-label={c("بحث باسم الطالب","Search by student name")} onChange={e=>update({q:e.target.value},true)}/></InputGroup>}><StatusFilter value={filters.status} ariaLabel={c("حالة الطلب","Application status")} dir={locale==="ar"?"rtl":"ltr"} options={labels} onValueChange={status=>update({status})}/>{extraFilters}</SearchFilterToolbar>{data.items.length?<ApplicationSelection pagination={{page:filters.page-1,more:data.more,onChange:value=>change({page:String(value+1)})}} organization={organization} rows={data.items} locale={locale} canBulk={canBulk} initialSelectedId={selectedId}/>:<ListEmpty icon={ClipboardList} filtered={filtered} clear={()=>{if(searchContext){const form=new FormData();form.set("org",organization);start(()=>searchApplications(form));}else update({q:null,status:null,committee:null,major:null,level:null,round:null,from:null,to:null,activity:null});}} title={c("لا توجد طلبات بعد","No applications yet")} description={c("تظهر الطلبات بعد فتح جولة تسجيل.","Applications appear when a registration round opens.")}/>}</div>;
}
