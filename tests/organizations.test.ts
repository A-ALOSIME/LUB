import { storageFixture } from "./storage-fixture";
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { beforeAll, beforeEach, afterAll, afterEach, expect, it } from "vitest";

const admin = "00000000-0000-4000-8000-000000000001";
const leader = "00000000-0000-4000-8000-000000000002";
const deputy = "00000000-0000-4000-8000-000000000003";
const committeeLeader = "00000000-0000-4000-8000-000000000004";
const outsider = "00000000-0000-4000-8000-000000000005";
const org = "00000000-0000-4000-8000-000000000101";
const otherOrg = "00000000-0000-4000-8000-000000000102";
const committee = "00000000-0000-4000-8000-000000000201";
const hiddenCommittee = "00000000-0000-4000-8000-000000000202";
let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
    insert into auth.users values ('${admin}'),('${leader}'),('${deputy}'),('${committeeLeader}'),('${outsider}');`);
  await storageFixture(db);
  for (const file of readdirSync("drizzle").filter(x => x.endsWith(".sql")).sort()) await db.exec(readFileSync(`drizzle/${file}`, "utf8"));
}, 30000);
beforeEach(async () => {
  await db.exec("begin");
  for (const [index, id] of [admin, leader, deputy, committeeLeader, outsider].entries()) {
    await db.query("insert into lub.users(id,email,email_verified_at) values ($1,$2,now())", [id, `student${index}@example.invalid`]);
    await db.query("insert into lub.student_profiles(user_id,full_name_ar,university_id_ciphertext,university_id_lookup_hash,major_name,academic_level) values($1,$2,'private',$3,'الحاسب','4')", [id, `طالب ${index}`, String(index).repeat(64)]);
  }
  await db.query("insert into lub.global_role_assignments(user_id,role_code,assigned_by_user_id) values($1,'SA',$1)", [admin]);
  await db.query("insert into lub.organizations(id,type_code,slug,name_ar) values($1,'Club','tech','نادي التقنية'),($2,'Council','council','المجلس الطلابي')", [org, otherOrg]);
  await db.query("insert into lub.committees(id,organization_id,name,is_public) values($1,$3,'التقنية',true),($2,$3,'الداخلية',false)", [committee, hiddenCommittee, org]);
  for (const [user, role, scope] of [[leader, "OL", null], [deputy, "OD", null], [committeeLeader, "CL", committee]] as const) {
    const { rows } = await db.query<{ id: string }>("insert into lub.organization_memberships(organization_id,user_id) values($1,$2) returning id", [org, user]);
    await db.query("insert into lub.role_assignments(organization_membership_id,organization_id,committee_id,role_code,is_primary_leader,assigned_by_user_id) values($1,$2,$3,$4,$5,$6)", [rows[0].id, org, scope, role, role === "OL", admin]);
  }
}, 30000);
afterEach(async () => { await db.exec("rollback"); });
afterAll(async () => { await db.close(); });
async function asUser(id: string) { await db.query("select set_config('request.jwt.claim.sub',$1,true)", [id]); await db.exec("set local role authenticated"); }
async function permission(code: string, scope: string | null = null, organization = org) {
  return (await db.query<{ allowed: boolean }>("select lub.has_org_permission($1,$2,$3) as allowed", [organization, code, scope])).rows[0].allowed;
}

it("lets anonymous visitors read organizations and public committees without private student access", async () => {
  await db.exec("set local role anon");
  expect((await db.query("select slug from lub.organizations order by slug")).rows).toHaveLength(2);
  expect((await db.query("select name from lub.committees")).rows).toEqual([{ name: "التقنية" }]);
  expect((await db.query("select * from lub.public_leadership($1)", [org])).rows).toEqual([{ full_name: "طالب 1", role_code: "OL" }, { full_name: "طالب 2", role_code: "OD" }]);
  await expect(db.exec("select email from lub.users")).rejects.toThrow();
});
it("gives SA lifecycle powers but no daily operating powers", async () => {
  await asUser(admin);
  expect((await db.query<{ yes: boolean }>("select lub.is_super_admin() as yes")).rows[0].yes).toBe(true);
  expect(await permission("ORG_PROFILE_MANAGE")).toBe(false);
  expect(await permission("COMMITTEE_MANAGE")).toBe(false);
  expect((await db.query("update lub.organizations set summary='forbidden' where id=$1 returning id", [org])).rows).toHaveLength(0);
});
it("gives leader/deputy organization scope and committee leaders only their own committee", async () => {
  await asUser(deputy);
  expect(await permission("COMMITTEE_MANAGE")).toBe(true);
  expect(await permission("COMMITTEE_MANAGE", null, otherOrg)).toBe(false);
  await db.exec("reset role"); await asUser(committeeLeader);
  expect(await permission("COMMITTEE_PROFILE_MANAGE", committee)).toBe(true);
  expect(await permission("COMMITTEE_PROFILE_MANAGE", hiddenCommittee)).toBe(false);
  expect(await permission("COMMITTEE_MANAGE")).toBe(false);
});
it("does not trust arbitrary capability names or grant primary-leader powers to a deputy", async () => {
  await asUser(deputy);
  expect(await permission("ORG_PRIMARY_LEADER_SET")).toBe(false);
  expect(await permission("TYPO_CAPABILITY")).toBe(false);
  await expect(db.query("select lub.set_primary_leader($1,$2)", [org, "student4@example.invalid"])).rejects.toThrow();
});
it("makes ended role and membership stop permissions immediately", async () => {
  await db.query("update lub.role_assignments set end_date=current_date where role_code='OL'");
  await asUser(leader);
  expect(await permission("ORG_PROFILE_MANAGE")).toBe(false);
  await db.exec("reset role");
  await db.query("update lub.organization_memberships set status_code='Ended',end_date=current_date where user_id=$1", [deputy]);
  await asUser(deputy);
  expect(await permission("COMMITTEE_MANAGE")).toBe(false);
});
it("combines grants only inside their active membership, duration and committee scope", async () => {
  const { rows } = await db.query<{ id: string }>("select id from lub.organization_memberships where user_id=$1", [committeeLeader]);
  await db.query("insert into lub.permission_grants(organization_membership_id,organization_id,committee_id,permission_code,granted_by_user_id,start_at) values($1,$2,$3,'COMMITTEE_PROFILE_MANAGE',$4,now()-interval '1 day')", [rows[0].id, org, hiddenCommittee, leader]);
  await asUser(committeeLeader);
  expect(await permission("COMMITTEE_PROFILE_MANAGE", hiddenCommittee)).toBe(true);
  expect(await permission("ORG_PROFILE_MANAGE")).toBe(false);
  await db.exec("reset role");
  await db.exec("update lub.permission_grants set end_at=now()-interval '1 second'");
  await asUser(committeeLeader);
  expect(await permission("COMMITTEE_PROFILE_MANAGE", hiddenCommittee)).toBe(false);
});
it("rejects a committee role that points outside its membership organization", async () => {
  const { rows } = await db.query<{ id: string }>("select id from lub.organization_memberships where user_id=$1", [leader]);
  await expect(db.query("insert into lub.role_assignments(organization_membership_id,organization_id,role_code,assigned_by_user_id) values($1,$2,'OD',$3)", [rows[0].id, otherOrg, admin])).rejects.toThrow();
});
it("allows public-profile editing without allowing leader status changes or deletes", async () => {
  await asUser(leader);
  expect((await db.query("update lub.organizations set summary='نبذة محدّثة' where id=$1 returning summary", [org])).rows).toEqual([{ summary: "نبذة محدّثة" }]);
  await expect(db.query("update lub.organizations set status_code='Inactive' where id=$1", [org])).rejects.toThrow();
});
it("keeps an archived historical page but disables organization operations", async () => {
  await asUser(admin);
  await db.query("select lub.set_organization_status($1,'Archived')", [org]);
  await db.exec("reset role"); await asUser(leader);
  expect(await permission("COMMITTEE_MANAGE")).toBe(false);
  await db.exec("reset role; set local role anon");
  expect((await db.query("select slug,status_code,archived_at is not null as archived from lub.organizations where id=$1", [org])).rows).toEqual([{ slug: "tech", status_code: "Archived", archived: true }]);
});
it("appoints a verified existing student atomically while preserving old membership and role history", async () => {
  await asUser(admin);
  await db.query("select lub.set_primary_leader($1,$2)", [org, "student4@example.invalid"]);
  await db.exec("reset role");
  const roles = await db.query("select m.user_id,r.end_date is null as active from lub.role_assignments r join lub.organization_memberships m on m.id=r.organization_membership_id where r.is_primary_leader order by active");
  expect(roles.rows).toEqual([{ user_id: leader, active: false }, { user_id: outsider, active: true }]);
  expect((await db.query("select status_code from lub.organization_memberships where user_id=$1", [leader])).rows).toEqual([{ status_code: "Active" }]);
  expect((await db.query("select entity_type from lub.audit_log where actor_user_id=$1", [admin])).rows.length).toBeGreaterThan(0);
});
it("rejects unknown leader and leaves the previous primary appointment intact", async () => {
  await asUser(admin);
  await db.exec("savepoint invalid_candidate");
  await expect(db.query("select lub.set_primary_leader($1,$2)", [org, "missing@example.invalid"])).rejects.toThrow();
  await db.exec("rollback to savepoint invalid_candidate; reset role");
  expect((await db.query("select m.user_id from lub.role_assignments r join lub.organization_memberships m on m.id=r.organization_membership_id where r.is_primary_leader and r.end_date is null")).rows).toEqual([{ user_id: leader }]);
});
it("prevents removing the last SA and permits a second SA without granting organization powers", async () => {
  await asUser(admin);
  await db.query("select lub.grant_super_admin($1)", ["student4@example.invalid"]);
  await db.query("select lub.end_super_admin($1)", [admin]);
  await db.exec("reset role"); await asUser(outsider);
  expect((await db.query<{ yes: boolean }>("select lub.is_super_admin() as yes")).rows[0].yes).toBe(true);
  expect(await permission("ORG_PROFILE_MANAGE")).toBe(false);
  await expect(db.query("select lub.end_super_admin($1)", [outsider])).rejects.toThrow();
});
it("hides leadership when organization publication is disabled", async () => {
  await db.query("update lub.organizations set show_leadership_publicly=false where id=$1", [org]);
  await db.exec("set local role anon");
  expect((await db.query("select * from lub.public_leadership($1)", [org])).rows).toHaveLength(0);
});
it("does not let students assign themselves roles or grants", async () => {
  await asUser(outsider);
  await expect(db.query("insert into lub.global_role_assignments(user_id,role_code,assigned_by_user_id) values($1,'SA',$1)", [outsider])).rejects.toThrow();
});

it("does not let SA alter public contacts as an indirect daily profile operation", async () => {
  await asUser(admin);
  await expect(db.query("insert into lub.organization_links(organization_id,link_type,url) values($1,'الموقع','https://example.com')", [org])).rejects.toThrow();
});
it("rejects copying a committee's identity reference to a different organization", async () => {
  await expect(db.query("insert into lub.committees(organization_id,name,copied_from_committee_id) values($1,'نسخة غير صالحة',$2)", [otherOrg, hiddenCommittee])).rejects.toThrow();
});
it("does not show private membership history to an inactive account", async () => {
  await db.query("update lub.users set status_code='Inactive' where id=$1", [leader]);
  await asUser(leader);
  expect((await db.query("select id from lub.organization_memberships")).rows).toHaveLength(0);
  expect(await permission("ORG_PROFILE_MANAGE")).toBe(false);
});
