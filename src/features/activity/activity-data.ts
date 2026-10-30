import type {TaskCard} from "@/features/tasks/repository";
import type {HoursData} from "@/features/hours/repository";
import type {myEvents} from "@/features/events/repository";
export type ActivitySnapshot={actorId:string;version:string;tasks:TaskCard[];mine:TaskCard[];events:Awaited<ReturnType<typeof myEvents>>["events"];hours:HoursData};
export function activityHours(data:HoursData,term:string|null,status:string){
 const records=data.records.filter(r=>!term||r.academic_term_id===term);
 const of=(code:string)=>records.filter(r=>r.status_code===code),sum=(code:string)=>String(Math.round(of(code).reduce((total,r)=>total+Number(r.hours),0)*100)/100);
 const totals=new Map<string,{name:string;total:number}>();for(const row of of("Approved")){const previous=totals.get(row.organization_id);totals.set(row.organization_id,{name:row.org_name,total:(previous?.total??0)+Number(row.hours)});}
 return {...data,records:records.filter(r=>status==="all"||r.status_code==={approved:"Approved",pending:"Pending",rejected:"Rejected"}[status]),total:sum("Approved"),hoursByStatus:{approved:sum("Approved"),pending:sum("Pending"),rejected:sum("Rejected"),approvedCount:of("Approved").length,pendingCount:of("Pending").length,rejectedCount:of("Rejected").length},byOrg:[...totals.values()].sort((a,b)=>a.name.localeCompare(b.name)).map(({name,total})=>({name,total:String(Math.round(total*100)/100)}))};
}
