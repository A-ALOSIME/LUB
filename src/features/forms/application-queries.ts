import {queryOptions} from "@tanstack/react-query";
import {privateJson} from "@/lib/private-query";
import type {Detail} from "./repository";
export type CachedApplicationDetail=Detail&{campaign_title?:string;created_at?:string};
export function applicationDetailQuery(actor:string|null,org:string|null,id:string|null){const q=org?`?organization=${encodeURIComponent(org)}`:"";return queryOptions({queryKey:["application-detail",actor,org,id],queryFn:({signal})=>privateJson<CachedApplicationDetail>(`/api/applications/${id}${q}`,signal)});}
