import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
const id = (n: number) => `40000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let db: PGlite;
async function actor(n: number) { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('role','authenticated',true)", [id(n)]); }
async function denied(run: () => Promise<unknown>) { await db.exec("savepoint denied"); await expect(run()).rejects.toThrow(); await db.exec("rollback to savepoint denied; release savepoint denied"); }
async function task(committee: string | null = id(200)) {
  const result = (await db.query<{ id: string }>("select lub.save_task(null,$1,$2,'إعداد التصميم','صمم بوستر الفعالية',now()-interval '1 hour',now()+interval '1 day',5,null) id", [id(100), committee])).rows[0].id;
  await db.query("select lub.change_task_status($1,'Open',1)", [result]); return result;
}
async function join(target: string) { return (await db.query<{ id: string }>("select lub.join_task($1) id", [target])).rows[0].id; }
async function submit(participant: string, last = 0, assets: string[] = [], message = "أنجزت المطلوب", revision = 2) {
  return (await db.query<{ id: string }>("select lub.submit_task($1,$2,$3::uuid[],$4,$5) id", [participant, message, assets, last, revision])).rows[0].id;
}
type Submission = { id: string; revision_number: number; message: string; status_code: string; task_snapshot: { description: string }; attachments: Array<{ assetId: string }> };
async function submissions(participant: string) { await db.exec("reset role"); return (await db.query<{ submissions: Submission[] }>("select submissions from lub.task_participants where id=$1", [participant])).rows[0].submissions; }
beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;");
  for (const file of ["schema18.sql", "administration18.sql", "hours18.sql", "campaigns18.sql", "tasks18.sql"]) await db.exec(readFileSync(`scripts/schema-simplification/${file}`, "utf8"));
}, 30000);
beforeEach(async () => {
  await db.exec("begin");
  for (let n = 1; n <= 5; n++) {
    await db.query("insert into auth.users values($1)", [id(n)]);
    await db.query("insert into lub.users(id,email,email_verified_at,full_name_ar,university_id_ciphertext,university_id_lookup_hash,major_name,academic_level,onboarded_at) values($1,$2,now(),'طالب اختبار','encrypted',$3,'نظم معلومات','5',now())", [id(n), `task18-${n}@example.invalid`, String(n).repeat(64)]);
  }
  await db.query("insert into lub.organizations(id,type_code,slug,name_ar) values($1,'Club','tasks-org','جهة المهام')", [id(100)]);
  for (const n of [200, 201]) await db.query("insert into lub.committees(id,organization_id,name) values($1,$2,'لجنة')", [id(n), id(100)]);
  for (let n = 1; n <= 5; n++) await db.query("insert into lub.organization_memberships(id,organization_id,user_id,start_date) values($1,$2,$3,lub.today_riyadh()-20)", [id(300 + n), id(100), id(n)]);
  for (const [n, role, committee] of [[1, "OL", null], [2, "CL", id(200)], [3, "CD", id(200)]] as const) await db.query("insert into lub.access_assignments(user_id,organization_id,organization_membership_id,committee_id,role_code,assigned_by_user_id) values($1,$2,$3,$4,$5,$6)", [id(n), id(100), id(300 + n), committee, role, id(1)]);
  for (const [n, committee] of [[4, 200], [5, 201]]) await db.query("insert into lub.committee_memberships(organization_id,organization_membership_id,committee_id) values($1,$2,$3)", [id(100), id(300 + n), id(committee)]);
  await db.query("insert into lub.academic_terms(id,academic_year,term_code,name_ar,start_date,end_date) values($1,'2026','T1','الفصل الأول',lub.today_riyadh()-30,lub.today_riyadh()+30)", [id(500)]);
});
afterEach(async () => { await db.exec("rollback"); }); afterAll(async () => { await db?.close(); });

it("joins, submits and approves actual work with exactly one embedded hour award", async () => {
  await actor(1); const work = await task(); await actor(4); const participant = await join(work); const submission = await submit(participant);
  await denied(() => submit(participant, 1)); await actor(2); await db.query("select lub.review_task_submission_decision($1,'Approved','')", [submission]);
  await denied(() => db.query("select lub.review_task_submission_decision($1,'Approved','')", [submission]));
  expect(await submissions(participant)).toMatchObject([{ id: submission, status_code: "Approved", task_snapshot: { description: "صمم بوستر الفعالية" } }]);
  expect((await db.query<{ hours: Array<{ hours: number; source_id: string; status_code: string }> }>("select hours from lub.organization_memberships where id=$1", [id(304)])).rows[0].hours).toMatchObject([{ hours: 5, source_id: participant, status_code: "Approved" }]);
});
it("accepts English and Arabic display names with ASCII keys, then a text-only resubmission", async () => {
  await actor(1); const work = await task(); await db.exec("reset role");
  for (const [n, name] of [[901, "poster.pdf"], [902, "تصميم الفعالية.pdf"]] as const) await db.query("insert into lub.assets(id,owner_user_id,object_key,file_name,mime_type,size_bytes) values($1,$2,$3,$4,'application/pdf',100)", [id(n), id(4), `${id(4)}/${id(n)}.pdf`, name]);
  await actor(4); const participant = await join(work); const english = await submit(participant, 0, [id(901)], "");
  await db.query("select lub.withdraw_task_submission($1)", [english]); const arabic = await submit(participant, 1, [id(902)], "");
  await db.query("select lub.withdraw_task_submission($1)", [arabic]); const text = await submit(participant, 2);
  expect(await submissions(participant)).toMatchObject([{ id: english, status_code: "Withdrawn", attachments: [{ assetId: id(901) }] }, { id: arabic, status_code: "Withdrawn", attachments: [{ assetId: id(902) }] }, { id: text, revision_number: 3, message: "أنجزت المطلوب" }]);
});
it("rejects empty, foreign, oversized and stale submissions without adding a partial entry", async () => {
  await actor(1); const work = await task(); await db.exec("reset role");
  for (const [n, owner, size] of [[903, 5, 100], [904, 4, 6000000]]) await db.query("insert into lub.assets(id,owner_user_id,object_key,file_name,mime_type,size_bytes) values($1,$2,$3,'file.pdf','application/pdf',$4)", [id(n), id(owner), `${id(owner)}/${id(n)}.pdf`, size]);
  await actor(4); const participant = await join(work);
  await denied(() => submit(participant, 0, [], "")); for (const asset of [903, 904]) await denied(() => submit(participant, 0, [id(asset)]));
  await denied(() => submit(participant, 0, [], "عمل", 1)); expect(await submissions(participant)).toEqual([]);
  await actor(5); await denied(() => submit(participant));
});
it("permits cross-committee task creation but keeps participation and review scoped", async () => {
  await actor(2); const work = await task(id(201)); await actor(4); await denied(() => join(work));
  await actor(5); const participant = await join(work); const submission = await submit(participant);
  await actor(2); await denied(() => db.query("select lub.review_task_submission_decision($1,'Approved','')", [submission]));
  await denied(() => db.query("select lub.save_task($1,$2,$3,'تغيير النطاق','نقل المهمة إلى لجنتي',null,null,5,2)", [work, id(100), id(200)]));
  expect((await db.query("select id from lub.task_participants where id=$1", [participant])).rows).toEqual([]);
  await actor(1); await db.query("select lub.review_task_submission_decision($1,'Approved','')", [submission]);
});
it("keeps deputy-approved task hours in the pending queue until the committee leader approves them", async () => {
  await actor(1); const work = await task(); await actor(4); const participant = await join(work); const submission = await submit(participant);
  await actor(3); await db.query("select lub.review_task_submission_decision($1,'Approved','')", [submission]);
  await actor(2); const queue = (await db.query<{ data: { records: Array<{ id: string; source_code: string; hours: string }> } }>("select lub.hours_review_workspace($1) data", [id(100)])).rows[0].data;
  expect(queue.records).toMatchObject([{ source_code: "TASK", hours: "5.00" }]);
  await db.query("select lub.review_hours($1,'Approved','')", [queue.records[0].id]);
  expect((await db.query<{ data: typeof queue }>("select lub.hours_review_workspace($1) data", [id(100)])).rows[0].data.records).toEqual([]);
});
it("preserves finalized submission content and allows rejoining after withdrawal without losing past submissions", async () => {
  await actor(1); const work = await task(); await actor(4); const participant = await join(work); const first = await submit(participant);
  await db.query("select lub.withdraw_task_participation($1)", [participant]); const rejoined = await join(work); expect(rejoined).toBe(participant);
  const second = await submit(participant, 1); await actor(2); await db.query("select lub.review_task_submission_decision($1,'Changes_Requested','أكمل المطلوب')", [second]);
  await db.exec("reset role"); await denied(() => db.query("update lub.task_participants set submissions=jsonb_set(submissions,'{1,message}','\"تغيير لاحق\"') where id=$1", [participant]));
  expect(await submissions(participant)).toMatchObject([{ id: first, status_code: "Withdrawn" }, { id: second, status_code: "Rejected" }]);
});
it("awards the hours captured at submission after the current task is edited", async () => {
  await actor(1); const work = await task(); await actor(4); const participant = await join(work); const submission = await submit(participant);
  await actor(1); await db.query("select lub.save_task($1,$2,$3,'عنوان جديد','مطلوب جديد',now()-interval '1 hour',now()+interval '1 day',10,2)", [work, id(100), id(200)]);
  await actor(2); await db.query("select lub.review_task_submission_decision($1,'Approved','')", [submission]);
  expect(await submissions(participant)).toMatchObject([{ task_snapshot: { description: "صمم بوستر الفعالية" } }]);
  expect((await db.query<{ hours: Array<{ hours: number }> }>("select hours from lub.organization_memberships where id=$1", [id(304)])).rows[0].hours).toMatchObject([{ hours: 5 }]);
  expect((await db.query("select to_regclass('lub.task_submissions') submissions,to_regclass('lub.task_revisions') revisions")).rows).toEqual([{ submissions: null, revisions: null }]);
});
it("accepts work without a term and rolls back approval completely until a term is defined", async () => {
  await actor(1); const work = await task(); await db.exec("reset role; delete from lub.academic_terms");
  await actor(4); const participant = await join(work); const submission = await submit(participant);
  await actor(2); await db.exec("savepoint missing_term");
  await expect(db.query("select lub.review_task_submission_decision($1,'Approved','')", [submission])).rejects.toMatchObject({ code: "P0002" });
  await db.exec("rollback to savepoint missing_term; release savepoint missing_term");
  expect(await submissions(participant)).toMatchObject([{ status_code: "Submitted" }]);
  expect((await db.query("select status_code from lub.task_participants where id=$1", [participant])).rows).toEqual([{ status_code: "Submitted" }]);
  expect((await db.query("select hours from lub.organization_memberships where id=$1", [id(304)])).rows).toEqual([{ hours: [] }]);
  await db.query("insert into lub.academic_terms(id,academic_year,term_code,name_ar,start_date,end_date) values($1,'2026','T1','الفصل',lub.today_riyadh()-1,lub.today_riyadh()+1)", [id(500)]);
  await actor(2); await db.query("select lub.review_task_submission_decision($1,'Approved','')", [submission]);
  expect(await submissions(participant)).toMatchObject([{ status_code: "Approved" }]);
});
it("duplicates a task as an independent draft instead of using a template library", async () => {
  await actor(1); const work = await task(); await actor(4); await join(work); await actor(2);
  const copy = (await db.query<{ id: string }>("select lub.duplicate_task($1) id", [work])).rows[0].id;
  expect(copy).not.toBe(work); await db.exec("reset role");
  expect((await db.query("select status_code,description,default_hours::text from lub.tasks where id=$1", [copy])).rows).toEqual([{ status_code: "Draft", description: "صمم بوستر الفعالية", default_hours: "5.00" }]);
  expect((await db.query("select id from lub.task_participants where task_id=$1", [copy])).rows).toEqual([]);
  await actor(2); await db.query("select lub.delete_task($1,1)", [copy]); await db.exec("reset role"); expect((await db.query("select id from lub.tasks where id=$1", [copy])).rows).toEqual([]);
  await actor(2); await db.query("select lub.delete_task($1,2)", [work]); await db.exec("reset role");
  expect((await db.query("select deleted_at is not null deleted from lub.tasks where id=$1", [work])).rows).toEqual([{ deleted: true }]);
  expect((await db.query("select id from lub.task_participants where task_id=$1", [work])).rows).toHaveLength(1);
});
it("checks poster ownership and media type without changing the task on failure", async () => {
  await actor(1); const work = await task(); await db.exec("reset role");
  for (const [n, owner, mime] of [[905, 1, "image/png"], [906, 4, "image/png"], [907, 1, "application/pdf"]] as const) await db.query("insert into lub.assets(id,owner_user_id,object_key,file_name,mime_type,size_bytes) values($1,$2,$3,'مرفق',$4,100)", [id(n), id(owner), `${id(owner)}/${id(n)}`, mime]);
  await actor(1); for (const n of [906, 907]) await denied(() => db.query("select lub.set_task_image($1,$2,2)", [work, id(n)]));
  await db.query("select lub.set_task_image($1,$2,2)", [work, id(905)]); await denied(() => db.query("select lub.set_task_image($1,null,2)", [work]));
  await db.exec("reset role"); expect((await db.query("select image_asset_id,revision from lub.tasks where id=$1", [work])).rows).toEqual([{ image_asset_id: id(905), revision: 3 }]);
});
