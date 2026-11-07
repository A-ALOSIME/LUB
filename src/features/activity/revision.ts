import "server-only";
import {sql} from "drizzle-orm";
import {withUser} from "@/db/client";

// Opaque freshness fingerprints only. RLS and the verified actor still govern every read.
export async function activityRevision(user:string){return withUser(user,async tx=>{
 const rows=await tx.execute(sql`select lub.activity_fingerprint() as version`);
 return String(rows[0]?.version??"");
});}

export async function notificationRevision(user:string){return withUser(user,async tx=>{
 const rows=await tx.execute(sql`select lub.notification_fingerprint() as version`);
 return String(rows[0]?.version??"");
});}
