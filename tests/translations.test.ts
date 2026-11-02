import {PGlite} from "@electric-sql/pglite";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {afterAll,afterEach,beforeAll,beforeEach,expect,it} from "vitest";
import {applyMigrations,storageFixture} from "./storage-fixture";
let db:PGlite;
const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
const source='نادي التقنية';
beforeAll(async()=>{db=new PGlite();await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);await storageFixture(db);await applyMigrations(db);},30000);
beforeEach(async()=>{await db.exec('begin');await db.query("insert into lub.organizations(type_code,slug,name_ar,summary) values('Club','translation-test',$1,'وصف النادي المنشور')",[source]);});
afterEach(async()=>{await db.exec('rollback');});afterAll(async()=>{await db.close();});
async function reserve(text=source){return(await db.query<{result:{state:string;request_id:string;source_kind?:string}}>('select public.translation_reserve($1,$2,$3) result',[text,hash(text),'EN'])).rows[0].result;}
async function finish(id:string,text:string|null){await db.query('select public.translation_finish($1,$2,$3,$4)',[id,source,hash(source),text]);}
async function denied(operation:()=>Promise<unknown>){await db.exec('savepoint denied');await expect(operation()).rejects.toThrow();await db.exec('rollback to savepoint denied;release savepoint denied');}
it('translates only published student names and bios, and withdraws access when the profile becomes private',async()=>{
 const user='00000000-0000-4000-8000-000000000071';await db.query('insert into auth.users values($1)',[user]);await db.query("insert into lub.users(id,email,email_verified_at) values($1,'published-profile@example.invalid',now())",[user]);
 await db.query("insert into lub.student_profiles(user_id,full_name_ar,university_id_ciphertext,university_id_lookup_hash,major_name,academic_level,bio) values($1,'محمد عبدالله','encrypted',$2,'الحاسب','5','طالب مهتم بتطوير البرمجيات')",[user,'7'.repeat(64)]);
 await db.query('insert into lub.profile_settings(user_id,public_profile_enabled) values($1,false)',[user]);
 await denied(()=>reserve('محمد عبدالله'));await denied(()=>reserve('طالب مهتم بتطوير البرمجيات'));
 await db.query('update lub.profile_settings set public_profile_enabled=true where user_id=$1',[user]);
 expect(await reserve('محمد عبدالله')).toMatchObject({state:'reserved',source_kind:'person_name'});
 expect(await reserve('طالب مهتم بتطوير البرمجيات')).toMatchObject({state:'reserved',source_kind:'content'});
 await db.query('update lub.profile_settings set public_profile_enabled=false where user_id=$1',[user]);await denied(()=>reserve('محمد عبدالله'));
});
it('translates a public registration round title but refuses a draft round title',async()=>{
 const org=(await db.query<{id:string}>("select id from lub.organizations where slug='translation-test'")).rows[0].id;
 const template=(await db.query<{id:string}>("insert into lub.form_templates(organization_id,name) values($1,'نموذج التقديم') returning id",[org])).rows[0].id;
 await db.query("insert into lub.form_versions(form_template_id,version_number,status_code,definition,published_at) values($1,1,'Published','{\"sections\":[]}',now())",[template]);
 const id=(await db.query<{id:string}>("insert into lub.registration_rounds(organization_id,form_template_id,title) values($1,$2,'تسجيل في المجلس للترم الاول') returning id",[org,template])).rows[0].id;
 await denied(()=>reserve('تسجيل في المجلس للترم الاول'));
 await db.query("update lub.registration_rounds set status_code='Open',opens_at=now(),closes_at=now()+interval '1 day' where id=$1",[id]);
 expect((await reserve('تسجيل في المجلس للترم الاول')).state).toBe('reserved');
});
it('caches successful translations, deduplicates in-flight requests and never caches failures',async()=>{
 const first=await reserve();expect(first.state).toBe('reserved');expect((await reserve()).state).toBe('busy');await finish(first.request_id,null);
 expect((await db.query('select * from lub.translations')).rows).toHaveLength(0);
 const retry=await reserve();await finish(retry.request_id,'Technology Club');expect((await reserve()).state).toBe('cached');
 expect((await db.query('select * from lub.translations')).rows).toHaveLength(1);
});
it('repairs mixed-script cached names without changing the Arabic source or cache identity',async()=>{
 const source='نادي تكنيشن',sourceHash=hash(source);
 await db.query("insert into lub.translations(source_hash,source_lang,target_lang,source_text,translated_text) values($1,'AR','EN',$2,'تكنيشن Club')",[sourceHash,source]);
 await db.exec(readFileSync('drizzle/0072_consistent_english_organization_names.sql','utf8'));
 expect((await db.query('select source_text,source_hash,translated_text from lub.translations')).rows).toEqual([{source_text:source,source_hash:sourceHash,translated_text:'TechNation Club'}]);
});
it('denies arbitrary private text, forged hashes and reverse translation',async()=>{
 await denied(()=>db.query("select public.translation_lookup('بيانات طالب خاصة',$1,'EN')",[hash('بيانات طالب خاصة')]));
 await denied(()=>db.query("select public.translation_lookup($1,$2,'EN')",[source,'0'.repeat(64)]));
 await denied(()=>db.query("select public.translation_lookup($1,$2,'AR')",[source,hash(source)]));
});
it('automatically accepts newly published event text and treats an edited description as a fresh cache entry',async()=>{
 const user='00000000-0000-4000-8000-000000000001';await db.query('insert into auth.users values($1)',[user]);await db.query("insert into lub.users(id,email,email_verified_at) values($1,'translation@example.invalid',now())",[user]);
 const org=(await db.query<{id:string}>("select id from lub.organizations where slug='translation-test'")).rows[0].id;
 const id=(await db.query<{id:string}>("insert into lub.events(organization_id,created_by_user_id,title,description,location_type_code,location_text,starts_at,ends_at,registration_opens_at,registration_closes_at) values($1,$2,'فعالية جديدة للاختبار','وصف جديد للفعالية','In_Person','قاعة التدريب',now()+interval '2 days',now()+interval '3 days',now(),now()+interval '1 day') returning id",[org,user])).rows[0].id;
 await denied(()=>reserve('وصف جديد للفعالية'));
 await db.query("update lub.events set status_code='Published',published_at=now() where id=$1",[id]);
 expect((await reserve('وصف جديد للفعالية')).state).toBe('reserved');
 await db.query("update lub.events set description='وصف الفعالية بعد التعديل' where id=$1",[id]);
 expect((await reserve('وصف الفعالية بعد التعديل')).state).toBe('reserved');
 await denied(()=>reserve('وصف جديد للفعالية'));
});
it('withdrawn public content is inaccessible even when cached',async()=>{
 const first=await reserve();await finish(first.request_id,'Technology Club');
 await db.exec("update lub.organizations set status_code='Inactive' where slug='translation-test'");
 await denied(()=>db.query("select public.translation_lookup($1,$2,'EN')",[source,hash(source)]));
});
it('enforces a shared request budget and expires stale leases',async()=>{
 await db.exec("insert into lub.translation_requests(source_hash,target_lang,characters,completed_at,success) select n::text,'EN',1,now(),false from generate_series(1,60) n");
 expect((await reserve()).state).toBe('limited');
 await db.exec("delete from lub.translation_requests");const first=await reserve();
 await db.query("update lub.translation_requests set lease_until=now()-interval '1 second' where id=$1",[first.request_id]);
 expect((await reserve()).state).toBe('reserved');
});
it.each(['anon','authenticated'])('keeps cache and service RPCs inaccessible to %s',async role=>{
 await db.exec(`set local role ${role}`);
 await denied(()=>db.query('select * from lub.translations'));
 await denied(()=>db.query("select public.translation_reserve($1,$2,'EN')",[source,hash(source)]));
 await db.exec('reset role');
});
it('allows only the service role to call the checked RPC without exposing lub tables',async()=>{
 await db.exec('set local role service_role');expect((await reserve()).state).toBe('reserved');
 await denied(()=>db.query('select * from lub.translations'));await db.exec('reset role');
});
