"use server";
import {z} from "zod";
import {sql} from "drizzle-orm";
import {withUser} from "@/db/client";
import {requireManagementUser} from "./access";
import {getOrganizationMemberDirectory} from "./management-repository";
import {decodeMemberRecord} from "./member-identifiers";
import type {EncryptedMemberRecord,MemberFilters} from "./member-types";
const filters=z.object({page:z.number().int().min(0).max(10000).optional(),sort:z.enum(["name:asc","name:desc","date:asc","date:desc"]).default("name:asc"),q:z.string().trim().max(120),status:z.enum(['all','Active','Ended','Inactive']),term:z.uuid().nullable().optional(),committee:z.uuid().nullable()});
export async function loadMemberDirectory(organization:string,input:MemberFilters){
 const user=await requireManagementUser();
 try{const data=await getOrganizationMemberDirectory(user.id,z.uuid().parse(organization),filters.parse(input));return data?{data}:{error:true as const};}catch{return{error:true as const};}
}
export async function loadMemberRecord(organization:string,member:string){
 const user=await requireManagementUser();
 try{
  const org=z.uuid().parse(organization),id=z.uuid().parse(member);
  const raw=await withUser(user.id,async tx=>{const [row]=await tx.execute<{record:EncryptedMemberRecord}>(sql`select lub.member_profile(${org},${id}) record`);return row?.record;});
  return raw?{data:decodeMemberRecord(raw)}:{error:true as const};
 }catch{return{error:true as const};}
}
