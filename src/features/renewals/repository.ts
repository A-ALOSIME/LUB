import "server-only";
import {sql} from "drizzle-orm";
import {withUser} from "@/db/client";
import type {AccountReadiness,Term} from "@/features/hours/repository";
export type Campaign={id:string;organization_id:string;academic_term_id:string;opens_at:string;closes_at:string;exclude_leadership:boolean;status_code:string;name:string;org_name:string;created_at:string;summary?:{renewed:number;members:number}};
export type Renewal={id:string;organization_membership_id:string;response_code:string;responded_at:string|null;name:string|null;canRespond:boolean};
export type RenewalWorkspace={account:AccountReadiness;name:string;allowed:boolean;terms:Term[];campaigns:Campaign[];selected:Campaign|null;responses:Renewal[];counts:Array<{status:string;count:number}>};
export type PersonalRenewals={account:AccountReadiness;items:Array<{campaign:Campaign;response:Renewal}>};
export async function myRenewals(user:string,page:number){
 return withUser(user,async tx=>{
  const [row]=await tx.execute<{data:PersonalRenewals|null}>(sql`select lub.my_renewal_cases(${page}) as data`);
  return row?.data??undefined;
 });
}
export async function renewalWorkspace(user:string,org:string,selected:string|null,page:number,memberPage:number){
 return withUser(user,async tx=>{
  const [row]=await tx.execute<{data:RenewalWorkspace|null}>(sql`select lub.renewal_management_page(${org},${selected},${page},${memberPage}) as data`);
  return row?.data??undefined;
 });
}
