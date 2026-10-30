import {OrganizationStatusBadge,type OrganizationStatus} from "@/features/organizations/organization-status-badge";
import type {Locale} from "@/lib/preferences";
import {taskLabels,taskLabelsEn} from "./display";
const tones:Record<string,OrganizationStatus>={In_Progress:"active",Approved:"accepted",Rejected:"rejected",Joined:"inactive",Submitted:"inactive",Closed:"closed"};
export function TaskParticipationBadge({status,locale}:{status:string;locale:Locale}){
 const labels=locale==="en"?taskLabelsEn:taskLabels;
 return <OrganizationStatusBadge status={tones[status]??"inactive"}>{labels[status]??status}</OrganizationStatusBadge>;
}
