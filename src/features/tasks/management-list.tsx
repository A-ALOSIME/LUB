"use client";
import {useEffect,useMemo,type ReactNode} from "react";
import {queryOptions,useQuery,useQueryClient,keepPreviousData} from "@tanstack/react-query";
import {Search,ClipboardCheck} from "lucide-react";
import {useQueryActor} from "@/components/private-query-provider";
import {SearchFilterToolbar} from "@/components/search-filter-toolbar";
import {InputGroup,InputGroupInput,InputGroupAddon} from "@/components/ui/input-group";
import {FilterTabs} from "@/components/ui/filter-tabs";
import {ListEmpty} from "@/components/list-empty";
import {completeList} from "@/lib/complete-list";
import {useListQuery} from "@/lib/list-query";
import {createTranslator} from "@/lib/i18n";
import {TaskList} from "./task-list";
import type {TaskCard} from "./repository";
import type {Locale} from "@/lib/preferences";
export type TaskManagementFilters={q:string;status:string;page:number;sort:"asc"|"desc"};
function options(actor:string|null,org:string,filters:TaskManagementFilters){return queryOptions({queryKey:["organization-tasks",actor,org,filters],queryFn:({signal})=>completeList<{items:TaskCard[];more:boolean}>(`/api/organizations/${org}/tasks?${new URLSearchParams({...filters,page:String(filters.page)})}`,signal)});}
export function TaskManagementList({organization,initial,page,locale,actions,initialFilters={q:"",status:"",sort:"desc",page}}:{initialFilters?:TaskManagementFilters;organization:string;initial:{items:TaskCard[];more:boolean};page:number;locale:Locale;actions:ReactNode}){
 const actor=useQueryActor(),client=useQueryClient(),c=createTranslator(locale),{params,change}=useListQuery(`?${new URLSearchParams({taskSearch:initialFilters.q,taskStatus:initialFilters.status,taskSort:initialFilters.sort,taskPage:String(initialFilters.page)})}`),q=(params.get("taskSearch")??"").slice(0,120),rawStatus=params.get("taskStatus")??"",pageValue=0,sortValue=params.get("taskSort")==="asc"?"asc":"desc";
 const filters=useMemo<TaskManagementFilters>(()=>({q,status:["Draft","Open","Completed","Cancelled"].includes(rawStatus)?rawStatus:"",page:pageValue,sort:sortValue}),[q,rawStatus,pageValue,sortValue]);
 const result=useQuery({...options(actor,organization,filters),placeholderData:keepPreviousData,initialData:!initial.more&&JSON.stringify(filters)===JSON.stringify(initialFilters)?initial:undefined}),data=result.data??initial;
 useEffect(()=>{for(const status of ["","Draft","Open","Completed","Cancelled"])void client.prefetchQuery(options(actor,organization,{q:"",status,sort:"desc",page:0}));return()=>{void client.cancelQueries({queryKey:["organization-tasks",actor,organization]});};},[actor,client,organization]);
 useEffect(()=>{const changed=()=>{void client.invalidateQueries({queryKey:["organization-tasks",actor,organization]});};window.addEventListener("activity-changed",changed);return()=>window.removeEventListener("activity-changed",changed);},[actor,client,organization]);
 const update=(value:Record<string,string|null>,replace=false)=>change({taskPage:null,...value},replace);
 return <div className="flex min-w-0 flex-col gap-4"><SearchFilterToolbar search={<InputGroup><InputGroupAddon><Search/></InputGroupAddon><InputGroupInput type="search" value={filters.q} aria-label={c("بحث المهام","Search tasks")} placeholder={c("ابحث عن مهمة","Search tasks")} onChange={e=>update({taskSearch:e.target.value},true)}/></InputGroup>}><FilterTabs value={filters.status||"all"} dir={locale==="ar"?"rtl":"ltr"} ariaLabel={c("حالة المهمة","Task status")} options={[{value:"all",label:c("الكل","All")},{value:"Open",label:c("منشورة","Published")},{value:"Draft",label:c("مسودة","Draft")},{value:"Completed",label:c("مغلقة","Closed")},{value:"Cancelled",label:c("ملغاة","Cancelled")}]} onValueChange={value=>update({taskStatus:value==="all"?null:value})}/>{actions}</SearchFilterToolbar>{data.items.length?<TaskList pagination={{page:filters.page,more:data.more,onChange:value=>change({taskPage:String(value)})}} activeStatus={filters.status} items={data.items} mode="all" locale={locale}/>:<ListEmpty icon={ClipboardCheck} filtered={Boolean(filters.q||filters.status)} clear={()=>update({taskSearch:null,taskStatus:null})} title={c("لا توجد مهام بعد","No tasks yet")} description={c("أنشئ أول مهمة للجهة.","Create the organization's first task.")}/>}</div>;
}
