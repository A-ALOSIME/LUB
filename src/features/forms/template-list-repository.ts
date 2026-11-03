import "server-only";
import {sql} from "drizzle-orm";
import {withUser} from "@/db/client";
import type {Template} from "./repository";
export async function templateList(user:string,org:string,f:{q:string;status:string;page:number}){return withUser(user,async tx=>{
 const rows=await tx.execute(sql`with forms as (
 select t.id,t.name,t.organization_id,lub.can_delete_form(t.id) as can_delete,lub.form_last_updated(t.id) as updated_at,
 (select count(*)::int from lub.registration_rounds r where r.form_template_id=t.id) as round_count,
 (select count(*)::int from lub.form_versions v where v.form_template_id=t.id) as version_count,
 coalesce((select jsonb_agg(to_jsonb(v)-'definition' order by v.version_number desc) from (select id,version_number,status_code,revision from lub.form_versions where form_template_id=t.id order by version_number desc limit 2) v),'[]') as versions,t.created_at
 from lub.form_templates t where t.organization_id=${org} and lub.has_org_permission(${org},'FORMS_MANAGE'))
 select * from forms where position(lub.arabic_search_key(${f.q}) in lub.arabic_search_key(name))>0 and (${f.status}='all' or coalesce(versions->0->>'status_code','Draft')=${f.status}) order by created_at desc,id limit 26 offset ${f.page*25}`);
 const items=rows as unknown as Template[];return {items:items.slice(0,25),more:items.length>25};
});}
