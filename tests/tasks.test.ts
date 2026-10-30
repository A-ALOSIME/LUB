import {PgDialect} from "drizzle-orm/pg-core";
import type {SQL} from "drizzle-orm";
vi.mock("server-only",()=>({}));
vi.mock("@/db/client",()=>({withUser:async(userId:string,operation:(tx:{execute:(query:SQL)=>Promise<Record<string,unknown>[]>})=>Promise<unknown>)=>{await asUser(userId);return operation({execute:async query=>{const compiled=new PgDialect().sqlToQuery(query);return (await db.query<Record<string,unknown>>(compiled.sql,compiled.params)).rows;}});}}));
import {activityRevision} from "../src/features/activity/revision";
import {listTasks,taskDetail} from "../src/features/tasks/repository";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { applyMigrations, storageFixture } from "./storage-fixture";
let db: PGlite;
const leader="00000000-0000-4000-8000-000000000001", member="00000000-0000-4000-8000-000000000002", other="00000000-0000-4000-8000-000000000003";
const org="00000000-0000-4000-8000-000000000101", committee="00000000-0000-4000-8000-000000000201";
let memberships:string[];
beforeAll(async()=>{
 db=new PGlite(); await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
 await storageFixture(db);
 await applyMigrations(db);
},30000);
async function asUser(id:string){await db.exec("reset role");await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('role','authenticated',true)",[id]);}
async function denied(fn:()=>Promise<unknown>){await db.exec("savepoint denied");await expect(fn()).rejects.toThrow();await db.exec("rollback to savepoint denied; release savepoint denied");}
beforeEach(async()=>{
 await db.exec("begin"); memberships=[];
 await db.exec("insert into lub.academic_terms(academic_year,term_code,name_ar,start_date,end_date) values('test','T1','الفصل التجريبي',current_date-30,current_date+90)");
 for(const [i,id] of [leader,member,other].entries()){
 await db.query("insert into auth.users values($1)",[id]);await db.query("insert into lub.users(id,email,email_verified_at) values($1,$2,now())",[id,`task${i}@example.invalid`]);
 await db.query("insert into lub.student_profiles(user_id,full_name_ar,university_id_ciphertext,university_id_lookup_hash,major_name,academic_level) values($1,$2,'private',$3,'الحاسب','4')",[id,`طالب ${i}`,String(i).repeat(64)]);
 }
 await db.query("insert into lub.organizations(id,type_code,slug,name_ar) values($1,'Club','tech','نادي التقنية')",[org]);
 await db.query("insert into lub.committees(id,organization_id,name) values($1,$2,'التقنية')",[committee,org]);
 for(const id of [leader,member,other])memberships.push((await db.query<{id:string}>("insert into lub.organization_memberships(organization_id,user_id) values($1,$2) returning id",[org,id])).rows[0].id);
 await db.query("insert into lub.role_assignments(organization_membership_id,organization_id,role_code,is_primary_leader,assigned_by_user_id) values($1,$2,'OL',true,$3)",[memberships[0],org,leader]);await asUser(leader);
});
afterEach(async()=>{await db.exec("rollback");});afterAll(async()=>{await db.close();});
async function create(scope:string|null=null){return(await db.query<{id:string}>("select lub.save_task(null,$1,$2,null,'تصميم الهوية','وصف المهمة',null,now()-interval '1 hour',2,null) as id",[org,scope])).rows[0].id;}
it("creates private drafts, denies member edits and anonymous reads, and derives overdue without closing",async()=>{
 const task=await create();expect((await db.query("select revision_number from lub.task_revisions where task_id=$1",[task])).rows).toHaveLength(1);
 await asUser(member);expect((await db.query("select id from lub.tasks")).rows).toHaveLength(0);await denied(()=>create());
 await asUser(leader);await db.query("select lub.change_task_status($1,'Open',1)",[task]);
 await asUser(member);expect((await db.query<{status_code:string}>("select status_code from lub.tasks where id=$1",[task])).rows[0].status_code).toBe("Open");
 await db.exec("reset role;set local role anon");await denied(()=>db.query("select * from lub.tasks"));
});
async function openTask(scope:string|null=null){const id=await create(scope);await db.query("select lub.change_task_status($1,'Open',1)",[id]);return id;}
async function join(task:string,user=member){await asUser(user);return(await db.query<{id:string}>("select lub.join_task($1) as id",[task])).rows[0].id;}
async function submit(participant:string,rev=0,message="المخرج الأول",assets:string[]=[]){return(await db.query<{id:string}>("select lub.submit_task($1,$2,$3::uuid[],$4,2) as id",[participant,message,assets,rev])).rows[0].id;}
it("joins once, preserves rejected versions, pins task revision, and reviews participants independently",async()=>{
 const task=await openTask();const p=await join(task);await denied(()=>join(task));await db.query("select lub.start_task_participation($1)",[p]);
 const s=await submit(p);await denied(()=>submit(p));await asUser(leader);
 await denied(()=>db.query("select lub.review_task_submission($1,'Rejected','',null)",[s]));
 await db.query("select lub.review_task_submission($1,'Rejected','أكمل المخرج',null)",[s]);
 await asUser(member);const newer=await submit(p,1,"نسخة محسّنة");expect(newer).not.toBe(s);
 expect((await db.query("select revision_number from lub.task_submissions where task_participant_id=$1 order by revision_number",[p])).rows).toEqual([{revision_number:1},{revision_number:2}]);
 const p2=await join(task,other);await submit(p2);await asUser(leader);
 await denied(()=>db.query("select lub.review_task_submission($1,'Approved','',null)",[s]));
 await db.query("select lub.review_task_submission($1,'Approved','عمل مكتمل',3)",[newer]);
 expect((await db.query("select status_code,approved_hours_override from lub.task_participants where id=$1",[p])).rows[0]).toEqual({status_code:"Approved",approved_hours_override:"3.00"});
 expect((await db.query<{status_code:string}>("select status_code from lub.task_participants where id=$1",[p2])).rows[0].status_code).toBe("Submitted");
 expect((await db.query("select r.id from lub.task_revisions r join lub.task_submissions s on s.task_revision_id=r.id where s.id=$1 and r.revision_number=2",[newer])).rows).toHaveLength(1);
});
it("denies peer submissions, foreign participation, direct writes and historical new content after departure",async()=>{
 const task=await openTask();const p=await join(task);const s=await submit(p);await asUser(other);
 expect((await db.query("select id from lub.task_participants where task_id=$1",[task])).rows).toHaveLength(0);expect((await db.query("select name,status from lub.task_team($1)",[task])).rows).toHaveLength(1);
 expect((await db.query("select id from lub.task_submissions")).rows).toHaveLength(0);await denied(()=>submit(p));await denied(()=>db.query("update lub.tasks set title='اختراق'"));
 await db.exec("reset role");await db.query("update lub.organization_memberships set status_code='Ended',end_date=current_date where id=$1",[memberships[1]]);
 await asUser(leader);await db.query("select lub.save_task($1,$2,null,null,'تحديث خاص','تفاصيل لاحقة',null,now()+interval '1 day',2,2)",[task,org]);
 await asUser(member);expect((await db.query("select id from lub.tasks")).rows).toHaveLength(0);expect((await db.query("select id from lub.task_submissions where id=$1",[s])).rows).toHaveLength(1);
 expect((await db.query("select revision_number from lub.task_revisions where task_id=$1 and revision_number=3",[task])).rows).toHaveLength(0);await denied(()=>submit(p,1));
});
it("respects committee membership and scoped leaders, never grants operational access to SA alone",async()=>{
 const task=await openTask(committee);await asUser(member);expect((await db.query("select id from lub.tasks")).rows).toHaveLength(0);await denied(()=>join(task));
 await db.exec("reset role");await db.query("insert into lub.committee_memberships(organization_id,organization_membership_id,committee_id) values($1,$2,$3)",[org,memberships[1],committee]);
 await db.query("insert into lub.role_assignments(organization_membership_id,organization_id,committee_id,role_code,assigned_by_user_id) values($1,$2,$3,'CL',$4)",[memberships[1],org,committee,leader]);
 await asUser(member);await create(committee);await denied(()=>create());await join(task);
 await db.exec("reset role");await db.query("insert into lub.global_role_assignments(user_id,role_code,assigned_by_user_id) values($1,'SA',$1)",[other]);
 await asUser(other);await denied(()=>create());
});
it("changes emit owner-only notifications, reject stale edits, and cannot close other participants by review",async()=>{
 const task=await openTask();const p=await join(task);await asUser(leader);
 await db.query("select lub.save_task($1,$2,null,null,'تغيير الموعد','وصف جديد',null,now()+interval '1 day',4,2)",[task,org]);
 await denied(()=>db.query("select lub.save_task($1,$2,null,null,'تعديل قديم','وصف',null,null,4,2)",[task,org]));
 await db.query("select lub.close_task_participant($1)",[p]);await asUser(member);
 const notes=(await db.query<{id:string}>("select id from lub.notifications")).rows;expect(notes).toHaveLength(2);
 await db.query("select lub.read_task_notification($1)",[notes[0].id]);expect((await db.query("select id from lub.notifications where read_at is not null")).rows).toHaveLength(1);
 await asUser(other);expect((await db.query("select * from lub.notifications")).rows).toHaveLength(0);await denied(()=>db.query("select lub.read_task_notification($1)",[notes[1].id]));
 await asUser(leader);await db.query("select lub.change_task_status($1,'Completed',3)",[task]);await denied(()=>db.query("select lub.change_task_status($1,'Open',4)",[task]));await denied(()=>join(task,other));
});
it("copies templates independently, enforces grant scope and keeps snapshots immutable",async()=>{
 const template=(await db.query<{id:string}>("select lub.save_task_template(null,$1,$2,'تصميم','إرشادات القالب',2,true,null,null) as id",[org,committee])).rows[0].id;
 const copied=(await db.query<{id:string}>("select lub.save_task_template(null,$1,null,'قالب منسوخ','',0,true,null,$2) as id",[org,template])).rows[0].id;
 await db.query("select lub.save_task_template($1,$2,$3,'قالب جديد','تعديل مستقل',4,true,1,null)",[template,org,committee]);
 expect((await db.query<{description_template:string}>("select description_template from lub.task_templates where id=$1",[copied])).rows[0].description_template).toBe("إرشادات القالب");
 await db.query("insert into lub.committees(organization_id,name,copied_from_committee_id) values($1,'نسخة اللجنة',$2)",[org,committee]);
 expect((await db.query("select id from lub.task_templates where copied_from_template_id=$1",[template])).rows).toHaveLength(2);
 await db.query("select lub.grant_task_permission($1,'TASKS_MANAGE',$2,null)",[memberships[1],committee]);await asUser(member);await create(committee);await denied(()=>create());
 await denied(()=>db.query("select lub.grant_task_permission($1,'TASKS_MANAGE',null,null)",[memberships[2]]));await asUser(leader);
 const grant=(await db.query<{id:string}>("select id from lub.permission_grants where organization_membership_id=$1",[memberships[1]])).rows[0].id;
 await db.query("select lub.end_task_permission($1)",[grant]);await asUser(member);await denied(()=>create(committee));
 await asUser(leader);const task=await create();await db.exec("reset role");await denied(()=>db.query("update lub.task_revisions set snapshot_json='{}' where task_id=$1",[task]));
});
it("binds only owned files, keeps bound objects undeletable, and limits downloads to owner and reviewer",async()=>{
 const task=await openTask();const p=await join(task);const asset="00000000-0000-4000-8000-000000000301",key=`${member}/${asset}`;
 await db.query("select lub.register_application_asset($1,$2,'proof.pdf','application/pdf',100)",[asset,key]);await db.query("insert into storage.objects(bucket_id,name) values('lub-application-files',$1)",[key]);
 const s=await submit(p,0,"",[asset]);await asUser(other);expect((await db.query("select id from lub.application_assets where id=$1",[asset])).rows).toHaveLength(0);
 const p2=await join(task,other);await denied(()=>submit(p2,0,"مرفق غير مملوك",[asset]));
 await asUser(leader);expect((await db.query("select id from lub.application_assets where id=$1",[asset])).rows).toHaveLength(1);
 await db.query("select lub.review_task_submission($1,'Rejected','أعد الإرسال',null)",[s]);await asUser(member);await submit(p,1,"نسخة جديدة");
 expect((await db.query<{allowed:boolean}>("select lub.can_delete_application_object($1) as allowed",[key])).rows[0].allowed).toBe(false);
 await db.exec("reset role");await db.query("update lub.users set status_code='Inactive' where id=$1",[member]);await asUser(member);
 expect((await db.query("select id from lub.task_submissions")).rows).toHaveLength(0);expect((await db.query<{allowed:boolean}>("select lub.can_delete_application_object($1) as allowed",[key])).rows[0].allowed).toBe(false);
});
it("never overwrites submission content or final reviews, and blocks new submissions after task closure",async()=>{
 const task=await openTask();const p=await join(task);let current=await submit(p);
 for(let revision=1;revision<=3;revision++){
  await asUser(leader);await db.query("select lub.review_task_submission($1,'Rejected','أعد المحاولة',null)",[current]);await asUser(member);current=await submit(p,revision,`نسخة ${revision+1}`);
 }
 expect((await db.query("select revision_number from lub.task_submissions where task_participant_id=$1",[p])).rows).toHaveLength(4);
 await db.exec("reset role");await denied(()=>db.query("update lub.task_submissions set message='تغيير قديم' where task_participant_id=$1",[p]));
 await asUser(leader);await db.query("select lub.review_task_submission($1,'Approved','اعتماد',null)",[current]);await db.exec("reset role");
 await denied(()=>db.query("update lub.task_submissions set review_note='استبدال القرار' where id=$1",[current]));
 await asUser(leader);await db.query("select lub.change_task_status($1,'Completed',2)",[task]);await asUser(member);await denied(()=>submit(p,4));
});

it("includes authorized drafts in the management directory without revealing them to students",async()=>{
 const task=await create();
 const managed=await listTasks(leader,{org,view:"all",page:0});expect(managed.items.map(item=>item.task.id)).toContain(task);expect(managed.items[0].task.status_code).toBe("Draft");
 expect((await listTasks(member,{org,view:"all",page:0})).items).toHaveLength(0);expect((await listTasks(member,{org,view:"available",page:0})).items).toHaveLength(0);
});
it("soft-deletes a task while retaining participant submissions and revision history",async()=>{
 const task=await openTask(),p=await join(task);await submit(p);await asUser(leader);
 await db.query("select lub.delete_task($1,2)",[task]);
 expect((await listTasks(leader,{org,view:"all",page:0})).items).toHaveLength(0);
 await asUser(member);expect((await listTasks(member,{org,view:"mine",page:0})).items[0].historical).toBe(true);
 expect((await db.query("select id from lub.task_submissions where task_participant_id=$1",[p])).rows).toHaveLength(1);
});
it("allows a participant to withdraw without destroying submissions or changing another student's participation",async()=>{
 const task=await openTask(),p=await join(task);await submit(p);const second=await join(task,other);await asUser(member);
 await db.query("select lub.withdraw_task_participation($1)",[p]);
 expect((await db.query<{status_code:string}>("select status_code from lub.task_participants where id=$1",[p])).rows[0].status_code).toBe("Closed");
 expect((await db.query("select id from lub.task_submissions where task_participant_id=$1",[p])).rows).toHaveLength(1);
 await denied(()=>db.query("select lub.withdraw_task_participation($1)",[second]));
});

it("guards removal and task images, preserves bound images, and exposes accurate team totals without exposing submissions",async()=>{
 const task=await create(),asset="00000000-0000-4000-8000-000000000302",key=`${leader}/${asset}`;
 await db.query("select lub.register_application_asset($1,$2,'task.png','image/png',100)",[asset,key]);
 await db.query("select lub.set_task_image($1,$2,1)",[task,asset]);
 expect((await db.query<{allowed:boolean}>("select lub.can_delete_application_object($1) as allowed",[key])).rows[0].allowed).toBe(false);
 await db.query("select lub.change_task_status($1,'Open',2)",[task]);await join(task);
 expect((await listTasks(member,{org,view:"mine",page:0})).items[0].summary?.participants).toBe(1);
 expect((await db.query("select id from lub.application_assets where id=$1",[asset])).rows).toHaveLength(1);
 await denied(()=>db.query("select lub.delete_task($1,3)",[task]));await denied(()=>db.query("select lub.set_task_image($1,$2,3)",[task,asset]));
 await asUser(leader);await db.query("select lub.set_task_image($1,null,3)",[task]);
 expect((await db.query<{allowed:boolean}>("select lub.can_delete_application_object($1) as allowed",[key])).rows[0].allowed).toBe(false);
});

it("returns every activity task for a complete snapshot while retaining paged management reads",async()=>{
 for(let i=0;i<28;i++)await openTask();
 const paged=await listTasks(leader,{view:"available",page:0}),complete=await listTasks(leader,{view:"available",page:null});
 expect(paged.items).toHaveLength(25);expect(paged.more).toBe(true);expect(complete.items).toHaveLength(28);expect(complete.more).toBe(false);
});
it("returns all submissions to authorized managers but keeps student reads owner-scoped",async()=>{
 const task=await openTask();const first=await join(task);await submit(first,0);const second=await join(task,other);await submit(second,0);
 const managerView=await taskDetail(leader,task),studentView=await taskDetail(member,task),crossOwner=await taskDetail(member,task,second);
 expect(managerView?.canManage).toBe(true);expect(managerView?.submissions).toHaveLength(2);expect(studentView?.canManage).toBe(false);expect(studentView?.submissions).toHaveLength(1);expect(studentView?.history).toHaveLength(0);expect(crossOwner?.submissions).toHaveLength(0);
});

it("refreshes the actor-scoped activity fingerprint when another participant joins a managed task",async()=>{
 const task=await openTask(),before=await activityRevision(leader);await join(task,member);const after=await activityRevision(leader);expect(before).toHaveLength(32);expect(after).not.toBe(before);
});
