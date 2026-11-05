import "server-only";
import {sql} from "drizzle-orm";
import {withUser} from "@/db/client";
import {localOrganizationContent} from "./local-content";
import type {AdminOrganizationRow} from "./management-repository";
import type {OpeningRequest} from "@/features/organization-requests/repository";
export type AdminDirectory={organizations:AdminOrganizationRow[];requests:OpeningRequest[];counts:Record<string,number>};
export async function adminDirectory(user:string){return withUser(user,async tx=>{
 const [row]=await tx.execute(sql`select case when lub.is_super_admin() then lub.admin_directory_snapshot() end as data`);
 const data=row?.data as AdminDirectory|null;
 if(!data)return null;
 return {...data,organizations:data.organizations.map(item=>({...item,logoUrl:item.logoUrl||localOrganizationContent(item.nameAr,item.typeCode)?.logoSrc||""}))};
});}
