import "server-only";
import {sql} from "drizzle-orm";
import {withUser} from "@/db/client";
import type {OwnRequestFilters,OwnRequestPage} from "./own-request-types";
export async function ownRequestPage(user:string,filters:OwnRequestFilters):Promise<OwnRequestPage>{
 return withUser(user,async tx=>{const [row]=await tx.execute(sql`select lub.own_request_page(${filters.tab},${filters.q},${filters.status},${filters.sort},${filters.page*25}) as data`);const data=row.data as Omit<OwnRequestPage,"more">;return {...data,more:data.items.length>25,items:data.items.slice(0,25)};});
}
