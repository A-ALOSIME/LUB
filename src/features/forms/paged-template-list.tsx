"use client";
import {useEffect,useMemo} from "react";
import {useQuery,useQueryClient,queryOptions,keepPreviousData} from "@tanstack/react-query";
import {useQueryActor} from "@/components/private-query-provider";
import {useListQuery} from "@/lib/list-query";
import {privateJson} from "@/lib/private-query";
import {RegistrationTemplateTable} from "./registration-template-table";
import type {Template} from "./repository";
function options(actor:string|null,org:string,filters:{q:string;status:string;page:string}){return queryOptions({queryKey:["template-list",actor,org,filters],queryFn:({signal})=>privateJson<{items:Template[];more:boolean}>(`/api/organizations/${org}/forms?${new URLSearchParams(filters)}`,signal)});}
export function PagedTemplateList(props:React.ComponentProps<typeof RegistrationTemplateTable>){
 const actor=useQueryActor(),client=useQueryClient(),{params,change}=useListQuery(),q=params.get("formSearch")??"",status=params.get("formStatus")??"all",page=String(Math.max(0,Math.min(10000,Number(params.get("formPage"))||0)));
 const filters=useMemo(()=>({q,status,page}),[q,status,page]),result=useQuery({...options(actor,props.organization,filters),placeholderData:keepPreviousData});
 useEffect(()=>{for(const status of ["all","Draft","Published"])void client.prefetchQuery(options(actor,props.organization,{status,q:"",page:"0"}));return()=>{void client.cancelQueries({queryKey:["template-list",actor,props.organization]});};},[actor,client,props.organization]);
 useEffect(()=>{if(result.data?.more)void client.prefetchQuery(options(actor,props.organization,{...filters,page:String(Number(page)+1)}));},[actor,client,props.organization,filters,page,result.data?.more]);
 useEffect(()=>{const changed=(event:Event)=>{if((event as CustomEvent<{organization:string}>).detail?.organization===props.organization)void client.invalidateQueries({queryKey:["template-list",actor,props.organization]});};window.addEventListener("organization-forms-changed",changed);return()=>window.removeEventListener("organization-forms-changed",changed);},[actor,client,props.organization]);
 return <RegistrationTemplateTable {...props} pagination={{page:Number(page),more:result.data?.more??props.items.length>25,onChange:value=>change({formPage:String(value)})}} items={result.data?.items??props.items.slice(0,25)} serverPaged/>;
}
