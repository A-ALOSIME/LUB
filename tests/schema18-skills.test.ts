import {PGlite} from "@electric-sql/pglite";
import {drizzle,type PgliteDatabase} from "drizzle-orm/pglite";
import {sql,type SQL} from "drizzle-orm";
import {readFileSync} from "node:fs";
import {afterAll,afterEach,beforeAll,beforeEach,expect,it,vi} from "vitest";
const id=(n:number)=>`c0000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
let db:PGlite,database:PgliteDatabase;
const mocks=vi.hoisted(()=>({user:vi.fn()}));
type Executor={execute:(query:SQL)=>Promise<Record<string,unknown>[]>};
vi.mock("server-only",()=>({}));
vi.mock("@/features/auth/authorization",()=>({requireStudentUser:mocks.user}));
vi.mock("next/cache",()=>({updateTag:vi.fn(),revalidatePath:vi.fn()}));
vi.mock("@/db/client",()=>({withUser:async<T>(user:string,operation:(tx:Executor)=>Promise<T>)=>{
 await db.exec("savepoint source_action");
 try{await database.execute(sql`select set_config('request.jwt.claim.sub',${user},true),set_config('role','authenticated',true)`);const result=await operation({execute:async query=>(await database.execute(query)).rows as Record<string,unknown>[]});await db.exec("release savepoint source_action");return result;}
 catch(error){await db.exec("rollback to savepoint source_action;release savepoint source_action");throw error;}
}}));
import {searchProfileSkillCatalog,saveProfileSkills,loadProfileSkills} from "@/features/talent/profile-skill-actions";
async function actor(n:number){await db.exec("reset role");await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('role','authenticated',true)",[id(n)]);}
async function denied(run:()=>Promise<unknown>){await db.exec("savepoint denied");await expect(run()).rejects.toThrow();await db.exec("rollback to savepoint denied;release savepoint denied");}
type Skill={key:string;labelAr:string;labelEn:string;featured:boolean;order:number;tasks:number;events:number;category:{key:string;labelAr:string;labelEn:string}};
async function own(n=1){return(await db.query<{skills:Skill[]}>("select lub.own_profile_skills($1) skills",[id(400+n)])).rows[0].skills;}
beforeAll(async()=>{
 db=new PGlite();database=drizzle(db);await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;");
 for(const file of ["schema18.sql","administration18.sql","forms18.sql","form-library18.sql","campaigns18.sql","hours18.sql","tasks18.sql","announcements18.sql","events18.sql","event-registration18.sql","skill-catalog18.sql","skills18.sql"])await db.exec(readFileSync(`scripts/schema-simplification/${file}`,"utf8"));
},30000);
beforeEach(async()=>{
 mocks.user.mockResolvedValue({id:id(1)});await db.exec("begin");for(let n=1;n<=3;n++){await db.query("insert into auth.users values($1)",[id(n)]);await db.query("insert into lub.users(id,email,email_verified_at,full_name_ar,university_id_ciphertext,university_id_lookup_hash,major_name,academic_level,onboarded_at,public_slug) values($1,$2,now(),'طالب','encrypted',$3,'نظم معلومات','5',now(),$4)",[id(n),`skills18-${n}@example.invalid`,String(n).repeat(64),id(400+n)]);}
 await db.query("insert into lub.organizations(id,type_code,slug,name_ar) values($1,'Club','skill-org','جهة')",[id(100)]);
 for(const n of [1,2])await db.query("insert into lub.organization_memberships(id,organization_id,user_id,start_date) values($1,$2,$3,lub.today_riyadh()-5)",[id(300+n),id(100),id(n)]);
 await db.query("insert into lub.access_assignments(user_id,organization_id,organization_membership_id,role_code,assigned_by_user_id) values($1,$2,$3,'OL',$1)",[id(1),id(100),id(301)]);await actor(1);
});
afterEach(async()=>{await db.exec("rollback");});afterAll(async()=>{await db?.close();});
it("searches the existing unified catalog from two characters with static bilingual categories",async()=>{
 const rows=(await db.query<{skills:Skill[]}>("select lub.skill_catalog_rows('با') skills")).rows[0].skills;
 expect(rows.find(s=>s.key==='python')).toMatchObject({labelAr:"بايثون",labelEn:"Python",category:{key:"programming",labelAr:"برمجة",labelEn:"Programming"}});
 expect((await db.query<{skills:Skill[]}>("select lub.skill_catalog_rows('ب') skills")).rows[0].skills).toEqual([]);
 expect((await db.query("select to_regclass('lub.skill_dictionary') dictionary,to_regclass('lub.skill_categories') categories")).rows).toEqual([{dictionary:null,categories:null}]);
});
it("checks ownership, preserves order, limits featured skills and does not leak a private profile",async()=>{
 await db.query("select lub.save_profile_skill_selection($1,$2)",[id(401),JSON.stringify([{key:"sql",featured:false},{key:"python",featured:true}])]);expect((await own()).map(s=>s.key)).toEqual(["sql","python"]);
 expect((await own())[1].featured).toBe(true);await denied(()=>db.query("select lub.save_profile_skill_selection($1,'[]')",[id(402)]));
 await denied(()=>db.query("select lub.save_profile_skill_selection($1,$2)",[id(401),JSON.stringify(["python","sql","javascript","typescript","react","java"].map(key=>({key,featured:true})))]));
 await db.exec("reset role;select set_config('request.jwt.claim.sub','',true);set local role anon");expect((await db.query<{skills:Skill[]}>("select lub.public_profile_skills($1) skills",[id(401)])).rows[0].skills).toEqual([]);
});
it("unifies aliases, permits custom skills and removes only the owner's selection",async()=>{
 await db.query("select lub.save_talent_skill('Python',true)");await db.query("select lub.save_talent_skill('بايثون',true)");expect((await own()).map(s=>s.key)).toEqual(["python"]);
 await db.query("select lub.save_talent_skill('مهارة مخصصة',true)");expect(await own()).toHaveLength(2);await actor(2);await db.query("select lub.save_talent_skill('Python',true)");await db.query("select lub.remove_talent_skill('بايثون')");expect(await own(2)).toEqual([]);
 await actor(1);expect(await own()).toHaveLength(2);await db.exec("reset role");await denied(()=>db.query("delete from lub.skills where canonical_key='python'"));
});
it("assigns activity skills with revision/scope guards and rejects duplicate canonical aliases",async()=>{
 const target=(await db.query<{id:string}>("select lub.save_task(null,$1,null,'مهمة','مطلوب',null,null,3,null) id",[id(100)])).rows[0].id;
 await db.query("select lub.set_activity_skill_tags('Task',$1,'[\"python\",\"sql\"]',1)",[target]);await denied(()=>db.query("select lub.set_activity_skill_tags('Task',$1,'[]',1)",[target]));
 await denied(()=>db.query("select lub.set_activity_skill_tags('Task',$1,'[\"python\",\"python\"]',2)",[target]));await actor(2);await denied(()=>db.query("select lub.set_activity_skill_tags('Task',$1,'[]',2)",[target]));
});
it("counts only approved task work and completed accepted attendance as platform evidence",async()=>{
 await db.exec("reset role");await db.query("insert into lub.academic_terms(id,academic_year,term_code,name_ar,start_date,end_date) values($1,'2026','T1','الفصل الأول',lub.today_riyadh()-2,lub.today_riyadh()+10)",[id(500)]);await actor(1);
 const target=(await db.query<{id:string}>("select lub.save_task(null,$1,null,'مهمة','مطلوب',null,null,3,null) id",[id(100)])).rows[0].id;await db.query("select lub.set_activity_skill_tags('Task',$1,'[\"python\"]',1)",[target]);await db.query("select lub.change_task_status($1,'Open',2)",[target]);
 await actor(2);await db.query("select lub.save_talent_skill('Python',true)");const participant=(await db.query<{id:string}>("select lub.join_task($1) id",[target])).rows[0].id;
 const submission=(await db.query<{id:string}>("select lub.submit_task($1,'تم العمل',array[]::uuid[],0,3) id",[participant])).rows[0].id;expect((await own(2))[0].tasks).toBe(0);await actor(1);await db.query("select lub.review_task_submission_decision($1,'Approved','')",[submission]);await actor(2);expect((await own(2))[0].tasks).toBe(1);
 await db.exec("reset role");await db.query("insert into lub.organization_content(id,organization_id,kind,title,status_code,published_at,completed_at,starts_at,ends_at,registration_opens_at,registration_closes_at,skill_ids) values($1,$2,'Event','فعالية','Completed',now(),now(),now()-interval '2 hours',now()-interval '1 hour',now()-interval '2 days',now()-interval '1 day',(select jsonb_build_array(id) from lub.skills where canonical_key='python'))",[id(800),id(100)]);
 await db.query("insert into lub.event_registrations(event_id,organization_id,user_id,review_status_code,attendance,checked_in_at) values($1,$2,$3,'Accepted','Present',now())",[id(800),id(100),id(2)]);await actor(2);expect((await own(2))[0]).toMatchObject({tasks:1,events:1});
});
it("adds catalog translations without letting a user rename an existing built-in skill",async()=>{
 await db.query("select lub.save_talent_catalog_skill('Python','Wrong label','اسم مختلف')");
 expect((await own())[0]).toMatchObject({labelAr:"بايثون",labelEn:"Python"});
 await db.query("select lub.save_talent_catalog_skill('Database Modeling','Database Modeling','نمذجة البيانات')");
 expect((await own()).find(s=>s.labelEn==='Database Modeling')).toMatchObject({labelAr:"نمذجة البيانات",category:{key:"other"}});
});
it("runs real skill search/load/save server actions against merged storage and preserves data on an unauthorized edit",async()=>{
 expect((await searchProfileSkillCatalog("Py")).find(s=>s.key==='python')?.labelEn).toBe("Python");
 const saved=await saveProfileSkills(id(401),[{key:"python",featured:true}]);expect(saved.skills).toMatchObject([{key:"python",featured:true}]);
 expect((await loadProfileSkills(id(401))).skills).toMatchObject([{key:"python"}]);
 expect(await saveProfileSkills(id(402),[])).toEqual({error:true});
 expect((await loadProfileSkills(id(401))).skills).toMatchObject([{key:"python",featured:true}]);
});
