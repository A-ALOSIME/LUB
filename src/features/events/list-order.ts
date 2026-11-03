import {arabicSearchKey} from "@/features/talent/skill-normalization";
export function eventListRows<T extends {title:string;starts_at:string;ends_at:string;status_code:string}>(rows:T[],{status="all",q="",sort="desc",now=Date.now()}:{status?:string;q?:string;sort?:string;now?:number}){
 return rows.filter(row=>(status==="all"?row.status_code!=="Archived":row.status_code===status)&&arabicSearchKey(row.title).includes(arabicSearchKey(q))).sort((a,b)=>{
  const at=Date.parse(a.starts_at),bt=Date.parse(b.starts_at);
  if(!Number.isFinite(at)||!Number.isFinite(bt))return Number.isFinite(at)?-1:Number.isFinite(bt)?1:0;
  const activeA=Date.parse(a.ends_at)>=now,activeB=Date.parse(b.ends_at)>=now;
  return Number(activeB)-Number(activeA)||(sort==="asc"?at-bt:bt-at);
 });
}
