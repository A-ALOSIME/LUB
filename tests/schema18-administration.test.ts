import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import type { SQL } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";

let database: PgliteDatabase;
let sourceReads=0;
vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () => ({
  withUser: async <T>(owner: string, operation: (tx: { execute: (query: SQL) => Promise<Record<string, unknown>[]> }) => Promise<T>) => {
    const [prior]=(await db.query<{role:string;subject:string}>("select current_setting('role') role,current_setting('request.jwt.claim.sub',true) subject")).rows;
    await db.exec("savepoint source_read");
    try{
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('role','authenticated',true)", [owner]);
      const result=await operation({execute:async query=>{sourceReads++;return (await database.execute(query)).rows;}});
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('role',$2,true)",[prior.subject??"",prior.role]);
      await db.exec("release savepoint source_read");
      return result;
    }catch(error){await db.exec("rollback to savepoint source_read;release savepoint source_read");throw error;}
  },
}));
import {createOrganization,getManagementOverview,getAdminAccountProfile,updateAdminAccountName,getManagementOrganization,saveOrganizationProfile,saveOrganizationLogo,saveCommittee,copyCommittee,setCommitteeStatus} from "@/features/organizations/management-repository";
import { adminDirectory } from "@/features/organizations/admin-directory-repository";
import { openingRequests, ownOpeningRequest } from "@/features/organization-requests/repository";

import { storageFixture } from "./storage-fixture";
import { organizationProfileSchema } from "@/features/organizations/validation";

const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let db: PGlite;
async function actor(n: number) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('role','authenticated',true)", [id(n)]);
}
async function denied(run: () => Promise<unknown>) {
  await db.exec("savepoint denied"); await expect(run()).rejects.toThrow(); await db.exec("rollback to savepoint denied; release savepoint denied");
}
beforeAll(async () => {
  db = new PGlite();
  database = drizzle(db);
  await db.exec("create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;");
  await db.exec(readFileSync("scripts/schema-simplification/schema18.sql", "utf8"));
  await db.exec(readFileSync("scripts/schema-simplification/administration18.sql", "utf8"));
  await db.exec(readFileSync("scripts/schema-simplification/opening18.sql", "utf8"));
  await storageFixture(db);
  await db.exec(readFileSync("scripts/schema-simplification/organization-editor18.sql", "utf8"));
}, 30000);
beforeEach(async () => {
  sourceReads=0;await db.exec("begin");
  for (let n = 1; n <= 5; n++) {
    await db.query("insert into auth.users values($1)", [id(n)]);
    await db.query("insert into lub.users(id,email,email_verified_at,full_name_ar,university_id_ciphertext,university_id_lookup_hash,major_name,academic_level,onboarded_at) values($1,$2,now(),$3,'encrypted',$4,'نظم معلومات','5',now())", [id(n), `admin18-${n}@example.invalid`, `طالب ${n}`, String(n).repeat(64)]);
  }
  await db.query("insert into lub.access_assignments(user_id,role_code,assigned_by_user_id) values($1,'SA',$1)", [id(1)]);
});
afterEach(async () => { await db.exec("rollback"); });
afterAll(async () => { await db?.close(); });

async function create(slug = "new-club", email: string | null = null) {
  return (await db.query<{ id: string }>("select lub.admin_create_organization('جهة الاختبار','Club',$1,'نبذة','رسالة',$2) id", [slug, email])).rows[0].id;
}
it("loads the actual authenticated workspace shell once per actor and request without leaking administrator counts",async()=>{
 await actor(1);const org=await create("active-club","admin18-2@example.invalid");
 const archived=await db.query<{id:string}>("select lub.admin_create_organization('جهة مؤرشفة','Club','archived-club','','',null) id");
 await db.query("select lub.set_organization_status($1,'Archived')",[archived.rows[0].id]);
 const request="schema18-overview-proof",first=getManagementOverview(id(1),request);
 expect(getManagementOverview(id(1),request)).toBe(first);
 const dashboard=await first;
 expect(sourceReads).toBe(1);
 expect(dashboard.access).toEqual({superAdmin:true,organizations:[]});
 expect(dashboard.summary).toEqual({activeOrganizations:1,archivedOrganizations:1,administrators:1});
 const leader=await getManagementOverview(id(2),request);
 expect(sourceReads).toBe(2);
 expect(leader.access).toMatchObject({superAdmin:false,organizations:[{id:org,canTasks:true,canApplications:true}]});
 expect(leader.summary).toEqual({activeOrganizations:0,archivedOrganizations:0,administrators:0});
 expect((await db.query<{subject:string}>("select auth.uid() subject")).rows[0].subject).toBe(id(1));
});

it("reads the administrator's own account once and checks authorization on display-name writes",async()=>{
 expect(await getAdminAccountProfile(id(1))).toEqual({email:"admin18-1@example.invalid",fullName:"طالب 1"});
 expect(sourceReads).toBe(1);
 await updateAdminAccountName(id(1),"مشرف النظام الجديد");
 expect(await getAdminAccountProfile(id(1))).toEqual({email:"admin18-1@example.invalid",fullName:"مشرف النظام الجديد"});
 await expect(getAdminAccountProfile(id(2))).rejects.toThrow("FORBIDDEN");
 await expect(updateAdminAccountName(id(2),"اسم غير مصرح")).rejects.toThrow("FORBIDDEN");
 await actor(2);await denied(()=>db.query("select lub.update_admin_display_name('اسم غير مصرح')"));
});
it("creates one organization and appoints/replaces/removes its president without duplicating membership", async () => {
  await actor(1); const org = await create("new-club", "admin18-2@example.invalid");
  await db.query("select lub.set_primary_leader($1,'admin18-2@example.invalid')", [org]);
  let snapshot = (await db.query<{ data: { organizations: Array<{ id: string; leaderName: string; memberCount: number }> } }>("select lub.admin_directory_snapshot() data")).rows[0].data;
  expect(snapshot.organizations).toHaveLength(1); expect(snapshot.organizations[0]).toMatchObject({ id: org, leaderName: "طالب 2", memberCount: 1 });
  await db.query("select lub.set_primary_leader($1,'admin18-3@example.invalid')", [org]);
  snapshot = (await db.query<{ data: typeof snapshot }>("select lub.admin_directory_snapshot() data")).rows[0].data;
  expect(snapshot.organizations[0]).toMatchObject({ leaderName: "طالب 3", memberCount: 2 });
  await db.query("select lub.remove_primary_leader($1)", [org]);
  expect((await db.query<{ data: typeof snapshot }>("select lub.admin_directory_snapshot() data")).rows[0].data.organizations[0].leaderName).toBeNull();
  await db.exec("reset role");
  expect((await db.query<{ count: number }>("select count(*)::int count from lub.organization_memberships where organization_id=$1", [org])).rows[0].count).toBe(2);
  expect((await db.query<{ count: number }>("select count(*)::int count from lub.access_assignments where role_code='OL' and end_at is null")).rows[0].count).toBe(0);
});
it("rolls back creation with an invalid candidate and rejects duplicate names and slugs", async () => {
  await actor(1);
  await denied(() => create("failed-club", "missing@example.invalid"));
  expect((await db.query<{ data: { organizations: unknown[] } }>("select lub.admin_directory_snapshot() data")).rows[0].data.organizations).toEqual([]);
  await create();
  await denied(() => create("different-slug"));
  await denied(() => db.query("select lub.admin_create_organization('جهة ثانية','Club','new-club','','',null)"));
});
it("enforces server authorization, verified completed candidates and private directory projections", async () => {
  await db.query("update lub.users set onboarded_at=null where id=$1", [id(4)]);
  await db.query("update lub.users set status_code='Inactive' where id=$1", [id(5)]);
  await actor(1); const org = await create();
  for (const n of [1, 4, 5]) await denied(() => db.query("select lub.set_primary_leader($1,$2)", [org, `admin18-${n}@example.invalid`]));
  const candidates = (await db.query<{ data: Array<Record<string, unknown>> }>("select lub.admin_leader_candidates('admin18-') data")).rows[0].data;
  expect(candidates).toHaveLength(2); expect(Object.keys(candidates[0]).sort()).toEqual(["email", "major", "name"]);
  await actor(2); await denied(() => create()); await denied(() => db.query("select lub.admin_directory_snapshot()"));
  await denied(() => db.query("select lub.set_organization_status($1,'Inactive')", [org]));
  await db.exec("reset role;set local role anon"); await denied(() => db.query("select lub.admin_leader_candidates('admin')"));
});
it("preserves leadership across suspension and archive/restore with correct counts", async () => {
  await actor(1); const org = await create("new-club", "admin18-2@example.invalid");
  for (const state of ["Inactive", "Archived", "Active"]) {
    await db.query("select lub.set_organization_status($1,$2)", [org, state]);
    const data = (await db.query<{ data: { organizations: Array<{ statusCode: string; leaderName: string }>; counts: Record<string, number> } }>("select lub.admin_directory_snapshot() data")).rows[0].data;
    expect(data.organizations[0]).toMatchObject({ statusCode: state, leaderName: "طالب 2" }); expect(data.counts[state]).toBe(1);
    await actor(2); expect((await db.query<{ ok: boolean }>("select lub.has_org_permission($1,'ORG_PROFILE_MANAGE') ok", [org])).rows[0].ok).toBe(state === "Active"); await actor(1);
  }
});
it("serializes administrator changes, forbids self-removal and excludes administrators from student roles", async () => {
  await actor(1); await denied(() => db.query("select lub.end_super_admin($1)", [id(1)]));
  await db.query("select lub.grant_super_admin('admin18-2@example.invalid')"); await db.query("select lub.grant_super_admin('admin18-2@example.invalid')");
  expect((await db.query<{ email: string }>("select * from lub.admin_account_directory()")).rows.map(r => r.email)).toEqual(["admin18-1@example.invalid", "admin18-2@example.invalid"]);
  await actor(2); await db.query("select lub.end_super_admin($1)", [id(1)]);
  await actor(1); await denied(() => db.query("select lub.grant_super_admin('admin18-3@example.invalid')"));
  await actor(2); const org = await create(); await denied(() => db.query("select lub.set_primary_leader($1,'admin18-2@example.invalid')", [org]));
  expect((await db.query<{ ok: boolean }>("select lub.is_student_account($1) ok", [id(2)])).rows[0].ok).toBe(false);
});

it("accepts an opening request atomically once, stores interests inline and notifies its applicant", async () => {
  await actor(2);
  const request = (await db.query<{ id: string }>("select lub.submit_organization_request('نادي الطلب','Club','نبذة','أهداف','[\"برمجة\"]'::jsonb,null) id")).rows[0].id;
  await denied(() => db.query("select lub.submit_organization_request('نادي ثان','Club','نبذة','أهداف','[]',null)"));
  await actor(3); await denied(() => db.query("select lub.decide_organization_request($1,'Accepted','')", [request]));
  await actor(1);
  const org = (await db.query<{ id: string }>("select lub.decide_organization_request($1,'Accepted','') id", [request])).rows[0].id;
  await denied(() => db.query("select lub.decide_organization_request($1,'Accepted','')", [request]));
  expect((await db.query<{ data: { organizations: unknown[]; requests: Array<{ status_code: string; organization_slug: string }>; counts: Record<string, number> } }>("select lub.admin_directory_snapshot() data")).rows[0].data).toMatchObject({ organizations: [expect.objectContaining({ id: org, leaderName: "طالب 2" })], requests: [expect.objectContaining({ status_code: "Accepted" })], counts: { Accepted: 1, Pending: 0 } });
  await actor(2);
  expect((await db.query<{ data: { items: Array<{ id: string; status_code: string }> } }>("select lub.organization_request_workspace(true,null,0) data")).rows[0].data.items).toMatchObject([{ id: request, status_code: "Accepted" }]);
  expect((await db.query<{ notifications: Array<{ targetUrl: string }> }>("select notifications from lub.users where id=$1", [id(2)])).rows[0].notifications).toMatchObject([{ targetUrl: "/applications?tab=organizations" }]);
  await db.exec("reset role"); expect((await db.query<{ interests: string[] }>("select interests from lub.organizations where id=$1", [org])).rows[0].interests).toEqual(["برمجة"]);
});
it("requires a rejection reason and restricts withdrawal to the pending request owner", async () => {
  await actor(2); const request = (await db.query<{ id: string }>("select lub.submit_organization_request('نادي الطلب','Club','نبذة','أهداف','[]',null) id")).rows[0].id;
  await actor(3); await denied(() => db.query("select lub.withdraw_organization_request($1)", [request]));
  await denied(() => db.query("select lub.organization_request_workspace(false,null,0)"));
  expect((await db.query<{ data: { items: unknown[] } }>("select lub.organization_request_workspace(true,null,0) data")).rows[0].data.items).toEqual([]);
  await actor(1); await denied(() => db.query("select lub.decide_organization_request($1,'Rejected','   ')", [request]));
  await db.query("select lub.decide_organization_request($1,'Rejected','الطلب غير مكتمل')", [request]);
  await actor(2); await denied(() => db.query("select lub.withdraw_organization_request($1)", [request]));
  const next = (await db.query<{ id: string }>("select lub.submit_organization_request('نادي آخر','Club','نبذة','أهداف','[]',null) id")).rows[0].id;
  await db.query("select lub.withdraw_organization_request($1)", [next]);
  expect((await db.query<{ data: { items: Array<{ status_code: string }> } }>("select lub.organization_request_workspace(true,'Withdrawn',0) data")).rows[0].data.items).toMatchObject([{ status_code: "Withdrawn" }]);
});

it("serves the existing administrative/request repositories from the actual 18-table schema", async () => {
  await actor(2); const request = (await db.query<{ id: string }>("select lub.submit_organization_request('نادي الطلب','Club','نبذة','أهداف','[]',null) id")).rows[0].id;
  expect((await openingRequests(id(2), true))?.items).toMatchObject([{ id: request, status_code: "Pending", applicant_name: "طالب 2" }]);
  expect(await ownOpeningRequest(id(3), request)).toBeUndefined();
  expect(await ownOpeningRequest(id(2), request)).toMatchObject({ id: request, name_ar: "نادي الطلب" });
  const directory = await adminDirectory(id(1));
  expect(directory).toMatchObject({ organizations: [], requests: [expect.objectContaining({ id: request })], counts: { Pending: 1 } });
  expect(await adminDirectory(id(2))).toBeNull();
});
it("creates academic terms with server-side inclusive overlap and complete-period checks", async () => {
  await actor(2); await denied(() => db.query("select lub.create_academic_term('2026-2027','T1','الفصل الأول','2026-09-01','2026-12-31')"));
  await actor(1); await db.query("select lub.create_academic_term('2026-2027','T1','الفصل الأول','2026-09-01','2026-12-31')");
  await denied(() => db.query("select lub.create_academic_term('2026-2027','T2','الفصل الثاني','2026-12-31','2027-03-01')"));
  await denied(() => db.query("select lub.create_academic_term('2026-2027','T2','الفصل الثاني','2027-04-01','2027-03-01')"));
  await denied(() => db.query("select lub.create_academic_term('2026-2027','T2','الفصل الثاني','2027-01-01',null)"));
  await db.query("select lub.create_academic_term('2026-2027','T2','الفصل الثاني','2027-01-01','2027-03-01')");
  await db.query("select lub.create_academic_term('2026-2027','T3','فترة قصيرة','2027-06-01','2027-06-01')");
  expect((await db.query("select * from lub.academic_terms")).rows).toHaveLength(3);
});
it("projects management navigation from real scoped roles without exposing private account data", async () => {
  await actor(1); const org = await create("new-club", "admin18-2@example.invalid");
  await actor(2);
  const data = (await db.query<{ data: { readiness: { onboarded: boolean }; access: { superAdmin: boolean; organizations: Array<Record<string, unknown>> }; summary: Record<string, number> } }>("select lub.management_overview() data")).rows[0].data;
  expect(data.readiness.onboarded).toBe(true); expect(data.access.organizations).toMatchObject([{ id: org, canEdit: true, canTasks: true, canHours: true, pendingApplications: 0 }]);
  expect(data.summary).toEqual({ activeOrganizations: 0, archivedOrganizations: 0, administrators: 0 });
  const serialized = JSON.stringify(data); for (const secret of ["@example.invalid", "encrypted", "notifications", "university_id"]) expect(serialized).not.toContain(secret);
  await actor(3); expect((await db.query<{ data: typeof data }>("select lub.management_overview() data")).rows[0].data.access.organizations).toEqual([]);
  await actor(1); expect((await db.query<{ data: typeof data }>("select lub.management_overview() data")).rows[0].data).toMatchObject({ access: { superAdmin: true, organizations: [] }, summary: { activeOrganizations: 1, administrators: 1 } });
});


it("creates through the application repository and limits identity changes to the super administrator", async () => {
  const input = { nameAr: "نادي البرمجة", nameEn: "Programming Club", slug: "programming-club", typeCode: "Club" as const, summary: "", mission: "" };
  await expect(createOrganization(id(2), input)).rejects.toThrow();
  await expect(createOrganization(id(1), input, "missing@example.invalid")).rejects.toThrow();
  const created = await createOrganization(id(1), input, "admin18-2@example.invalid");
  expect((await db.query("select name_en,slug from lub.organizations where id=$1", [created.id])).rows).toEqual([{ name_en: input.nameEn, slug: input.slug }]);
  expect((await adminDirectory(id(1)))?.organizations).toMatchObject([{ id: created.id, leaderName: "طالب 2", memberCount: 1 }]);
  await expect(createOrganization(id(1), { ...input, nameAr: "نادي آخر" })).rejects.toThrow();
  await expect(createOrganization(id(1), { ...input, slug: "mismatched-slug", nameAr: "اسم آخر" })).rejects.toThrow();
  await actor(2);
  await denied(() => db.query("select lub.admin_update_organization_identity($1,'renamed','Council')", [created.id]));
  await denied(() => db.query("update lub.organizations set slug='forged' where id=$1", [created.id]));
  await actor(1);
  await db.query("select lub.admin_update_organization_identity($1,'renamed','Council')", [created.id]);
  expect((await adminDirectory(id(1)))?.organizations).toMatchObject([{ id: created.id, slug: "renamed", typeCode: "Council", leaderName: "طالب 2" }]);
});

it("writes and reads inline organization profiles within the editor scope", async () => {
  await actor(1);
  const org = await create("editor-club", "admin18-2@example.invalid");
  const profile = organizationProfileSchema.parse({ nameAr: "جهة الاختبار بعد التعديل", summary: "نبذة جديدة",
    mission: "رسالة جديدة", tagNames: "التقنية، تطوع", contacts: JSON.stringify([{ kind: "Email", value: "club@example.invalid" }]),
    showLeadershipPublicly: false, publicProfileContent: { vision: "الرؤية" } });
  expect(await getManagementOrganization(id(1), org)).toBeUndefined();
  expect(await getManagementOrganization(id(3), org)).toBeUndefined();
  expect((await getManagementOrganization(id(1), org, true))?.organization).toMatchObject({ canEdit: true, canManageCommittees: false, canTasks: false });
  await expect(saveOrganizationProfile(id(3), org, profile)).rejects.toThrow();
  await expect(saveOrganizationProfile(id(2), org, { ...profile, tagNames: ["x".repeat(41)] })).rejects.toThrow();
  await saveOrganizationProfile(id(2), org, profile);
  sourceReads = 0;
  expect(await getManagementOrganization(id(2), org)).toMatchObject({
    organization: { nameAr: profile.nameAr, summary: profile.summary, showLeadershipPublicly: false, publicProfileContent: { vision: "الرؤية" } },
    tagNames: ["التقنية", "تطوع"], contacts: [{ linkType: "Email", url: "mailto:club@example.invalid" }],
  });
  expect(sourceReads).toBe(1);
});

it("copies a committee without participants and prevents cross-organization writes and deeper nesting", async () => {
  await actor(1);
  const org = await create("committees-club", "admin18-2@example.invalid");
  const other = (await db.query<{ id: string }>("select lub.admin_create_organization('الجهة الثانية','Club','other-club','','',null) id")).rows[0].id;
  const root = await saveCommittee(id(2), org, { name: "لجنة التقنية", description: "شرح اللجنة", isPublic: true, parentCommitteeId: null });
  const child = await saveCommittee(id(2), org, { name: "لجنة البرمجة", description: "شرح فرعي", isPublic: false, parentCommitteeId: root.id });
  const copied = await copyCommittee(id(2), org, child.id);
  await expect(saveCommittee(id(2), org, { name: "مستوى ثالث", description: "", isPublic: false, parentCommitteeId: child.id })).rejects.toThrow();
  await expect(copyCommittee(id(2), other, child.id)).rejects.toThrow();
  await expect(setCommitteeStatus(id(3), org, child.id, "Archived")).rejects.toThrow();
  await setCommitteeStatus(id(2), org, copied.id, "Archived");
  expect((await getManagementOrganization(id(2), org))?.committees).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: root.id, parentCommitteeId: null, memberCount: 0 }),
    expect.objectContaining({ id: child.id, parentCommitteeId: root.id, description: "شرح فرعي", isPublic: false }),
    expect.objectContaining({ id: copied.id, copiedFromCommitteeId: child.id, parentCommitteeId: root.id, statusCode: "Archived" }),
  ]));
  await setCommitteeStatus(id(2), org, copied.id, "Active");
  expect((await getManagementOrganization(id(2), org))?.committees.find(c => c.id === copied.id)?.statusCode).toBe("Active");
});

it("accepts an uploaded logo only for the editor and the matching organization path", async () => {
  await actor(1);
  const org = await create("logo-club", "admin18-2@example.invalid");
  const object = `organizations/${org}/${id(1000)}.png`;
  const url = `https://storage.example.invalid/storage/v1/object/public/lub-organization-logos/${object}`;
  await expect(saveOrganizationLogo(id(2), org, url)).rejects.toThrow();
  await actor(3);
  await denied(() => db.query("insert into storage.objects(bucket_id,name,owner_id) values('lub-organization-logos',$1,$2)", [object,id(3)]));
  await actor(2);
  await db.query("insert into storage.objects(bucket_id,name,owner_id) values('lub-organization-logos',$1,$2)", [object,id(2)]);
  expect(await saveOrganizationLogo(id(2), org, url)).toEqual({ previousLogoUrl: "", slug: "logo-club" });
  await expect(saveOrganizationLogo(id(3), org, "")).rejects.toThrow();
  expect(await saveOrganizationLogo(id(1), org, "")).toEqual({ previousLogoUrl: url, slug: "logo-club" });
});
