import "server-only";
import { sql } from "drizzle-orm";
import { withUser } from "@/db/client";
export {taskLabels,formatTaskDate} from "./display";
export type Task={id:string;organization_id:string;committee_id:string|null;title:string;description:string;starts_at:string|null;due_at:string|null;default_hours:string;status_code:string;revision:number;task_template_id:string|null;event_id?:string|null};
export type Participant={id:string;user_id:string;status_code:string;approved_hours_override:string|null;joined_at:string;closed_at:string|null};
export type Submission={id:string;revision_number:number;message:string;status_code:string;submitted_at:string;review_note:string|null;reviewed_at:string|null;task_revision_id:string;task_revision_number:number;task_snapshot:Task;assets:Array<{id:string;name:string}>};
export type TaskTemplate={id:string;organization_id:string;committee_id:string|null;name:string;description_template:string;default_hours:string;is_active:boolean;revision:number};
export type TaskCard={task:Task;org_name:string;participant:Participant|null;historical:boolean};
export type TaskDetail={task:Task;canManage:boolean;current:boolean;own:Participant|null;selected:Participant|null;lastRevision:number;team:Array<{id:string;name:string;status:string}>;submissions:Submission[];history:Array<{id:string;revision_number:number;snapshot_json:Task;changed_at:string}>;linkedEvent:{id:string;title:string;status:string}|null;eventChoices:Array<{id:string;title:string;status:string}>};
export type TaskWorkspace={name:string;scopes:Array<{id:string|null;name:string;tasks:boolean;templates:boolean}>;templates:TaskTemplate[];hourRules:Array<{id:string;name:string;default_hours:string;committee_id:string|null;task_template_id:string|null}>;members:Array<{id:string;name:string;grants:Array<{id:string;code:string;committee:string|null;ends:string|null}>}>;canGrant:boolean};
export async function taskWorkspace(user:string,org:string){return withUser(user,async tx=>{
 const rows=await tx.execute(sql`select o.name_ar as name,coalesce((select jsonb_agg(r) from (select id,name,default_hours,committee_id,task_template_id from lub.hour_rules where organization_id=o.id and is_active and effective_from<=(statement_timestamp() at time zone 'Asia/Riyadh')::date and (effective_to is null or effective_to>=(statement_timestamp() at time zone 'Asia/Riyadh')::date) order by name,id limit 100) r),'[]') as "hourRules",lub.has_org_permission(o.id,'PERMISSIONS_GRANT') as "canGrant",
 coalesce((select jsonb_agg(s) from (select null::uuid as id,'الجهة بالكامل' as name,lub.has_org_permission(o.id,'TASKS_MANAGE') as tasks,lub.has_org_permission(o.id,'TASK_TEMPLATES_MANAGE') as templates union all select c.id,c.name,lub.has_org_permission(o.id,'TASKS_MANAGE',c.id),lub.has_org_permission(o.id,'TASK_TEMPLATES_MANAGE',c.id) from lub.committees c where c.organization_id=o.id and c.status_code='Active') s where s.tasks or s.templates),'[]') as scopes,
 coalesce((select jsonb_agg(t) from (select * from lub.task_templates where organization_id=o.id order by created_at desc,id limit 100) t),'[]') as templates,
 case when lub.has_org_permission(o.id,'PERMISSIONS_GRANT') then lub.task_grant_members(o.id) else '[]'::jsonb end as members
 from lub.organizations o where o.id=${org} and (lub.has_task_access(o.id) or lub.has_org_permission(o.id,'PERMISSIONS_GRANT'))`);
 return rows[0] as unknown as TaskWorkspace|undefined;
});}
export async function listTasks(user:string,options:{org?:string;mine?:boolean;page:number}){return withUser(user,async tx=>{
 const rows=await tx.execute(sql`with visible as (
 select to_jsonb(t) as task,t.organization_id,t.created_at,to_jsonb(p) as participant,false as historical from lub.tasks t left join lub.task_participants p on p.task_id=t.id and p.user_id=${user}
 where (${options.org??null}::uuid is null or t.organization_id=${options.org??null}::uuid) and (${Boolean(options.mine)}=false or p.id is not null)
 union all select r.snapshot_json,(r.snapshot_json->>'organization_id')::uuid,p.joined_at,to_jsonb(p),true from lub.task_participants p join lateral(select r.* from lub.task_revisions r where r.task_id=p.task_id order by r.revision_number desc limit 1) r on true
 where p.user_id=${user} and not exists(select 1 from lub.tasks t where t.id=p.task_id) and (${options.org??null}::uuid is null or (r.snapshot_json->>'organization_id')::uuid=${options.org??null}::uuid))
 select v.task,o.name_ar as org_name,v.participant,v.historical from visible v join lub.organizations o on o.id=v.organization_id order by v.created_at desc,v.task->>'id' limit 26 offset ${options.page*25}`);
 const items=rows as unknown as TaskCard[];return {items:items.slice(0,25),more:items.length>25};
});}
export async function taskDetail(user:string,id:string,participant:string|null=null,revisionPage=0,teamPage=0,eventPage=0){return withUser(user,async tx=>{
 const rows=await tx.execute(sql`select
 coalesce((select to_jsonb(t) from lub.tasks t where t.id=${id}),(select r.snapshot_json from lub.task_revisions r where r.task_id=${id} order by r.revision_number desc limit 1)) as task,
 lub.can_manage_task(${id}) as "canManage",lub.can_read_task(${id}) as current,
 (select jsonb_build_object('id',e.id,'title',e.title,'status',e.status_code) from lub.events e where e.id=(select t.event_id from lub.tasks t where t.id=${id})) as "linkedEvent",
 case when lub.can_manage_task(${id}) then coalesce((select jsonb_agg(e) from(select e.id,e.title,e.status_code as status from lub.events e where e.organization_id=(select t.organization_id from lub.tasks t where t.id=${id}) and e.status_code<>'Cancelled' order by e.starts_at desc,e.id limit 26 offset ${eventPage*25}) e),'[]') else '[]'::jsonb end as "eventChoices",
 (select to_jsonb(p) from lub.task_participants p where p.task_id=${id} and p.user_id=${user}) as own,
 (select to_jsonb(p) from lub.task_participants p where p.task_id=${id} and ((p.id=${participant}::uuid and lub.can_manage_task(${id})) or (${participant}::uuid is null and p.user_id=${user})) limit 1) as selected,
 coalesce((select max(s.revision_number) from lub.task_submissions s join lub.task_participants p on p.id=s.task_participant_id where p.task_id=${id} and p.user_id=${user}),0) as "lastRevision",
 coalesce((select jsonb_agg(t) from lub.task_team(${id},${teamPage*100}) t),'[]') as team,
 coalesce((select jsonb_agg(s order by s.revision_number desc) from (select s.*,r.revision_number as task_revision_number,r.snapshot_json as task_snapshot,coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',a.file_name)) from lub.task_submission_assets sa join lub.application_assets a on a.id=sa.asset_id where sa.task_submission_id=s.id),'[]') as assets from lub.task_submissions s join lub.task_participants p on p.id=s.task_participant_id join lub.task_revisions r on r.id=s.task_revision_id where p.task_id=${id} and ((${participant}::uuid is null and p.user_id=${user}) or (p.id=${participant}::uuid and lub.can_manage_task(${id}))) order by s.revision_number desc limit 21 offset ${revisionPage*20}) s),'[]') as submissions,
 coalesce((select jsonb_agg(r order by r.revision_number desc) from (select id,revision_number,snapshot_json,changed_at from lub.task_revisions where task_id=${id} order by revision_number desc limit 21 offset ${revisionPage*20}) r),'[]') as history`);
 const data=rows[0] as unknown as TaskDetail|undefined;return data?.task?data:undefined;
});}
export async function taskNotifications(user:string,page:number){return withUser(user,async tx=>{
 const rows=await tx.execute(sql`select id,title,body,target_url,created_at,read_at from lub.notifications order by created_at desc,id limit 26 offset ${page*25}`);
 return rows as unknown as Array<{id:string;title:string;body:string;target_url:string;created_at:string;read_at:string|null}>;
});}
