import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";

import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { storageFixture } from "./storage-fixture";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/features/auth/session", () => ({ requireUser: async () => ({ id: currentActor }) }));
vi.mock("@/features/auth/authorization", () => ({ studentOperationError: async () => null }));
vi.mock("@/db/client", () => ({
  withUser: async <T>(owner: string, operation: (tx: { execute: (query: SQL) => Promise<unknown[]> }) => Promise<T>) => {
    const previous = currentActor;
    await db.exec("savepoint app_operation");
    try {
      await asUser(owner);
      const result = await operation({ execute: async query => {
        const compiled = new PgDialect().sqlToQuery(query);
        return (await db.query(compiled.sql,compiled.params)).rows;
      }});
      await asUser(previous);
      await db.exec("release savepoint app_operation");
      return result;
    } catch (error) {
      currentActor = previous;
      await db.exec("rollback to savepoint app_operation; release savepoint app_operation");
      throw error;
    }
  },
}));
import { listTasks, taskDetail, taskWorkspace } from "@/features/tasks/repository";
import { mutateTask } from "@/features/tasks/actions";
import { activityRevision } from "@/features/activity/revision";

let currentActor: string;
async function asUser(owner: string) {
  currentActor = owner;
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('role','authenticated',true)", [owner]);
}

function form(values: Record<string, string>) {
  const result = new FormData();
  for (const [key, value] of Object.entries(values)) result.set(key,value);
  return result;
}


const id = (n: number) => `40000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let db: PGlite;
async function actor(n: number) { await asUser(id(n)); }
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
  await storageFixture(db);
  for (const file of ["schema18.sql", "administration18.sql", "hours18.sql", "campaigns18.sql", "tasks18.sql", "assets18.sql", "skills18.sql", "task-reads18.sql"]) await db.exec(readFileSync(`scripts/schema-simplification/${file}`, "utf8"));
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
  expect((await taskDetail(id(4), work, null, 0, 0, "student"))?.approvedHours).toBeNull();
  await db.query("select lub.review_hours($1,'Approved','')", [queue.records[0].id]);
  expect((await taskDetail(id(4), work, null, 0, 0, "student"))?.approvedHours).toBe("5.00");
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

it("lists drafts only for managers, scopes student lists, and preserves bounded result pages", async () => {
  await actor(1);
  const draft = (await db.query<{id:string}>("select lub.save_task(null,$1,$2,'مسودة خاصة','وصف',null,null,1,null) id",[id(100),id(200)])).rows[0].id;
  const visible = await task();
  for(let n=0;n<27;n++) await task();
  expect((await taskWorkspace(id(1),id(100)))?.scopes).toContainEqual({id:id(201),name:"لجنة"});
  expect(await taskWorkspace(id(4),id(100))).toBeUndefined();
  expect((await listTasks(id(1),{org:id(100),view:"all",page:0,status:"Draft"})).items.map(row=>row.task.id)).toEqual([draft]);
  expect((await listTasks(id(4),{org:id(100),view:"all",page:0})).items).toEqual([]);
  expect((await listTasks(id(5),{view:"available",page:0})).items).toEqual([]);
  const paged = await listTasks(id(4),{view:"available",page:0});
  expect(paged.items).toHaveLength(25);
  expect(paged.more).toBe(true);
  const managed = await listTasks(id(1),{org:id(100),view:"all",page:0});
  expect(managed.items).toHaveLength(25);
  expect(managed.more).toBe(true);
  expect(managed.items[0].task).not.toHaveProperty("description");
  expect(managed.items[0].task).not.toHaveProperty("skills");
  expect((await listTasks(id(4),{view:"available",page:null})).items).toHaveLength(28);
  expect((await listTasks(id(4),{view:"available",page:0,q:"مسودة خاصة"})).items).toEqual([]);
  expect((await listTasks(id(4),{view:"mine",page:0})).items).toEqual([]);
  const before = await activityRevision(id(1));
  await actor(4);
  const participant = await join(visible);
  expect(await activityRevision(id(1))).not.toBe(before);
  expect(before).toHaveLength(32);
  await submit(participant);
  const [mine] = (await listTasks(id(4),{view:"mine",page:0})).items;
  expect(mine).toMatchObject({participant:{id:participant},latest_submission:{status_code:"Submitted"},summary:{participants:1,submitted:1}});
  expect(mine.participant).not.toHaveProperty("submissions");
  await db.query("select lub.withdraw_task_participation($1)",[participant]);
  expect((await listTasks(id(4),{view:"mine",page:0})).items).toEqual([]);
  expect((await listTasks(id(4),{view:"available",page:null})).items.find(row=>row.task.id===visible)?.participant).toBeNull();
  await join(visible);
  await actor(1);
  await db.query("select lub.delete_task($1,2)",[visible]);
  expect((await listTasks(id(4),{view:"mine",page:0})).items[0]).toMatchObject({historical:true,task:{id:visible}});
});

it("creates and duplicates drafts through the source action and publishes without templates", async () => {
  await actor(3);
  const values = {operation:"save-task",org:id(100),committee:id(201),title:"مهمة لجنة ثانية",description:"المطلوب",hours:"3"};
  const created = await mutateTask({},form({...values,intent:"draft"}));
  expect(created.success).toBeTruthy();
  expect(created.task).toBeTruthy();
  expect((await listTasks(id(3),{org:id(100),view:"all",page:0})).items[0].task.status_code).toBe("Draft");
  const copied = await mutateTask({},form({operation:"duplicate",task:created.task!,confirm:"on"}));
  expect(copied.success).toBeTruthy();
  expect(copied.task).not.toBe(created.task);
  expect((await listTasks(id(3),{org:id(100),view:"all",page:0})).items.find(row=>row.task.id===copied.task)?.task).toMatchObject({id:copied.task,title:"نسخة من مهمة لجنة ثانية",status_code:"Draft"});
  const published = await mutateTask({},form({...values,intent:"publish"}));
  expect(published.success).toBeTruthy();
  expect((await listTasks(id(5),{view:"available",page:0})).items[0].task.id).toBe(published.task);
  await actor(5);
  expect((await mutateTask({},form({operation:"duplicate",task:created.task!,confirm:"on"}))).error).toBeTruthy();
});

it.each([null,"work.pdf","تسليم عربي.pdf"])("submits through the source action with attachment %s and keeps retry errors actionable", async (name) => {
  await actor(1);const work = await task();await actor(4);const participant=await join(work);
  const payload=form({operation:"submit",participant,message:"",revision:"2",lastRevision:"0"});
  expect((await mutateTask({},payload)).submissionError).toBe("empty");
  payload.set("message","المخرج جاهز");
  payload.set("revision","1");
  expect((await mutateTask({},payload)).submissionError).toBe("task-changed");
  payload.set("revision","2");
  await actor(5);
  expect((await mutateTask({},payload)).submissionError).toBe("access");
  if(name){
    await db.exec("reset role");
    await db.query("insert into lub.assets(id,owner_user_id,object_key,file_name,mime_type,size_bytes) values($1,$2,$3,$4,'application/pdf',100)", [id(901),id(5),id(5)+"/"+id(901)+".pdf",name]);
    await actor(4);
    payload.append("asset",id(901));
    expect((await mutateTask({},payload)).submissionError).toBe("attachment");
    await db.exec("reset role");
    await db.query("insert into lub.assets(id,owner_user_id,object_key,file_name,mime_type,size_bytes) values($1,$2,$3,$4,'application/pdf',100)", [id(902),id(4),id(4)+"/"+id(902)+".pdf",name]);
    payload.set("asset",id(902));
  }
  await actor(4);
  expect((await mutateTask({},payload)).success).toBeTruthy();
  expect((await mutateTask({},payload)).submissionError).toBe("pending");
  expect(await submissions(participant)).toMatchObject([{message:"المخرج جاهز",attachments:name?[{assetId:id(902)}]:[]}]);
  expect((await db.query("select hours from lub.organization_memberships where id=$1",[id(304)])).rows[0]).toEqual({hours:[]});
});

it("keeps selected submissions owner-scoped and blocks another committee's manager from reviewing", async () => {
  await actor(1);
  const work = await task(id(201));
  await actor(5); const person = await join(work); const submitted = await submit(person);
  const student = await taskDetail(id(5),work,null,0,0,"student");
  expect(student?.own?.id).toBe(person);
  expect(student?.submissions).toMatchObject([{id:submitted,message:"أنجزت المطلوب"}]);
  expect(student?.submissions[0]).not.toHaveProperty("task_snapshot");
  expect(student?.team[0]).not.toHaveProperty("major");
  expect((await taskDetail(id(5),work,person,0,0,"student"))?.submissions).toEqual([]);
  expect(await taskDetail(id(4),work,null,0,0,"student")).toBeUndefined();
  const unrelated = await taskDetail(id(2),work,person);
  expect(unrelated).toMatchObject({canManage:true,canReview:false,selected:null,submissions:[]});
  const manager = await taskDetail(id(1),work,person);
  expect(manager).toMatchObject({canManage:true,canReview:true,selected:{id:person},submissions:[{id:submitted,major:"نظم معلومات"}]});
  expect(manager).not.toHaveProperty("history");
  expect((await taskDetail(id(1),work,null,0,0,"management",false,false))?.team).toEqual([]);
  await db.exec("reset role");
  await db.query("update lub.organization_memberships set status_code='Ended',end_date=lub.today_riyadh() where id=$1",[id(305)]);
  const former = await taskDetail(id(5),work,null,0,0,"student");
  expect(former).toMatchObject({current:false,team:[],submissions:[{id:submitted}]});
});
