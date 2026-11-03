import "server-only";
import {sql} from "drizzle-orm";
import {withUser} from "@/db/client";
import type {Event} from "./repository";
export type EventEditorData={event:Event;templates:Array<{id:string;name:string}>};
/** Edit only: never loads registrants, contributions or signed attachment URLs. */
export async function eventEditor(user:string,org:string,target:string){return withUser(user,async tx=>{
 const rows=await tx.execute(sql`select to_jsonb(e)||jsonb_build_object('skills',lub.activity_skill_selection('Event',e.id),'has_poster',exists(select 1 from lub.event_assets a where a.event_id=e.id and a.asset_type_code='Poster')) as event,
 coalesce((select jsonb_agg(t) from(select t.id,t.name from lub.form_templates t where (t.organization_id=e.organization_id or t.is_system_template) and exists(select 1 from lub.form_versions v where v.form_template_id=t.id and v.status_code='Published') order by t.name,t.id limit 100) t),'[]') as templates
 from lub.events e where e.id=${target} and e.organization_id=${org} and lub.can_operate_event(e.id)`);
 return rows[0] as unknown as EventEditorData|undefined;
});}
