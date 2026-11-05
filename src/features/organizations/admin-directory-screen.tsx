"use client";
import Link from "next/link";
import {useEffect,useMemo,useCallback,useRef,useState} from "react";
import {useQuery,useQueryClient,keepPreviousData} from "@tanstack/react-query";
import {toast} from "@/components/ui/toast";
import {Plus} from "lucide-react";
import {useQueryActor} from "@/components/private-query-provider";
import {privateJson} from "@/lib/private-query";
import {useListQuery} from "@/lib/list-query";
import {createTranslator} from "@/lib/i18n";
import {Button} from "@/components/ui/button";
import {FilterTabs} from "@/components/ui/filter-tabs";
import {Spinner} from "@/components/ui/spinner";
import {AdminOrganizationTable} from "./admin-organization-table";
import {AdminOpeningRequests} from "./admin-opening-requests";
import type {AdminDirectory} from "./admin-directory-repository";
import type {Locale} from "@/lib/preferences";
export function AdminDirectoryScreen({initial,initialSearch,locale}:{initial:AdminDirectory;initialSearch:string;locale:Locale}){
 const actor=useQueryActor(),client=useQueryClient(),t=createTranslator(locale),{params,change}=useListQuery(initialSearch.startsWith("?")?initialSearch:`?${initialSearch}`);
 const tab=params.get("tab")==="requests"?"requests":"organizations",status=tab==="requests"?params.get("requestStatus")||"Pending":params.get("status")||"all";
 const orgSort=params.get("admin-organizationsSort")??"name:asc",requestSort=params.get("admin-requestsSort")??"name:asc";
 const [refreshError,setRefreshError]=useState(false);
 const base=useMemo(()=>["admin-directory",actor] as const,[actor]);
 const snapshot=useMemo(()=>({queryKey:[...base,"snapshot"],queryFn:({signal}:{signal:AbortSignal})=>privateJson<AdminDirectory>("/api/admin/organizations",signal),initialData:initial,staleTime:90000}),[base,initial]);
 const options=useCallback((view:string,state:string)=>({queryKey:[...base,"view",view,state,"",view==="requests"?requestSort:orgSort,0],queryFn:async()=>client.fetchQuery(snapshot),initialData:()=>client.getQueryData<AdminDirectory>(snapshot.queryKey)??initial,staleTime:90000,initialDataUpdatedAt:()=>client.getQueryState(snapshot.queryKey)?.dataUpdatedAt,placeholderData:keepPreviousData}),[base,client,snapshot,initial,orgSort,requestSort]);
 const query=useQuery(options(tab,status)),data=query.data;
 const notified=useRef(false);useEffect(()=>{if(params.get("notice")==="created"&&!notified.current){notified.current=true;toast.add({title:t("تم إنشاء الجهة","Organization created"),type:"success"});}},[params,t]);
 useEffect(()=>{client.setQueryData(snapshot.queryKey,initial);},[client,initial,snapshot.queryKey]);
 useEffect(()=>{for(const view of ["organizations","requests"])for(const state of view==="organizations"?["all","Active","Inactive","Archived"]:["Pending","Accepted","Rejected"])void client.prefetchQuery(options(view,state));},[client,options]); // All basic views share one server snapshot.
 async function changed(){setRefreshError(false);try{await client.invalidateQueries({queryKey:snapshot.queryKey,refetchType:"none"});const fresh=await client.fetchQuery({...snapshot,staleTime:0});client.setQueriesData({queryKey:[...base,"view"]},fresh);}catch{setRefreshError(true);}}
 const filters=tab==="requests"?[{value:"Pending",label:t("قيد المراجعة","Under review")},{value:"Accepted",label:t("مقبولة","Accepted")},{value:"Rejected",label:t("مرفوضة","Rejected")}]:[{value:"all",label:t("الكل","All")},{value:"Active",label:t("نشطة","Active")},{value:"Inactive",label:t("موقوفة","Inactive")},{value:"Archived",label:t("مؤرشفة","Archived")}];
 return <main id="main" className="workspace-content flex min-w-0 flex-col gap-6" dir={locale==="ar"?"rtl":"ltr"}>
 <header className="workspace-page-header"><h1>{t("الجهات","Organizations")}</h1></header>
 <FilterTabs value={tab} dir={locale==="ar"?"rtl":"ltr"} ariaLabel={t("الجهات والطلبات","Organizations and requests")} options={[{value:"organizations",label:t("الجهات","Organizations")},{value:"requests",label:t("طلبات فتح الأندية","Club opening requests")}]} onItemPrefetch={value=>void client.prefetchQuery(options(value,value==="requests"?params.get("requestStatus")||"Pending":params.get("status")||"all"))} onValueChange={value=>change({tab:value})}/>
 <div className="flex flex-wrap items-center gap-3">
 <FilterTabs value={status} dir={locale==="ar"?"rtl":"ltr"} ariaLabel={t("الحالة","Status")} options={filters} onItemPrefetch={value=>void client.prefetchQuery(options(tab,value))} onValueChange={value=>change({[tab==="requests"?"requestStatus":"status"]:value})}/>
 {tab==="organizations"&&<Button nativeButton={false} render={<Link href="/manage/organizations/new"/>}><Plus/>{t("إضافة جهة","Add organization")}</Button>}
 {query.isFetching&&<Spinner aria-label={t("تحديث","Updating")}/>}
 </div>
 {(query.isError||refreshError)&&<p role="alert">{t("تعذّر تحديث البيانات. حاول مجددًا.","Could not refresh the data. Try again.")}<Button variant="ghost" onClick={()=>void changed()}>{t("إعادة المحاولة","Retry")}</Button></p>}
 <div className={query.isFetching?"opacity-75":""}>
 {tab==="organizations"?<AdminOrganizationTable organizations={data.organizations.filter(row=>status==="all"||row.statusCode===status)} locale={locale} onChanged={()=>void changed()}/>:<AdminOpeningRequests items={data.requests.filter(row=>row.status_code===status)} locale={locale} onChanged={()=>void changed()}/>}
 </div></main>;
}
