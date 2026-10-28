import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
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

it("publishes image/link announcements, pins only one, archives and soft-deletes without public leakage",async()=>{
 const asset="00000000-0000-4000-8000-000000000301",key=`${leader}/${asset}`;
 await db.query("select lub.register_application_asset($1,$2,'notice.png','image/png',100)",[asset,key]);
 const save=async(title:string,pin=false)=> (await db.query<{id:string}>("select lub.save_announcement(null,$1,$2,'محتوى الإعلان','https://example.com/news',true,$3,$4,true) as id",[org,title,pin,asset])).rows[0].id;
 const first=await save("الإعلان الأول",true),second=await save("الإعلان الثاني",true);
 expect((await db.query<{pinned_at:string|null}>("select pinned_at from lub.announcements where id=$1",[first])).rows[0].pinned_at).toBeNull();
 await db.exec("reset role; set local role anon");expect((await db.query("select id from lub.announcements")).rows).toHaveLength(2);expect((await db.query("select * from lub.public_announcement_image($1)",[second])).rows).toHaveLength(1);
 expect((await db.query<{allowed:boolean}>("select lub.can_read_public_announcement_object($1) as allowed",[key])).rows[0].allowed).toBe(true);
 await asUser(leader);await db.query("select lub.change_announcement_state($1,'archive',false)",[second]);await db.query("select lub.change_announcement_state($1,'delete',false)",[first]);
 await db.exec("reset role; set local role anon");expect((await db.query("select id from lub.announcements")).rows).toHaveLength(0);expect((await db.query("select * from lub.public_announcement_image($1)",[second])).rows).toHaveLength(0);
 expect((await db.query<{allowed:boolean}>("select lub.can_read_public_announcement_object($1) as allowed",[key])).rows[0].allowed).toBe(false);
});
it("rejects unauthorized decisions, foreign image binding and unsafe URLs at the database boundary",async()=>{
 const asset="00000000-0000-4000-8000-000000000302";await asUser(member);await db.query("select lub.register_application_asset($1,$2,'private.png','image/png',100)",[asset,`${member}/${asset}`]);
 await denied(()=>db.query("select lub.save_announcement(null,$1,'عنوان الإعلان','محتوى الإعلان',null,true,false,null,false)",[org]));await asUser(leader);
 await denied(()=>db.query("select lub.save_announcement(null,$1,'عنوان الإعلان','محتوى الإعلان',null,true,false,$2,true)",[org,asset]));
 await denied(()=>db.query("select lub.save_announcement(null,$1,'عنوان الإعلان','محتوى الإعلان','javascript:alert(1)',true,false,null,false)",[org]));
 const id=(await db.query<{id:string}>("select lub.save_announcement(null,$1,'عنوان الإعلان','محتوى الإعلان',null,false,false,null,false) as id",[org])).rows[0].id;await asUser(member);
 await denied(()=>db.query("select lub.change_announcement_state($1,'delete',false)",[id]));expect((await db.query("select id from lub.announcements")).rows).toHaveLength(0);
});
