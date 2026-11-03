import "server-only";
import {sql} from "drizzle-orm";
import {withUser} from "@/db/client";
import type {RenewalParticipantFilters,RenewalParticipantPage} from "./participant-types";
export async function renewalParticipantPage(user:string,campaign:string,filters:RenewalParticipantFilters){return withUser(user,async tx=>{
 const [row]=await tx.execute<{data:RenewalParticipantPage}>(sql`select lub.renewal_participant_page(${campaign}::uuid,${filters.q},${filters.status},${filters.page}::int) as data`);
 return row?.data;
});}
