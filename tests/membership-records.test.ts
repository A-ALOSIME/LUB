import {PGlite} from "@electric-sql/pglite";
import {readFileSync,readdirSync} from "node:fs";
import {afterAll,afterEach,beforeAll,beforeEach,expect,it} from "vitest";
import {storageFixture} from "./storage-fixture";
let db:PGlite;
const uid=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const org=uid(101),committee=uid(201),otherCommittee=uid(202),leader=uid(1),deputy=uid(2),cl=uid(3),student=uid(4),other=uid(5),admin=uid(6);
const leaderMember=uid(301),deputyMember=uid(302),clMember=uid(303),oldMember=uid(304),currentMember=uid(305),otherMember=uid(306);
async function actor(user:string){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('role','authenticated',true)",[user]);}
async function denied(operation:()=>Promise<unknown>){await db.exec('savepoint denied');await expect(operation()).rejects.toThrow();await db.exec('rollback to savepoint denied;release savepoint denied');}
beforeAll(async()=>{db=new PGlite();await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);await storageFixture(db);for(const file of readdirSync('drizzle').filter(f=>/^\d+.*\.sql$/.test(f)&&Number(f.slice(0,4))<74).sort()){if(file==='0038_direct_hours_export.sql')await db.exec("delete from storage.objects where bucket_id='lub-generated-documents';delete from storage.buckets where id='lub-generated-documents'");await db.exec(readFileSync(`drizzle/${file}`,'utf8'));}},30000);
beforeEach(async()=>{
 await db.exec('begin');for(const [n,user] of [leader,deputy,cl,student,other,admin].entries()){await db.query('insert into auth.users values($1)',[user]);await db.query("insert into lub.users(id,email,email_verified_at) values($1,$2,now())",[user,`member-${n}@example.invalid`]);await db.query("insert into lub.student_profiles(user_id,full_name_ar,university_id_ciphertext,university_id_lookup_hash,major_name,academic_level) values($1,$2,'cipher',$3,'الحاسب','5')",[user,`طالب ${n}`,String(n).repeat(64)]);}
 await db.query("insert into lub.organizations(id,type_code,slug,name_ar) values($1,'Club','membership-test','جهة الاختبار')",[org]);
 for(const c of [committee,otherCommittee])await db.query("insert into lub.committees(id,organization_id,name) values($1,$2,'لجنة اختبار')",[c,org]);
 for(const [id,user] of [[leaderMember,leader],[deputyMember,deputy],[clMember,cl],[currentMember,student],[otherMember,other]])await db.query("insert into lub.organization_memberships(id,organization_id,user_id) values($1,$2,$3)",[id,org,user]);
 await db.query("insert into lub.organization_memberships(id,organization_id,user_id,status_code,start_date,end_date) values($1,$2,$3,'Ended','2025-01-01','2025-06-01')",[oldMember,org,student]);
 for(const [membership,code,c] of [[leaderMember,'OL',null],[deputyMember,'OD',null],[clMember,'CL',committee]])await db.query("insert into lub.role_assignments(organization_membership_id,organization_id,role_code,is_primary_leader,committee_id,assigned_by_user_id) values($1,$2,$3,$4,$5,$6)",[membership,org,code,code==='OL',c,leader]);
 for(const [membership,c] of [[currentMember,committee],[otherMember,otherCommittee]])await db.query("insert into lub.committee_memberships(organization_membership_id,organization_id,committee_id) values($1,$2,$3)",[membership,org,c]);
 await db.query("insert into lub.global_role_assignments(user_id,role_code,assigned_by_user_id) values($1,'SA',$1)",[admin]);
 await db.query("insert into lub.academic_terms(id,academic_year,term_code,name_ar,start_date,end_date) values($1,'2025-2026','1','الفصل الدراسي الأول','2025-01-01','2026-12-31')",[uid(401)]);
 await db.query("select set_config('request.jwt.claim.sub',$1,true)",[leader]);
 for(const [membership,hours] of [[oldMember,3],[currentMember,7]])await db.query("insert into lub.hour_records(organization_id,organization_membership_id,academic_term_id,source_code,hours,activity_date,description,status_code,requested_by_user_id,reviewed_by_user_id,reviewed_at) values($1,$2,$3,'MANUAL',$4,'2025-05-01','مشاركة معتمدة','Approved',$5,$5,now())",[org,membership,uid(401),hours,leader]);
 await db.query("select set_config('request.jwt.claim.sub','',true)");
 await db.exec(readFileSync('drizzle/0074_canonical_membership_records.sql','utf8'));
 await db.exec(readFileSync('drizzle/0075_member_directory_details.sql','utf8'));
 await db.exec(readFileSync('drizzle/0076_member_exports.sql','utf8'));
 await db.exec(readFileSync('drizzle/0077_imported_membership_rejoins.sql','utf8'));
});
afterEach(async()=>{await db.exec('rollback');});afterAll(async()=>{await db.close();});
it('retains legacy IDs while enforcing one canonical membership per user and organization',async()=>{
 const rows=(await db.query<{id:string;merged_into:string|null}>('select id,merged_into from lub.organization_memberships where user_id=$1 order by id',[student])).rows;
 expect(rows).toEqual([{id:oldMember,merged_into:currentMember},{id:currentMember,merged_into:null}]);
 await denied(()=>db.query('insert into lub.organization_memberships(organization_id,user_id) values($1,$2)',[org,student]));
 expect((await db.query("select * from lub.membership_events where membership_id=$1",[currentMember])).rows).toHaveLength(3);
 expect((await db.query<{hours:string}>("select sum(hours)::text hours from lub.hour_records where organization_id=$1",[org])).rows[0].hours).toBe('10.00');
});
it('ends and rejoins through authorized operations without creating another membership',async()=>{
 await actor(leader);await db.query("select lub.end_organization_membership($1,'سبب إنهاء الاختبار')",[currentMember]);
 await actor(admin);await db.query("select lub.set_primary_leader($1,'member-3@example.invalid')",[org]);
 await db.exec('reset role');expect((await db.query<{id:string;status_code:string}>('select id,status_code from lub.organization_memberships where user_id=$1 and merged_into is null',[student])).rows).toEqual([{id:currentMember,status_code:'Active'}]);
 expect((await db.query<{event_code:string}>("select event_code from lub.membership_events where membership_id=$1 and not imported order by occurred_at,id",[currentMember])).rows.map(r=>r.event_code)).toEqual(['Ended','Rejoined']);
 expect((await db.query<{hours:string}>("select sum(hours)::text hours from lub.hour_records where organization_id=$1",[org])).rows[0].hours).toBe('10.00');
});
it('does not let a deputy read or self-grant member access implicitly',async()=>{
 await actor(deputy);expect((await db.query<{allowed:boolean}>("select lub.has_org_permission($1,'MEMBERS_VIEW') allowed",[org])).rows[0].allowed).toBe(false);
 await denied(()=>db.query('select lub.organization_member_directory($1)',[org]));
 await denied(()=>db.query("select lub.grant_organization_permission($1,'MEMBERS_VIEW',null,null)",[deputyMember]));
 await actor(leader);await db.query("select lub.grant_organization_permission($1,'MEMBERS_VIEW',null,null)",[deputyMember]);
 await actor(deputy);expect((await db.query<{allowed:boolean}>("select lub.has_org_permission($1,'MEMBERS_VIEW') allowed",[org])).rows[0].allowed).toBe(true);
});
it('keeps an ordinary member outside the directory and internal reactivation helpers',async()=>{
 await actor(student);await denied(()=>db.query('select lub.organization_member_directory($1)',[org]));await denied(()=>db.query('select lub.ensure_current_membership($1,$2,null)',[org,student]));
});
it('keeps the committee leader scoped to their committee and excludes merged aliases',async()=>{
 await actor(cl);const [row]=(await db.query<{workspace:{members:Array<{id:string}>}}> ('select lub.organization_member_directory($1) workspace',[org])).rows;
 expect(row.workspace.members.map(m=>m.id)).toContain(currentMember);expect(row.workspace.members.map(m=>m.id)).not.toContain(otherMember);expect(row.workspace.members.map(m=>m.id)).not.toContain(oldMember);
});
it('returns server-filtered counts and aggregates all approved hours for one canonical student',async()=>{
 await actor(leader);const [row]=(await db.query<{workspace:{counts:{total:number;active:number;ended:number};members:Array<{id:string;hours:number}>}}>("select lub.organization_member_directory($1,'طالب 3','all',null) workspace",[org])).rows;
 expect(row.workspace.counts).toEqual({total:1,active:1,ended:0,inactive:0});expect(row.workspace.members).toHaveLength(1);expect(row.workspace.members[0]).toMatchObject({id:currentMember,hours:10});
 const [empty]=(await db.query<{workspace:{counts:{total:number};members:unknown[]}}>("select lub.organization_member_directory($1,'غير موجود','all',null) workspace",[org])).rows;expect(empty.workspace.counts.total).toBe(0);expect(empty.workspace.members).toHaveLength(0);
});
it('authorizes private detail requests in SQL and includes only the current organization',async()=>{
 await actor(student);await denied(()=>db.query('select lub.member_profile($1,$2)',[org,otherMember]));
 await actor(cl);await denied(()=>db.query('select lub.member_profile($1,$2)',[org,otherMember]));
 const [allowed]=(await db.query<{profile:{id:string;universityCiphertext:string;organization:{slug:string};events:unknown[]}}>('select lub.member_profile($1,$2) profile',[org,oldMember])).rows;
 expect(allowed.profile.id).toBe(currentMember);expect(allowed.profile.organization.slug).toBe('membership-test');expect(allowed.profile.events).toHaveLength(3);expect(allowed.profile.universityCiphertext).toBe('cipher');
 await denied(()=>db.query("select lub.organization_member_directory($1,'','all',$2)",[org,otherCommittee]));
});

it('exports only the scoped filtered members, checks tickets once and restricts the audit to the leader',async()=>{
 await actor(student);await denied(()=>db.query("select public.prepare_member_export($1,'','all',null)",[org]));
 await actor(cl);const ticket=(await db.query<{data:{ticket:string}}>("select public.prepare_member_export($1,'طالب 3','all',null) data",[org])).rows[0].data.ticket;
 await actor(leader);await denied(()=>db.query('select public.consume_member_export($1)',[ticket]));
 await actor(cl);const rows=(await db.query<{data:Array<{id:string}>}>('select public.consume_member_export($1) data',[ticket])).rows[0].data;expect(rows.map(x=>x.id)).toEqual([currentMember]);await denied(()=>db.query('select public.consume_member_export($1)',[ticket]));await denied(()=>db.query('select lub.member_export_audit($1)',[org]));
 await actor(leader);const audit=(await db.query<{data:Array<{count:number}>}>('select lub.member_export_audit($1) data',[org])).rows[0].data;expect(audit).toHaveLength(1);expect(audit[0].count).toBe(1);expect(JSON.stringify(audit)).not.toMatch(/cipher|national|university/);
});
it('expires export tickets, rechecks revocation and limits exports per actor per hour',async()=>{
 await actor(leader);let ticket=(await db.query<{data:{ticket:string}}>("select public.prepare_member_export($1,'','all',null) data",[org])).rows[0].data.ticket;
 await db.exec('reset role');await db.query("update lub.member_exports set expires_at=clock_timestamp()-interval '1 second' where id=$1",[ticket]);await actor(leader);await denied(()=>db.query('select public.consume_member_export($1)',[ticket]));
 await db.query("select lub.grant_organization_permission($1,'MEMBERS_VIEW',null,null)",[deputyMember]);await actor(deputy);ticket=(await db.query<{data:{ticket:string}}>("select public.prepare_member_export($1,'','all',null) data",[org])).rows[0].data.ticket;
 await db.exec('reset role');await db.query("update lub.permission_grants set start_at=clock_timestamp()-interval '1 hour',end_at=clock_timestamp()-interval '1 second' where organization_membership_id=$1",[deputyMember]);await actor(deputy);await denied(()=>db.query('select public.consume_member_export($1)',[ticket]));
 await actor(leader);for(let i=0;i<5;i++)await db.query("select public.prepare_member_export($1,'','all',null)",[org]);await denied(()=>db.query("select public.prepare_member_export($1,'','all',null)",[org]));
});

it('does not let a deputy self-grant member access even with a legacy permission-management grant',async()=>{
 await db.exec('reset role');await db.query("insert into lub.permission_grants(organization_membership_id,organization_id,permission_code,granted_by_user_id) values($1,$2,'PERMISSIONS_GRANT',$3)",[deputyMember,org,leader]);await actor(deputy);await denied(()=>db.query("select lub.grant_organization_permission($1,'MEMBERS_VIEW',null,null)",[deputyMember]));
});

it('labels an imported later period as a return only when a previous ending exists, preserving all event IDs',async()=>{
 const events=(await db.query<{event_code:string;imported:boolean}>("select event_code,imported from lub.membership_events where membership_id=$1 order by occurred_at",[currentMember])).rows;expect(events.map(x=>x.event_code)).toEqual(['Joined','Ended','Rejoined']);expect(events.every(x=>x.imported)).toBe(true);
});

it("exports unique non-test students, earliest join date and combined hours with the original committee scope",async()=>{
 await db.exec(readFileSync("drizzle/0078_cached_details_xlsx.sql","utf8"));await db.query("update lub.users set is_test_account=true where id=$1",[other]);
 await actor(leader);const ticket=(await db.query<{data:{ticket:string}}>("select public.prepare_member_export($1,'','all',null) data",[org])).rows[0].data.ticket;
 const payload=(await db.query<{data:{records:Array<{userId:string;startDate:string;hours:number;avatar?:string;events?:unknown}>;slug:string;filter:string}}>("select public.consume_member_export($1) data",[ticket])).rows[0].data;
 expect(payload.slug).toBe("membership-test");expect(payload.records.some(row=>row.userId===other)).toBe(false);expect(new Set(payload.records.map(row=>row.userId)).size).toBe(payload.records.length);const row=payload.records.find(row=>row.userId===student)!;expect(row.startDate).toBe("2025-01-01");expect(Number(row.hours)).toBe(10);expect(row.avatar).toBeUndefined();expect(row.events).toBeUndefined();
 await actor(cl);const scoped=(await db.query<{data:{ticket:string}}>("select public.prepare_member_export($1,'','all',null) data",[org])).rows[0].data.ticket;const data=(await db.query<{data:{records:Array<{userId:string}>}}>("select public.consume_member_export($1) data",[scoped])).rows[0].data;expect(data.records.map(row=>row.userId)).toEqual([cl,student]);expect(data.records.some(row=>[leader,deputy,other].includes(row.userId))).toBe(false);
});
