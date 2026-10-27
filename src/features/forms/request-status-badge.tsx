import {OrganizationStatusBadge} from "@/features/organizations/organization-status-badge";
import type {Locale} from "@/lib/preferences";
const labels:Record<string,[string,string]>={Submitted:["قيد المراجعة","Under review"],Pending:["بانتظار الموافقة","Pending approval"],Interview:["مقابلة","Interview"],Accepted:["مقبول","Accepted"],Rejected:["مرفوض","Rejected"],Withdrawn:["مسحوب","Withdrawn"],Cancelled:["ملغى","Cancelled"]};
export function RequestStatusBadge({status,locale="ar"}:{status:string;locale?:Locale}){return <OrganizationStatusBadge status={status==="Accepted"?"accepted":status==="Rejected"?"rejected":status==="Interview"?"interview":status==="Pending"||status==="Submitted"?"review":"inactive"}>{labels[status]?.[locale==="en"?1:0]??status}</OrganizationStatusBadge>;}
