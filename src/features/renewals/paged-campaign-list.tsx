"use client";
import {useEffect,useMemo} from "react";
import {useQuery,useQueryClient,queryOptions,keepPreviousData} from "@tanstack/react-query";
import {useQueryActor} from "@/components/private-query-provider";
import {useListQuery} from "@/lib/list-query";
import {privateJson} from "@/lib/private-query";
import {Button} from "@/components/ui/button";
import {useI18n} from "@/components/i18n-provider";
import {CombinedManagementList} from "./combined-management-list";
import type {CampaignItem} from "./campaign-list-types";
function options(actor:string|null,org:string,filters:Record<string,string>){return queryOptions({queryKey:["campaign-list",actor,org,filters],queryFn:({signal})=>privateJson<{items:CampaignItem[];more:boolean}>(`/api/organizations/${org}/campaigns?${new URLSearchParams(filters)}`,signal)});}
export function PagedCampaignList(props:React.ComponentProps<typeof CombinedManagementList>){
 const actor=useQueryActor(),client=useQueryClient(),{params,change}=useListQuery(),{t}=useI18n(),filters={status:params.get("campaignStatus")??"all",kind:params.get("campaignType")??"all",q:params.get("campaignSearch")??"",sort:params.get("campaignSort")==="asc"?"asc":"desc",page:String(Math.max(0,Math.min(10000,Number(params.get("campaignPage"))||0)))};
 const result=useQuery({...options(actor,props.organization,filters),placeholderData:keepPreviousData});
 useEffect(()=>{for(const status of ["all","Draft","Open","Paused","Closed","Archived"])for(const kind of ["all","round","renewal"])void client.prefetchQuery(options(actor,props.organization,{status,kind,q:"",sort:"desc",page:"0"}));return()=>{void client.cancelQueries({queryKey:["campaign-list",actor,props.organization]});};},[actor,client,props.organization]);
 const status=filters.status,kind=filters.kind,q=filters.q,sort=filters.sort,page=filters.page;
 const next=useMemo(()=>({status,kind,q,sort,page:String(Number(page)+1)}),[status,kind,q,sort,page]);
 useEffect(()=>{if(result.data?.more)void client.prefetchQuery(options(actor,props.organization,next));},[actor,client,props.organization,next,result.data?.more]);
 useEffect(()=>{const changed=()=>{void client.invalidateQueries({queryKey:["campaign-list",actor,props.organization]});};window.addEventListener("campaigns-changed",changed);return()=>window.removeEventListener("campaigns-changed",changed);},[actor,client,props.organization]);
 return <><CombinedManagementList {...props} serverRows={result.data?.items??[]} serverPaged/>{(Number(filters.page)>0||result.data?.more)&&<nav className="flex gap-2">{Number(filters.page)>0&&<Button variant="outline" onClick={()=>change({campaignPage:String(Number(filters.page)-1)})}>{t("السابق","Previous")}</Button>}{result.data?.more&&<Button variant="outline" onClick={()=>change({campaignPage:next.page})}>{t("التالي","Next")}</Button>}</nav>}</>;
}
