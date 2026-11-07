import "server-only";
import {sql} from "drizzle-orm";
import {withUser} from "@/db/client";
import type {CampaignFilters,CampaignItem} from "./campaign-list-types";
export async function campaignList(user:string,org:string,filters:CampaignFilters){
 return withUser(user,async tx=>{
  const [row]=await tx.execute<{items:CampaignItem[]}>(sql`
   select lub.campaign_page(${org},${filters.kind},${filters.status},${filters.q},${filters.sort==="asc"},${filters.page}) as items
  `);
  const items=row?.items??[];
  return {items:items.slice(0,25),more:items.length>25};
 });
}
