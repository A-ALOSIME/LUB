"use server";
import {z} from "zod";
import {sql} from "drizzle-orm";
import {revalidatePath} from "next/cache";
import {withUser} from "@/db/client";
import {requireManagementUser} from "@/features/organizations/access";
export async function transitionCampaign(input:unknown){
 const user=await requireManagementUser();
 const parsed=z.object({kind:z.enum(["round","renewal"]),id:z.uuid(),operation:z.enum(["publish","pause","resume","close","archive","delete"]),expected:z.enum(["Draft","Open","Paused","Closed","Archived"])}).safeParse(input);
 if(!parsed.success)return {error:true};
 try{const {kind,id,operation,expected}=parsed.data;await withUser(user.id,tx=>tx.execute(sql`select lub.transition_campaign(${kind},${id},${operation},${expected})`));revalidatePath("/manage/organizations/[id]/renewals","page");revalidatePath("/applications");revalidatePath("/organizations/[slug]","page");return {success:true};}catch{return {error:true};}
}
