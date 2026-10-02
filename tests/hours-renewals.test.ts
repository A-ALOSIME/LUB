import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import { storageFixture } from "./storage-fixture";
let db:PGlite;
const leader="00000000-0000-4000-8000-000000000001",member="00000000-0000-4000-8000-000000000002",admin="00000000-0000-4000-8000-000000000003";
const org="00000000-0000-4000-8000-000000000101",committee="00000000-0000-4000-8000-000000000201";
let memberships:string[],term:string;
beforeAll(async()=>{
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
 await storageFixture(db);for(const file of readdirSync("drizzle").filter(x=>x.endsWith(".sql")).sort())await db.exec(readFileSync(`drizzle/${file}`,"utf8"));
},30000);
async function asUser(id:string){await db.exec("reset role");await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('role','authenticated',true)",[id]);}
async function denied(fn:()=>Promise<unknown>){await db.exec("savepoint denied");await expect(fn()).rejects.toThrow();await db.exec("rollback to savepoint denied;release savepoint denied");}
beforeEach(async context=>{
 await db.exec("begin");memberships=[];
 for(const [i,id] of [leader,member,admin].entries()){
 await db.query("insert into auth.users values($1)",[id]);await db.query("insert into lub.users(id,email,email_verified_at) values($1,$2,now())",[id,`hours${i}@example.invalid`]);
 await db.query("insert into lub.student_profiles(user_id,full_name_ar,university_id_ciphertext,university_id_lookup_hash,major_name,academic_level) values($1,$2,'private',$3,'الحاسب','4')",[id,`طالب ${i}`,String(i).repeat(64)]);
 }
 await db.query("insert into lub.organizations(id,type_code,slug,name_ar) values($1,'Club','tech','نادي التقنية')",[org]);await db.query("insert into lub.committees(id,organization_id,name) values($1,$2,'التقنية')",[committee,org]);
 for(const id of [leader,member,admin])memberships.push((await db.query<{id:string}>("insert into lub.organization_memberships(organization_id,user_id) values($1,$2) returning id",[org,id])).rows[0].id);
 await db.query("insert into lub.role_assignments(organization_membership_id,organization_id,role_code,is_primary_leader,assigned_by_user_id) values($1,$2,'OL',true,$3)",[memberships[0],org,leader]);
 await db.query("insert into lub.global_role_assignments(user_id,role_code,assigned_by_user_id) values($1,'SA',$1)",[admin]);await asUser(admin);
 term="";if(!context.task.name.startsWith("requires a covering term"))term=(await db.query<{id:string}>("select lub.create_academic_term('2026-2027','T1','الفصل الأول',current_date-30,current_date+90) as id")).rows[0].id;await asUser(leader);
});
afterEach(async()=>{await db.exec("rollback");});afterAll(async()=>{await db.close();});
it("awards a task once, preserves its pinned hours, and excludes voided history from balances",async()=>{
 const task=(await db.query<{id:string}>("select lub.save_task(null,$1,null,null,'تصميم','المخرج المطلوب',null,null,2,null) as id",[org])).rows[0].id;
 await db.query("select lub.change_task_status($1,'Open',1)",[task]);await asUser(member);
 const p=(await db.query<{id:string}>("select lub.join_task($1) as id",[task])).rows[0].id;
 const s=(await db.query<{id:string}>("select lub.submit_task($1,'المخرج',array[]::uuid[],0,2) as id",[p])).rows[0].id;
 await asUser(leader);await db.query("select lub.save_task($1,$2,null,null,'تصميم','المخرج المطلوب',null,null,9,2)",[task,org]);
 await db.query("select lub.review_task_submission($1,'Approved','',null)",[s]);await db.query("select lub.import_task_hours($1)",[p]);
 const records=(await db.query<{id:string;hours:string;status_code:string}>("select id,hours,status_code from lub.hour_records")).rows;
 expect(records).toHaveLength(1);expect(Number(records[0].hours)).toBe(2);expect(records[0].status_code).toBe("Approved");
 await denied(()=>db.query("update lub.hour_records set hours=99 where id=$1",[records[0].id]));
 await db.query("select lub.review_hours($1,'Voided','تصحيح موثق')",[records[0].id]);await db.query("select lub.import_task_hours($1)",[p]);
 expect((await db.query("select id from lub.hour_records")).rows).toHaveLength(1);expect(Number((await db.query<{total:string}>("select coalesce(sum(hours),0) as total from lub.hour_records where status_code='Approved'")).rows[0].total)).toBe(0);
 await asUser(member);expect((await db.query("select id from lub.hour_records")).rows).toHaveLength(1);await asUser(admin);expect((await db.query("select id from lub.hour_records")).rows).toHaveLength(0);
});
it("requires a covering term and rolls back both task approval and hours if it is missing",async()=>{
 const task=(await db.query<{id:string}>("select lub.save_task(null,$1,null,null,'تصميم','وصف',null,null,2,null) as id",[org])).rows[0].id;
 await asUser(leader);await db.query("select lub.change_task_status($1,'Open',1)",[task]);await asUser(member);
 const p=(await db.query<{id:string}>("select lub.join_task($1) as id",[task])).rows[0].id;const s=(await db.query<{id:string}>("select lub.submit_task($1,'عمل',array[]::uuid[],0,2) as id",[p])).rows[0].id;
 await asUser(leader);await denied(()=>db.query("select lub.review_task_submission($1,'Approved','',null)",[s]));
 expect((await db.query<{status_code:string}>("select status_code from lub.task_submissions where id=$1",[s])).rows[0].status_code).toBe("Submitted");expect((await db.query("select id from lub.hour_records")).rows).toHaveLength(0);
});
it("separates manual submission and approval capabilities, keeps review notes and rejects direct writes",async()=>{
 await db.exec("reset role");
 await db.query("insert into lub.permission_grants(organization_membership_id,organization_id,permission_code,granted_by_user_id) values($1,$2,'HOURS_MANUAL_ADD',$3)",[memberships[1],org,leader]);await asUser(member);
 const record=(await db.query<{id:string}>("select lub.add_hours($1,null,$2,3.5,current_date,'تنظيم لقاء',false) as id",[memberships[2],term])).rows[0].id;
 expect((await db.query<{status_code:string}>("select status_code from lub.hour_records where id=$1",[record])).rows[0].status_code).toBe("Pending");
 await denied(()=>db.query("select lub.review_hours($1,'Approved','')",[record]));await denied(()=>db.query("update lub.hour_records set status_code='Approved' where id=$1",[record]));
 await denied(()=>db.query("select lub.add_hours($1,null,$2,'NaN',current_date,'سبب',false)",[memberships[2],term]));await denied(()=>db.query("select lub.add_hours($1,null,$2,1.001,current_date,'سبب',false)",[memberships[2],term]));
 await asUser(leader);await db.query("select lub.review_hours($1,'Approved','قرار الاعتماد')",[record]);await denied(()=>db.query("select lub.review_hours($1,'Voided','')",[record]));await db.query("select lub.review_hours($1,'Voided','سبب التصحيح')",[record]);
 expect((await db.query<{note:string}>("select note from lub.hour_decisions where hour_record_id=$1 order by created_at,id",[record])).rows.map(x=>x.note).sort()).toEqual(['سبب التصحيح','قرار الاعتماد'].sort());
 await db.exec("reset role");await denied(()=>db.query("update lub.hour_records set hours=9 where id=$1",[record]));await denied(()=>db.query("delete from lub.hour_decisions where hour_record_id=$1",[record]));await db.query("update lub.organization_memberships set status_code='Ended',end_date=current_date where id=$1",[memberships[2]]);
 await asUser(admin);expect((await db.query("select id from lub.hour_records")).rows).toHaveLength(1);await asUser(member);await db.exec("reset role;set local role anon");await denied(()=>db.query("select * from lub.hour_records"));
});
it("defaults self reporting off and keeps it pending and owner-only after explicit enablement",async()=>{
 await asUser(member);await denied(()=>db.query("select lub.add_hours($1,null,$2,2,current_date,'طلب ذاتي',true)",[memberships[1],term]));
 await asUser(leader);await db.query("select lub.set_self_report_hours($1,true)",[org]);await asUser(member);
 const record=(await db.query<{id:string}>("select lub.add_hours($1,null,$2,2,current_date,'طلب ذاتي',true) as id",[memberships[1],term])).rows[0].id;
 await denied(()=>db.query("select lub.add_hours($1,null,$2,2,current_date,'طلب شخص آخر',true)",[memberships[2],term]));await asUser(admin);expect((await db.query("select id from lub.hour_records")).rows).toHaveLength(0);
 await asUser(leader);await denied(()=>db.query("select lub.review_hours($1,'Rejected','')",[record]));await db.query("select lub.review_hours($1,'Rejected','غير مستحق')",[record]);
 await asUser(member);expect((await db.query<{status_code:string}>("select status_code from lub.hour_records")).rows[0].status_code).toBe("Rejected");await denied(()=>db.query("select lub.review_hours($1,'Approved','')",[record]));
});
it("confines committee leaders and effective rules to their scope and rejects expired delegates",async()=>{
 await db.exec("reset role");
 await db.query("insert into lub.committee_memberships(organization_id,organization_membership_id,committee_id) values($1,$2,$3)",[org,memberships[1],committee]);
 await db.query("insert into lub.role_assignments(organization_membership_id,organization_id,committee_id,role_code,assigned_by_user_id) values($1,$2,$3,'CL',$4)",[memberships[1],org,committee,leader]);await asUser(member);
 const rule=(await db.query<{id:string}>("select lub.save_hour_rule(null,$1,$2,null,'قاعدة التصميم',4,current_date,null,true,null) as id",[org,committee])).rows[0].id;
 await denied(()=>db.query("select lub.save_hour_rule(null,$1,null,null,'خارج النطاق',4,current_date,null,true,null)",[org]));
 await db.query("select lub.save_hour_rule($1,$2,$3,null,'قاعدة جديدة',5,current_date,null,true,1)",[rule,org,committee]);await denied(()=>db.query("select lub.save_hour_rule($1,$2,$3,null,'تعديل قديم',9,current_date,null,true,1)",[rule,org,committee]));
 await denied(()=>db.query("select lub.add_hours($1,null,$2,1,current_date,'خارج النطاق',false)",[memberships[1],term]));await db.query("select lub.add_hours($1,$2,$3,1,current_date,'عمل اللجنة',false)",[memberships[1],committee,term]);
 await db.exec("reset role");await db.query("insert into lub.permission_grants(organization_membership_id,organization_id,permission_code,start_at,end_at,granted_by_user_id) values($1,$2,'HOURS_APPROVE',now()-interval '2 days',now()-interval '1 day',$3)",[memberships[2],org,leader]);await asUser(admin);expect((await db.query<{allowed:boolean}>("select lub.has_org_permission($1,'HOURS_APPROVE') as allowed",[org])).rows[0].allowed).toBe(false);
});
async function campaign(exclude=false){return(await db.query<{id:string}>("select lub.create_renewal($1,$2,now()-interval '1 hour',now()+interval '1 day',$3) as id",[org,term,exclude])).rows[0].id;}
it("snapshots eligible renewal members with exclusions and keeps their original membership identity",async()=>{
 const c=await campaign(true);await db.query("select lub.exclude_renewal_member($1,$2,'استثناء موثق',true)",[c,memberships[2]]);await db.query("select lub.change_renewal_status($1,'Open')",[c]);
 const responses=(await db.query<{id:string;organization_membership_id:string}>("select id,organization_membership_id from lub.membership_renewals")).rows;expect(responses).toHaveLength(1);expect(responses[0].organization_membership_id).toBe(memberships[1]);
 await denied(()=>db.query("select lub.exclude_renewal_member($1,$2,'متأخر',true)",[c,memberships[1]]));await asUser(member);await db.query("select lub.respond_renewal($1,'Renewed')",[responses[0].id]);await denied(()=>db.query("select lub.respond_renewal($1,'Declined')",[responses[0].id]));
 await asUser(admin);expect((await db.query("select id from lub.renewal_campaigns")).rows).toHaveLength(0);await denied(()=>db.query("select lub.respond_renewal($1,'Renewed')",[responses[0].id]));await asUser(leader);await db.query("select lub.change_renewal_status($1,'Closed')",[c]);
 expect((await db.query<{id:string;status_code:string}>("select id,status_code from lub.organization_memberships order by id")).rows.map(x=>x.id).sort()).toEqual([...memberships].sort());expect((await db.query<{response_code:string}>("select response_code from lub.membership_renewals")).rows[0].response_code).toBe("Renewed");
 await db.query("select lub.change_renewal_status($1,'Archived')",[c]);await denied(()=>db.query("select lub.change_renewal_status($1,'Open')",[c]));
});
it("protects response ownership/window and records decline or no response without ending membership",async()=>{
 const c=await campaign();await db.query("select lub.change_renewal_status($1,'Open')",[c]);const rows=(await db.query<{id:string;organization_membership_id:string}>("select id,organization_membership_id from lub.membership_renewals")).rows;
 const own=rows.find(x=>x.organization_membership_id===memberships[1])!;const peer=rows.find(x=>x.organization_membership_id===memberships[2])!;
 await asUser(member);expect((await db.query("select id from lub.membership_renewals")).rows).toHaveLength(1);await denied(()=>db.query("select lub.respond_renewal($1,'Renewed')",[peer.id]));await db.query("select lub.respond_renewal($1,'Declined')",[own.id]);
 await asUser(leader);await db.query("select lub.change_renewal_status($1,'Closed')",[c]);expect((await db.query<{response_code:string}>("select response_code from lub.membership_renewals order by response_code")).rows.map(x=>x.response_code)).toEqual(['Declined','No_Response','No_Response']);expect((await db.query<{count:number}>("select count(*)::int as count from lub.organization_memberships where status_code='Active'")).rows[0].count).toBe(3);
 await asUser(admin);await denied(()=>db.query("select lub.respond_renewal($1,'Renewed')",[peer.id]));
});
it("allows only administrators to create non-overlapping immutable formal terms",async()=>{
 await denied(()=>db.query("select lub.create_academic_term('2027','T2','الفصل الثاني',current_date+91,current_date+180)"));await asUser(admin);
 await denied(()=>db.query("select lub.create_academic_term('2026','T3','فصل متداخل',current_date,current_date+10)"));
 await db.query("select lub.create_academic_term('2027','T2','الفصل الثاني',current_date+91,current_date+180)");expect((await db.query("select id from lub.academic_terms")).rows).toHaveLength(2);await db.exec("reset role");await denied(()=>db.query("update lub.academic_terms set end_date=current_date where id=$1",[term]));
});
it("keeps delegated task approval pending for a hours reviewer and reads rules without changing old tasks",async()=>{
 const rule=(await db.query<{id:string}>("select lub.save_hour_rule(null,$1,null,null,'قاعدة عامة',7,current_date,null,true,null) as id",[org])).rows[0].id;
 const task=(await db.query<{id:string}>("select lub.save_task_with_rule($1,null,null,'مهمة بقاعدة','وصف العمل',null,null,$2) as id",[org,rule])).rows[0].id;
 await db.query("select lub.save_hour_rule($1,$2,null,null,'تعديل القاعدة',9,current_date,null,true,1)",[rule,org]);expect(Number((await db.query<{default_hours:string}>("select default_hours from lub.tasks where id=$1",[task])).rows[0].default_hours)).toBe(7);
 await db.query("select lub.change_task_status($1,'Open',1)",[task]);await db.query("select lub.grant_task_permission($1,'TASKS_MANAGE',null,null)",[memberships[2]]);await asUser(member);
 const p=(await db.query<{id:string}>("select lub.join_task($1) as id",[task])).rows[0].id;const s=(await db.query<{id:string}>("select lub.submit_task($1,'عمل',array[]::uuid[],0,2) as id",[p])).rows[0].id;
 await asUser(admin);await db.query("select lub.review_task_submission($1,'Approved','',4)",[s]);await asUser(member);const h=(await db.query<{id:string;hours:string;status_code:string}>("select id,hours,status_code from lub.hour_records")).rows[0];expect(h.status_code).toBe("Pending");expect(Number(h.hours)).toBe(4);
 await asUser(leader);await db.query("select lub.review_hours($1,'Approved','مراجعة مستقلة')",[h.id]);expect((await db.query<{status_code:string}>("select status_code from lub.hour_records where id=$1",[h.id])).rows[0].status_code).toBe("Approved");
});
it("revokes delegated hours access immediately and forbids committee-scoped renewal grants",async()=>{
 await denied(()=>db.query("select lub.grant_hours_permission($1,'RENEWALS_MANAGE',$2,null)",[memberships[1],committee]));await db.query("select lub.grant_hours_permission($1,'HOURS_APPROVE',null,null)",[memberships[1]]);
 const g=(await db.query<{id:string}>("select id from lub.permission_grants where permission_code='HOURS_APPROVE'")).rows[0].id;
 await asUser(member);expect((await db.query<{allowed:boolean}>("select lub.has_org_permission($1,'HOURS_APPROVE') as allowed",[org])).rows[0].allowed).toBe(true);
 await asUser(leader);await db.query("select lub.end_hours_permission($1)",[g]);await asUser(member);expect((await db.query<{allowed:boolean}>("select lub.has_org_permission($1,'HOURS_APPROVE') as allowed",[org])).rows[0].allowed).toBe(false);
});
it("does not let a new membership answer the old membership campaign or accept late responses",async()=>{
 const c=await campaign();await db.query("select lub.change_renewal_status($1,'Open')",[c]);const rows=(await db.query<{id:string;organization_membership_id:string}>("select id,organization_membership_id from lub.membership_renewals")).rows;
 const own=rows.find(x=>x.organization_membership_id===memberships[1])!,peer=rows.find(x=>x.organization_membership_id===memberships[2])!;
 await db.exec("reset role");await db.query("update lub.organization_memberships set status_code='Ended',end_date=current_date where id=$1",[memberships[1]]);await db.query("insert into lub.organization_memberships(organization_id,user_id) values($1,$2)",[org,member]);
 await asUser(member);await denied(()=>db.query("select lub.respond_renewal($1,'Renewed')",[own.id]));
 await db.exec("reset role");await db.query("update lub.renewal_campaigns set closes_at=now()-interval '1 minute' where id=$1",[c]);await asUser(admin);await denied(()=>db.query("select lub.respond_renewal($1,'Renewed')",[peer.id]));
 await asUser(leader);await db.query("select lub.change_renewal_status($1,'Closed')",[c]);expect((await db.query<{response_code:string}>("select response_code from lub.membership_renewals where id=$1",[peer.id])).rows[0].response_code).toBe("No_Response");
});
it("allows organization leadership to correct archived committee hours without restoring committee access",async()=>{
 await db.exec("reset role");await db.query("insert into lub.committee_memberships(organization_id,organization_membership_id,committee_id) values($1,$2,$3)",[org,memberships[1],committee]);await asUser(leader);
 const h=(await db.query<{id:string}>("select lub.add_hours($1,$2,$3,2,current_date,'عمل اللجنة',false) as id",[memberships[1],committee,term])).rows[0].id;
 await db.exec("reset role");await db.query("update lub.committee_memberships set status_code='Ended',end_date=current_date where committee_id=$1",[committee]);await db.query("update lub.committees set status_code='Archived',archived_at=now() where id=$1",[committee]);await asUser(leader);
 expect((await db.query("select id from lub.hour_records where id=$1",[h])).rows).toHaveLength(1);await db.query("select lub.review_hours($1,'Voided','تصحيح بعد أرشفة اللجنة')",[h]);
 await asUser(member);expect((await db.query<{status_code:string}>("select status_code from lub.hour_records where id=$1",[h])).rows[0].status_code).toBe("Voided");
});
