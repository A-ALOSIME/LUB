import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import { applyMigrations, storageFixture } from "./storage-fixture";
let db:PGlite;
const leader="00000000-0000-4000-8000-000000000001",member="00000000-0000-4000-8000-000000000002",admin="00000000-0000-4000-8000-000000000003",systemAdmin="00000000-0000-4000-8000-000000000004";
const org="00000000-0000-4000-8000-000000000101",committee="00000000-0000-4000-8000-000000000201";
let memberships:string[],term:string;
beforeAll(async()=>{
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
 await storageFixture(db);await applyMigrations(db);
},30000);
async function asUser(id:string){await db.exec("reset role");await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('role','authenticated',true)",[id]);}
async function denied(fn:()=>Promise<unknown>){await db.exec("savepoint denied");await expect(fn()).rejects.toThrow();await db.exec("rollback to savepoint denied;release savepoint denied");}
beforeEach(async context=>{
 await db.exec("begin");memberships=[];
 for(const [i,id] of [leader,member,admin,systemAdmin].entries()){
 await db.query("insert into auth.users values($1)",[id]);await db.query("insert into lub.users(id,email,email_verified_at) values($1,$2,now())",[id,`hours${i}@example.invalid`]);
 await db.query("insert into lub.student_profiles(user_id,full_name_ar,university_id_ciphertext,university_id_lookup_hash,major_name,academic_level) values($1,$2,'private',$3,'الحاسب','4')",[id,`طالب ${i}`,String(i).repeat(64)]);
 }
 await db.query("insert into lub.organizations(id,type_code,slug,name_ar) values($1,'Club','tech','نادي التقنية')",[org]);await db.query("insert into lub.committees(id,organization_id,name) values($1,$2,'التقنية')",[committee,org]);
 for(const id of [leader,member,admin])memberships.push((await db.query<{id:string}>("insert into lub.organization_memberships(organization_id,user_id) values($1,$2) returning id",[org,id])).rows[0].id);
 await db.query("insert into lub.role_assignments(organization_membership_id,organization_id,role_code,is_primary_leader,assigned_by_user_id) values($1,$2,'OL',true,$3)",[memberships[0],org,leader]);
 await db.query("insert into lub.global_role_assignments(user_id,role_code,assigned_by_user_id) values($1,'SA',$1)",[systemAdmin]);await asUser(systemAdmin);
 term="";if(!context.task.name.startsWith("requires a covering term"))term=(await db.query<{id:string}>("select lub.create_academic_term('2026-2027','T1','الفصل الأول',current_date-30,current_date+90) as id")).rows[0].id;await asUser(leader);
});
afterEach(async()=>{await db.exec("rollback");});afterAll(async()=>{await db.close();});
it("allows a new renewal in the same term after a previous campaign is archived",async()=>{
 const args=[org,term];const first=(await db.query<{id:string}>("select lub.create_renewal($1,$2,now(),now()+interval '1 day',false) as id",args)).rows[0].id;
 await db.query("select lub.transition_campaign('renewal',$1,'publish','Draft')",[first]);await db.query("select lub.transition_campaign('renewal',$1,'close','Open')",[first]);await db.query("select lub.transition_campaign('renewal',$1,'archive','Closed')",[first]);
 const second=(await db.query<{id:string}>("select lub.create_renewal($1,$2,now(),now()+interval '2 days',false) as id",args)).rows[0].id;
 expect(second).not.toBe(first);expect((await db.query("select id from lub.renewal_campaigns where organization_id=$1",[org])).rows).toHaveLength(2);
});
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
 await db.query("insert into lub.role_assignments(organization_membership_id,organization_id,committee_id,role_code,assigned_by_user_id) values($1,$2,$3,'CD',$4)",[memberships[1],org,committee,leader]);await db.query("insert into lub.committee_memberships(organization_membership_id,organization_id,committee_id) values($1,$2,$3)",[memberships[2],org,committee]);await asUser(member);
 const record=(await db.query<{id:string}>("select lub.add_hours($1,'00000000-0000-4000-8000-000000000201',$2,3.5,current_date,'تنظيم لقاء',false) as id",[memberships[2],term])).rows[0].id;
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
it("confines committee leaders to their hours scope and rejects retired rules and expired delegates",async()=>{
 await db.exec("reset role");
 await db.query("insert into lub.committee_memberships(organization_id,organization_membership_id,committee_id) values($1,$2,$3)",[org,memberships[1],committee]);
 await db.query("insert into lub.role_assignments(organization_membership_id,organization_id,committee_id,role_code,assigned_by_user_id) values($1,$2,$3,'CL',$4)",[memberships[1],org,committee,leader]);await asUser(member);
 await denied(()=>db.query("select lub.save_hour_rule(null,$1,$2,null,'قاعدة التصميم',4,current_date,null,true,null)",[org,committee]));
 expect((await db.query<{allowed:boolean}>("select lub.has_org_permission($1,'HOUR_RULES_MANAGE',$2) as allowed",[org,committee])).rows[0].allowed).toBe(false);
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
 await denied(()=>db.query("select lub.create_academic_term('2027','T2','الفصل الثاني',current_date+91,current_date+180)"));await asUser(systemAdmin);
 await denied(()=>db.query("select lub.create_academic_term('2026','T3','فصل متداخل',current_date,current_date+10)"));
 await db.query("select lub.create_academic_term('2027','T2','الفصل الثاني',current_date+91,current_date+180)");expect((await db.query("select id from lub.academic_terms")).rows).toHaveLength(2);await db.exec("reset role");await denied(()=>db.query("update lub.academic_terms set end_date=current_date where id=$1",[term]));
});
it("keeps delegated task approval pending for a hours reviewer and preserves explicit task hours",async()=>{
 const task=(await db.query<{id:string}>("select lub.save_task(null,$1,$2,null,'مهمة بساعات محددة','وصف العمل',null,null,7,null) as id",[org,committee])).rows[0].id;
 expect(Number((await db.query<{default_hours:string}>("select default_hours from lub.tasks where id=$1",[task])).rows[0].default_hours)).toBe(7);
 await denied(()=>db.query("select lub.save_task_with_rule($1,null,null,'مهمة','وصف',null,null,$2)",[org,committee]));
 await db.query("select lub.change_task_status($1,'Open',1)",[task]);await db.query("select lub.change_member_role($1,'CD',$2)",[memberships[2],committee]);await db.exec('reset role');await db.query("insert into lub.committee_memberships(organization_membership_id,organization_id,committee_id) values($1,$2,$3)",[memberships[1],org,committee]);await asUser(member);
 const p=(await db.query<{id:string}>("select lub.join_task($1) as id",[task])).rows[0].id;const s=(await db.query<{id:string}>("select lub.submit_task($1,'عمل',array[]::uuid[],0,2) as id",[p])).rows[0].id;
 await asUser(admin);await db.query("select lub.review_task_submission($1,'Approved','',4)",[s]);await asUser(member);const h=(await db.query<{id:string;hours:string;status_code:string}>("select id,hours,status_code from lub.hour_records")).rows[0];expect(h.status_code).toBe("Pending");expect(Number(h.hours)).toBe(4);
 await asUser(leader);await db.query("select lub.review_hours($1,'Approved','مراجعة مستقلة')",[h.id]);expect((await db.query<{status_code:string}>("select status_code from lub.hour_records where id=$1",[h.id])).rows[0].status_code).toBe("Approved");
});
it("revokes delegated hours access immediately and forbids committee-scoped renewal grants",async()=>{
 await denied(()=>db.query("select lub.grant_hours_permission($1,'RENEWALS_MANAGE',$2,null)",[memberships[1],committee]));await db.query("select lub.grant_hours_permission($1,'HOURS_APPROVE',null,null)",[memberships[1]]);
 const g=(await db.query<{id:string}>("select id from lub.permission_grants where permission_code='HOURS_APPROVE'")).rows[0].id;
 await asUser(member);expect((await db.query<{allowed:boolean}>("select lub.has_org_permission($1,'HOURS_APPROVE') as allowed",[org])).rows[0].allowed).toBe(false);
 await asUser(leader);await db.query("select lub.end_hours_permission($1)",[g]);await asUser(member);expect((await db.query<{allowed:boolean}>("select lub.has_org_permission($1,'HOURS_APPROVE') as allowed",[org])).rows[0].allowed).toBe(false);
});
it("does not let a reactivated membership answer the old membership campaign or accept late responses",async()=>{
 const c=await campaign();await db.query("select lub.change_renewal_status($1,'Open')",[c]);const rows=(await db.query<{id:string;organization_membership_id:string}>("select id,organization_membership_id from lub.membership_renewals")).rows;
 const own=rows.find(x=>x.organization_membership_id===memberships[1])!,peer=rows.find(x=>x.organization_membership_id===memberships[2])!;
 await db.exec("reset role");await db.query("update lub.organization_memberships set status_code='Ended',end_date=current_date where id=$1",[memberships[1]]);await db.query("select lub.ensure_current_membership($1,$2)",[org,member]);
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

it("records signed hour adjustments, preserves history and checks scope, balance and stale values",async()=>{
 const record=(await db.query<{id:string}>("select lub.add_hours($1,null,$2,10,current_date,'تنظيم فعالية',false) as id",[memberships[1],term])).rows[0].id;
 await db.query("select lub.adjust_hours($1,2,10,'عمل إضافي')",[record]);
 expect(Number((await db.query<{hours:string}>("select hours from lub.hour_records where id=$1",[record])).rows[0].hours)).toBe(12);
 const history=(await db.query<{before_hours:string;after_hours:string;note:string}>("select before_hours,after_hours,note from lub.hour_adjustments where hour_record_id=$1",[record])).rows;
 expect(history.map(item=>[Number(item.before_hours),Number(item.after_hours),item.note])).toEqual([[10,12,'عمل إضافي']]);
 expect((await db.query("select id from lub.hour_decisions where hour_record_id=$1",[record])).rows).toHaveLength(1);
 await denied(()=>db.query("select lub.adjust_hours($1,-13,12,'')",[record]));
 await denied(()=>db.query("select lub.adjust_hours($1,1,10,'تعديل قديم')",[record]));
 await db.query("select lub.adjust_hours($1,-2,12,'')",[record]);
 await asUser(member);expect((await db.query("select id from lub.hour_adjustments where hour_record_id=$1",[record])).rows).toHaveLength(2);
 await denied(()=>db.query("select lub.adjust_hours($1,99,10,'')",[record]));
 await denied(()=>db.query("insert into lub.hour_adjustments(hour_record_id,before_hours,after_hours,actor_user_id,actor_name,note,transaction_id) values($1,10,99,$2,'طالب','','')",[record,member]));
 await asUser(leader);await denied(()=>db.query("update lub.hour_adjustments set note='تمويه' where hour_record_id=$1",[record]));
});
it("asks before duplicate manual hours and accepts only an explicit repeated-entry confirmation",async()=>{
 const args=[memberships[1],term];
 await db.query("select lub.add_hours($1,null,$2,2,current_date,'عمل مكرر',false)",args);
 await denied(()=>db.query("select lub.add_hours($1,null,$2,2,current_date,'عمل مكرر',false)",args));
 await denied(()=>db.query("select lub.add_hours($1,null,$2,2,current_date,'وصف مختلف',false)",args));
 await db.query("select lub.add_hours($1,null,$2,2,current_date,'عمل مكرر',false,true)",args);
 expect((await db.query("select id from lub.hour_records")).rows).toHaveLength(2);
});

it("exports exactly the selected hours status and member search",async()=>{
 await db.query("select lub.add_hours($1,null,$2,5,current_date,'نشاط معتمد',false)",[memberships[1],term]);
 await db.query("select lub.set_self_report_hours($1,true)",[org]);await asUser(member);
 await db.query("select lub.add_hours($1,null,$2,2,current_date,'نشاط معلق',true)",[memberships[1],term]);await asUser(leader);
 const filtered=(await db.query<{csv:string}>("select lub.export_hours_csv($1,null,$2,'Pending','طالب 1') as csv",[org,term])).rows[0].csv;
 expect(filtered).toContain('"2.00"');expect(filtered).not.toContain('"5.00"');
 const empty=(await db.query<{csv:string}>("select lub.export_hours_csv($1,null,$2,'Pending','لا يوجد') as csv",[org,term])).rows[0].csv;
 expect(empty).not.toContain('"2.00"');
});

it("publishes, pauses, resumes, closes and archives renewal drafts without duplicating or finalizing replies while paused",async()=>{
 const id=(await db.query<{id:string}>("select lub.create_renewal($1,$2,now()-interval '1 hour',now()+interval '2 days',false) id",[org,term])).rows[0].id;
 await db.query("select lub.transition_campaign('renewal',$1,'publish','Draft')",[id]);
 const before=(await db.query("select id from lub.membership_renewals where renewal_campaign_id=$1 order by id",[id])).rows;
 expect(before).toHaveLength(3);
 await db.query("select lub.transition_campaign('renewal',$1,'pause','Open')",[id]);
 expect((await db.query("select distinct response_code from lub.membership_renewals where renewal_campaign_id=$1",[id])).rows).toEqual([{response_code:"Pending"}]);
 await asUser(member);await denied(()=>db.query("select lub.transition_campaign('renewal',$1,'resume','Paused')",[id]));
 await asUser(leader);await denied(()=>db.query("select lub.transition_campaign('renewal',$1,'delete','Paused')",[id]));
 await db.query("select lub.transition_campaign('renewal',$1,'resume','Paused')",[id]);expect((await db.query("select id from lub.membership_renewals where renewal_campaign_id=$1 order by id",[id])).rows).toEqual(before);
 await db.query("select lub.transition_campaign('renewal',$1,'close','Open')",[id]);
 expect((await db.query("select distinct response_code from lub.membership_renewals where renewal_campaign_id=$1",[id])).rows).toEqual([{response_code:"No_Response"}]);
 await db.query("select lub.transition_campaign('renewal',$1,'archive','Closed')",[id]);
 expect((await db.query<{status_code:string}>("select status_code from lub.renewal_campaigns where id=$1",[id])).rows[0].status_code).toBe("Archived");
 await db.query("select lub.transition_campaign('renewal',$1,'restore','Archived')",[id]);expect((await db.query<{status_code:string}>("select status_code from lub.renewal_campaigns where id=$1",[id])).rows[0].status_code).toBe("Closed");expect((await db.query("select id from lub.membership_renewals where renewal_campaign_id=$1 order by id",[id])).rows).toEqual(before);
});

it("exports selected-status totals once per student through an owner-only single-use ticket",async()=>{
 await db.query("select lub.add_hours($1,null,$2,2.25,current_date,'عمل أول',false)",[memberships[1],term]);
 await db.query("select lub.add_hours($1,null,$2,1.25,current_date,'عمل ثان',false)",[memberships[1],term]);
 const prepared=(await db.query<{payload:{ticket:string}}>("select public.prepare_hours_export($1,null,$2,'Approved','طالب 1') as payload",[org,term])).rows[0].payload;
 await asUser(member);await denied(()=>db.query("select public.consume_hours_export($1)",[prepared.ticket]));
 await asUser(leader);const payload=(await db.query<{payload:{records:Array<{userId:string;hours:string;isTest:boolean;firstDate:string;lastDate:string}>}}>("select public.consume_hours_export($1) as payload",[prepared.ticket])).rows[0].payload;
 expect(payload.records).toHaveLength(1);expect(payload.records[0].userId).toBe(member);expect(Number(payload.records[0].hours)).toBe(3.5);expect(payload.records[0].isTest).toBe(false);expect(payload.records[0].firstDate).toBe(payload.records[0].lastDate);
 await denied(()=>db.query("select public.consume_hours_export($1)",[prepared.ticket]));
 await denied(()=>db.query("select lub.export_hours_rows($1,null,$2,'Approved','')",[org,term]));
});
it("rechecks export scope on consumption, excludes test students and rate-limits ticket creation",async()=>{
 await db.query("select lub.add_hours($1,null,$2,2,current_date,'ساعات اختبار',false)",[memberships[1],term]);
 await db.exec("reset role");await db.query("update lub.users set is_test_account=true where id=$1",[member]);await asUser(leader);
 const ticket=(await db.query<{payload:{ticket:string}}>("select public.prepare_hours_export($1,null,$2,'Approved','') as payload",[org,term])).rows[0].payload.ticket;
 const rows=(await db.query<{payload:{records:unknown[]}}>("select public.consume_hours_export($1) as payload",[ticket])).rows[0].payload.records;expect(rows).toHaveLength(0);
 let unconsumed="";for(let i=0;i<5;i++){const prepared=await db.query<{payload:{ticket:string}}>("select public.prepare_hours_export($1,null,null,null,'') as payload",[org]);unconsumed=prepared.rows[0].payload.ticket;}
 await denied(()=>db.query("select public.prepare_hours_export($1,null,null,null,'')",[org]));
 await db.exec("reset role");await db.query("update lub.role_assignments set end_date=current_date where organization_membership_id=$1",[memberships[0]]);await asUser(leader);
 await denied(()=>db.query("select public.consume_hours_export($1)",[unconsumed]));
});

it("scopes renewal participant pages and keeps test rows out of their same-query counters",async()=>{
 const id=await campaign();await db.query("select lub.change_renewal_status($1,'Open')",[id]);
 await db.exec("reset role");await db.query("update lub.users set is_test_account=true where id=$1",[member]);await asUser(leader);
 const data=(await db.query<{data:{organization:string;items:Array<{name:string;status:string}>;counts:Record<string,number>;total:number}}>("select lub.renewal_participant_page($1,'','all',0) as data",[id])).rows[0].data;
 expect(data.organization).toBe(org);expect(data.items).toHaveLength(3);expect(data.total).toBe(3);expect(data.counts.Pending).toBe(2);expect(data.items.map(row=>row.name)).toContain("طالب 1");
 const filtered=(await db.query<{data:{items:unknown[];counts:Record<string,number>}}>("select lub.renewal_participant_page($1,'طالب 1','all',0) as data",[id])).rows[0].data;expect(filtered.items).toHaveLength(1);expect(filtered.counts).toEqual({});
 const summary=(await db.query<{summary:{renewed:number;members:number}}>("select lub.renewal_campaign_summary($1) as summary",[id])).rows[0].summary;expect(summary).toEqual({renewed:0,members:2});
 await asUser(member);expect((await db.query<{data:unknown}>("select lub.renewal_participant_page($1,'','all',0) as data",[id])).rows[0].data).toBeNull();
});
it("withdraws only the owner's pending self-report and retains its immutable content and history",async()=>{
 await db.exec("reset role");await db.query("update lub.organizations set self_report_hours_enabled=true where id=$1",[org]);await asUser(member);
 const record=(await db.query<{id:string}>("select lub.add_hours($1,null,$2,3,current_date,'طلب ذاتي',true,true) as id",[memberships[1],term])).rows[0].id;
 await asUser(leader);await denied(()=>db.query("select lub.withdraw_self_report_hours($1)",[record]));await asUser(admin);await denied(()=>db.query("select lub.withdraw_self_report_hours($1)",[record]));
 await asUser(member);await db.query("select lub.withdraw_self_report_hours($1)",[record]);
 expect((await db.query<{status_code:string;hours:string;description:string}>("select status_code,hours,description from lub.hour_records where id=$1",[record])).rows[0]).toEqual({status_code:"Withdrawn",hours:"3.00",description:"طلب ذاتي"});
 expect((await db.query<{status_code:string}>("select status_code from lub.hour_decisions where hour_record_id=$1",[record])).rows[0].status_code).toBe("Withdrawn");
 await denied(()=>db.query("select lub.withdraw_self_report_hours($1)",[record]));await asUser(leader);await denied(()=>db.query("select lub.review_hours($1,'Approved','')",[record]));
 const approved=(await db.query<{id:string}>("select lub.add_hours($1,null,$2,1,current_date,'إضافة معتمدة',false,true) as id",[memberships[1],term])).rows[0].id;await asUser(member);await denied(()=>db.query("select lub.withdraw_self_report_hours($1)",[approved]));
});
it("uses selected-term hours and overlapping membership periods; no term retains lifetime totals in list and export",async()=>{
 await db.exec("reset role");
 const oldTerm=(await db.query<{id:string}>("insert into lub.academic_terms(academic_year,term_code,name_ar,start_date,end_date) values('2025','T1','السابق',current_date-300,current_date-150) returning id")).rows[0].id;
 await db.query("insert into lub.hour_records(organization_id,organization_membership_id,academic_term_id,source_code,hours,activity_date,description,status_code,requested_by_user_id,reviewed_by_user_id,reviewed_at,review_note) values($1,$2,$3,'MANUAL',7,current_date-200,'سابق','Approved',$4,$4,now(),'')",[org,memberships[1],oldTerm,leader]);
 await asUser(leader);await db.query("select lub.add_hours($1,null,$2,3,current_date,'حالي',false,true)",[memberships[1],term]);
 const list=async(selected:string|null)=>(await db.query<{data:{members:Array<{id:string;hours:number}>}}>("select lub.organization_member_directory($1,'','all',null,0,'name:asc',$2) data",[org,selected])).rows[0].data.members;
 expect((await list(term)).find(row=>row.id===memberships[1])?.hours).toBe(3);
 expect((await list(null)).find(row=>row.id===memberships[1])?.hours).toBe(10);
 expect((await list(oldTerm)).some(row=>row.id===memberships[1])).toBe(false);
 const ticket=(await db.query<{data:{ticket:string}}>("select public.prepare_member_export($1,'','all',null,$2) data",[org,term])).rows[0].data.ticket;
 const exported=(await db.query<{data:{records:Array<{hours:number}>}}>("select public.consume_member_export($1) data",[ticket])).rows[0].data.records;
 expect(exported.some(row=>row.hours===3)).toBe(true);expect(exported.some(row=>row.hours===10)).toBe(false);
});
