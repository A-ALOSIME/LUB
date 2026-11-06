import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";

const id = (n: number) => `30000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let db: PGlite;
async function actor(n: number) { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('role','authenticated',true)", [id(n)]); }
async function denied(run: () => Promise<unknown>) { await db.exec("savepoint denied"); await expect(run()).rejects.toThrow(); await db.exec("rollback to savepoint denied; release savepoint denied"); }
async function add(member = 4, amount = 2.5, self = false, committee: string | null = id(200), duplicate = false) {
  return (await db.query<{ id: string }>("select lub.add_hours($1,$2,$3,$4,lub.today_riyadh(),'عمل تطوعي',$5,$6) id", [id(300 + member), committee, id(500), amount, self, duplicate])).rows[0].id;
}
type Hour = { id: string; hours: number; status_code: string; review_note: string; source_code: string; reviewed_by_user_id: string | null };
async function saved(member = 4) { await db.exec("reset role"); return (await db.query<{ hours: Hour[] }>("select hours from lub.organization_memberships where id=$1", [id(300 + member)])).rows[0].hours; }
beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;");
  for (const file of ["schema18.sql", "administration18.sql", "hours18.sql"]) await db.exec(readFileSync(`scripts/schema-simplification/${file}`, "utf8"));
}, 30000);
beforeEach(async () => {
  await db.exec("begin");
  for (let n = 1; n <= 7; n++) {
    await db.query("insert into auth.users values($1)", [id(n)]);
    await db.query("insert into lub.users(id,email,email_verified_at,full_name_ar,university_id_ciphertext,university_id_lookup_hash,major_name,academic_level,onboarded_at) values($1,$2,now(),'طالب اختبار','encrypted',$3,'نظم معلومات','5',now())", [id(n), `hours18-${n}@example.invalid`, String(n).repeat(64)]);
  }
  await db.query("insert into lub.organizations(id,type_code,slug,name_ar) values($1,'Club','hours-org','جهة الساعات')", [id(100)]);
  for (const [n, name] of [[200, "المحتوى"], [201, "التصميم"], [202, "الموارد البشرية"]] as const) await db.query("insert into lub.committees(id,organization_id,name) values($1,$2,$3)", [id(n), id(100), name]);
  for (let n = 1; n <= 7; n++) await db.query("insert into lub.organization_memberships(id,organization_id,user_id,start_date) values($1,$2,$3,lub.today_riyadh()-20)", [id(300 + n), id(100), id(n)]);
  for (const [n, role, committee] of [[1, "OL", null], [2, "CL", id(200)], [3, "CD", id(200)], [6, "CD", id(202)], [7, "HRL", null]] as const) await db.query("insert into lub.access_assignments(user_id,organization_id,organization_membership_id,committee_id,role_code,assigned_by_user_id) values($1,$2,$3,$4,$5,$6)", [id(n), id(100), id(300 + n), committee, role, id(1)]);
  for (const [n, committee] of [[4, 200], [5, 201]]) await db.query("insert into lub.committee_memberships(organization_id,organization_membership_id,committee_id) values($1,$2,$3)", [id(100), id(300 + n), id(committee)]);
  await db.query("insert into lub.academic_terms(id,academic_year,term_code,name_ar,start_date,end_date) values($1,'2026','T1','الفصل الأول',lub.today_riyadh()-30,lub.today_riyadh()+30)", [id(500)]);
});
afterEach(async () => { await db.exec("rollback"); }); afterAll(async () => { await db?.close(); });

it("stores current manual hours inside membership, corrects their value and detects stale/duplicate writes", async () => {
  await actor(1); const record = await add(); await denied(() => add());
  await db.query("select lub.adjust_hours($1,1,2.5,'تصحيح')", [record]);
  await denied(() => db.query("select lub.adjust_hours($1,1,2.5,'تعديل قديم')", [record]));
  await denied(() => db.query("select lub.adjust_hours($1,-10,3.5,'قيمة سالبة')", [record]));
  expect(await saved()).toMatchObject([{ id: record, hours: 3.5, status_code: "Approved", review_note: "تصحيح", reviewed_by_user_id: id(1) }]);
  expect((await db.query("select to_regclass('lub.hour_records') records,to_regclass('lub.hour_decisions') decisions,to_regclass('lub.hour_adjustments') adjustments")).rows).toEqual([{ records: null, decisions: null, adjustments: null }]);
});
it("requires the enabled self-request policy, ownership and real committee membership", async () => {
  await actor(4); await denied(() => add(4, 3, true)); await actor(1); await db.query("select lub.set_self_report_hours($1,true)", [id(100)]);
  await actor(4); await denied(() => add(5, 3, true, id(201))); await denied(() => add(4, 3, true, id(201)));
  const record = await add(4, 3, true); expect(await saved()).toMatchObject([{ id: record, status_code: "Pending", source_code: "SELF_REPORTED" }]);
  await actor(5); await denied(() => db.query("select lub.withdraw_self_report_hours($1)", [record]));
  await actor(4); await db.query("select lub.withdraw_self_report_hours($1)", [record]);
  expect(await saved()).toMatchObject([{ status_code: "Withdrawn" }]);
});
it("keeps committee-deputy hours pending and allows approval only in the reviewer's scope", async () => {
  await actor(3); const record = await add(); await denied(() => add(5, 2, false, id(201)));
  await denied(() => db.query("select lub.review_hours($1,'Approved','')", [record])); expect(await saved()).toMatchObject([{ status_code: "Pending" }]);
  await actor(2); await db.query("select lub.review_hours($1,'Approved','')", [record]); expect(await saved()).toMatchObject([{ status_code: "Approved", reviewed_by_user_id: id(2) }]);
  await actor(1); const other = await add(5, 2, false, id(201)); await actor(2); await denied(() => db.query("select lub.adjust_hours($1,1,2,'')", [other]));
  await actor(6); await db.query("select lub.adjust_hours($1,1,2,'مراجعة الموارد')", [other]); expect(await saved(5)).toMatchObject([{ hours: 3 }]);
});
it("checks academic/date bounds and leaves the original entry unchanged on rejected review", async () => {
  await actor(1);
  await denied(() => db.query("select lub.add_hours($1,null,$2,2,lub.today_riyadh()+1,'عمل',false,false)", [id(304), id(500)]));
  await denied(() => db.query("select lub.add_hours($1,null,null,2,lub.today_riyadh(),'عمل',false,false)", [id(304)]));
  await db.query("select lub.set_self_report_hours($1,true)", [id(100)]); await actor(4); const record = await add(4, 2, true);
  await actor(2); await denied(() => db.query("select lub.review_hours($1,'Rejected','')", [record]));
  expect(await saved()).toMatchObject([{ status_code: "Pending", hours: 2 }]);
  await actor(2); await db.query("select lub.review_hours($1,'Rejected','المعلومات غير مكتملة')", [record]); expect(await saved()).toMatchObject([{ status_code: "Rejected", review_note: "المعلومات غير مكتملة" }]);
});
it("returns one scoped pending queue for self-requests and deputy additions without a general history/export", async () => {
  await actor(1); await db.query("select lub.set_self_report_hours($1,true)", [id(100)]);
  await actor(3); const manual = await add(); await actor(4); const own = await add(4, 4.5, true); await actor(5); const other = await add(5, 3, true, id(201));
  await actor(2);
  const queue = (await db.query<{ data: { records: Array<{ id: string; source_code: string }> } }>("select lub.hours_review_workspace($1) data", [id(100)])).rows[0].data;
  expect(queue.records.map(row => row.id).sort()).toEqual([manual, own].sort());
  expect(queue.records.map(row => row.source_code).sort()).toEqual(["MANUAL", "SELF_REPORTED"]);
  expect(queue).not.toHaveProperty("exportScopes"); expect(queue).not.toHaveProperty("total");
  await db.query("select lub.review_hours($1,'Approved','')", [manual]);
  expect((await db.query<{ data: typeof queue }>("select lub.hours_review_workspace($1) data", [id(100)])).rows[0].data.records.map(row => row.id)).toEqual([own]);
  await actor(6); expect((await db.query<{ data: typeof queue }>("select lub.hours_review_workspace($1) data", [id(100)])).rows[0].data.records.map(row => row.id).sort()).toEqual([own, other].sort());
  await actor(4); expect((await db.query<{ data: unknown }>("select lub.hours_review_workspace($1) data", [id(100)])).rows[0].data).toBeNull();
});
