import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { sql, type SQL } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
let db:PGlite,database:PgliteDatabase;
type Executor={execute:(query:SQL)=>Promise<Record<string,unknown>[]>};
vi.mock("server-only",()=>({}));
vi.mock("@/db/client",()=>({withUser:async<T>(user:string,operation:(tx:Executor)=>Promise<T>)=>database.transaction(async tx=>{
 await tx.execute(sql`select set_config('request.jwt.claim.sub',${user},true),set_config('role','authenticated',true)`);
 return operation({execute:async query=>(await tx.execute(query)).rows as Record<string,unknown>[]});
})}));
import {taskNotifications,taskNotificationCounts} from "@/features/tasks/repository";
import {notificationRevision} from "@/features/activity/revision";
const id=(n:number)=>`a0000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
beforeAll(async()=>{
 db=new PGlite();database=drizzle(db);await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;");
 for(const file of ["schema18.sql","administration18.sql","campaigns18.sql","hours18.sql","tasks18.sql","notifications18.sql"])await db.exec(readFileSync(`scripts/schema-simplification/${file}`,"utf8"));
},30000);
beforeEach(async()=>{
 for(const n of [1,2]){await db.query("insert into auth.users values($1)",[id(n)]);await db.query("insert into lub.users(id,email,email_verified_at,full_name_ar) values($1,$2,now(),'طالب')",[id(n),`notice18-${n}@example.invalid`]);}
 await db.query("update lub.users set notifications=$1 where id=$2",[JSON.stringify(Array.from({length:31},(_,n)=>({id:id(100+n),typeCode:"TASK_REVIEWED",title:"تحديث المهمة",body:"تمت مراجعة العمل",targetUrl:"/activity",createdAt:new Date(Date.UTC(2026,0,1,0,n)).toISOString(),readAt:n===0?"2026-01-02T00:00:00Z":null}))),id(1)]);
});
afterEach(async()=>{await db.exec("reset role;truncate auth.users,lub.organizations cascade");});afterAll(async()=>{await db?.close();});
async function asUser(n:number,query:string,values:unknown[]=[]){return db.transaction(async tx=>{
 await tx.query("select set_config('request.jwt.claim.sub',$1,true),set_config('role','authenticated',true)",[id(n)]);
 return tx.query(query,values);
});}
it("serves the source notification feed/counts from merged users with stable paging and owner isolation",async()=>{
 expect(await taskNotificationCounts(id(1))).toEqual({all:31,unread:30});expect(await taskNotificationCounts(id(2))).toEqual({all:0,unread:0});
 const rows=await taskNotifications(id(1),0);expect(rows).toHaveLength(26);expect(rows[0]).toMatchObject({id:id(130),type_code:"TASK_REVIEWED",target_url:"/activity"});expect(await taskNotifications(id(1),1)).toHaveLength(6);
 expect(await taskNotifications(id(2),0)).toEqual([]);expect((await taskNotifications(id(1),1,true)).some(n=>n.id===id(100))).toBe(false);
});
it("marks one owned item read idempotently, changes its fingerprint and rejects another account",async()=>{
 const before=await notificationRevision(id(1));await expect(asUser(2,"select lub.read_task_notification($1)",[id(101)])).rejects.toThrow();
 await asUser(1,"select lub.read_task_notification($1)",[id(101)]);const after=await notificationRevision(id(1));expect(after).not.toBe(before);
 await asUser(1,"select lub.read_task_notification($1)",[id(101)]);expect(await notificationRevision(id(1))).toBe(after);expect((await taskNotificationCounts(id(1))).unread).toBe(29);
});
it("marks the existing feed read without losing messages appended afterwards",async()=>{
 await asUser(1,"select lub.read_all_task_notifications()");expect((await taskNotificationCounts(id(1))).unread).toBe(0);
 await db.query("update lub.users set notifications=notifications||$1::jsonb where id=$2",[JSON.stringify([{id:id(200),typeCode:"NEW",title:"تحديث",body:"",targetUrl:"/activity",createdAt:"2026-01-03T00:00:00Z",readAt:null}]),id(1)]);
 expect(await taskNotificationCounts(id(1))).toEqual({all:32,unread:1});expect((await taskNotifications(id(1),0,true)).map(n=>n.id)).toEqual([id(200)]);
});
it("denies mutation from inactive accounts and rejects invalid pagination",async()=>{
 await db.query("update lub.users set status_code='Inactive' where id=$1",[id(1)]);await expect(asUser(1,"select lub.read_task_notification($1)",[id(101)])).rejects.toThrow();
 await expect(taskNotifications(id(1),-1)).rejects.toThrow();
});
it("reads the real task-review notification through the current source repository",async()=>{
 await db.query("update lub.users set notifications='[]',university_id_ciphertext='encrypted',university_id_lookup_hash=$1,major_name='نظم معلومات',academic_level='5',onboarded_at=now() where id=$2",["a".repeat(64),id(1)]);
 await db.query("update lub.users set university_id_ciphertext='encrypted',university_id_lookup_hash=$1,major_name='نظم معلومات',academic_level='5',onboarded_at=now() where id=$2",["b".repeat(64),id(2)]);
 await db.query("insert into lub.organizations(id,type_code,slug,name_ar) values($1,'Club','notice-task','جهة')",[id(500)]);
 for(const n of [1,2])await db.query("insert into lub.organization_memberships(id,organization_id,user_id) values($1,$2,$3)",[id(600+n),id(500),id(n)]);
 await db.query("insert into lub.access_assignments(user_id,organization_id,organization_membership_id,role_code,assigned_by_user_id) values($1,$2,$3,'OL',$1)",[id(2),id(500),id(602)]);
 const task=(await asUser(2,"select lub.save_task(null,$1,null,'مهمة فعلية','وصفها',null,null,2,null) id",[id(500)])).rows[0] as {id:string};
 await asUser(2,"select lub.change_task_status($1,'Open',1)",[task.id]);
 const participant=(await asUser(1,"select lub.join_task($1) id",[task.id])).rows[0] as {id:string};
 const submission=(await asUser(1,"select lub.submit_task($1,'مخرج',array[]::uuid[],0,2) id",[participant.id])).rows[0] as {id:string};
 await asUser(2,"select lub.review_task_submission_decision($1,'Rejected','أكمل المطلوب')",[submission.id]);
 expect((await taskNotifications(id(1),0))[0].target_url).toBe(`/tasks/${task.id}`);
 expect((await taskNotifications(id(2),0))).toEqual([]);
});
