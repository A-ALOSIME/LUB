import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, beforeEach, afterEach, it, expect } from "vitest";
import { applyMigrations, storageFixture } from "./storage-fixture";
let db: PGlite;
const admin = "00000000-0000-4000-8000-000000000001",
  student = "00000000-0000-4000-8000-000000000002",
  other = "00000000-0000-4000-8000-000000000003";
async function asUser(id: string) {
  await db.exec("reset role");
  await db.query(
    "select set_config('request.jwt.claim.sub',$1,true),set_config('role','authenticated',true)",
    [id],
  );
}
async function denied(action: () => Promise<unknown>) {
  await db.exec("savepoint denied");
  await expect(action()).rejects.toThrow();
  await db.exec("rollback to savepoint denied;release savepoint denied");
}
async function submit(name = "نادي الاختبار") {
  return (
    await db.query<{ id: string }>(
      "select lub.submit_organization_request($1,'Club','نبذة عن النادي','رسالة وأهداف النادي','[\"تقنية\"]'::jsonb,null) as id",
      [name],
    )
  ).rows[0].id;
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
  for (const [i, id] of [admin, student, other].entries()) {
    await db.query("insert into auth.users values($1)", [id]);
    await db.query(
      "insert into lub.users(id,email,email_verified_at) values($1,$2,now())",
      [id, `request${i}@example.invalid`],
    );
    await db.query(
      "insert into lub.student_profiles(user_id,full_name_ar,university_id_ciphertext,university_id_lookup_hash,major_name,academic_level) values($1,$2,'private',$3,'نظم معلومات','5')",
      [id, `طالب ${i}`, String(i).repeat(64)],
    );
  }
  await db.query(
    "insert into lub.global_role_assignments(user_id,role_code,assigned_by_user_id) values($1,'SA',$1)",
    [admin],
  );
  await asUser(student);
});
afterEach(async () => {
  await db.exec("rollback");
});
afterAll(async () => {
  await db.close();
});
it("confines request visibility and submission to the owner and limits one pending request", async () => {
  const id = await submit();
  await denied(() => submit("نادي ثان"));
  expect(
    (await db.query("select id from lub.organization_opening_requests")).rows,
  ).toEqual([{ id }]);
  await asUser(other);
  expect(
    (await db.query("select id from lub.organization_opening_requests")).rows,
  ).toEqual([]);
  await denied(() =>
    db.query("select lub.decide_organization_request($1,'Accepted','')", [id]),
  );
  await denied(() =>
    db.query(
      "update lub.organization_opening_requests set status_code='Accepted' where id=$1",
      [id],
    ),
  );
  await asUser(admin);
  await denied(() => submit());
  expect(
    (await db.query("select id from lub.organization_opening_requests")).rows,
  ).toEqual([{ id }]);
});
it("accepts once and creates the organization, interests, leadership and notification atomically", async () => {
  const id = await submit();
  await asUser(admin);
  await db.query("select lub.decide_organization_request($1,'Accepted','')", [
    id,
  ]);
  const row = (
    await db.query<{ organization_id: string; status_code: string }>(
      "select organization_id,status_code from lub.organization_opening_requests where id=$1",
      [id],
    )
  ).rows[0];
  expect(row.status_code).toBe("Accepted");
  expect(
    (await db.query("select id from lub.organization_memberships")).rows,
  ).toEqual([]);
  await db.exec("reset role");
  expect(
    (
      await db.query("select name_ar from lub.organizations where id=$1", [
        row.organization_id,
      ])
    ).rows[0],
  ).toEqual({ name_ar: "نادي الاختبار" });
  expect(
    (
      await db.query(
        "select m.user_id,r.is_primary_leader from lub.role_assignments r join lub.organization_memberships m on m.id=r.organization_membership_id where r.organization_id=$1",
        [row.organization_id],
      )
    ).rows,
  ).toEqual([{ user_id: student, is_primary_leader: true }]);
  expect(
    (
      await db.query(
        "select tag_id from lub.organization_tags where organization_id=$1",
        [row.organization_id],
      )
    ).rows,
  ).toHaveLength(1);
  await asUser(admin);
  await denied(() =>
    db.query("select lub.decide_organization_request($1,'Rejected','متأخر')", [
      id,
    ]),
  );
  await asUser(student);
  expect(
    (await db.query("select type_code,target_url from lub.notifications")).rows,
  ).toContainEqual({
    type_code: "ORGANIZATION_REQUEST_ACCEPTED",
    target_url: "/applications?tab=organizations",
  });
  await denied(() => submit("نَادِي الاختبار"));
});
it("requires a rejection reason, keeps it for the owner and permits a new submission", async () => {
  const id = await submit();
  await asUser(admin);
  await denied(() =>
    db.query("select lub.decide_organization_request($1,'Rejected','')", [id]),
  );
  await db.query(
    "select lub.decide_organization_request($1,'Rejected','الأهداف تحتاج توضيحًا')",
    [id],
  );
  await asUser(student);
  expect(
    (
      await db.query(
        "select decision_note from lub.organization_opening_requests where id=$1",
        [id],
      )
    ).rows[0],
  ).toEqual({ decision_note: "الأهداف تحتاج توضيحًا" });
  expect(await submit()).not.toBe(id);
});
it("withdraws only an owned pending request and preserves its history", async () => {
  const id = await submit();
  await asUser(other);
  await denied(() =>
    db.query("select lub.withdraw_organization_request($1)", [id]),
  );
  await asUser(student);
  await db.query("select lub.withdraw_organization_request($1)", [id]);
  expect(
    (
      await db.query(
        "select status_code from lub.organization_opening_requests where id=$1",
        [id],
      )
    ).rows[0],
  ).toEqual({ status_code: "Withdrawn" });
  await denied(() =>
    db.query("select lub.withdraw_organization_request($1)", [id]),
  );
  expect(await submit()).not.toBe(id);
});
it("returns scoped counts and safe details without logo bytes or private applicant identifiers", async () => {
  const id = await submit();
  const own = (
    await db.query<{
      data: {
        counts: { Pending: number };
        items: Array<Record<string, unknown>>;
      };
    }>("select lub.organization_request_workspace(true,null,0) as data")
  ).rows[0].data;
  expect(own.counts.Pending).toBe(1);
  expect(own.items[0].id).toBe(id);
  expect(JSON.stringify(own)).not.toMatch(
    /applicant_user_id|request1@|university|private|logo_webp_base64/,
  );
  await asUser(other);
  expect(
    (
      await db.query<{ data: { items: unknown[] } }>(
        "select lub.organization_request_workspace(true,null,0) as data",
      )
    ).rows[0].data.items,
  ).toEqual([]);
  await denied(() =>
    db.query("select lub.organization_request_workspace(false,null,0)"),
  );
  await asUser(admin);
  expect(
    (
      await db.query<{ data: { counts: { Pending: number } } }>(
        "select lub.organization_request_workspace(false,'Pending',0) as data",
      )
    ).rows[0].data.counts.Pending,
  ).toBe(1);
});
it("rolls acceptance back when the applicant is no longer eligible", async () => {
  const id = await submit();
  await db.exec("reset role");
  await db.query("update lub.users set status_code='Inactive' where id=$1", [
    student,
  ]);
  await asUser(admin);
  await denied(() =>
    db.query("select lub.decide_organization_request($1,'Accepted','')", [id]),
  );
  expect(
    (
      await db.query(
        "select status_code,organization_id from lub.organization_opening_requests where id=$1",
        [id],
      )
    ).rows[0],
  ).toEqual({ status_code: "Pending", organization_id: null });
  expect((await db.query("select id from lub.organizations")).rows).toEqual([]);
});
it("keeps pending logo bytes private and publishes the small logo only after acceptance", async () => {
  const bytes = Buffer.alloc(32);
  bytes.write("RIFF");
  bytes.writeUInt32LE(24, 4);
  bytes.write("WEBPVP8 ", 8);
  bytes.writeUInt32LE(12, 16);
  bytes.set([157, 1, 42], 23);
  bytes.writeUInt16LE(256, 26);
  bytes.writeUInt16LE(256, 28);
  const logo = bytes.toString("base64");
  const id = (
    await db.query<{ id: string }>(
      "select lub.submit_organization_request('نادي الشعار','Club','نبذة','أهداف','[]'::jsonb,$1) as id",
      [logo],
    )
  ).rows[0].id;
  await denied(() =>
    db.query(
      "select logo_webp_base64 from lub.organization_opening_requests where id=$1",
      [id],
    ),
  );
  expect(
    (
      await db.query<{ logo: string }>(
        "select lub.organization_request_logo($1) as logo",
        [id],
      )
    ).rows[0].logo,
  ).toBe(logo);
  await db.exec(
    "reset role;select set_config('request.jwt.claim.sub','',true);set local role anon",
  );
  expect(
    (
      await db.query<{ logo: string | null }>(
        "select lub.organization_request_logo($1) as logo",
        [id],
      )
    ).rows[0].logo,
  ).toBeNull();
  await asUser(admin);
  await db.query("select lub.decide_organization_request($1,'Accepted','')", [
    id,
  ]);
  await db.exec(
    "reset role;select set_config('request.jwt.claim.sub','',true);set local role anon",
  );
  expect(
    (
      await db.query<{ logo: string }>(
        "select lub.organization_request_logo($1) as logo",
        [id],
      )
    ).rows[0].logo,
  ).toBe(logo);
  expect(
    (await db.query("select logo_url from lub.organizations")).rows[0],
  ).toEqual({
    logo_url: `https://lub.community/organization-requests/${id}/logo`,
  });
});
