import "server-only";
import {sql} from "drizzle-orm";
import {withUser} from "@/db/client";
/** An opaque actor-scoped freshness signal, never a permission cache. */
export async function organizationEventsVersion(user:string,org:string){return withUser(user,async tx=>{
 const [row]=await tx.execute<{version:string|null}>(sql`select lub.event_management_version(${org}) as version`);
 return row?.version??null;
});}
