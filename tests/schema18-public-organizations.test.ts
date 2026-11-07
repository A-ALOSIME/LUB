import { PGlite } from "@electric-sql/pglite";
import { sql, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { storageFixture } from "./storage-fixture";
import { discoverySchema } from "@/features/organizations/validation";

let db: PGlite;
let sourceReads = 0;
const org = "a0000000-0000-4000-8000-000000000100";
const leader = "a0000000-0000-4000-8000-000000000001";

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () => ({
  withVisitor: async <T>(read: (tx: { execute: (query: SQL) => Promise<unknown[]> }) => Promise<T>) =>
    drizzle(db).transaction(async tx => {
      await tx.execute(sql`set local role anon`);
      return read({ execute: async query => { sourceReads++; return (await tx.execute(query)).rows; } });
    }),
}));
import { getPublicDirectory, getPublicOrganization } from "@/features/organizations/public-repository";

beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;");
  await storageFixture(db);
  for (const file of ["schema18", "administration18", "forms18", "form-library18", "campaigns18", "hours18", "tasks18", "assets18", "announcements18", "events18", "organization-public18"]) {
    await db.exec(readFileSync(`scripts/schema-simplification/${file}.sql`, "utf8"));
  }
  await db.exec(`
insert into auth.users values ('a0000000-0000-4000-8000-000000000001'),('a0000000-0000-4000-8000-000000000002');
insert into lub.users(id,email,email_verified_at,full_name_ar,full_name_en,university_id_ciphertext,university_id_lookup_hash,major_name,academic_level,onboarded_at)
select id,'test-'||right(id::text,1)||'@example.invalid',now(),'القائد','Student leader','private-envelope',repeat(right(id::text,1),64),'الحاسب','5',now() from auth.users;
insert into lub.organizations(id,type_code,slug,name_ar,name_en,summary,summary_en,mission,mission_en,interests,links,public_profile_content)
values ('a0000000-0000-4000-8000-000000000100','Club','tech','نادي التقنية','Technology Club','نبذة','A summary','رسالة','A mission',
'["تقنية"," تقنية ",{"private":"hidden"}]','[{"id":"a0000000-0000-4000-8000-000000000300","kind":"Email","value":"club@example.invalid"},{"id":"a0000000-0000-4000-8000-000000000301","kind":"Website","value":"https://user:private@example.invalid"},{"id":"a0000000-0000-4000-8000-000000000302","kind":"Phone","value":"+966 512345678"}]',
'{"vision":"رؤية","goals":"أهداف","internalSecret":"hidden","fields":{"private":"hidden"}}');
insert into lub.organizations(type_code,slug,name_ar,status_code,archived_at) values ('Council','history','المجلس السابق','Archived',now());
insert into lub.organization_memberships(id,organization_id,user_id)
select ('a0000000-0000-4000-8000-00000000020'||right(id::text,1))::uuid,'a0000000-0000-4000-8000-000000000100',id from auth.users;
insert into lub.access_assignments(user_id,organization_id,organization_membership_id,role_code,assigned_by_user_id)
values ('a0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000100','a0000000-0000-4000-8000-000000000201','OL','a0000000-0000-4000-8000-000000000001'),
('a0000000-0000-4000-8000-000000000002',null,null,'SA','a0000000-0000-4000-8000-000000000002');
insert into lub.committees(id,organization_id,name,is_public) values
('a0000000-0000-4000-8000-000000000400','a0000000-0000-4000-8000-000000000100','لجنة سرية',false),
('a0000000-0000-4000-8000-000000000401','a0000000-0000-4000-8000-000000000100','لجنة عامة',true);
update lub.committees set parent_committee_id='a0000000-0000-4000-8000-000000000400',name_en='Public committee' where id='a0000000-0000-4000-8000-000000000401';
`);
}, 30000);
afterAll(async () => { await db?.close(); });

it("reads a public DTO once with allowlisted links, leadership and profile fields", async () => {
  sourceReads = 0;
  const page = await getPublicOrganization("tech");
  expect(sourceReads).toBe(1);
  expect(page?.organization).toMatchObject({
    nameEn: "Technology Club", summaryEn: "A summary", missionEn: "A mission",
    tags: ["تقنية"], memberCount: 1, publicProfileContent: { vision: "رؤية", goals: "أهداف" },
  });
  expect(page?.organization.publicProfileContent).toEqual({ vision: "رؤية", goals: "أهداف" });
  expect(page?.leadership).toEqual([{ fullName: "القائد", fullNameEn: "Student leader", roleCode: "OL" }]);
  expect(page?.committees).toMatchObject([{ nameEn: "Public committee", parentCommitteeId: null }]);
  expect(page?.contacts.map(contact => contact.url)).toEqual(["mailto:club@example.invalid", "tel:+966512345678"]);
  expect(JSON.stringify(page)).not.toMatch(/private-envelope|internalSecret|example.invalid.*test-|لجنة سرية/);
  const [privileges] = (await db.query("select has_table_privilege('anon','lub.users','select') as accounts,has_function_privilege('anon','lub.organization_public_rounds(uuid)','execute') as raw_rounds")).rows;
  expect(privileges).toEqual({ accounts: false, raw_rounds: false });

  await db.query("update lub.organizations set show_leadership_publicly=false where id=$1", [org]);
  try {
    expect((await getPublicOrganization("tech"))?.leadership).toEqual([]);
  } finally {
    await db.query("update lub.organizations set show_leadership_publicly=true where id=$1", [org]);
  }
});

it("finds bilingual names and text interests literally, keeping archive links accessible", async () => {
  sourceReads = 0;
  expect((await getPublicDirectory(discoverySchema.parse({ q: "technology", tag: "تقنية" }))).organizations.map(row => row.id)).toEqual([org]);
  expect(sourceReads).toBe(1);
  expect((await getPublicDirectory(discoverySchema.parse({ q: "%" }))).organizations).toEqual([]);
  expect((await getPublicDirectory(discoverySchema.parse({ type: "Council" }))).organizations).toEqual([]);
  expect((await getPublicDirectory(discoverySchema.parse({ type: "Council", inactive: "on" }))).organizations.map(row => row.slug)).toEqual(["history"]);
  expect((await getPublicOrganization("history"))?.organization.statusCode).toBe("Archived");
  expect(await getPublicOrganization("../history")).toBeUndefined();
  expect(await getPublicOrganization("unknown")).toBeUndefined();
});

it("publishes only visible content and selects the open campaign with a published form", async () => {
  const { initialDefinition } = await import("@/features/forms/definition");
  expect((await getPublicDirectory(discoverySchema.parse({ upcoming: "on", open: "on" }))).organizations).toEqual([]);
  await db.query("insert into lub.organization_content(organization_id,kind,title,title_en,body,body_en,status_code,published_at,pinned_at) values ($1,'Announcement','مثبت','Pinned','النص','The text','Published',now(),now()),($1,'Announcement','مسودة',null,'سر','','Draft',null,null),($1,'Announcement','مجدول',null,'سر','','Published',now()+interval '1 day',null)", [org]);
  await db.query("insert into lub.organization_content(organization_id,kind,title,title_en,status_code,published_at,is_featured,starts_at,ends_at,registration_opens_at,registration_closes_at) values ($1,'Event','فعالية','Public event','Published',now(),true,now()+interval '2 days',now()+interval '3 days',now()-interval '1 hour',now()+interval '1 day'),($1,'Event','فعالية مخفية',null,'Draft',null,false,now()+interval '2 days',now()+interval '3 days',now()-interval '1 hour',now()+interval '1 day')", [org]);
  expect((await getPublicOrganization("tech"))?.rounds).toEqual([]);

  const { form, round } = await drizzle(db).transaction(async tx => {
    await tx.execute(sql`select set_config('request.jwt.claim.sub',${leader},true)`);
    await tx.execute(sql`set local role authenticated`);
    const { rows: [{ id: form }] } = await tx.execute<{ id: string }>(sql`select lub.create_form(${org}::uuid,'نموذج عام',null) id`);
    await tx.execute(sql`select lub.save_form_draft(${form}::uuid,${JSON.stringify(initialDefinition)}::jsonb,1)`);
    await tx.execute(sql`select lub.publish_form_version(${form}::uuid)`);
    const { rows: [{ id: round }] } = await tx.execute<{ id: string }>(sql`select lub.save_registration_round(null,${org}::uuid,${form}::uuid,'فتح التسجيل',now()-interval '1 hour',now()+interval '1 day',true,true) id`);
    return { form, round };
  });
  await db.query("update lub.membership_campaigns set title_en='Open registration',minimum_hours=2 where id=$1", [round]);

  const detail = await getPublicOrganization("tech");
  expect(detail?.upcomingEvents).toMatchObject([{ title_en: "Public event", featured: true, has_poster: false }]);
  expect(detail?.announcements).toMatchObject([{ title_en: "Pinned", body_en: "The text", pinned: true }]);
  expect(detail?.rounds).toMatchObject([{ id: round, title_en: "Open registration", open: true, minimum_approved_hours: 2 }]);
  expect(JSON.stringify(detail)).not.toContain(form);
  expect((await getPublicDirectory(discoverySchema.parse({ upcoming: "on", open: "on" }))).organizations.map(row => row.id)).toEqual([org]);

  await drizzle(db).transaction(async tx => {
    await tx.execute(sql`select set_config('request.jwt.claim.sub',${leader},true)`);
    await tx.execute(sql`set local role authenticated`);
    await tx.execute(sql`select lub.change_round_status(${round}::uuid,'Closed')`);
  });
  expect((await getPublicOrganization("tech"))?.rounds).toMatchObject([{ id: round, open: false, status_code: "Closed" }]);
  expect((await getPublicDirectory(discoverySchema.parse({ open: "on" }))).organizations).toEqual([]);
});

it("returns disjoint pages of 24 organizations with a deterministic tie-break", async () => {
  await db.exec("insert into lub.organizations(type_code,slug,name_ar) select 'Club','test-page-'||n,'نادي التجربة' from generate_series(1,26) n");
  const first = await getPublicDirectory(discoverySchema.parse({ q: "التجربة" }));
  const second = await getPublicDirectory(discoverySchema.parse({ q: "التجربة", page: 2 }));
  expect(first.organizations).toHaveLength(24);
  expect(second.organizations).toHaveLength(2);
  expect(first.hasNext).toBe(true);
  expect(second.hasNext).toBe(false);
  expect(new Set([...first.organizations, ...second.organizations].map(row => row.id)).size).toBe(26);
});
