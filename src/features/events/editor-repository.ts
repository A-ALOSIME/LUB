import "server-only";
import {sql} from "drizzle-orm";
import {withUser} from "@/db/client";
import type {Event} from "./repository";
export type EventEditorData={event:Event;templates:Array<{id:string;name:string}>};
/** Edit only: never loads registrants, contributions or signed attachment URLs. */
export async function eventEditor(user:string,org:string,target:string){return withUser(user,async tx=>{
 const [row]=await tx.execute<EventEditorData>(sql`
  select detail->'event' as event, lub.event_management_page(${org},0,'{"section":"editor"}')->'templates' as templates
  from (select lub.event_page(${target}) as detail) data
  where (detail->>'canManage')::boolean and detail->'event'->>'organization_id'=${org}
 `);
 return row;
});}
