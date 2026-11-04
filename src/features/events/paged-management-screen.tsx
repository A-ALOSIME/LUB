"use client";
import {useEffect,useMemo} from "react";
import {useQuery,useQueryClient,queryOptions,keepPreviousData} from "@tanstack/react-query";
import {useQueryActor} from "@/components/private-query-provider";
import {completeList} from "@/lib/complete-list";
import {OrganizationEventsView} from "./management-view";
import type {OrganizationEventsSnapshot} from "./management-cache";
import type {Locale} from "@/lib/preferences";
function options(actor:string|null,id:string,filters:Record<string,string|undefined>){const values=Object.fromEntries(Object.entries(filters).filter((entry):entry is [string,string]=>entry[1]!==undefined&&entry[1]!==""));return queryOptions({queryKey:["organization-event-page",actor,id,values],queryFn:({signal})=>completeList<{workspace:OrganizationEventsSnapshot["workspace"];registrations:OrganizationEventsSnapshot["registrations"]|null}>(`/api/organizations/${id}/event-lists?${new URLSearchParams(values)}`,signal)});}
export function PagedOrganizationEventsView({id,snapshot,search,locale,onChange}:{id:string;snapshot:OrganizationEventsSnapshot;search:Record<string,string|undefined>;locale:Locale;onChange:(values:Record<string,string|null>,replace?:boolean)=>void}){
 const actor=useQueryActor(),client=useQueryClient(),section=search.section==="announcements"?"announcements":search.section==="registrants"?"registrants":"events";
 // Include only parameters used by this section, so switching another tab never splits an identical cache entry.
 const filters=useMemo(()=>section==="events"?{section,eventStatus:search.eventStatus??"all",eventSearch:search.eventSearch??"",sort:search.sort??"desc",page:search.page??"0"}:section==="announcements"?{section,announcementStatus:search.announcementStatus??"all",announcementSearch:search.announcementSearch??"",announcementSort:search.announcementSort??"desc",announcementPage:search.announcementPage??"0"}:{section,q:search.q??"",review:search.review??"",eventFilter:search.eventFilter,registrationPage:search.registrationPage??"0"},[search,section]);
 const result=useQuery({...options(actor,id,filters),placeholderData:keepPreviousData});
 useEffect(()=>{for(const eventStatus of ["all","Published","Draft","Cancelled","Archived"])void client.prefetchQuery(options(actor,id,{section:"events",eventStatus,eventSearch:"",sort:"desc",page:"0"}));for(const announcementStatus of ["all","published","draft","archived"])void client.prefetchQuery(options(actor,id,{section:"announcements",announcementStatus,announcementSearch:"",announcementSort:"desc",announcementPage:"0"}));for(const review of ["","Pending","Accepted","Recorded","Rejected"])void client.prefetchQuery(options(actor,id,{section:"registrants",q:"",review,registrationPage:"0"}));return()=>{void client.cancelQueries({queryKey:["organization-event-page",actor,id]});};},[actor,client,id]);
 useEffect(()=>{const changed=(event:Event)=>{const org=(event as CustomEvent<{organization?:string}>).detail?.organization;if(!org||org===id)void client.invalidateQueries({queryKey:["organization-event-page",actor,id]});};window.addEventListener("organization-events-changed",changed);return()=>window.removeEventListener("organization-events-changed",changed);},[actor,client,id]);
 const data=result.data?{...snapshot,workspace:{...snapshot.workspace,...result.data.workspace},registrations:result.data.registrations??snapshot.registrations}:snapshot;
 return <OrganizationEventsView id={id} snapshot={data} search={search} locale={locale} onChange={onChange} serverPaged/>;
}
