import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
const id = (n: number) => `70000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let db: PGlite;
async function actor(n: number) { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('role','authenticated',true)", [id(n)]); }
async function denied(run: () => Promise<unknown>) { await db.exec("savepoint denied"); await expect(run()).rejects.toThrow(); await db.exec("rollback to savepoint denied; release savepoint denied"); }
async function create(exclude = false) { return (await db.query<{ id: string }>("select lub.create_renewal($1,$2,now()-interval '1 hour',now()+interval '1 day',$3) id", [id(100), id(500), exclude])).rows[0].id; }
async function transition(campaign: string, operation: string, expected: string) { await db.query("select lub.transition_campaign('renewal',$1,$2,$3)", [campaign, operation, expected]); }
async function cases(campaign: string) { await db.exec("reset role"); return (await db.query<{ id: string; user_id: string; status_code: string }>("select id,user_id,status_code from lub.membership_cases where campaign_id=$1 order by user_id", [campaign])).rows; }
beforeAll(async () => {
  db = new PGlite(); await db.exec("create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;");
  for (const file of ["schema18.sql", "administration18.sql", "forms18.sql", "form-library18.sql", "campaigns18.sql", "renewals18.sql"]) await db.exec(readFileSync(`scripts/schema-simplification/${file}`, "utf8"));
}, 30000);
beforeEach(async () => {
  await db.exec("begin");
  for (let n = 1; n <= 6; n++) { await db.query("insert into auth.users values($1)", [id(n)]); await db.query("insert into lub.users(id,email,email_verified_at,full_name_ar,university_id_ciphertext,university_id_lookup_hash,major_name,academic_level,onboarded_at) values($1,$2,now(),'طالب اختبار','encrypted',$3,'نظم معلومات','5',now())", [id(n), `renewal18-${n}@example.invalid`, String(n).repeat(64)]); }
  await db.query("insert into lub.organizations(id,type_code,slug,name_ar) values($1,'Club','renewal-org','جهة التجديد')", [id(100)]);
  for (let n = 1; n <= 6; n++) await db.query("insert into lub.organization_memberships(id,organization_id,user_id) values($1,$2,$3)", [id(300+n),id(100),id(n)]);
  for (const [n, role] of [[1,"OL"],[2,"HRL"],[3,"HRD"]]) await db.query("insert into lub.access_assignments(user_id,organization_id,organization_membership_id,role_code,assigned_by_user_id) values($1,$2,$3,$4,$5)", [id(Number(n)),id(100),id(300+Number(n)),role,id(1)]);
  await db.query("update lub.organization_memberships set status_code='Ended',end_date=lub.today_riyadh() where id=$1", [id(306)]);
  await db.query("insert into lub.academic_terms(id,academic_year,term_code,name_ar,start_date,end_date) values($1,'2026','T1','الفصل الأول',lub.today_riyadh()-5,lub.today_riyadh()+50)", [id(500)]);
  await actor(1);
});
afterEach(async () => { await db.exec("rollback"); }); afterAll(async () => { await db?.close(); });

it("creates an independent draft and seeds eligible invitations exactly once on publication", async () => {
  const campaign = await create(true); expect(await cases(campaign)).toEqual([]); await actor(1); await transition(campaign,"publish","Draft");
  const rows = await cases(campaign); expect(rows.map(r => r.user_id)).toEqual([id(4),id(5)]); expect(rows.every(r => r.status_code==='Pending')).toBe(true);
  await actor(1); await transition(campaign,"pause","Open"); await transition(campaign,"resume","Paused"); expect(await cases(campaign)).toHaveLength(2);
});
it("checks owner, active membership, response window and single response in the database", async () => {
  const campaign = await create(); await transition(campaign,"publish","Draft"); const response = (await cases(campaign)).find(r=>r.user_id===id(4))!;
  await actor(5); await denied(()=>db.query("select lub.respond_renewal($1,'Renewed')",[response.id]));
  await actor(4); await db.query("select lub.respond_renewal($1,'Renewed')",[response.id]); await denied(()=>db.query("select lub.respond_renewal($1,'Declined')",[response.id]));
  expect((await cases(campaign)).find(r=>r.id===response.id)?.status_code).toBe("Renewed");
  expect((await db.query("select id from lub.history_events where membership_case_id=$1 and to_status_code='Renewed'",[response.id])).rows).toHaveLength(1);
});
it("closes pending replies without changing prior answers and restores archives to closed", async () => {
  const campaign = await create(); await transition(campaign,"publish","Draft"); const response = (await cases(campaign)).find(r=>r.user_id===id(4))!;
  await actor(4); await db.query("select lub.respond_renewal($1,'Declined')",[response.id]); await actor(1); await transition(campaign,"pause","Open"); await transition(campaign,"close","Paused");
  expect((await cases(campaign)).map(r=>r.status_code)).toEqual(["No_Response","No_Response","No_Response","Declined","No_Response"]);
  await actor(1); await transition(campaign,"archive","Closed"); await transition(campaign,"restore","Archived");
  await denied(()=>transition(campaign,"publish","Closed")); expect((await db.query<{ state: string }>("select status_code state from lub.membership_campaigns where id=$1",[campaign])).rows[0].state).toBe("Closed");
});
it("permits multiple campaigns in the same term and rejects stale or unauthorized changes", async () => {
  const first = await create(); await transition(first,"publish","Draft"); await transition(first,"close","Open"); await transition(first,"archive","Closed");
  const second = await create(); expect(second).not.toBe(first); await transition(second,"publish","Draft"); await denied(()=>transition(second,"pause","Draft"));
  await actor(3); await denied(()=>create()); await denied(()=>transition(second,"close","Open"));
  expect((await db.query<{ user_id: string }>("select user_id from lub.membership_cases where campaign_id=$1", [second])).rows).toEqual([{ user_id: id(3) }]);
  await actor(2); await transition(second,"close","Open");
});
it("rejects invalid periods and only lets authorized managers edit unused drafts", async () => {
  await denied(()=>db.query("select lub.create_renewal($1,$2,now(),now()-interval '1 hour',false)",[id(100),id(500)]));
  const campaign = await create(); await db.query("select lub.save_renewal_draft($1,$2,now()+interval '1 day',now()+interval '2 days',true)",[campaign,id(500)]);
  await transition(campaign,"publish","Draft"); const own = (await cases(campaign)).find(r=>r.user_id===id(4))!;
  await actor(4); await denied(()=>db.query("select lub.respond_renewal($1,'Renewed')",[own.id])); await actor(1);
  await denied(()=>db.query("select lub.save_renewal_draft($1,$2,now(),now()+interval '1 day',false)",[campaign,id(500)]));
});
it("does not renew a membership ended after invitation and keeps other members private", async () => {
  const campaign = await create(); await transition(campaign,"publish","Draft"); const response = (await cases(campaign)).find(r=>r.user_id===id(4))!;
  await db.query("update lub.organization_memberships set status_code='Ended',end_date=lub.today_riyadh() where id=$1",[id(304)]);
  await actor(4); await denied(()=>db.query("select lub.respond_renewal($1,'Renewed')",[response.id]));
  expect((await db.query("select id from lub.membership_cases where campaign_id=$1",[campaign])).rows).toEqual([{id:response.id}]);
  expect((await db.query<{data: unknown}>("select lub.renewal_participant_page($1,'','all',0) data",[campaign])).rows[0].data).toBeNull();
});
it("returns scoped participant counts and removes only an unused draft", async () => {
  const draft = await create(); await transition(draft,"delete","Draft"); expect(await cases(draft)).toEqual([]);
  await actor(1); const campaign = await create(); await transition(campaign,"publish","Draft");
  const data = (await db.query<{data:{items:unknown[];total:number;counts:Record<string,number>}}>("select lub.renewal_participant_page($1,'','all',0) data",[campaign])).rows[0].data;
  expect(data.total).toBe(5); expect(data.items).toHaveLength(5); expect(data.counts).toEqual({Pending:5});
  await denied(()=>transition(campaign,"delete","Open"));
});
