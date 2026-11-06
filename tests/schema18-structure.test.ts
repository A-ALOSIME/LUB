import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let db: PGlite;
async function actor(n: number, role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('role',$2,true)", [id(n), role]);
}
async function rejected(run: () => Promise<unknown>) {
  await db.exec("savepoint rejected"); await expect(run()).rejects.toThrow(); await db.exec("rollback to savepoint rejected; release savepoint rejected");
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;");
  await db.exec(readFileSync("scripts/schema-simplification/schema18.sql", "utf8"));
}, 30000);
beforeEach(async () => {
  await db.exec("begin");
  for (let n = 1; n <= 8; n++) {
    await db.query("insert into auth.users values($1)", [id(n)]);
    await db.query("insert into lub.users(id,email,email_verified_at,full_name_ar,university_id_ciphertext,university_id_lookup_hash,major_name,academic_level,onboarded_at) values($1,$2,now(),$3,'encrypted',$4,'الحاسب','5',now())", [id(n), `schema${n}@example.invalid`, `طالب ${n}`, String(n).repeat(64)]);
  }
  await db.query("insert into lub.organizations(id,type_code,slug,name_ar) values($1,'Club','schema-test','جهة الاختبار')", [id(100)]);
  for (const [n, name] of [[200, "المحتوى"], [201, "التصميم"], [202, "الموارد البشرية"]] as const) await db.query("insert into lub.committees(id,organization_id,name) values($1,$2,$3)", [id(n), id(100), name]);
  for (let n = 1; n <= 8; n++) await db.query("insert into lub.organization_memberships(id,organization_id,user_id) values($1,$2,$3)", [id(300 + n), id(100), id(n)]);
  for (const [n, role, committee] of [[1, "OL", null], [2, "OD", null], [3, "CL", id(200)], [4, "CD", id(200)], [5, "CL", id(202)], [6, "CD", id(202)]] as const) await db.query("insert into lub.access_assignments(user_id,organization_id,organization_membership_id,committee_id,role_code,assigned_by_user_id) values($1,$2,$3,$4,$5,$6)", [id(n), id(100), id(300 + n), committee, role, id(1)]);
});
afterEach(async () => { await db.exec("rollback"); });
afterAll(async () => { await db?.close(); });

describe("18-table storage contract", () => {
  it("does not expose tasks through future/expired memberships or privately archived content", async () => {
    await db.query("update lub.organization_memberships set start_date=lub.today_riyadh()+1 where user_id=$1", [id(7)]);
    await db.query("insert into lub.tasks(id,organization_id,created_by_user_id,title,description,status_code) values($1,$2,$3,'مهمة منشورة','مخرج','Open')", [id(850), id(100), id(1)]);
    await db.query("insert into lub.organization_content(id,organization_id,kind,title,status_code,published_at) values($1,$2,'Event','فعالية أرشيفية','Archived',now())", [id(851), id(100)]);
    await db.query("insert into lub.organization_content(id,organization_id,kind,title,status_code,archived_at,published_at) values($1,$2,'Event','فعالية أخفيت إدارياً','Archived',now(),now())", [id(852), id(100)]);
    await actor(7);
    expect((await db.query("select id from lub.tasks")).rows).toEqual([]);
    expect((await db.query("select id from lub.organization_content")).rows).toEqual([{ id: id(851) }]);
    await db.exec("reset role");
    await db.query("update lub.organization_memberships set start_date=lub.today_riyadh()-10,end_date=lub.today_riyadh()-1 where user_id=$1", [id(7)]);
    await actor(7); expect((await db.query("select id from lub.tasks")).rows).toEqual([]);
    await db.exec("reset role"); await db.query("update lub.organizations set status_code='Inactive' where id=$1", [id(100)]);
    await actor(8); expect((await db.query("select id from lub.organization_content")).rows).toEqual([]);
  });
  it("scopes available tasks to the student's committee and retains access to their own past participation", async () => {
    for (const [n, committee] of [[860, null], [861, id(200)]] as const) await db.query("insert into lub.tasks(id,organization_id,committee_id,created_by_user_id,title,description,status_code) values($1,$2,$3,$4,'مهمة','مخرج','Open')", [id(n), id(100), committee, id(1)]);
    await actor(7); expect((await db.query("select id from lub.tasks order by id")).rows).toEqual([{ id: id(860) }]);
    await db.exec("reset role");
    await db.query("insert into lub.committee_memberships(organization_id,organization_membership_id,committee_id) values($1,$2,$3)", [id(100), id(307), id(200)]);
    await actor(7); expect((await db.query("select id from lub.tasks order by id")).rows).toEqual([{ id: id(860) }, { id: id(861) }]);
    await db.exec("reset role");
    await db.query("insert into lub.task_participants(task_id,organization_id,organization_membership_id,user_id) values($1,$2,$3,$4)", [id(861), id(100), id(307), id(7)]);
    await db.query("update lub.organization_memberships set status_code='Ended',end_date=lub.today_riyadh() where id=$1", [id(307)]);
    await db.query("update lub.tasks set status_code='Completed' where id=$1", [id(861)]);
    await actor(7); expect((await db.query("select id from lub.tasks")).rows).toEqual([{ id: id(861) }]);
  });
  it("uses exactly the approved tables with RLS, without legacy compatibility views", async () => {
    const rows = (await db.query<{ name: string; rls: boolean }>("select c.relname name,c.relrowsecurity rls from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='lub' and c.relkind='r' order by c.relname")).rows;
    expect(rows.map(row => row.name)).toEqual(["academic_terms", "access_assignments", "assets", "committee_memberships", "committees", "event_registrations", "history_events", "membership_campaigns", "membership_cases", "organization_content", "organization_memberships", "organization_opening_requests", "organizations", "private_student_identifiers", "skills", "task_participants", "tasks", "users"]);
    expect(rows.every(row => row.rls)).toBe(true);
    expect((await db.query("select viewname from pg_views where schemaname='lub'")).rows).toEqual([]);
  });
  it("publishes an explicit profile allowlist, never account identifiers or notifications", async () => {
    await db.query("update lub.users set public_profile_enabled=true,notifications=$2::jsonb where id=$1", [id(7), JSON.stringify([{ id: id(700), title: "private", readAt: null }])]);
    const slug = (await db.query<{ public_slug: string }>("select public_slug from lub.users where id=$1", [id(7)])).rows[0].public_slug;
    await actor(8, "anon");
    const value = (await db.query<{ value: Record<string, unknown> }>("select lub.public_profile($1) value", [slug])).rows[0].value;
    expect(value.name).toBe("طالب 7");
    for (const key of ["id", "email", "phone", "university_id_ciphertext", "university_id_lookup_hash", "notifications"]) expect(value).not.toHaveProperty(key);
    await rejected(() => db.query("select email from lub.users"));
  });
  it("preserves opt-in publication and excludes test/admin accounts", async () => {
    const slug = (await db.query<{ public_slug: string }>("select public_slug from lub.users where id=$1", [id(7)])).rows[0].public_slug;
    expect((await db.query<{ value: unknown }>("select lub.public_profile($1) value", [slug])).rows[0].value).toBeNull();
    await db.query("update lub.users set public_profile_enabled=true,is_test_account=true where id=$1", [id(7)]);
    expect((await db.query<{ value: unknown }>("select lub.public_profile($1) value", [slug])).rows[0].value).toBeNull();
    await db.query("update lub.users set is_test_account=false where id=$1", [id(7)]);
    await db.query("insert into lub.access_assignments(user_id,role_code,assigned_by_user_id) values($1,'SA',$2)", [id(7), id(1)]);
    expect((await db.query<{ value: unknown }>("select lub.public_profile($1) value", [slug])).rows[0].value).toBeNull();
  });
  it("rejects wrong role scope and membership/user mismatches", async () => {
    await rejected(() => db.query("insert into lub.access_assignments(user_id,organization_id,organization_membership_id,role_code,assigned_by_user_id) values($1,$2,$3,'CL',$4)", [id(7), id(100), id(307), id(1)]));
    await rejected(() => db.query("insert into lub.access_assignments(user_id,organization_id,organization_membership_id,role_code,assigned_by_user_id) values($1,$2,$3,'OD',$4)", [id(7), id(100), id(308), id(1)]));
    await rejected(() => db.query("insert into lub.access_assignments(user_id,organization_id,role_code,assigned_by_user_id) values($1,$2,'SA',$3)", [id(7), id(100), id(1)]));
  });
  it("keeps scoped role permissions including cross-committee creation and own-committee review", async () => {
    const allowed = async (n: number, capability: string, committee: string | null = null) => {
      await actor(n); return (await db.query<{ ok: boolean }>("select lub.has_org_permission($1,$2,$3) ok", [id(100), capability, committee])).rows[0].ok;
    };
    expect(await allowed(1, "ORG_PROFILE_MANAGE")).toBe(true);
    expect(await allowed(2, "ORG_PROFILE_MANAGE")).toBe(false);
    expect(await allowed(2, "EVENTS_MANAGE")).toBe(true);
    for (const n of [3, 4]) {
      expect(await allowed(n, "TASKS_MANAGE", id(201))).toBe(true);
      expect(await allowed(n, "TASKS_REVIEW", id(200))).toBe(true);
      expect(await allowed(n, "TASKS_REVIEW", id(201))).toBe(false);
    }
    expect(await allowed(3, "HOURS_APPROVE", id(200))).toBe(true);
    expect(await allowed(4, "HOURS_APPROVE", id(200))).toBe(false);
    for (const n of [5, 6]) expect(await allowed(n, "APPLICATIONS_REVIEW")).toBe(true);
    expect(await allowed(5, "REPORTS_GENERATE")).toBe(true);
    expect(await allowed(6, "REPORTS_GENERATE")).toBe(false);
    expect(await allowed(7, "TASKS_MANAGE")).toBe(false);
  });
  it("denies direct privilege and profile tampering", async () => {
    await actor(7);
    await rejected(() => db.query("insert into lub.access_assignments(user_id,role_code,assigned_by_user_id) values($1,'SA',$1)", [id(7)]));
    await rejected(() => db.query("update lub.users set status_code='Active' where id=$1", [id(8)]));
    expect((await db.query<{ id: string }>("select id from lub.users")).rows).toEqual([{ id: id(7) }]);
    await rejected(() => db.query("select forms from lub.organizations where id=$1", [id(100)]));
  });
  it("rejects incomplete onboarding and published events with missing dates", async () => {
    await rejected(() => db.query("update lub.users set full_name_ar=null where id=$1", [id(7)]));
    await rejected(() => db.query("insert into lub.organization_content(organization_id,kind,title,status_code,starts_at,registration_opens_at) values($1,'Event','فعالية غير مكتملة','Published',now()+interval '2 days',now())", [id(100)]));
    await db.query("update lub.users set academic_level='graduate' where id=$1", [id(7)]);
  });
  it("validates nested activity skills and prevents deleting a referenced skill", async () => {
    await rejected(() => db.query("insert into lub.tasks(organization_id,created_by_user_id,title,description,skill_ids) values($1,$2,'مهمة اختبار','مخرج',$3::jsonb)", [id(100), id(1), JSON.stringify([id(999)])]));
    await db.query("insert into lub.skills(id,canonical_key,name_ar,category_code) values($1,'sql','قواعد البيانات','programming')", [id(901)]);
    await db.query("insert into lub.tasks(organization_id,created_by_user_id,title,description,skill_ids) values($1,$2,'مهمة اختبار','مخرج',$3::jsonb)", [id(100), id(1), JSON.stringify([id(901)])]);
    await rejected(() => db.query("delete from lub.skills where id=$1", [id(901)]));
  });
  it("rejects malformed or missing canonical skills in nested profile selection", async () => {
    await rejected(() => db.query("update lub.users set skills=$2::jsonb where id=$1", [id(7), JSON.stringify([{ id: id(999), isFeatured: false }])]));
    await db.query("insert into lub.skills(id,canonical_key,name_ar,name_en,aliases,category_code) values($1,'python','بايثون','Python','[\"python\",\"بايثون\"]','programming')", [id(900)]);
    await db.query("update lub.users set skills=$2::jsonb where id=$1", [id(7), JSON.stringify([{ id: id(900), isFeatured: true, sortOrder: 0 }])]);
    await rejected(() => db.query("update lub.users set skills=$2::jsonb where id=$1", [id(7), JSON.stringify([{ id: id(900) }, { id: id(900) }])]));
  });
});
