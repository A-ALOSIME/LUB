import { PGlite } from "@electric-sql/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  it,
  vi,
} from "vitest";
import { applyMigrations, storageFixture } from "./storage-fixture";
import type { ProfileSkill } from "@/features/talent/profile-skills-model";
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  updateTag: vi.fn(),
  revalidatePath: vi.fn(),
  unstable_cache: (fn: unknown) => fn,
}));
vi.mock("@/features/auth/session", () => ({
  requireUser: async () => ({ id: currentUser }),
}));
vi.mock("@/features/auth/authorization", () => ({
  studentOperationError: async () => undefined,
}));
vi.mock("@/db/client", () => ({
  withUser: async (
    user: string,
    operation: (tx: {
      execute: (query: SQL) => Promise<Record<string, unknown>[]>;
    }) => Promise<unknown>,
  ) => {
    await actor(user);
    await db.exec("savepoint action_mutation");
    try {
      const result = await operation({
        execute: async (query) => {
          const compiled = new PgDialect().sqlToQuery(query);
          return (
            await db.query<Record<string, unknown>>(
              compiled.sql,
              compiled.params,
            )
          ).rows;
        },
      });
      await db.exec("release savepoint action_mutation");
      return result;
    } catch (error) {
      await db.exec(
        "rollback to savepoint action_mutation;release savepoint action_mutation",
      );
      throw error;
    }
  },
}));
import { mutateTask } from "@/features/tasks/actions";
import { mutateEvent } from "@/features/events/actions";
import { taskDetail, listTasks } from "@/features/tasks/repository";
import { eventDetail } from "@/features/events/repository";
let db: PGlite, currentUser: string, studentSlug: string;
const leader = "00000000-0000-4000-8000-000000000001",
  student = "00000000-0000-4000-8000-000000000002",
  org = "00000000-0000-4000-8000-000000000101";
async function actor(user: string) {
  currentUser = user;
  await db.exec("reset role");
  await db.query(
    "select set_config('request.jwt.claim.sub',$1,true),set_config('role','authenticated',true)",
    [user],
  );
}
function form(values: Record<string, string>, skills?: string[]) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  if (skills) {
    data.set("skills-present", "on");
    for (const skill of skills) data.append("skill", skill);
  }
  return data;
}
async function revision(kind: "tasks" | "events", id: string) {
  return (
    await db.query<{ revision: number }>(
      `select revision from lub.${kind} where id=$1`,
      [id],
    )
  ).rows[0].revision;
}
async function evidence() {
  return (
    await db.query<{ skills: ProfileSkill[] }>(
      "select lub.public_profile_skills($1) as skills",
      [studentSlug],
    )
  ).rows[0].skills[0];
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`,
  );
  await storageFixture(db);
  await applyMigrations(db);
}, 30000);
beforeEach(async () => {
  await db.exec("begin");
  for (const [i, user] of [leader, student].entries()) {
    await db.query("insert into auth.users values($1)", [user]);
    await db.query(
      "insert into lub.users(id,email,email_verified_at) values($1,$2,now())",
      [user, `skills${i}@example.invalid`],
    );
    await db.query(
      "insert into lub.student_profiles(user_id,full_name_ar,university_id_ciphertext,university_id_lookup_hash,major_name,academic_level) values($1,$2,'private',$3,'الحاسب','4')",
      [user, `طالب ${i}`, String(i).repeat(64)],
    );
    await db.query("insert into lub.profile_settings(user_id) values($1)", [
      user,
    ]);
  }
  await db.query(
    "insert into lub.organizations(id,type_code,slug,name_ar) values($1,'Club','skills-test','نادي المهارات')",
    [org],
  );
  for (const user of [leader, student]) {
    const m = (
      await db.query<{ id: string }>(
        "insert into lub.organization_memberships(organization_id,user_id) values($1,$2) returning id",
        [org, user],
      )
    ).rows[0].id;
    if (user === leader)
      await db.query(
        "insert into lub.role_assignments(organization_membership_id,organization_id,role_code,is_primary_leader,assigned_by_user_id) values($1,$2,'OL',true,$3)",
        [m, org, leader],
      );
  }
  await db.exec(
    "insert into lub.academic_terms(academic_year,term_code,name_ar,start_date,end_date) values('test','T1','الفصل',current_date-5,current_date+5)",
  );
  await actor(student);
  await db.query(
    "select lub.save_talent_skill('Python',true),lub.save_talent_settings('',true)",
  );
  studentSlug = (
    await db.query<{ public_slug: string }>(
      "select public_slug from lub.profile_settings where user_id=$1",
      [student],
    )
  ).rows[0].public_slug;
  await actor(leader);
});
afterEach(async () => {
  await db.exec("rollback");
});
afterAll(async () => {
  await db.close();
});
const taskValues = {
  operation: "save-task",
  org,
  title: "مهمة بايثون",
  description: "إنجاز مخرج موثّق",
  hours: "0",
  intent: "publish",
};
it("saves task skills atomically, reloads them in both editors, and counts only approved participation", async () => {
  const result = await mutateTask({}, form(taskValues, ["python"]));
  expect(result.success).toBeDefined();
  const task = result.task!;
  expect((await taskDetail(leader, task))?.task.skills).toMatchObject([
    { key: "python", labelEn: "Python" },
  ]);
  expect(
    (await listTasks(leader, { org, view: "all", page: 0 })).items[0].task
      .skills,
  ).toMatchObject([{ key: "python" }]);
  await actor(student);
  expect((await taskDetail(student, task))?.task.skills).toBeUndefined();
  expect((await evidence()).tasks).toBe(0);
  const participant = (
    await db.query<{ id: string }>("select lub.join_task($1) as id", [task])
  ).rows[0].id;
  const submission = (
    await db.query<{ id: string }>(
      "select lub.submit_task($1,'المخرج المنجز','{}'::uuid[],0,$2) as id",
      [participant, await revision("tasks", task)],
    )
  ).rows[0].id;
  expect((await evidence()).tasks).toBe(0);
  await actor(leader);
  await db.query("select lub.review_task_submission($1,'Approved','',null)", [
    submission,
  ]);
  expect((await evidence()).tasks).toBe(1);
});
it("rolls back a task edit with an invalid skill, rejects members, preserves omitted selections and allows explicit clearing", async () => {
  const task = (
    await mutateTask({}, form({ ...taskValues, intent: "draft" }, ["python"]))
  ).task!;
  const before = await revision("tasks", task);
  const edit = {
    ...taskValues,
    task,
    intent: "draft",
    revision: String(before),
    title: "تعديل غير محفوظ",
  };
  expect((await mutateTask({}, form(edit, ["unknown"]))).error).toBeDefined();
  expect((await taskDetail(leader, task))?.task.title).toBe(taskValues.title);
  expect(await revision("tasks", task)).toBe(before);
  await actor(student);
  expect((await mutateTask({}, form(edit, ["sql"]))).error).toBeDefined();
  expect(
    (
      await db.query<{ skills: unknown[] }>(
        "select lub.activity_skill_selection('Task',$1) as skills",
        [task],
      )
    ).rows[0].skills,
  ).toEqual([]);
  await actor(leader);
  expect(
    (await mutateTask({}, form({ ...edit, title: "عنوان محفوظ" }))).success,
  ).toBeDefined();
  expect((await taskDetail(leader, task))?.task.skills).toMatchObject([
    { key: "python" },
  ]);
  const next = await revision("tasks", task);
  await mutateTask(
    {},
    form({ ...edit, title: "عنوان محفوظ", revision: String(next) }, []),
  );
  expect((await taskDetail(leader, task))?.task.skills).toEqual([]);
});
it("stores event selections with publication and counts verified completed events, never registration alone", async () => {
  const now = Date.now(),
    iso = (hours: number) => new Date(now + hours * 3600000).toISOString();
  const values = {
    operation: "save",
    org,
    title: "ورشة بايثون",
    description: "تعلم بايثون",
    locationType: "In_Person",
    location: "قاعة",
    hours: "0",
    starts: iso(24),
    ends: iso(26),
    opens: iso(-1),
    closes: iso(12),
    publish: "on",
  };
  const result = await mutateEvent({}, form(values, ["python"]));
  expect(result.success).toBeDefined();
  const event = result.eventId!;
  expect((await eventDetail(leader, event))?.event.skills).toMatchObject([
    { key: "python" },
  ]);
  const before = await revision("events", event);
  expect(
    (
      await mutateEvent(
        {},
        form(
          { ...values, event, revision: String(before), title: "غير محفوظ" },
          ["unknown"],
        ),
      )
    ).error,
  ).toBeDefined();
  expect((await eventDetail(leader, event))?.event.title).toBe(values.title);
  await actor(student);
  expect((await eventDetail(student, event))?.event.skills).toBeUndefined();
  const registration = (
    await db.query<{ id: string }>(
      "select lub.register_event($1,null,'{}',null) as id",
      [event],
    )
  ).rows[0].id;
  expect((await evidence()).events).toBe(0);
  expect(
    (
      await mutateEvent(
        {},
        form({ ...values, event, revision: String(before) }, ["sql"]),
      )
    ).error,
  ).toBeDefined();
  await db.exec("reset role");
  await db.query(
    "update lub.events set starts_at=now()-interval '2 hours',ends_at=now()-interval '1 hour',registration_opens_at=now()-interval '2 days',registration_closes_at=now()-interval '1 day' where id=$1",
    [event],
  );
  await actor(leader);
  await db.query("select lub.mark_event_attendance($1,'Present')", [
    registration,
  ]);
  expect((await evidence()).events).toBe(0);
  const completed = await mutateEvent(
    {},
    form({
      operation: "status",
      event,
      status: "Completed",
      confirm: "on",
      revision: String(await revision("events", event)),
    }),
  );
  expect(completed.success).toBeDefined();
  expect((await evidence()).events).toBe(1);
});
