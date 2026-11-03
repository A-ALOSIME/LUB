import {queryOptions} from "@tanstack/react-query";
import {privateJson} from "@/lib/private-query";
import type {OwnRequestFilters,OwnRequestPage} from "./own-request-types";
export function ownRequestQuery(actor:string|null,filters:OwnRequestFilters){
 return queryOptions({queryKey:["own-requests",actor,filters],queryFn:({signal})=>privateJson<OwnRequestPage>(`/api/my-requests?${new URLSearchParams({...filters,page:String(filters.page)})}`,signal)});
}
