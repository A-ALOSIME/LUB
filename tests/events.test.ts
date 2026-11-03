import {campaignList} from "@/features/renewals/campaign-list-repository";
import {templateList} from "@/features/forms/template-list-repository";
import {listTasks} from "@/features/tasks/repository";
import {organizationApplicationPage} from "@/features/forms/repository";
import {ownRequestPage} from "@/features/forms/own-request-repository";
import {PgDialect} from "drizzle-orm/pg-core";
import type {SQL} from "drizzle-orm";
vi.mock("server-only",()=>({}));
vi.mock("@/db/client",()=>({withUser:async(user:string,operation:(tx:{execute:(query:SQL)=>Promise<Record<string,unknown>[]>})=>Promise<unknown>)=>{await actor(user);return operation({execute:async query=>{const compiled=new PgDialect().sqlToQuery(query);return (await db.query<Record<string,unknown>>(compiled.sql,compiled.params)).rows;}});}}));
import {eventWorkspaceOverview} from "../src/features/events/workspace";
import {eventRegistrants} from "../src/features/events/review-repository";
import {organizationEventsVersion} from "../src/features/events/management-version";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { applyMigrations, storageFixture } from "./storage-fixture";
import {initialDefinition} from "@/features/forms/definition";
let db:PGlite;
const leader="00000000-0000-4000-8000-000000000001", student="00000000-0000-4000-8000-000000000002", peer="00000000-0000-4000-8000-000000000003", org="00000000-0000-4000-8000-000000000101";
async function actor(id:string){await db.exec("reset role");await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('role','authenticated',true)",[id]);}
async function denied(fn:()=>Promise<unknown>){await db.exec("savepoint denied");await expect(fn()).rejects.toThrow();await db.exec("rollback to savepoint denied;release savepoint denied");}
beforeAll(async()=>{db=new PGlite();await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);await storageFixture(db);await applyMigrations(db);},30000);
beforeEach(async()=>{await db.exec("begin");for(const [i,id] of [leader,student,peer].entries()){await db.query("insert into auth.users values($1)",[id]);await db.query("insert into lub.users(id,email,email_verified_at) values($1,$2,now())",[id,`event${i}@example.invalid`]);await db.query("insert into lub.student_profiles(user_id,full_name_ar,university_id_ciphertext,university_id_lookup_hash,major_name,academic_level) values($1,$2,'private',$3,'الحاسب','4')",[id,`طالب ${i}`,String(i).repeat(64)]);}await db.query("insert into lub.organizations(id,type_code,slug,name_ar) values($1,'Club','events-test','نادي الاختبار')",[org]);const m=(await db.query<{id:string}>("insert into lub.organization_memberships(organization_id,user_id) values($1,$2) returning id",[org,leader])).rows[0].id;await db.query("insert into lub.role_assignments(organization_membership_id,organization_id,role_code,is_primary_leader,assigned_by_user_id) values($1,$2,'OL',true,$3)",[m,org,leader]);await actor(leader);});
afterEach(async()=>{await db.exec("rollback");});afterAll(async()=>{await db.close();});
async function create(capacity=1){return(await db.query<{id:string}>("select lub.save_event(null,$1,'ورشة الاختبار','وصف الفعالية','In_Person','القاعة',null,now()+interval '1 day',now()+interval '2 days',now()-interval '1 hour',now()+interval '12 hours',$2,null,2,null) as id",[org,capacity])).rows[0].id;}
it("exports accepted and recorded registrants through expiring owner-bound tickets and excludes test accounts at source",async()=>{
 const event=await create(10);await db.query("select lub.change_event_status($1,'Published',1)",[event]);await actor(student);
 const registration=(await db.query<{id:string}>("select lub.register_event($1,null,'{}',null) as id",[event])).rows[0].id;
 await actor(leader);await db.query("select lub.review_event_registrations(array[$1]::uuid[],'Accepted','')",[registration]);
 const prepare=()=>db.query<{value:{ticket:string}}>("select public.prepare_registrant_export($1,$2,null,'','') as value",[org,event]);
 const ticket=(await prepare()).rows[0].value.ticket;
 await actor(peer);await denied(()=>db.query("select public.consume_registrant_export($1)",[ticket]));await denied(()=>prepare());await actor(leader);
 const read=async(id:string)=>(await db.query<{value:{records:Array<{userId:string;isTest:boolean;status:string}>}}>("select public.consume_registrant_export($1) as value",[id])).rows[0].value;
 expect((await read(ticket)).records).toEqual([expect.objectContaining({userId:student,isTest:false,status:"Accepted"})]);await denied(()=>read(ticket));
 await db.query("select lub.verify_registration_contribution($1,'Presenter','شرح الورشة')",[registration]);
 expect((await read((await prepare()).rows[0].value.ticket)).records[0].status).toBe("Recorded");
 const list=await eventRegistrants(leader,org,event,"","Recorded",0,false);expect(list.items).toHaveLength(1);expect(list.recorded).toBe(1);expect(list.accepted).toBe(0);
 await db.exec("reset role");await db.query("update lub.users set is_test_account=true where id=$1",[student]);await actor(leader);
 expect((await read((await prepare()).rows[0].value.ticket)).records).toEqual([]);const counted=await eventRegistrants(leader,org,event,"","",0,false);expect(counted.items).toHaveLength(1);expect(counted.recorded).toBe(0);
});
it("restricts a delegated registrant export to its committee and rejects expired tickets and exhausted quota",async()=>{
 const event=await create(10);await db.query("select lub.change_event_status($1,'Published',1)",[event]);
 const ids=[];for(const user of [student,peer,leader]){await actor(user);ids.push((await db.query<{id:string}>("select lub.register_event($1,null,'{}',null) as id",[event])).rows[0].id);}
 await actor(leader);await db.query("select lub.review_event_registrations($1::uuid[],'Accepted','')",[ids]);
 await db.exec("reset role");const committee=(await db.query<{id:string}>("insert into lub.committees(organization_id,name) values($1,'التقنية') returning id",[org])).rows[0].id;
 const membership=(await db.query<{id:string}>("insert into lub.organization_memberships(organization_id,user_id) values($1,$2) returning id",[org,student])).rows[0].id;
 const peerMembership=(await db.query<{id:string}>("insert into lub.organization_memberships(organization_id,user_id) values($1,$2) returning id",[org,peer])).rows[0].id;
 await db.query("insert into lub.committee_memberships(organization_id,organization_membership_id,committee_id) values($1,$2,$3)",[org,peerMembership,committee]);
 await db.query("insert into lub.committee_memberships(organization_id,organization_membership_id,committee_id) values($1,$2,$3)",[org,membership,committee]);
 await actor(leader);await db.query("select lub.grant_report_permission($1,$2,null)",[membership,committee]);await actor(student);
 const prepare=async()=>(await db.query<{value:{ticket:string}}>("select public.prepare_registrant_export($1,$2,null,'','') as value",[org,event])).rows[0].value.ticket;
 const ticket=await prepare(),payload=(await db.query<{value:{records:Array<{userId:string}>}}>("select public.consume_registrant_export($1) as value",[ticket])).rows[0].value;expect(payload.records.map(row=>row.userId).sort()).toEqual([student,peer].sort());expect(payload.records.some(row=>row.userId===leader)).toBe(false);
 const expired=await prepare();await db.exec("reset role");await db.query("update lub.data_exports set expires_at=now()-interval '1 second' where id=$1",[expired]);await actor(student);await denied(()=>db.query("select public.consume_registrant_export($1)",[expired]));
 for(let i=0;i<4;i++)await prepare();await denied(()=>prepare());
});
async function publish(event:string){await db.query("select lub.change_event_status($1,'Published',1)",[event]);}
async function register(event:string){return(await db.query<{id:string}>("select lub.register_event($1,null,'{}',null) as id",[event])).rows[0].id;}

it("links tasks to scoped events with immutable revisions and rejects stale or unrelated changes",async()=>{
 const event=await create();const task=(await db.query<{id:string}>("select lub.save_task(null,$1,null,null,'مهمة مرتبطة','وصف داخلي',null,null,0,null) as id",[org])).rows[0].id;
 await db.query("select lub.link_task_event($1,$2,1)",[task,event]);
 expect((await db.query<{snapshot_json:{event_id:string}}>("select snapshot_json from lub.task_revisions where task_id=$1 order by revision_number desc limit 1",[task])).rows[0].snapshot_json.event_id).toBe(event);
 await denied(()=>db.query("select lub.link_task_event($1,null,1)",[task]));
 await actor(peer);await denied(()=>db.query("select lub.link_task_event($1,null,2)",[task]));
 await db.exec("reset role");const otherOrg=(await db.query<{id:string}>("insert into lub.organizations(type_code,slug,name_ar) values('Club','other-event','جهة أخرى') returning id")).rows[0].id;
 const unrelated=(await db.query<{id:string}>("insert into lub.events(organization_id,created_by_user_id,title,description,location_type_code,location_text,starts_at,ends_at,registration_opens_at,registration_closes_at) values($1,$2,'فعالية أخرى','وصف','In_Person','قاعة',now()+interval '1 day',now()+interval '2 days',now(),now()+interval '12 hours') returning id",[otherOrg,leader])).rows[0].id;
 await actor(leader);await denied(()=>db.query("select lub.link_task_event($1,$2,2)",[task,unrelated]));
 await db.query("select lub.link_task_event($1,null,2)",[task]);
 expect((await db.query<{snapshot_json:{event_id:string|null}}>("select snapshot_json from lub.task_revisions where task_id=$1 order by revision_number desc limit 1",[task])).rows[0].snapshot_json.event_id).toBeNull();
 await db.query("select lub.change_task_status($1,'Cancelled',3)",[task]);await denied(()=>db.query("select lub.link_task_event($1,$2,4)",[task,event]));
});

it("lets delegated task managers link public events but keeps private drafts outside their capability",async()=>{
 const event=await create();const task=(await db.query<{id:string}>("select lub.save_task(null,$1,null,null,'مهمة مستقلة','وصف',null,null,0,null) as id",[org])).rows[0].id;
 await db.exec('reset role');const member=(await db.query<{id:string}>("insert into lub.organization_memberships(organization_id,user_id) values($1,$2) returning id",[org,student])).rows[0].id;
 await actor(leader);await db.query("select lub.grant_task_permission($1,'TASKS_MANAGE',null,null)",[member]);await actor(student);await denied(()=>db.query("select lub.link_task_event($1,$2,1)",[task,event]));
 await actor(leader);await publish(event);await actor(student);await db.query("select lub.link_task_event($1,$2,1)",[task,event]);expect((await db.query<{event_id:string}>("select event_id from lub.tasks where id=$1",[task])).rows[0].event_id).toBe(event);
});
it("publishes for visitors while keeping drafts and registration identities private",async()=>{const e=await create();await db.exec("reset role;set local role anon");expect((await db.query("select id from lub.events")).rows).toHaveLength(0);await denied(()=>register(e));await actor(leader);await publish(e);await db.exec("reset role;set local role anon");expect((await db.query("select id from lub.events")).rows).toEqual([{id:e}]);await denied(()=>db.query("select * from lub.event_registrations"));});
it("serializes capacity, registers once, supports cancellation and respects closing time",async()=>{const e=await create();await publish(e);await actor(student);const r=await register(e);expect(await register(e)).toBe(r);await actor(peer);await denied(()=>register(e));await actor(student);await db.query("select lub.cancel_event_registration($1)",[r]);await actor(peer);await register(e);await actor(student);await denied(()=>register(e));await db.exec("reset role");await db.query("update lub.events set registration_closes_at=now()-interval '1 minute' where id=$1",[e]);await actor(peer);await denied(()=>register(e));});
it("denies SA-only event operations, direct writes, stale edits and peer registration reads",async()=>{const e=await create();await publish(e);await actor(student);await register(e);await actor(peer);expect((await db.query("select id from lub.event_registrations")).rows).toHaveLength(0);await denied(()=>db.query("update lub.events set title='اختراق'"));await db.exec("reset role");await db.query("insert into lub.global_role_assignments(user_id,role_code,assigned_by_user_id) values($1,'SA',$1)",[peer]);await actor(peer);await denied(()=>create());await actor(leader);await denied(()=>db.query("select lub.change_event_status($1,'Cancelled',1)",[e]));});
it("notifies registered users on published edits and cancellation without deleting history",async()=>{const e=await create();await publish(e);await actor(student);await register(e);await actor(leader);await db.query("select lub.save_event($1,$2,'موعد جديد','وصف','Online',null,'https://example.invalid',now()+interval '3 days',now()+interval '4 days',now()-interval '1 hour',now()+interval '12 hours',1,null,2,2)",[e,org]);await db.query("select lub.change_event_status($1,'Cancelled',3)",[e]);await actor(student);expect((await db.query("select id from lub.notifications where target_url=$1",[`/events/${e}`])).rows.length).toBeGreaterThanOrEqual(3);expect((await db.query("select id from lub.event_registrations")).rows).toHaveLength(1);});
it("awards only eligible original members on manual completion, once, and rolls back missing term",async()=>{const e=await create();await publish(e);await actor(student);const r=await register(e);await actor(leader);await denied(()=>db.query("select lub.mark_event_attendance($1,'Present')",[r]));await db.exec("reset role");await db.query("update lub.events set starts_at=now()-interval '2 days',ends_at=now()-interval '1 day',registration_opens_at=now()-interval '4 days',registration_closes_at=now()-interval '3 days' where id=$1",[e]);await actor(leader);await db.query("select lub.mark_event_attendance($1,'Present')",[r]);expect((await db.query("select id from lub.hour_records")).rows).toHaveLength(0);await db.exec("reset role");await db.query("insert into lub.organization_memberships(organization_id,user_id,start_date) values($1,$2,current_date-10)",[org,student]);await actor(leader);await denied(()=>db.query("select lub.change_event_status($1,'Completed',2)",[e]));await db.exec("reset role");await db.exec("insert into lub.academic_terms(academic_year,term_code,name_ar,start_date,end_date) values('test','T1','الفصل',current_date-30,current_date+30)");await actor(leader);await db.query("select lub.change_event_status($1,'Completed',2)",[e]);expect((await db.query("select hours,status_code,source_code from lub.hour_records")).rows).toEqual([{hours:"2.00",status_code:"Approved",source_code:"EVENT"}]);await denied(()=>db.query("select lub.change_event_status($1,'Completed',3)",[e]));await denied(()=>db.query("select lub.mark_event_attendance($1,'Absent')",[r]));});
it("keeps outside attendees eligible to register, but never fabricates memberships or hours",async()=>{const e=await create();await publish(e);await actor(student);const r=await register(e);await actor(leader);await denied(()=>db.query("select lub.mark_event_attendance($1,'Present')",[r]));await db.exec("reset role");await db.query("update lub.events set starts_at=now()-interval '2 days',ends_at=now()-interval '1 day',registration_opens_at=now()-interval '4 days',registration_closes_at=now()-interval '3 days' where id=$1",[e]);await actor(leader);await db.query("select lub.mark_event_attendance($1,'Present')",[r]);await db.query("select lub.verify_event_contribution($1,$2,'Trainer','تقديم الورشة')",[e,student]);await db.exec("reset role");await actor(leader);await db.query("select lub.change_event_status($1,'Completed',2)",[e]);expect((await db.query("select id from lub.hour_records")).rows).toHaveLength(0);expect((await db.query("select id from lub.event_contributions")).rows).toHaveLength(1);});
it("pins form versions, validates required answers and rejects stale response edits",async()=>{
 const e=await create(5);const template=(await db.query<{id:string}>("select lub.create_form($1,'نموذج الفعالية',null) as id",[org])).rows[0].id;const v=(await db.query<{id:string}>("select id from lub.form_versions where form_template_id=$1",[template])).rows[0].id;
 await db.query("select lub.save_form_draft($1,$2::jsonb,1)",[v,JSON.stringify(initialDefinition)]);await db.query("select lub.publish_form_version($1)",[v]);await db.exec("reset role");await db.query("update lub.events set registration_form_template_id=$1 where id=$2",[template,e]);await actor(leader);await publish(e);await actor(student);await denied(()=>register(e));const answers={[initialDefinition.sections[0].fields[0].id]:"أرغب بالمشاركة"};
 const r=(await db.query<{id:string}>("select lub.register_event($1,$2,$3::jsonb,null) as id",[e,v,JSON.stringify(answers)])).rows[0].id;await denied(()=>db.query("select lub.register_event($1,$2,$3::jsonb,8)",[e,v,JSON.stringify(answers)]));await db.query("select lub.register_event($1,$2,$3::jsonb,1)",[e,v,JSON.stringify(answers)]);expect((await db.query("select revision,form_version_id from lub.form_responses")).rows).toEqual([{revision:2,form_version_id:v}]);
 await actor(peer);expect((await db.query("select id from lub.form_responses")).rows).toEqual([]);await denied(()=>db.query("select lub.cancel_event_registration($1)",[r]));await actor(leader);expect((await db.query("select answers from lub.form_responses")).rows).toHaveLength(1);
});
it("delegates only organization capabilities and revokes event access immediately",async()=>{await db.exec("reset role");const m=(await db.query<{id:string}>("insert into lub.organization_memberships(organization_id,user_id) values($1,$2) returning id",[org,student])).rows[0].id;await actor(leader);await db.query("select lub.grant_event_permission($1,'EVENT_ATTENDANCE_MANAGE',null)",[m]);const e=await create();await publish(e);await actor(peer);const r=await register(e);await actor(student);await db.exec("reset role");await db.query("update lub.events set starts_at=now()-interval '2 days',ends_at=now()-interval '1 day',registration_opens_at=now()-interval '4 days',registration_closes_at=now()-interval '3 days' where id=$1",[e]);await actor(student);await db.query("select lub.mark_event_attendance($1,'Present')",[r]);await denied(()=>create());await actor(leader);const g=(await db.query<{id:string}>("select id from lub.permission_grants where permission_code='EVENT_ATTENDANCE_MANAGE'")).rows[0].id;await db.query("select lub.end_event_permission($1)",[g]);await actor(student);await denied(()=>db.query("select lub.mark_event_attendance($1,'Absent')",[r]));});

it("stores incomplete drafts privately and only publishes complete events",async()=>{
 const draft=(await db.query<{id:string}>("select lub.save_event(null,$1,'','','In_Person',null,null,null,null,null,null,null,null,0,null) as id",[org])).rows[0].id;
 await denied(()=>db.query("select lub.change_event_status($1,'Published',1)",[draft]));
 await db.exec("reset role;set local role anon");expect((await db.query("select id from lub.events where id=$1",[draft])).rows).toHaveLength(0);
});
it("unpublishes an event without dropping registrations and hides its public row",async()=>{
 const event=await create();await publish(event);await actor(student);const registration=await register(event);
 await actor(leader);await db.query("select lub.change_event_status($1,'Draft',2)",[event]);
 await db.exec("reset role;set local role anon");expect((await db.query("select id from lub.events where id=$1",[event])).rows).toHaveLength(0);
 await actor(leader);expect((await db.query("select id from lub.event_registrations where id=$1",[registration])).rows).toHaveLength(1);
 await db.query("select lub.change_event_status($1,'Published',3)",[event]);
});

it("atomically saves and publishes a complete event and rolls back incomplete publication",async()=>{
 await denied(()=>db.query("select lub.save_and_publish_event(null,$1,'','','In_Person',null,null,null,null,null,null,null,null,0,null,null,true)",[org]));
 expect((await db.query("select id from lub.events")).rows).toHaveLength(0);
 const saved=(await db.query<{id:string}>("select lub.save_and_publish_event(null,$1,'فعالية مباشرة','','In_Person','كلية الحاسب',null,now()+interval '3 days',now()+interval '4 days',now()-interval '1 hour',now()+interval '2 days',null,null,0,null,null,true) as id",[org])).rows[0].id;
 expect((await db.query<{status_code:string}>("select status_code from lub.events where id=$1",[saved])).rows[0].status_code).toBe('Published');
});

it("reviews registrations with scoped bulk decisions and keeps approval separate from attendance",async()=>{const event=await create(3);await db.query("select lub.set_event_registration_policy($1,true,1)",[event]);await db.query("select lub.change_event_status($1,'Published',2)",[event]);await actor(student);const a=await register(event);expect((await db.query("select review_status_code from lub.event_registrations where id=$1",[a])).rows[0]).toMatchObject({review_status_code:'Pending'});await actor(peer);const b=await register(event);await denied(()=>db.query("select lub.review_event_registrations($1::uuid[],'Accepted','')",[[a,b]]));await actor(leader);await denied(()=>db.query("select lub.mark_event_attendance($1,'Present')",[a]));await db.query("select lub.review_event_registrations($1::uuid[],'Accepted','')",[[a,b]]);expect((await db.query<{count:number}>("select count(*)::int as count from lub.event_registrations where event_id=$1 and review_status_code='Accepted'",[event])).rows[0].count).toBe(2);await db.query("select lub.review_event_registrations($1::uuid[],'Rejected','اكتملت المقاعد')",[[b]]);await actor(peer);expect((await db.query<{review_note:string}>("select review_note from lub.event_registrations where id=$1",[b])).rows[0].review_note).toBe('اكتملت المقاعد');expect((await db.query<{count:number}>("select count(*)::int as count from lub.event_registration_history where event_registration_id=$1",[b])).rows[0].count).toBe(3);expect((await db.query<{remaining:number}>("select lub.event_remaining($1) as remaining",[event])).rows[0].remaining).toBe(2);});

it("copies the approval policy and excludes rejected registrations when reducing capacity",async()=>{const event=await create(2);await db.query("select lub.set_event_registration_policy($1,true,1)",[event]);const copy=(await db.query<{id:string}>("select lub.duplicate_event($1) as id",[event])).rows[0].id;expect((await db.query("select requires_approval from lub.events where id=$1",[copy])).rows[0]).toMatchObject({requires_approval:true});await db.query("select lub.change_event_status($1,'Published',2)",[event]);await actor(student);await register(event);await actor(peer);const r=await register(event);await actor(leader);await db.query("select lub.review_event_registrations($1::uuid[],'Rejected','')",[[r]]);await db.query("select lub.save_event($1,$2,'ورشة','وصف','In_Person','قاعة',null,now()+interval '1 day',now()+interval '2 days',now()-interval '1 hour',now()+interval '12 hours',1,null,2,3)",[event,org]);expect((await db.query<{remaining:number}>("select lub.event_remaining($1) as remaining",[event])).rows[0].remaining).toBe(0);});

it("allows only event managers to remove registrations and retains decision history",async()=>{const event=await create();await publish(event);await actor(student);const r=await register(event);await actor(peer);await denied(()=>db.query("select lub.remove_event_registration($1)",[r]));await actor(leader);await db.query("select lub.remove_event_registration($1)",[r]);expect((await db.query("select status_code from lub.event_registrations where id=$1",[r])).rows[0]).toEqual({status_code:'Cancelled'});await actor(student);expect((await db.query<{status_code:string}>("select status_code from lub.event_registration_history where event_registration_id=$1 order by created_at",[r])).rows.map(x=>x.status_code)).toEqual(expect.arrayContaining(['Accepted','Cancelled']));expect((await db.query("select id from lub.notifications where target_url=$1",[`/events/${event}`])).rows.length).toBeGreaterThanOrEqual(2);await actor(leader);await denied(()=>db.query("select lub.remove_event_registration($1)",[r]));});

it("loads the full organization cache across page boundaries and keeps all reads permission-scoped",async()=>{
 for(let i=0;i<28;i++){await actor(leader);const event=await create();await publish(event);await actor(student);await register(event);}
 const paged=await eventWorkspaceOverview(leader,org,0),complete=await eventWorkspaceOverview(leader,org,null),registrations=await eventRegistrants(leader,org,null,"","",null);
 expect(paged?.events).toHaveLength(26);expect(complete?.events).toHaveLength(28);expect(registrations.items).toHaveLength(28);expect(registrations.options).toHaveLength(28);
 expect(await eventWorkspaceOverview(student,org,null)).toBeUndefined();expect((await eventRegistrants(student,org,null,"","",null)).items).toHaveLength(0);expect(await organizationEventsVersion(student,org)).toBeNull();
 const before=await organizationEventsVersion(leader,org);await db.query("select lub.review_event_registrations($1::uuid[],'Rejected','سبب القرار')",[[registrations.items[0].id]]);const after=await organizationEventsVersion(leader,org);expect(before).toHaveLength(32);expect(after).not.toBe(before);
});

it("restores only empty source fields, preserves existing values, and keeps undated archives non-registerable and idempotent",async()=>{
 const payload={slug:'events-test',name:'اسم من الملف',type:'Club',summary:'نبذة المصدر',mission:'رسالة المصدر',profile:{vision:'رؤية المصدر',partners:'شريك المصدر'},contacts:[{kind:'X',url:'https://x.com/source'}],committees:[{name:'لجنة الإعلام',description:'• توثيق الأنشطة.\n• إنتاج المحتوى.',parent:null}],events:[{id:'00000000-0000-4000-8000-000000000900',title:'لقاء أرشيفي',description:'نص الملف فقط',dateText:'25 يناير'}]};
 await actor(student);await denied(()=>db.query('select lub.restore_markdown_organization($1::jsonb)',[JSON.stringify(payload)]));await db.exec("reset role;select set_config('request.jwt.claim.sub','',true)");await db.query("insert into lub.global_role_assignments(user_id,role_code,assigned_by_user_id) values($1,'SA',$1)",[leader]);await db.query("update lub.organizations set public_profile_content=$1::jsonb where id=$2",[JSON.stringify({vision:"",partners:"شريك حالي"}),org]);await db.query("select set_config('request.jwt.claim.sub','',true)");
 const first=(await db.query<{result:{changed:string[];kept:Array<{field:string;current:string}>}}>('select lub.restore_markdown_organization($1::jsonb) as result',[JSON.stringify(payload)])).rows[0].result;expect(first.changed).toContain('mission');expect(first.kept).toContainEqual(expect.objectContaining({field:'name',current:'نادي الاختبار'}));expect(first.kept).toContainEqual(expect.objectContaining({field:'profile.partners',current:'شريك حالي'}));const second=(await db.query<{result:{changed:string[]}}>('select lub.restore_markdown_organization($1::jsonb) as result',[JSON.stringify(payload)])).rows[0].result;expect(second.changed).toEqual([]);
 await db.exec('reset role');expect((await db.query('select starts_at,ends_at,source_date_text,status_code from lub.events where id=$1',[payload.events[0].id])).rows).toEqual([{starts_at:null,ends_at:null,source_date_text:'25 يناير',status_code:'Archived'}]);expect((await db.query('select description from lub.committees where organization_id=$1',[org])).rows[0]).toEqual({description:'• توثيق الأنشطة.\n• إنتاج المحتوى.'});await actor(student);await denied(()=>register(payload.events[0].id));await db.exec("reset role;set local role anon");expect((await db.query('select id from lub.events')).rows).toHaveLength(1);
});
it('limits the committee hierarchy to one subcommittee level',async()=>{await db.exec('reset role');const root=(await db.query<{id:string}>("insert into lub.committees(organization_id,name) values($1,'رئيسية') returning id",[org])).rows[0].id;const child=(await db.query<{id:string}>("insert into lub.committees(organization_id,name,parent_committee_id) values($1,'فرعية',$2) returning id",[org,root])).rows[0].id;await denied(()=>db.query("insert into lub.committees(organization_id,name,parent_committee_id) values($1,'تفصيل مهمة',$2)",[org,child]));});

it('exposes dimensions only for published posters and prevents another user from changing them',async()=>{
 const event=await create(),asset='00000000-0000-4000-8000-000000000901';
 await db.query("select lub.register_application_asset($1,$2,'poster.png','image/png',100)",[asset,`${leader}/${asset}.png`]);
 await db.query('select lub.set_asset_image_dimensions($1,800,1200)',[asset]);
 await db.query('select lub.set_event_poster($1,$2)',[event,asset]);
 await denied(()=>db.query('select lub.set_asset_image_dimensions($1,0,1200)',[asset]));
 await actor(student);await denied(()=>db.query('select lub.set_asset_image_dimensions($1,100,100)',[asset]));
 await db.exec('reset role;set local role anon');
 expect((await db.query('select lub.public_event_poster_dimensions($1) as dimensions',[event])).rows[0]).toEqual({dimensions:null});
 await actor(leader);await publish(event);await db.exec('reset role;set local role anon');
 expect((await db.query('select lub.public_event_poster_dimensions($1) as dimensions',[event])).rows[0]).toEqual({dimensions:{width:800,height:1200}});
});

it('keeps pinning exclusive to the active leader even when event management is delegated',async()=>{
 const event=await create();await publish(event);await db.exec('reset role');
 const member=(await db.query<{id:string}>('insert into lub.organization_memberships(organization_id,user_id) values($1,$2) returning id',[org,student])).rows[0].id;
 await actor(leader);await db.query("select lub.grant_event_permission($1,'EVENTS_MANAGE',null)",[member]);
 await actor(student);expect((await db.query('select lub.can_feature_event($1) as allowed',[event])).rows[0]).toEqual({allowed:false});await denied(()=>db.query('select lub.set_featured_event($1,true)',[event]));
 await actor(leader);expect((await db.query('select lub.can_feature_event($1) as allowed',[event])).rows[0]).toEqual({allowed:true});await db.query('select lub.set_featured_event($1,true)',[event]);
 expect((await db.query('select is_featured from lub.events where id=$1',[event])).rows[0]).toEqual({is_featured:true});
});

it("archives events without dropping registrations and only deletes unused drafts",async()=>{
 const e=await create();await publish(e);await actor(student);await register(e);await actor(leader);
 await denied(()=>db.query("select lub.event_list_action($1,'delete',2)",[e]));
 await db.query("select lub.event_list_action($1,'archive',2)",[e]);
 expect((await db.query<{status_code:string}>("select status_code from lub.events where id=$1",[e])).rows[0].status_code).toBe("Archived");
 expect((await db.query("select id from lub.event_registrations where event_id=$1",[e])).rows).toHaveLength(1);
 await db.exec("reset role;set local role anon");expect((await db.query("select id from lub.events where id=$1",[e])).rows).toHaveLength(0);await actor(leader);
 const draft=await create();await actor(peer);await denied(()=>db.query("select lub.event_list_action($1,'delete',1)",[draft]));await actor(leader);
 await denied(()=>db.query("select lub.event_list_action($1,'delete',99)",[draft]));await db.query("select lub.event_list_action($1,'delete',1)",[draft]);
 expect((await db.query("select id from lub.events where id=$1",[draft])).rows).toHaveLength(0);
});

it("keeps all three request list reads owner-scoped and paginated with their real states",async()=>{
 const filters={q:"",sort:"desc" as const,status:"all",page:0};
 await actor(student);
 await db.query("select lub.submit_organization_request('نادي بحث','Club','نبذة','رسالة الجهة','[]',null)");
 const openings=await ownRequestPage(student,{...filters,tab:"organizations"});expect(openings.items).toHaveLength(1);expect(openings.items[0].status).toBe("Pending");expect(openings.items[0].canWithdraw).toBe(true);
 expect((await ownRequestPage(peer,{...filters,tab:"organizations"})).items).toHaveLength(0);
 expect((await ownRequestPage(student,{...filters,tab:"applications"})).items).toHaveLength(0);
 expect((await ownRequestPage(student,{...filters,tab:"renewals"})).items).toHaveLength(0);
 expect((await ownRequestPage(student,{...filters,q:"بحث",tab:"organizations"})).total).toBe(1);
 expect((await ownRequestPage(student,{...filters,status:"Accepted",tab:"organizations"})).items).toHaveLength(0);
});

it("bounds bootstrap and server pages, searches all records and never includes form/task definitions in list DTOs",async()=>{
 const template=(await db.query<{id:string}>("select lub.create_form($1,'نموذج التسجيل',null) as id",[org])).rows[0].id;
 const version=(await db.query<{id:string}>("select id from lub.form_versions where form_template_id=$1",[template])).rows[0].id;await db.query("select lub.save_form_draft($1,$2::jsonb,1)",[version,JSON.stringify(initialDefinition)]);await db.query("select lub.publish_form_version($1)",[version]);
 for(let i=0;i<54;i++){
  await create();
  await db.query("select lub.create_registration_round($1,$2,$3,now(),now()+interval '2 days',true)",[org,template,`جولة ${i}`]);
  await db.query("select lub.save_task(null,$1,null,null,$2,'تفاصيل لا تحملها القائمة',null,null,1,null)",[org,`مهمة ${i}`]);
 }
 expect((await eventWorkspaceOverview(leader,org,null))?.events).toHaveLength(51);
 const event0=(await eventWorkspaceOverview(leader,org,0,{eventStatus:'Draft'}))!.events,event1=(await eventWorkspaceOverview(leader,org,1,{eventStatus:'Draft'}))!.events;
 expect(event0).toHaveLength(26);expect(event1).toHaveLength(26);expect(event0.slice(0,25).some(row=>event1.slice(0,25).some(other=>row.id===other.id))).toBe(false);
 const first=await campaignList(leader,org,{status:'Draft',kind:'round',q:'',sort:'desc',page:0}),next=await campaignList(leader,org,{status:'Draft',kind:'round',q:'',sort:'desc',page:1});
 expect(first.items).toHaveLength(25);expect(first.more).toBe(true);expect(next.items).toHaveLength(25);expect(first.items.some(row=>next.items.some(other=>row.id===other.id))).toBe(false);
 expect((await campaignList(leader,org,{status:'all',kind:'round',q:'جولة 53',sort:'desc',page:0})).items).toHaveLength(1);
 expect((await campaignList(peer,org,{status:'all',kind:'all',q:'',sort:'desc',page:0})).items).toHaveLength(0);
 const tasks=await listTasks(leader,{org,view:'all',page:0});expect(tasks.items).toHaveLength(25);expect(tasks.more).toBe(true);expect(tasks.items[0].task).not.toHaveProperty('description');expect(tasks.items[0].task).not.toHaveProperty('skills');
 const forms=await templateList(leader,org,{q:'',status:'Published',page:0});expect(forms.items[0].versions[0]).not.toHaveProperty('definition');expect((await templateList(peer,org,{q:'',status:'all',page:0})).items).toHaveLength(0);
 await db.exec('reset role');expect((await db.query<{allowed:boolean}>("select has_function_privilege('anon','lub.organization_member_directory(uuid,text,text,uuid,integer)','execute') as allowed")).rows[0].allowed).toBe(false);
});

it("returns application rows and full status counters in one scoped page read",async()=>{
 const filters={q:'',status:'',committee:'',major:'',level:'',from:'',to:'',page:1,lookup:'',round:'',activity:''};
 const result=await organizationApplicationPage(leader,org,filters);expect(result.items).toEqual([]);expect(result.counts).toEqual({all:0,submitted:0,interview:0,accepted:0,rejected:0,withdrawn:0});expect(result.more).toBe(false);
 const blocked=await organizationApplicationPage(peer,org,filters);expect(blocked.items).toEqual([]);expect(blocked.counts.all).toBe(0);
 await actor(leader);
 const template=(await db.query<{id:string}>("select lub.create_form($1,'نموذج الطلب',null) as id",[org])).rows[0].id;
 const version=(await db.query<{id:string}>("select id from lub.form_versions where form_template_id=$1",[template])).rows[0].id;
 await db.query("select lub.save_form_draft($1,$2::jsonb,1)",[version,JSON.stringify(initialDefinition)]);await db.query("select lub.publish_form_version($1)",[version]);
 const round=(await db.query<{id:string}>("select lub.create_registration_round($1,$2,'جولة الطلب',now()-interval '1 hour',now()+interval '1 day',true) as id",[org,template])).rows[0].id;await db.query("select lub.change_round_status($1,'Open')",[round]);
 await actor(student);await db.query("select lub.submit_application($1,$2,$3::jsonb,null,null,null)",[round,version,JSON.stringify({[initialDefinition.sections[0].fields[0].id]:'أرغب بالمشاركة'})]);
 const populated=await organizationApplicationPage(leader,org,filters);expect(populated.items).toHaveLength(1);expect(populated.counts).toMatchObject({all:1,submitted:1,interview:0});expect(populated.items[0]).toMatchObject({name:'طالب 1',status_code:'Submitted'});expect(populated.items[0]).not.toHaveProperty('answers');expect(populated.items[0]).not.toHaveProperty('avatar');
 const accepted=await organizationApplicationPage(leader,org,{...filters,status:'Accepted'});expect(accepted.items).toEqual([]);expect(accepted.counts.submitted).toBe(1);
 expect((await organizationApplicationPage(peer,org,filters)).items).toEqual([]);

});
