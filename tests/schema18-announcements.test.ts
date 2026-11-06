import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import { storageFixture } from "./storage-fixture";
const id = (n: number) => `80000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
let db:PGlite;
async function actor(n:number){await db.exec("reset role");await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('role','authenticated',true)",[id(n)]);}
async function denied(run:()=>Promise<unknown>){await db.exec("savepoint denied");await expect(run()).rejects.toThrow();await db.exec("rollback to savepoint denied;release savepoint denied");}
async function save(target:string|null=null,published=true,pinned=false,asset:string|null=null,replace=true){return(await db.query<{id:string}>("select lub.save_announcement($1,$2,'إعلان الجهة','تفاصيل الإعلان','https://example.invalid/read',$3,$4,$5,$6) id",[target,id(100),published,pinned,asset,replace])).rows[0].id;}
async function visible(){return(await db.query<{id:string;title:string}>("select * from lub.public_organization_announcements($1,'ar')",[id(100)])).rows;}
beforeAll(async()=>{
 db=new PGlite();await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;");await storageFixture(db);
 for(const file of ["schema18.sql","administration18.sql","campaigns18.sql","hours18.sql","tasks18.sql","assets18.sql","announcements18.sql"])await db.exec(readFileSync(`scripts/schema-simplification/${file}`,"utf8"));
},30000);
beforeEach(async()=>{
 await db.exec("begin");for(let n=1;n<=3;n++){await db.query("insert into auth.users values($1)",[id(n)]);await db.query("insert into lub.users(id,email,email_verified_at,full_name_ar,university_id_ciphertext,university_id_lookup_hash,major_name,academic_level,onboarded_at) values($1,$2,now(),'طالب','encrypted',$3,'نظم معلومات','5',now())",[id(n),`announcement18-${n}@example.invalid`,String(n).repeat(64)]);}
 await db.query("insert into lub.organizations(id,type_code,slug,name_ar) values($1,'Club','announcement-org','جهة')",[id(100)]);
 for(let n=1;n<=3;n++)await db.query("insert into lub.organization_memberships(id,organization_id,user_id) values($1,$2,$3)",[id(300+n),id(100),id(n)]);
 for(const[n,role]of [[1,"OL"],[2,"OD"]])await db.query("insert into lub.access_assignments(user_id,organization_id,organization_membership_id,role_code,assigned_by_user_id) values($1,$2,$3,$4,$5)",[id(Number(n)),id(100),id(300+Number(n)),role,id(1)]);
 await actor(1);
});
afterEach(async()=>{await db.exec("rollback");});afterAll(async()=>{await db?.close();});
it("publishes with a full image and link, moves a pinned item first and unpins the previous one",async()=>{
 await db.exec("reset role");await db.query("insert into lub.assets(id,owner_user_id,object_key,file_name,mime_type,size_bytes) values($1,$2,$3,'بوستر.png','image/png',100)",[id(900),id(1),`${id(1)}/${id(900)}.png`]);await actor(1);
 const first=await save(null,true,false,id(900));const second=await save();await db.query("select lub.change_announcement_state($1,'pin',true)",[first]);
 await db.exec("reset role;set local role anon");expect((await visible()).map(x=>x.id)).toEqual([first,second]);expect((await db.query("select * from lub.public_announcement_image($1)",[first])).rows).toHaveLength(1);
 await actor(1);await db.query("select lub.change_announcement_state($1,'pin',true)",[second]);await db.exec("reset role;set local role anon");expect((await visible())[0].id).toBe(second);
});
it("hides drafts and archived media, restores publication, and prevents deletion of published records",async()=>{
 const published=await save(),draft=await save(null,false);await db.query("select lub.change_announcement_state($1,'archive',false)",[published]);
 await db.exec("reset role;set local role anon");expect(await visible()).toEqual([]);await actor(1);await denied(()=>db.query("select lub.change_announcement_state($1,'delete',false)",[published]));
 await db.query("select lub.change_announcement_state($1,'restore',false)",[published]);await db.query("select lub.change_announcement_state($1,'delete',false)",[draft]);
 await db.exec("reset role;set local role anon");expect((await visible()).map(x=>x.id)).toEqual([published]);
});
it("permits the organization deputy but rejects ordinary members and foreign files",async()=>{
 await actor(2);const target=await save();await actor(3);await denied(()=>save());await denied(()=>db.query("select lub.change_announcement_state($1,'archive',false)",[target]));
 await db.exec("reset role");await db.query("insert into lub.assets(id,owner_user_id,object_key,file_name,mime_type,size_bytes) values($1,$2,$3,'file.png','image/png',100)",[id(900),id(3),`${id(3)}/${id(900)}.png`]);await actor(2);await denied(()=>save(target,true,false,id(900)));
});
it("validates title/body/link and avoids clearing an unchanged image on edit",async()=>{
 for(const link of ["javascript:alert(1)","https://user:pass@example.invalid","https://example.invalid/ bad"])await denied(()=>db.query("select lub.save_announcement(null,$1,'إعلان','محتوى',$2,true,false,null,false)",[id(100),link]));
 await denied(()=>db.query("select lub.save_announcement(null,$1,'','',null,true,false,null,false)",[id(100)]));
 await db.query("select lub.save_announcement(null,$1,'إعلان','محتوى','HTTPS://example.invalid/read',true,false,null,false)",[id(100)]);
 await db.exec("reset role");await db.query("insert into lub.assets(id,owner_user_id,object_key,file_name,mime_type,size_bytes) values($1,$2,$3,'file.png','image/png',100)",[id(900),id(1),`${id(1)}/${id(900)}.png`]);await actor(1);
 const target=await save(null,true,false,id(900));await save(target,true,false,null,false);
 expect((await db.query<{image:string}>("select primary_image_id image from lub.organization_content where id=$1",[target])).rows[0].image).toBe(id(900));
});
it("does not leak future publications, inactive organizations or other content kinds",async()=>{
 const target=await save();await db.exec("reset role");await db.query("update lub.organization_content set published_at=now()+interval '1 day' where id=$1",[target]);await db.exec("set local role anon");expect(await visible()).toEqual([]);
 await actor(3); expect((await db.query("select id from lub.organization_content where id=$1",[target])).rows).toEqual([]);
 await db.exec("reset role");await db.query("update lub.organization_content set published_at=now() where id=$1",[target]);await db.query("update lub.organizations set status_code='Inactive' where id=$1",[id(100)]);await db.exec("set local role anon");expect(await visible()).toEqual([]);
});
