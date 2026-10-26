import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import { applyMigrations, storageFixture } from "./storage-fixture";

let db: PGlite;
let publicSlug:string;
const owner = "00000000-0000-4000-8000-000000000001";
const peer = "00000000-0000-4000-8000-000000000002";
const org = "00000000-0000-4000-8000-000000000101";

async function actor(user: string) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('role','authenticated',true)", [user]);
}

async function visitor() {
  await db.exec("reset role");
  await db.exec("select set_config('request.jwt.claim.sub','',true);set local role anon");
}

async function denied(operation: () => Promise<unknown>) {
  await db.exec("savepoint denied");
  await expect(operation()).rejects.toThrow();
  await db.exec("rollback to savepoint denied;release savepoint denied");
}

async function profile() {
  const rows = await db.query<{ profile: Record<string, unknown> | null }>(
    "select lub.public_talent($1,0,0,0) as profile",
    [publicSlug],
  );
  return rows.rows[0].profile;
}

async function publish(enabled = true) {
  await db.query("select lub.save_talent_settings('نبذة الطالب',$1)", [enabled]);
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role lub_runtime;create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
  await storageFixture(db);
  await applyMigrations(db);
}, 30_000);

beforeEach(async () => {
  await db.exec("begin");
  for (const [index, user] of [owner, peer].entries()) {
    await db.query("insert into auth.users values($1)", [user]);
    await db.query("insert into lub.users(id,email,phone,email_verified_at) values($1,$2,$3,now())", [
      user,
      `private${index}@example.invalid`,
      `050000000${index}`,
    ]);
    await db.query(
      "insert into lub.student_profiles(user_id,full_name_ar,university_id_ciphertext,university_id_lookup_hash,major_name,academic_level) values($1,$2,'sensitive-cipher',$3,'الحاسب','4')",
      [user, `طالب ${index}`, String(index).repeat(64)],
    );
    await db.query("insert into lub.profile_settings(user_id) values($1)", [user]);
  }
  publicSlug=(await db.query<{public_slug:string}>("select public_slug from lub.profile_settings where user_id=$1",[owner])).rows[0].public_slug;
  await actor(owner);
});

afterEach(async () => { await db.exec("rollback"); });
afterAll(async () => { await db.close(); });

it("keeps profiles private until published and returns only public-safe identity fields", async () => {
  await visitor();
  expect(await profile()).toBeNull();
  await actor(owner);
  await publish();
  await visitor();
  expect((await profile())?.name).toBe("طالب 0");
  const serialized = JSON.stringify(await profile());
  expect(serialized).not.toMatch(/sensitive-cipher|private0|0500000000|lookup_hash|university_id/);
  await denied(() => db.query("select university_id_ciphertext from lub.student_profiles"));
  await actor(owner);
  await publish(false);
  await visitor();
  expect(await profile()).toBeNull();
  expect((await db.query("select * from lub.talent_directory('',null,0)")).rows).toEqual([]);
});

it("shows only contact channels and skills explicitly marked public", async () => {
  await publish();
  const link = (await db.query<{ id: string }>(
    "select lub.save_talent_link(null,'Email','البريد','contact@example.invalid',false) as id",
  )).rows[0].id;
  await db.query("select lub.save_talent_link(null,'Website','الموقع','https://example.invalid',true)");
  await db.query("select lub.save_talent_skill('تصميم',true)");
  await db.query("select lub.save_talent_skill('مهارة مخفية',false)");
  await visitor();
  expect((await profile())?.links).toEqual([expect.objectContaining({ kind: "Website" })]);
  expect((await profile())?.skills).toEqual(["تصميم"]);
  await actor(peer);
  await denied(() => db.query("select lub.save_talent_link($1,'Email','اختراق','peer@example.invalid',true)", [link]));
  await actor(owner);
  await denied(() => db.query("select lub.save_talent_link(null,'Website','اختراق','javascript:alert(1)',true)"));
  await db.query("select lub.save_talent_link($1,'Email','البريد','contact@example.invalid',true)", [link]);
  await visitor();
  expect((await profile())?.links).toHaveLength(2);
  expect((await db.query("select * from lub.talent_directory('طالب','مهارة مخفية',0)")).rows).toEqual([]);
});

it("lets the least-privilege Worker call only the public talent projections", async () => {
  await publish();
  await db.exec("reset role;set local role lub_runtime");
  expect((await db.query("select * from lub.talent_directory('',null,0)")).rows).toHaveLength(1);
  const rows = await db.query<{ profile: Record<string, unknown> | null }>(
    "select lub.public_talent($1,0,0,0) as profile",
    [publicSlug],
  );
  expect(rows.rows[0].profile).toMatchObject({ name: "طالب 0", total: null });
  await denied(() => db.query("select university_id_ciphertext from lub.student_profiles"));
  await denied(() => db.query("select lub.save_talent_settings('',false)"));
});

it("allows only owned verified project summaries and publishes them with the profile", async () => {
  await db.exec("reset role");
  await db.query("insert into lub.organizations(id,type_code,slug,name_ar) values($1,'Club','talent-test','نادي الاختبار')", [org]);
  const membership = (await db.query<{ id: string }>(
    "insert into lub.organization_memberships(organization_id,user_id) values($1,$2) returning id",
    [org, owner],
  )).rows[0].id;
  await db.query(
    "insert into lub.role_assignments(organization_membership_id,organization_id,role_code,is_primary_leader,assigned_by_user_id) values($1,$2,'OL',true,$3)",
    [membership, org, owner],
  );
  await actor(owner);
  await publish();
  await denied(() => db.query("select lub.save_talent_project(null,null,null,'إنجاز خارجي','غير موثق',false)"));
  const task = (await db.query<{ id: string }>(
    "select lub.save_task(null,$1,null,null,'عنوان داخلي','وصف داخلي سري',null,null,0,null) as id",
    [org],
  )).rows[0].id;
  await db.query("select lub.change_task_status($1,'Open',1)", [task]);
  const participant = (await db.query<{ id: string }>("select lub.join_task($1) as id", [task])).rows[0].id;
  await denied(() => db.query("select lub.save_talent_project(null,$1,null,'عنوان عام','ملخص اختاره الطالب',false)", [participant]));
  await db.exec("reset role");
  await db.exec("insert into lub.academic_terms(academic_year,term_code,name_ar,start_date,end_date) values('test','T1','الفصل',current_date-5,current_date+5)");
  await actor(owner);
  const submission = (await db.query<{ id: string }>(
    "select lub.submit_task($1,'مخرج خاص','{}'::uuid[],0,2) as id",
    [participant],
  )).rows[0].id;
  await db.query("select lub.review_task_submission($1,'Approved','',null)", [submission]);
  const project = (await db.query<{ id: string }>(
    "select lub.save_talent_project(null,$1,null,'عنوان عام','ملخص اختاره الطالب',true) as id",
    [participant],
  )).rows[0].id;
  await actor(peer);
  await denied(() => db.query("select lub.save_talent_project($1,$2,null,'اختراق','',false)", [project, participant]));
  await visitor();
  expect((await profile())?.projects).toEqual([expect.objectContaining({ title: "عنوان عام" })]);
  expect(JSON.stringify(await profile())).not.toMatch(/عنوان داخلي|وصف داخلي سري|task_participant_id|asset_id/);
});

it("publishes all approved hours and membership history when the profile is enabled", async () => {
  await db.exec("reset role");
  await db.query("insert into lub.organizations(id,type_code,slug,name_ar) values($1,'Club','hours-talent','نادي الساعات')", [org]);
  const membership = (await db.query<{ id: string }>(
    "insert into lub.organization_memberships(organization_id,user_id) values($1,$2) returning id",
    [org, owner],
  )).rows[0].id;
  await db.query(
    "insert into lub.role_assignments(organization_membership_id,organization_id,role_code,is_primary_leader,assigned_by_user_id) values($1,$2,'OL',true,$3)",
    [membership, org, owner],
  );
  const term = (await db.query<{ id: string }>(
    "insert into lub.academic_terms(academic_year,term_code,name_ar,start_date,end_date) values('test','T1','الفصل',current_date-5,current_date+5) returning id",
  )).rows[0].id;
  await actor(owner);
  await db.query("select lub.add_hours($1,null,$2,4,current_date,'عمل خاص',false)", [membership, term]);
  await publish();
  await visitor();
  expect(await profile()).toMatchObject({ total: "4.00", organizations: [expect.objectContaining({ hours: "4.00" })] });
  const organization = ((await profile())?.organizations as Array<{ memberships: Array<{ roles: unknown[] }> }>)[0];
  expect(organization.memberships[0].roles).toHaveLength(1);expect(organization.memberships[0].roles[0]).toMatchObject({hours:"4.00"});
});

it("includes completed-event attendance and all verified contributions", async () => {
  await db.exec("reset role");
  await db.query("insert into lub.organizations(id,type_code,slug,name_ar) values($1,'Club','event-talent','نادي الفعاليات')", [org]);
  const event = (await db.query<{ id: string }>(
    "insert into lub.events(organization_id,created_by_user_id,title,description,location_type_code,location_text,starts_at,ends_at,registration_opens_at,registration_closes_at,status_code,published_at,completed_at) values($1,$2,'فعالية مكتملة','وصف','In_Person','القاعة',now()-interval '2 days',now()-interval '1 day',now()-interval '4 days',now()-interval '3 days','Completed',now()-interval '4 days',now()) returning id",
    [org, owner],
  )).rows[0].id;
  const registration = (await db.query<{ id: string }>(
    "insert into lub.event_registrations(event_id,user_id) values($1,$2) returning id",
    [event, owner],
  )).rows[0].id;
  await db.query("insert into lub.event_attendance(event_registration_id,status_code,checked_in_at,marked_by_user_id) values($1,'Present',now(),$2)", [registration, owner]);
  await db.query("insert into lub.event_contributions(event_id,user_id,contribution_type_code,title,verified_by_user_id) values($1,$2,'Trainer','تقديم الورشة',$2)", [event, owner]);
  await actor(owner);
  await publish();
  await visitor();
  expect((await profile())?.events).toEqual([
    expect.objectContaining({ attendance: "Present", contributions: [{ kind: "Trainer", title: "تقديم الورشة" }] }),
  ]);
});

it("returns only active profile settings and no per-organization or event privacy controls", async () => {
  const workspace = (await db.query<{ data: Record<string, unknown> }>("select lub.talent_workspace() as data")).rows[0].data;
  expect(workspace.settings).toEqual({ public_profile_enabled: false });
  expect(workspace).not.toHaveProperty("organizations");
  expect(workspace).not.toHaveProperty("events");
  const columns = (await db.query<{ table_name: string; column_name: string }>(
    "select table_name,column_name from information_schema.columns where table_schema='lub' and table_name in ('profile_settings','profile_organization_settings','event_registrations','event_contributions','student_projects') and column_name in ('show_total_hours','show_role_history','show_events','show_projects','show_hours','show_membership_history','show_on_profile','is_public')",
  )).rows;
  expect(columns).toEqual([]);
  await db.exec("reset role");
  await db.query("update lub.users set status_code='Inactive' where id=$1", [owner]);
  await actor(owner);
  expect((await db.query<{ data: unknown }>("select lub.talent_workspace() as data")).rows[0].data).toEqual({ status: "Inactive", onboarded: false });
});

it("searches normalized public skills without changing their stored spelling",async()=>{
 await db.query("select lub.save_talent_skill('Python',true),lub.save_talent_skill('SQL',true)");await db.query("select lub.save_talent_skill('Private skill',false)");await publish();await visitor();
 expect((await db.query("select name from lub.talent_skill_options()")).rows).toEqual([{name:"Python"},{name:"SQL"}]);
 expect((await db.query("select * from lub.talent_directory('بايثون',null,0)")).rows).toHaveLength(1);
 expect((await db.query("select * from lub.talent_directory('', 'sql',0)")).rows).toHaveLength(1);
 await actor(owner);expect((await db.query<{data:unknown}>("select lub.talent_workspace() as data")).rows[0].data).toMatchObject({skills:expect.arrayContaining([{name:'Python',public:true},{name:'SQL',public:true}])});
});
it("exposes stored avatars only while the matching active profile is published",async()=>{
 await db.query("insert into storage.objects(bucket_id,name,owner_id) values('lub-avatars',$1,$2)",[owner+'/avatar.webp',owner]);
 await visitor();expect((await db.query<{version:string|null}>("select lub.public_avatar_version($1) as version",[owner])).rows[0].version).toBeNull();expect((await db.query("select name from storage.objects where bucket_id='lub-avatars'")).rows).toEqual([]);
 await actor(owner);await publish();await visitor();expect((await db.query<{version:string|null}>("select lub.public_avatar_version($1) as version",[owner])).rows[0].version).toBeTruthy();expect((await db.query("select name from storage.objects where bucket_id='lub-avatars'")).rows).toEqual([]);
 await db.query("select set_config('storage.operation','object.list',false)");expect((await db.query("select name from storage.objects where bucket_id='lub-avatars'")).rows).toEqual([]);
 await db.query("select set_config('storage.operation','object.get_authenticated',false)");expect((await db.query("select name from storage.objects where bucket_id='lub-avatars'")).rows).toHaveLength(1);expect((await profile())?.avatar_version).toBeTruthy();
 await actor(owner);await publish(false);await visitor();expect((await db.query<{version:string|null}>("select lub.public_avatar_version($1) as version",[owner])).rows[0].version).toBeNull();expect((await db.query("select name from storage.objects where bucket_id='lub-avatars'")).rows).toEqual([]);
});


it("uses opaque public profile slugs and never includes private identity IDs",async()=>{
 await publish();await db.exec("reset role");const slug=(await db.query<{public_slug:string}>("select public_slug from lub.profile_settings where user_id=$1",[owner])).rows[0].public_slug;
 expect(slug).not.toBe(owner);await visitor();const p=(await db.query<{p:Record<string,unknown>}>("select lub.public_talent($1,0,0,0) as p",[slug])).rows[0].p;
 expect(p.name).toBe("طالب 0");expect(JSON.stringify(p)).not.toContain(owner);expect(p.indexable).toBe(false);expect((await db.query<{p:unknown}>("select lub.public_talent($1,0,0,0) as p",[owner])).rows[0].p).toBeNull();
});
it("normalizes Arabic names, majors, organizations and bilingual skill aliases with shared filters",async()=>{
 await publish();await db.query("select lub.save_talent_skill('Python',true),lub.save_talent_skill('SQL',true)");await db.exec("reset role");await db.query("update lub.student_profiles set full_name_ar='أحـمَد يحيى',major_name='تقنية المعلومات' where user_id=$1",[owner]);await visitor();
 for(const q of ["احمد","يحيي","تقنيه","بايثون"]){const r=(await db.query<{r:{total:number;items:unknown[]}}>("select lub.search_talent($1::jsonb) as r",[JSON.stringify({q,skills:["python","SQL"]})])).rows[0].r;expect(r.total).toBe(1);expect(r.items).toHaveLength(1);}
 expect((await db.query<{r:{total:number}}>("select lub.search_talent($1::jsonb) as r",[JSON.stringify({minHours:5})])).rows[0].r.total).toBe(0);
});
it("excludes administrators and flagged test accounts from every public talent projection",async()=>{
 await publish();await db.exec("reset role");await db.query("update lub.users set is_test_account=true where id=$1",[owner]);await visitor();expect((await db.query<{r:{total:number}}>("select lub.search_talent('{}') as r")).rows[0].r.total).toBe(0);
 await db.exec("reset role");await db.query("update lub.users set is_test_account=false where id=$1",[owner]);await db.query("insert into lub.global_role_assignments(user_id,role_code,assigned_by_user_id) values($1,'SA',$1)",[owner]);await visitor();expect((await db.query<{r:{total:number}}>("select lub.search_talent('{}') as r")).rows[0].r.total).toBe(0);expect(await profile()).toBeNull();
});

it("keeps optional indexing off until the owner opts in and supports safe Behance links",async()=>{await db.query("select lub.save_talent_settings('نبذة',true,true)");await db.query("select lub.save_talent_link(null,'Behance','أعمالي','https://behance.net/test',true)");await visitor();expect((await profile())?.indexable).toBe(true);expect((await profile())?.links).toEqual([expect.objectContaining({kind:"Behance"})]);await actor(peer);await db.query("select lub.save_talent_settings('',true,false)");await visitor();expect((await profile())?.indexable).toBe(true);});

it("keeps phone numbers private and supplies bilingual metadata without overwriting owner spelling",async()=>{await db.query("select lub.save_talent_link(null,'Phone','جوال','+966500000000',true)");await db.query("select lub.save_talent_skill('بايثون',true)");await publish();await visitor();expect((await profile())?.links).toEqual([]);await actor(owner);const workspace=(await db.query<{data:{links:Array<{is_public:boolean}>;skills:Array<{name:string}>}}>("select lub.talent_workspace() as data")).rows[0].data;expect(workspace.links[0].is_public).toBe(false);expect(workspace.skills[0].name).toBe('بايثون');await db.exec('reset role');expect((await db.query("select name_en,aliases from lub.skills where name_ar='بايثون'")).rows[0]).toEqual({name_en:'Python',aliases:['Python','بايثون']});});
