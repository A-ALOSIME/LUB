import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { storageFixture } from "./storage-fixture";
import * as schema from "@/db/schema";
let db: PGlite, database: PgliteDatabase<typeof schema>;
type Tx = Parameters<Parameters<PgliteDatabase<typeof schema>["transaction"]>[0]>[0];
vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () => ({ withUser: async <T>(user: string, operation: (tx: Tx) => Promise<T>) => database.transaction(async tx => {
  await tx.execute(sql`select set_config('request.jwt.claim.sub',${user},true),set_config('role','authenticated',true)`);
  return operation(new Proxy(tx, { get(target, key) {
    if (key === "execute") return async (query: Parameters<Tx["execute"]>[0]) => (await target.execute(query)).rows;
    return Reflect.get(target, key);
  } }));
}) }));
import { saveAnnouncement, changeAnnouncementState } from "@/features/organizations/management-repository";
const id = (n: number) => `90000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const input = { title: "إعلان الجهة", body: "تفاصيل الإعلان", published: true, pinned: false, externalUrl: "https://example.invalid/info" };
beforeAll(async () => {
  db = new PGlite(); database = drizzle(db, { schema });
  await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;"); await storageFixture(db);
  for (const file of ["schema18.sql","administration18.sql","campaigns18.sql","hours18.sql","tasks18.sql","assets18.sql","announcements18.sql"]) await db.exec(readFileSync(`scripts/schema-simplification/${file}`, "utf8"));
}, 30000);
beforeEach(async () => {
  for (let n=1;n<=3;n++) { await db.query("insert into auth.users values($1)",[id(n)]); await db.query("insert into lub.users(id,email,email_verified_at,full_name_ar,university_id_ciphertext,university_id_lookup_hash,major_name,academic_level,onboarded_at) values($1,$2,now(),'طالب','encrypted',$3,'نظم معلومات','5',now())",[id(n),`ann-repo18-${n}@example.invalid`,String(n).repeat(64)]); }
  for (const n of [100,101]) await db.query("insert into lub.organizations(id,type_code,slug,name_ar) values($1,'Club',$2,'جهة')",[id(n),`ann-repo-${n}`]);
  for (let n=1;n<=3;n++) await db.query("insert into lub.organization_memberships(id,organization_id,user_id) values($1,$2,$3)",[id(300+n),id(100),id(n)]);
  for (const[n,role]of [[1,"OL"],[2,"OD"]]) await db.query("insert into lub.access_assignments(user_id,organization_id,organization_membership_id,role_code,assigned_by_user_id) values($1,$2,$3,$4,$5)",[id(Number(n)),id(100),id(300+Number(n)),role,id(1)]);
});
afterEach(async()=>{await db.exec("reset role;truncate auth.users,lub.organizations cascade");}); afterAll(async()=>{await db?.close();});
it("uses the source repository to save, pin, archive and restore the same merged content row",async()=>{
  const target=await saveAnnouncement(id(1),id(100),input);
  await changeAnnouncementState(id(2),id(100),target,"pin",true);
  expect((await db.query<{pinned:boolean}>("select pinned_at is not null pinned from lub.organization_content where id=$1",[target])).rows[0].pinned).toBe(true);
  await changeAnnouncementState(id(2),id(100),target,"archive");
  expect((await db.query("select * from lub.public_organization_announcements($1)",[id(100)])).rows).toEqual([]);
  await changeAnnouncementState(id(1),id(100),target,"restore");
  expect((await db.query("select * from lub.public_organization_announcements($1)",[id(100)])).rows).toHaveLength(1);
});
it("does not let a member or a different organization modify the announcement",async()=>{
  const target=await saveAnnouncement(id(1),id(100),input);
  await expect(saveAnnouncement(id(3),id(100),input)).rejects.toThrow();
  await expect(changeAnnouncementState(id(3),id(100),target,"archive")).rejects.toThrow();
  await expect(changeAnnouncementState(id(1),id(101),target,"archive")).rejects.toThrow();
  expect((await db.query<{state:string}>("select status_code state from lub.organization_content where id=$1",[target])).rows[0].state).toBe("Published");
});
