import "server-only";
import {sql} from "drizzle-orm";
import {withUser} from "@/db/client";
import type {Template} from "./repository";
export async function templateList(user:string,org:string,f:{q:string;status:string;page:number}){return withUser(user,async tx=>{
 const rows=await tx.execute(sql`
  select t from jsonb_array_elements(case when lub.has_org_permission(${org},'FORMS_MANAGE') then lub.form_library(${org},null) else '[]' end)
   with ordinality as entries(t,ordinal)
  where position(lub.arabic_search_key(${f.q}) in lub.arabic_search_key(t->>'name'))>0
   and (${f.status}='all' or t->'versions'->0->>'status_code'=${f.status})
  order by ordinal limit 26 offset ${f.page*25}
 `);
 const items=rows.map(row=>row.t as Template);return {items:items.slice(0,25),more:items.length>25};
});}

export async function formPreview(user:string,org:string,template:string){return withUser(user,async tx=>{
 const [row]=await tx.execute(sql`
  select t->'versions'->0 as version,coalesce((select jsonb_agg(c) from lub.form_committee_options(${org}) c),'[]') as committees
  from jsonb_array_elements(case when lub.has_org_permission(${org},'FORMS_MANAGE') then lub.form_library(${org},${template}) else '[]' end) t
  where t->>'id'=${template}
 `);
 return row as {version:import('./repository').Version;committees:Array<{id:string;name:string}>}|undefined;
});}
