import "server-only";
import {sql} from "drizzle-orm";
import {withUser} from "@/db/client";
import type {CampaignFilters,CampaignItem} from "./campaign-list-types";
export async function campaignList(user:string,org:string,f:CampaignFilters){return withUser(user,async tx=>{
 const rows=await tx.execute(sql`with campaigns as (
 select r.id,'round'::text as kind,r.title,r.opens_at as opens,r.closes_at as closes,r.status_code as status,to_jsonb(r)||jsonb_build_object('open',lub.round_is_open(r.id),'application_count',lub.round_application_count(r.id)) as round,null::jsonb as campaign
 from lub.registration_rounds r where r.organization_id=${org} and lub.has_org_permission(${org},'REGISTRATION_ROUNDS_MANAGE')
 union all select c.id,'renewal',t.name_ar,c.opens_at,c.closes_at,c.status_code,null,to_jsonb(c)||jsonb_build_object('name',t.name_ar,'org_name',o.name_ar)
 from lub.renewal_campaigns c join lub.academic_terms t on t.id=c.academic_term_id join lub.organizations o on o.id=c.organization_id where c.organization_id=${org} and lub.has_org_permission(${org},'RENEWALS_MANAGE'))
 select * from campaigns where (${f.kind}='all' or kind=${f.kind}) and ((${f.status}='all' and status<>'Archived') or status=${f.status}) and position(lub.arabic_search_key(${f.q}) in lub.arabic_search_key(title))>0 order by opens ${f.sort==='asc'?sql`asc`:sql`desc`} nulls last,id limit 26 offset ${f.page*25}`);
 const items=rows as unknown as CampaignItem[];return {items:items.slice(0,25),more:items.length>25};
});}
