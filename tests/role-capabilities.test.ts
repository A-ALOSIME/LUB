import {PGlite} from "@electric-sql/pglite";
import {beforeAll,beforeEach,afterEach,afterAll,expect,it} from "vitest";
import {applyMigrations,storageFixture} from "./storage-fixture";
let db:PGlite;
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`,org=id(100),first=id(200),second=id(201),hr=id(202);
async function actor(n:number){await db.exec("reset role");await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('role','authenticated',true)",[id(n)]);}
async function denied(run:()=>Promise<unknown>){await db.exec("savepoint denied");await expect(run()).rejects.toThrow();await db.exec("rollback to savepoint denied;release savepoint denied");}
beforeAll(async()=>{db=new PGlite();await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;");await storageFixture(db);await applyMigrations(db);},30000);
beforeEach(async()=>{await db.exec("begin");for(let n=1;n<=8;n++){await db.query("insert into auth.users values($1)",[id(n)]);await db.query("insert into lub.users(id,email,email_verified_at) values($1,$2,now())",[id(n),`role${n}@example.invalid`]);await db.query("insert into lub.student_profiles(user_id,full_name_ar,university_id_ciphertext,university_id_lookup_hash,major_name,academic_level) values($1,$2,'cipher',$3,'الحاسب','5')",[id(n),`طالب ${n}`,String(n).repeat(64)]);}
 await db.query("insert into lub.organizations(id,type_code,slug,name_ar) values($1,'Club','roles-test','جهة الأدوار')",[org]);for(const [committee,name]of [[first,'المحتوى'],[second,'التصميم'],[hr,'الموارد البشرية']])await db.query("insert into lub.committees(id,organization_id,name) values($1,$2,$3)",[committee,org,name]);
 for(let n=1;n<=8;n++){await db.query("insert into lub.organization_memberships(id,organization_id,user_id) values($1,$2,$3)",[id(300+n),org,id(n)]);if(n<=6)await db.query("insert into lub.role_assignments(organization_membership_id,organization_id,role_code,committee_id,is_primary_leader,assigned_by_user_id) values($1,$2,$3,$4,$5,$6)",[id(300+n),org,['OL','OD','CL','CD','CL','CD'][n-1],n<=2?null:n>=5?hr:first,n===1,id(1)]);}
});afterEach(async()=>db.exec("rollback"));afterAll(async()=>db.close());
async function allowed(n:number,cap:string,committee:string|null=null){await actor(n);return(await db.query<{ok:boolean}>("select lub.has_org_permission($1,$2,$3) ok",[org,cap,committee])).rows[0].ok;}
it("derives current-role scope and separates cross-committee creation from review",async()=>{
 for(const cap of ['MEMBERS_VIEW','PERMISSIONS_GRANT','EVENTS_MANAGE','RENEWALS_MANAGE','REPORTS_GENERATE','HOURS_APPROVE']){expect(await allowed(1,cap)).toBe(true);expect(await allowed(2,cap)).toBe(true);}
 for(const cap of ['ORG_PROFILE_MANAGE','COMMITTEE_MANAGE','COMMITTEE_PROFILE_MANAGE'])expect(await allowed(2,cap)).toBe(false);
 for(const n of [3,4]){for(const cap of ['TASKS_MANAGE','TASK_TEMPLATES_MANAGE'])expect(await allowed(n,cap,second)).toBe(true);expect(await allowed(n,'TASKS_REVIEW',first)).toBe(true);expect(await allowed(n,'TASKS_REVIEW',second)).toBe(false);expect(await allowed(n,'MEMBERS_VIEW',first)).toBe(true);expect(await allowed(n,'MEMBERS_VIEW',second)).toBe(false);}
 expect(await allowed(3,'REPORTS_GENERATE',first)).toBe(true);expect(await allowed(4,'REPORTS_GENERATE',first)).toBe(false);expect(await allowed(4,'HOURS_APPROVE',first)).toBe(false);
 for(const n of [5,6])for(const cap of ['MEMBERS_VIEW','APPLICATIONS_REVIEW','EVENT_REGISTRATIONS_REVIEW','HOURS_APPROVE'])expect(await allowed(n,cap)).toBe(true);
 for(const cap of ['EVENTS_MANAGE','RENEWALS_MANAGE','REPORTS_GENERATE']){expect(await allowed(5,cap)).toBe(true);expect(await allowed(6,cap)).toBe(false);}
 await db.exec('reset role');await db.query("insert into lub.permission_grants(organization_membership_id,organization_id,permission_code,granted_by_user_id) values($1,$2,'TASKS_MANAGE',$3)",[id(307),org,id(1)]);expect(await allowed(7,'TASKS_MANAGE')).toBe(false);await actor(7);await denied(()=>db.query("select lub.change_member_role($1,'OD',null)",[id(307)]));
});
it("assigns roles through the leader, prevents self/primary-leader changes and retains role history",async()=>{
 await actor(1);await denied(()=>db.query("select lub.change_member_role($1,'Member',null)",[id(301)]));await db.query("select lub.change_member_role($1,'CD',$2)",[id(307),first]);expect(await allowed(7,'TASKS_REVIEW',first)).toBe(true);expect(await allowed(7,'HOURS_APPROVE',first)).toBe(false);
 await actor(2);await db.query("select lub.change_member_role($1,'CL',$2)",[id(307),second]);expect(await allowed(7,'TASKS_REVIEW',first)).toBe(false);expect(await allowed(7,'TASKS_REVIEW',second)).toBe(true);await actor(1);await denied(()=>db.query("select lub.change_member_role($1,'HRL',null)",[id(308)]));
 expect((await db.query("select id from lub.role_assignments where organization_membership_id=$1",[id(307)])).rows.length).toBe(2);
});

it("allows cross-committee task creation but rejects reviewing its submissions and private applicants outside authorized scope",async()=>{
 await actor(3);const task=(await db.query<{id:string}>("select lub.save_task(null,$1,$2,null,'مهمة مشتركة','مخرج',null,null,2,null) id",[org,second])).rows[0].id;await db.query("select lub.change_task_status($1,'Open',1)",[task]);
 await db.exec('reset role');await db.query("insert into lub.committee_memberships(organization_membership_id,organization_id,committee_id) values($1,$2,$3)",[id(307),org,second]);await actor(7);const participation=(await db.query<{id:string}>("select lub.join_task($1) id",[task])).rows[0].id;const submission=(await db.query<{id:string}>("select lub.submit_task($1,'المخرج',array[]::uuid[],0,2) id",[participation])).rows[0].id;
 await actor(3);await denied(()=>db.query("select lub.review_task_submission_decision($1,'Rejected','مراجعة خارج النطاق')",[submission]));expect((await db.query("select id from lub.task_submissions where id=$1",[submission])).rows).toHaveLength(0);expect((await db.query<{data:unknown[]}>("select lub.task_submission_page($1,null,0,true) data",[task])).rows[0].data).toEqual([]);
 await actor(1);await db.query("select lub.review_task_submission_decision($1,'Rejected','قرار القائد')",[submission]);
 const template=(await db.query<{id:string}>("select lub.create_form($1,'انضمام',null) id",[org])).rows[0].id;const version=(await db.query<{id:string}>("select id from lub.form_versions where form_template_id=$1",[template])).rows[0].id;await db.query("select lub.publish_form_version($1)",[version]);const round=(await db.query<{id:string}>("select lub.create_registration_round($1,$2,'جولة',now()-interval '1 hour',now()+interval '1 day',true) id",[org,template])).rows[0].id;await db.query("select lub.change_round_status($1,'Open')",[round]);
 await actor(1);await db.query("select lub.end_organization_membership($1,'انتهت العضوية السابقة')",[id(308)]);await actor(8);const application=(await db.query<{id:string}>("select lub.submit_application($1,$2,$3::jsonb,null,null,null) id",[round,version,JSON.stringify(Object.fromEntries((await db.query<{definition:{sections:Array<{fields:Array<{id:string}>}>}}>("select definition from lub.form_versions where id=$1",[version])).rows[0].definition.sections.flatMap(section=>section.fields.map(field=>[field.id,"إجابة"]))))])).rows[0].id;
 await actor(3);await denied(()=>db.query("select lub.application_member_profile($1,$2)",[org,application]));await actor(1);const record=(await db.query<{data:{userId:string;avatar:null;roles:unknown[]}}>("select lub.application_member_profile($1,$2) data",[org,application])).rows[0].data;expect(record.userId).toBe(id(8));expect(record.avatar).toBeNull();expect(record.roles).toEqual([]);await denied(()=>db.query("select lub.application_member_profile($1,$2)",[id(999),application]));
});

it("defaults a committee leader export to their authorized committee and rejects deputy and foreign-scope exports",async()=>{
 await db.query("insert into lub.committee_memberships(organization_membership_id,organization_id,committee_id) values($1,$2,$3),($4,$2,$5)",[id(307),org,first,id(308),second]);
 await actor(3);
 const ticket=(await db.query<{data:{ticket:string}}>("select public.prepare_member_export($1,'','all',null,null) data",[org])).rows[0].data.ticket;
 await db.exec('reset role');expect((await db.query<{committee_id:string}>("select committee_id from lub.member_exports where id=$1",[ticket])).rows[0].committee_id).toBe(first);
 await actor(3);const data=(await db.query<{data:{records:Array<{userId:string}>}}>("select public.consume_member_export($1) data",[ticket])).rows[0].data;
 expect(data.records.map(row=>row.userId)).toContain(id(7));expect(data.records.map(row=>row.userId)).not.toContain(id(8));
 await denied(()=>db.query("select public.prepare_member_export($1,'','all',$2,null)",[org,second]));
 await actor(4);await denied(()=>db.query("select public.prepare_member_export($1,'','all',$2,null)",[org,first]));
});
