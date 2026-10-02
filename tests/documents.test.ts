import {PGlite} from "@electric-sql/pglite";
import {readdirSync,readFileSync} from "node:fs";
import {afterAll,afterEach,beforeAll,beforeEach,expect,it} from "vitest";
import {storageFixture} from "./storage-fixture";
let db:PGlite,memberId:string,term:string,hour:string;
const leader="00000000-0000-4000-8000-000000000001",student="00000000-0000-4000-8000-000000000002",admin="00000000-0000-4000-8000-000000000003";
const org="00000000-0000-4000-8000-000000000101",committee="00000000-0000-4000-8000-000000000201";
beforeAll(async()=>{
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
 await storageFixture(db);for(const file of readdirSync("drizzle").filter(x=>x.endsWith(".sql")).sort())await db.exec(readFileSync(`drizzle/${file}`,"utf8"));
},30000);
async function asUser(id:string){await db.exec("reset role");await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('role','authenticated',true)",[id]);}
async function denied(fn:()=>Promise<unknown>){await db.exec("savepoint denied");await expect(fn()).rejects.toThrow();await db.exec("rollback to savepoint denied;release savepoint denied");}
beforeEach(async()=>{
 await db.exec("begin");
 for(const [i,id] of [leader,student,admin].entries()){
  await db.query("insert into auth.users values($1)",[id]);await db.query("insert into lub.users(id,email,email_verified_at) values($1,$2,now())",[id,`doc${i}@example.invalid`]);
  await db.query("insert into lub.student_profiles(user_id,full_name_ar,university_id_ciphertext,university_id_lookup_hash,major_name,academic_level) values($1,$2,'secret',$3,'الحاسب','4')",[id,i===1?'=طالب <script>alert(1)</script>':'قائد',String(i).repeat(64)]);
 }
 await db.query("insert into lub.organizations(id,type_code,slug,name_ar) values($1,'Club','reports','جهة التقارير')",[org]);
 const lead=(await db.query<{id:string}>("insert into lub.organization_memberships(organization_id,user_id) values($1,$2) returning id",[org,leader])).rows[0].id;
 memberId=(await db.query<{id:string}>("insert into lub.organization_memberships(organization_id,user_id) values($1,$2) returning id",[org,student])).rows[0].id;
 await db.query("insert into lub.role_assignments(organization_membership_id,organization_id,role_code,is_primary_leader,assigned_by_user_id) values($1,$2,'OL',true,$3)",[lead,org,leader]);
 await db.query("insert into lub.global_role_assignments(user_id,role_code,assigned_by_user_id) values($1,'SA',$1)",[admin]);
 await db.query("insert into lub.committees(id,organization_id,name) values($1,$2,'اللجنة')",[committee,org]);
 await db.query("insert into lub.committee_memberships(organization_id,organization_membership_id,committee_id) values($1,$2,$3)",[org,memberId,committee]);
 await asUser(admin);term=(await db.query<{id:string}>("select lub.create_academic_term('2026','T1','الفصل الأول',current_date-5,current_date+5) as id")).rows[0].id;
 await asUser(leader);hour=(await db.query<{id:string}>("select lub.add_hours($1,$2,$3,2.5,current_date,'عمل',false) as id",[memberId,committee,term])).rows[0].id;
});
afterEach(async()=>{await db.exec("rollback");});afterAll(async()=>{await db.close();});
async function start(kind="Hours_Report",scope:string|null=null,member:string|null=null,period="All",value:string|null=null,starts:string|null=null,ends:string|null=null){return(await db.query<{id:string}>("select lub.generate_document($1,$2,$3,$4,$5,$6,$7::date,$8::date) as id",[org,scope,kind,member,period,value,starts,ends])).rows[0].id;}
async function finish(id:string){const upload=(await db.query<{upload_attempt:string;storage_key:string}>("select * from lub.document_upload($1)",[id])).rows[0];await db.query("insert into storage.objects(bucket_id,name,owner_id) values('lub-generated-documents',$1,$2)",[upload.storage_key,leader]);await db.query("select lub.complete_document($1,$2,true)",[id,upload.upload_attempt]);}
async function generate(...args:Parameters<typeof start>){const id=await start(...args);await finish(id);return id;}
it('keeps failed uploads private and retries the same bytes with a fresh attempt token',async()=>{
 const id=await start('Hours_Certificate',null,memberId);const upload=(await db.query<{body:string;upload_attempt:string;storage_key:string}>('select * from lub.document_upload($1)',[id])).rows[0];await denied(()=>db.query('select * from lub.document_asset($1)',[id]));await denied(()=>db.query('select lub.complete_document($1,$2,true)',[id,upload.upload_attempt]));await denied(()=>db.query('select lub.complete_document($1,null,false)',[id]));await db.query('select lub.complete_document($1,$2,false)',[id,upload.upload_attempt]);
 await db.query('select lub.retry_document($1)',[id]);const retried=(await db.query<typeof upload>('select * from lub.document_upload($1)',[id])).rows[0];expect(retried.body).toBe(upload.body);expect(retried.upload_attempt).not.toBe(upload.upload_attempt);await denied(()=>db.query('select lub.complete_document($1,$2,false)',[id,upload.upload_attempt]));await denied(()=>db.query('select lub.retry_document($1)',[id]));await finish(id);
 await asUser(student);expect((await db.query('select name from storage.objects')).rows).toHaveLength(1);expect((await db.query('delete from storage.objects where name=$1',[upload.storage_key])).affectedRows).toBe(0);expect((await db.query('select name from storage.objects')).rows).toHaveLength(1);await asUser(admin);expect((await db.query('select name from storage.objects')).rows).toHaveLength(0);
});
it("freezes only approved hours, identity and template with immutable private bytes and checksum",async()=>{
 await db.query("select lub.set_self_report_hours($1,true)",[org]);await asUser(student);await db.query("select lub.add_hours($1,$2,$3,99,current_date,'طلب',true)",[memberId,committee,term]);await asUser(leader);
 const id=await generate();const before=(await db.query<{data_snapshot_json:{total:string;rows:Array<{name:string}>};asset_id:string}>("select data_snapshot_json,asset_id from lub.generated_documents where id=$1",[id])).rows[0];
 expect(Number(before.data_snapshot_json.total)).toBe(2.5);expect(before.data_snapshot_json.rows).toHaveLength(1);expect(JSON.stringify(before)).not.toContain('secret');
 await denied(()=>db.query("select body from lub.assets"));const asset=(await db.query<{body:string;checksum_sha256:string}>("select * from lub.document_asset($1)",[id])).rows[0];expect(asset.checksum_sha256).toHaveLength(64);expect(asset.body).toContain("\"'=طالب");
 await db.query("select lub.review_hours($1,'Voided','تصحيح')",[hour]);await db.exec("reset role");await db.query("update lub.student_profiles set full_name_ar='اسم جديد' where user_id=$1",[student]);
 await denied(()=>db.query("update lub.generated_documents set data_snapshot_json='{}' where id=$1",[id]));await denied(()=>db.query("delete from lub.assets where id=$1",[before.asset_id]));
 await asUser(leader);expect((await db.query("select data_snapshot_json,asset_id from lub.generated_documents where id=$1",[id])).rows[0]).toEqual(before);
});
it("denies SA-only and peers; certificate ownership survives ended membership and escaped HTML",async()=>{
 const id=await generate("Hours_Certificate",null,memberId);const asset=(await db.query<{body:string}>("select * from lub.document_asset($1)",[id])).rows[0].body;expect(asset).toContain('&lt;script&gt;');expect(asset).not.toContain('<script>');
 await asUser(admin);expect((await db.query("select id from lub.generated_documents")).rows).toHaveLength(0);await denied(()=>generate());await denied(()=>db.query("select * from lub.document_asset($1)",[id]));
 await db.exec("reset role");await db.query("update lub.organization_memberships set status_code='Ended',end_date=current_date where id=$1",[memberId]);await asUser(student);expect((await db.query("select id from lub.generated_documents")).rows).toHaveLength(1);expect((await db.query("select * from lub.document_asset($1)",[id])).rows).toHaveLength(1);await denied(()=>generate("Hours_Certificate",null,memberId));
});
it("requires explicit committee report grant, confines snapshot scope and revokes immediately",async()=>{
 await db.query("select lub.add_hours($1,null,$2,5,current_date,'عمل الجهة',false)",[memberId,term]);
 await db.exec("reset role");await db.query("insert into lub.role_assignments(organization_membership_id,organization_id,committee_id,role_code,assigned_by_user_id) values($1,$2,$3,'CL',$4)",[memberId,org,committee,leader]);await asUser(student);await denied(()=>generate("Hours_Report",committee));
 await asUser(leader);await db.query("select lub.grant_report_permission($1,$2,null)",[memberId,committee]);await asUser(student);const id=await generate("Hours_Report",committee);await denied(()=>generate());expect((await db.query<{total:string}>("select data_snapshot_json->>'total' as total from lub.generated_documents where id=$1",[id])).rows[0].total).toBe('2.50');
 await asUser(leader);const grant=(await db.query<{id:string}>("select id from lub.permission_grants where permission_code='REPORTS_GENERATE'")).rows[0].id;await db.query("select lub.end_report_permission($1)",[grant]);await asUser(student);expect((await db.query("select id from lub.generated_documents where id=$1",[id])).rows).toHaveLength(0);
});
it("resolves term/year/custom periods in the database and rejects empty, invalid and mismatched requests",async()=>{
 for(const [period,value] of [["Term",term],["Year","2026"]])expect(await generate("Hours_Report",null,null,period,value)).toBeTruthy();
 await denied(()=>generate("Hours_Report",null,null,"Year","missing"));await denied(()=>generate("Hours_Report",null,null,"Custom",null,"2026-10-02","2026-10-01"));await denied(()=>generate("Hours_Report",null,null,"Custom",null,"2000-01-01","2000-01-02"));await denied(()=>generate("Hours_Certificate"));await denied(()=>generate("Hours_Report",null,memberId));
});
it("archives without changing bytes and audits generation, access and archive without names",async()=>{
 const id=await generate();await db.query("select * from lub.document_asset($1)",[id]);await db.query("select lub.archive_document($1)",[id]);await denied(()=>db.query("select lub.archive_document($1)",[id]));
 expect((await db.query<{status_code:string}>("select status_code from lub.generated_documents where id=$1",[id])).rows[0].status_code).toBe('Archived');await db.exec("reset role");const logs=(await db.query<{action_code:string;metadata:unknown}>("select action_code,metadata from lub.audit_log where entity_type='generated_document' order by created_at,id")).rows;expect(logs.map(x=>x.action_code).sort()).toEqual(['DOCUMENT_ACCESSED','DOCUMENT_ARCHIVED','DOCUMENT_GENERATED','DOCUMENT_READY']);expect(JSON.stringify(logs)).not.toContain('طالب');
});
it('refuses oversize exports without leaving a truncated document or asset',async()=>{
 await db.exec('reset role');await db.query("insert into lub.hour_records(organization_id,organization_membership_id,academic_term_id,source_code,hours,activity_date,description,status_code,requested_by_user_id,reviewed_by_user_id,reviewed_at) select $1,$2,$3,'MANUAL',1,current_date,'اختبار الحد','Approved',$4,$4,now() from generate_series(1,5000)",[org,memberId,term,leader]);await asUser(leader);await denied(()=>start());expect((await db.query('select id from lub.generated_documents')).rows).toHaveLength(0);await db.exec('reset role');expect((await db.query('select id from lub.assets')).rows).toHaveLength(0);
});
it('retains own issued certificates after organization archival without retaining operational reports',async()=>{
 const certificate=await generate('Hours_Certificate',null,memberId);await generate();await asUser(admin);await db.query("select lub.set_organization_status($1,'Archived')",[org]);await asUser(leader);expect((await db.query('select id from lub.generated_documents')).rows).toHaveLength(0);await asUser(student);expect((await db.query('select id from lub.generated_documents')).rows).toEqual([{id:certificate}]);expect((await db.query('select * from lub.document_asset($1)',[certificate])).rows).toHaveLength(1);
});
