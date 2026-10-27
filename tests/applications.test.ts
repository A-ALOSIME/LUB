import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import { initialDefinition } from "@/features/forms/definition";
import { applyMigrations, storageFixture } from "./storage-fixture";
let db: PGlite;
const leader = "00000000-0000-4000-8000-000000000001";
const student = "00000000-0000-4000-8000-000000000002";
const other = "00000000-0000-4000-8000-000000000003";
const org = "00000000-0000-4000-8000-000000000101";
const committee = "00000000-0000-4000-8000-000000000201";
const committeeQuestion='00000000-0000-4000-8000-000000000202';
const committeeDefinition={...initialDefinition,sections:[{...initialDefinition.sections[0],fields:[...initialDefinition.sections[0].fields,{id:committeeQuestion,type:'Committee' as const,label:'اللجنة المطلوبة',help:'',required:false,options:[],maxLength:300}]}]};
let template: string; let version: string; let round: string;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
  await storageFixture(db);
  await applyMigrations(db);
}, 30000);
async function asUser(id: string) { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('role','authenticated',true)", [id]); }
async function owner() { await db.exec("reset role"); }
beforeEach(async () => {
  await db.exec("begin");
  for (const [index, id] of [leader, student, other].entries()) {
    await db.query("insert into auth.users values($1)", [id]);
    await db.query("insert into lub.users(id,email,email_verified_at) values($1,$2,now())", [id, `student${index}@example.invalid`]);
    await db.query("insert into lub.student_profiles(user_id,full_name_ar,university_id_ciphertext,university_id_lookup_hash,major_name,academic_level) values($1,$2,'private',$3,'الحاسب','4')", [id, `طالب ${index}`, String(index).repeat(64)]);
  }
  await db.query("insert into lub.organizations(id,type_code,slug,name_ar) values($1,'Club','tech','نادي التقنية')", [org]);
  await db.query("insert into lub.committees(id,organization_id,name) values($1,$2,'التقنية')", [committee, org]);
  const membership = (await db.query<{ id: string }>("insert into lub.organization_memberships(organization_id,user_id) values($1,$2) returning id", [org, leader])).rows[0].id;
  await db.query("insert into lub.role_assignments(organization_membership_id,organization_id,role_code,is_primary_leader,assigned_by_user_id) values($1,$2,'OL',true,$3)", [membership, org, leader]);
  await asUser(leader);
  template = (await db.query<{ id: string }>("select lub.create_form($1,'طلب انضمام',null) as id", [org])).rows[0].id;
  version = (await db.query<{ id: string }>("select id from lub.form_versions where form_template_id=$1", [template])).rows[0].id;
  await db.query("select lub.save_form_draft($1,$2::jsonb,1)", [version, JSON.stringify(committeeDefinition)]);
  await db.query("select lub.publish_form_version($1)", [version]);
  round = (await db.query<{ id: string }>("select lub.create_registration_round($1,$2,'التسجيل الجديد',now()-interval '1 hour',now()+interval '1 day',true) as id", [org, template])).rows[0].id;
  await db.query("select lub.change_round_status($1,'Open')", [round]);
}, 30000);
afterEach(async () => { await db.exec("rollback"); });
afterAll(async () => { await db.close(); });
async function submit(id = student) {
  await asUser(id);
  return (await db.query<{ id: string }>("select lub.submit_application($1,$2,$3::jsonb,$4,null,null) as id", [round, version, JSON.stringify({ [initialDefinition.sections[0].fields[0].id]: "أرغب بالمشاركة",[committeeQuestion]:committee }), committee])).rows[0].id;
}
it("keeps published versions immutable, creates independent copies, and denies unaffiliated template writes", async () => {
  await denied(() => db.query("select lub.save_form_draft($1,$2::jsonb,2)", [version, JSON.stringify(initialDefinition)]));
  const draft = (await db.query<{ id: string }>("select lub.start_form_draft($1) as id", [template])).rows[0].id;
  expect(draft).not.toBe(version);
  await asUser(student);
  await denied(() => db.query("select lub.create_form($1,'مزور',null)", [org]));
});
it("allows public round/definition previews while denying private responses", async () => {
  await submit(); await owner(); await db.exec("set local role anon");
  expect((await db.query("select id from lub.registration_rounds")).rows).toHaveLength(1);
  expect((await db.query("select id from lub.form_versions where id=$1", [version])).rows).toHaveLength(1);
  await denied(() => db.query("select answers from lub.form_responses"));
});
it("enforces one application, pinned versions, required answers and cross-organization committee scope", async () => {
  const application = await submit();
  await denied(() => db.query("select lub.submit_application($1,$2,$3::jsonb,$4,null,null)", [round, version, "{}", committee]));
  await denied(() => submit());
  const response = (await db.query<{ version: string }>("select form_version_id as version from lub.form_responses")).rows[0];
  expect(response.version).toBe(version);
  expect((await db.query("select id from lub.membership_applications where id=$1", [application])).rows).toHaveLength(1);
});
it("preserves a withdrawn request and allows a new one in the same open round", async () => {
  const previous = await submit();
  await asUser(student);
  await db.query("select lub.withdraw_application($1)", [previous]);

  const second = await submit();
  await asUser(student);
  await db.query("select lub.withdraw_application($1)", [second]);
  const current = await submit();
  await owner();
  const rows = (await db.query<{ id: string; status: string }>("select id,status_code as status from lub.membership_applications where registration_round_id=$1 and applicant_user_id=$2", [round, student])).rows;

  expect(rows).toHaveLength(3);
  expect(rows).toContainEqual({ id: previous, status: "Withdrawn" });
  expect(rows).toContainEqual({ id: second, status: "Withdrawn" });
  expect(rows).toContainEqual({ id: current, status: "Submitted" });
});
it("permits Interview edits while open, then locks final decisions and creates membership/committee history atomically", async () => {
  const application = await submit(); await asUser(leader);
  await db.query("select lub.decide_application($1,'Interview','موعد المقابلة غدًا')", [application]);
  await asUser(student);
  await db.query("select lub.submit_application($1,$2,$3::jsonb,$4,$5,1)", [round, version, JSON.stringify({ [initialDefinition.sections[0].fields[0].id]: "إجابة معدلة",[committeeQuestion]:committee }), committee, application]);
  await asUser(leader); await db.query("select lub.decide_application($1,'Accepted','')", [application]);
  await owner();
  expect((await db.query("select id from lub.organization_memberships where user_id=$1 and status_code='Active'", [student])).rows).toHaveLength(1);
  expect((await db.query("select id from lub.committee_memberships where committee_id=$1", [committee])).rows).toHaveLength(1);
  await asUser(student);
  await denied(() => db.query("select lub.submit_application($1,$2,$3::jsonb,$4,$5,2)", [round, version, JSON.stringify({ [initialDefinition.sections[0].fields[0].id]: "تغيير نهائي" }), committee, application]));
});
it("keeps internal notes private but exposes interview messages to their applicant", async () => {
  const application = await submit(); await asUser(leader);
  await db.query("select lub.add_application_note($1,'ملاحظة داخلية')", [application]);
  await owner();
  const audits=await db.query<{action:string;org:string;data:unknown}>("select action_code as action,organization_id as org,metadata as data from lub.audit_log where action_code='APPLICATION_NOTE_CREATED'");
  expect(audits.rows).toHaveLength(1);expect(audits.rows[0].org).toBe(org);expect(JSON.stringify(audits.rows)).not.toContain("ملاحظة داخلية");
  await asUser(leader);
  await db.query("select lub.decide_application($1,'Interview','تفاصيل المقابلة')", [application]);
  await asUser(student);
  expect((await db.query("select body from lub.application_internal_notes")).rows).toHaveLength(0);
  expect((await db.query("select body from lub.application_messages")).rows).toEqual([{ body: "تفاصيل المقابلة" }]);
  await asUser(other);
  expect((await db.query("select * from lub.form_responses")).rows).toHaveLength(0);
});
it("undoes bulk acceptance to each previous state and ends created periods while preserving audit/history", async () => {
  const a = await submit(); const b = await submit(other); await asUser(leader);
  await db.query("select lub.decide_application($1,'Interview','مقابلة')", [b]);
  const bulk = (await db.query<{ id: string }>("select lub.bulk_decide_applications($1::uuid[],'Accepted','') as id", [[a, b]])).rows[0].id;
  await db.query("select lub.undo_application_bulk($1)", [bulk]); await owner();
  const states = (await db.query<{ id: string; status: string }>("select id,status_code as status from lub.membership_applications order by id")).rows;
  expect(states.find(row => row.id === a)?.status).toBe("Submitted");
  expect(states.find(row => row.id === b)?.status).toBe("Interview");
  expect((await db.query("select id from lub.organization_memberships where user_id in($1,$2) and status_code='Ended'", [student, other])).rows).toHaveLength(2);
  const audit = (await db.query<{ data: unknown }>("select metadata as data from lub.audit_log")).rows;
  expect(JSON.stringify(audit)).not.toMatch(/إجابة|المقابلة|private/);
  expect((await db.query("select id from lub.application_status_history")).rows.length).toBeGreaterThanOrEqual(7);
});

it("does not let Super Admin alone run daily operations or bypass direct table writes",async()=>{
 await owner();await db.query("insert into lub.global_role_assignments(user_id,role_code,assigned_by_user_id) values($1,'SA',$1)",[other]);
 await asUser(other);await denied(()=>db.query("select lub.create_form($1,'غير مصرح',null)",[org]));
 await denied(()=>db.query("insert into lub.registration_rounds(organization_id,form_template_id,title,opens_at,closes_at) values($1,$2,'تزوير',now(),now()+interval '1 day')",[org,template]));
 await denied(()=>db.query("select lub.apply_decision($1,'Accepted','',null)",[leader]));
});
it("pins previous submissions while new applicants use the newer published version and rejects stale edits",async()=>{
 const application=await submit();await asUser(leader);
 const draft=(await db.query<{id:string}>("select lub.start_form_draft($1) as id",[template])).rows[0].id;
 await db.query("select lub.publish_form_version($1)",[draft]);
 await asUser(other);await denied(()=>db.query("select lub.submit_application($1,$2,$3::jsonb,null,null,null)",[round,version,JSON.stringify({[initialDefinition.sections[0].fields[0].id]:"جديد"})]));
 await asUser(student);await denied(()=>db.query("select lub.submit_application($1,$2,$3::jsonb,null,$4,9)",[round,version,JSON.stringify({[initialDefinition.sections[0].fields[0].id]:"معدل"}),application]));
 await db.query("select lub.submit_application($1,$2,$3::jsonb,null,$4,1)",[round,version,JSON.stringify({[initialDefinition.sections[0].fields[0].id]:"معدل"}),application]);
 expect((await db.query<{id:string}>("select form_version_id as id from lub.form_responses")).rows[0].id).toBe(version);
});
it("rolls back an entire bulk decision when any selected application is already final",async()=>{
 const a=await submit();const b=await submit(other);await asUser(leader);
 await db.query("select lub.decide_application($1,'Rejected','')",[b]);
 await denied(()=>db.query("select lub.bulk_decide_applications($1::uuid[],'Accepted','')",[[a,b]]));
 expect((await db.query<{status:string}>("select status_code as status from lub.membership_applications where id=$1",[a])).rows[0].status).toBe("Submitted");
 expect((await db.query("select id from lub.bulk_actions")).rows).toHaveLength(0);
});
it("skips a subsequent independent change during Undo and makes Undo idempotent",async()=>{
 const a=await submit();await asUser(leader);
 const b=(await db.query<{id:string}>("select lub.bulk_decide_applications($1::uuid[],'Interview','موعد') as id",[[a]])).rows[0].id;
 await db.query("select lub.decide_application($1,'Rejected','')",[a]);
 await db.query("select lub.undo_application_bulk($1)",[b]);await db.query("select lub.undo_application_bulk($1)",[b]);
 expect((await db.query<{status:string}>("select status_code as status from lub.membership_applications where id=$1",[a])).rows[0].status).toBe("Rejected");
 expect((await db.query<{result:string}>("select undo_result_code as result from lub.bulk_action_items")).rows[0].result).toBe("SkippedChanged");
});
it("enforces closed rounds, one withdrawal, and committee-scoped review grants",async()=>{
 const a=await submit();await owner();
 const m=(await db.query<{id:string}>("insert into lub.organization_memberships(organization_id,user_id) values($1,$2) returning id",[org,other])).rows[0].id;
 await asUser(leader);await db.query("select lub.grant_application_permission($1,'APPLICATIONS_REVIEW',$2,null)",[m,committee]);
 await asUser(other);expect((await db.query("select id from lub.membership_applications")).rows).toHaveLength(1);
 await denied(()=>db.query("select lub.create_form($1,'مزور',null)",[org]));
 await asUser(leader);await db.query("select lub.change_round_status($1,'Closed')",[round]);
 await asUser(student);await denied(()=>db.query("select lub.withdraw_application($1)",[a]));
});
it("keeps attachments private, prevents foreign references and locks deletion of submitted files",async()=>{
 const asset="30000000-0000-4000-8000-000000000001";
 await owner();await db.query("insert into lub.application_assets(id,owner_user_id,object_key,file_name,mime_type,size_bytes) values($1,$2,$3,'sample.pdf','application/pdf',20)",[asset,student,student+"/"+asset]);
 await db.query("insert into storage.objects(bucket_id,name,owner_id) values('lub-application-files',$1,$2)",[student+"/"+asset,student]);
 await asUser(other);expect((await db.query("select id from lub.application_assets")).rows).toHaveLength(0);
 await denied(()=>db.query("insert into storage.objects(bucket_id,name) values('lub-application-files',$1)",[student+"/30000000-0000-4000-8000-000000000002"]));
 const app=await submit();await owner();
 const response=(await db.query<{id:string}>("select form_response_id as id from lub.membership_applications where id=$1",[app])).rows[0].id;
 await db.query("insert into lub.form_response_assets(form_response_id,asset_id,field_id) values($1,$2,$3)",[response,asset,initialDefinition.sections[0].fields[0].id]);
 await asUser(student);await db.query("delete from storage.objects where name=$1",[student+"/"+asset]);
 expect((await db.query("select id from storage.objects")).rows).toHaveLength(1);
 await asUser(leader);expect((await db.query("select id from lub.application_assets")).rows).toHaveLength(1);
  await owner();await db.query("update lub.users set status_code='Inactive' where id=$1",[student]);
  await asUser(student);await db.query("delete from storage.objects");
  await owner();expect((await db.query("select id from storage.objects")).rows).toHaveLength(1);
});
it("does not undo a membership that has subsequently received an operational role",async()=>{
 const app=await submit();await asUser(leader);
 const bulk=(await db.query<{id:string}>("select lub.bulk_decide_applications($1::uuid[],'Accepted','') as id",[[app]])).rows[0].id;
 await owner();const member=(await db.query<{id:string}>("select accepted_membership_id as id from lub.membership_applications where id=$1",[app])).rows[0].id;
 await db.query("insert into lub.role_assignments(organization_membership_id,organization_id,role_code,assigned_by_user_id) values($1,$2,'OD',$3)",[member,org,leader]);
 await asUser(leader);await db.query("select lub.undo_application_bulk($1)",[bulk]);
 expect((await db.query<{status:string}>("select status_code as status from lub.membership_applications where id=$1",[app])).rows[0].status).toBe("Accepted");
});
it("rejects cross-organization committee selection and a file owned by a different applicant",async()=>{
 const foreign="50000000-0000-4000-8000-000000000001";const foreignCommittee="50000000-0000-4000-8000-000000000002";const asset="50000000-0000-4000-8000-000000000003";
 await owner();await db.query("insert into lub.organizations(id,type_code,slug,name_ar) values($1,'Club','foreign','جهة ثانية')",[foreign]);await db.query("insert into lub.committees(id,organization_id,name) values($1,$2,'أخرى')",[foreignCommittee,foreign]);
 await db.query("insert into lub.application_assets(id,owner_user_id,object_key,file_name,mime_type,size_bytes) values($1,$2,$3,'sample.pdf','application/pdf',20)",[asset,other,other+"/"+asset]);
 await asUser(student);await denied(()=>db.query("select lub.submit_application($1,$2,$3::jsonb,$4,null,null)",[round,version,JSON.stringify({[initialDefinition.sections[0].fields[0].id]:"إجابة"}),foreignCommittee]));
 await asUser(leader);const draft=(await db.query<{id:string}>("select lub.start_form_draft($1) as id",[template])).rows[0].id;
 const definition=structuredClone(initialDefinition);definition.sections[0].fields[0].type="File";
 await db.query("select lub.save_form_draft($1,$2::jsonb,1)",[draft,JSON.stringify(definition)]);await db.query("select lub.publish_form_version($1)",[draft]);
 await asUser(student);await denied(()=>db.query("select lub.submit_application($1,$2,$3::jsonb,null,null,null)",[round,draft,JSON.stringify({[initialDefinition.sections[0].fields[0].id]:asset})]));
});
it("enforces committee review scope even for a reviewer's own historical application",async()=>{
 const secondary="50000000-0000-4000-8000-000000000004";await owner();await db.query("insert into lub.committees(id,organization_id,name) values($1,$2,'ثانية')",[secondary,org]);
 await asUser(other);const a=(await db.query<{id:string}>("select lub.submit_application($1,$2,$3::jsonb,$4,null,null) as id",[round,version,JSON.stringify({[initialDefinition.sections[0].fields[0].id]:"إجابة"}),secondary])).rows[0].id;
 await owner();const m=(await db.query<{id:string}>("insert into lub.organization_memberships(organization_id,user_id) values($1,$2) returning id",[org,other])).rows[0].id;
 await asUser(leader);await db.query("select lub.grant_application_permission($1,'APPLICATIONS_REVIEW',$2,null)",[m,committee]);
 await asUser(other);await denied(()=>db.query("select lub.decide_application($1,'Rejected','')",[a]));
 expect((await db.query<{allowed:boolean}>("select lub.can_read_application($1,'APPLICATIONS_REVIEW') as allowed",[a])).rows[0].allowed).toBe(false);
});

async function denied(operation: () => Promise<unknown>) { await db.exec("savepoint rejection"); try { await expect(operation()).rejects.toThrow(); } finally { await db.exec("rollback to savepoint rejection; release savepoint rejection"); } }

it("duplicates the latest version into an independent draft without rounds",async()=>{
 const latest=(await db.query<{id:string}>("select lub.start_form_draft($1) as id",[template])).rows[0].id;
 const changed=structuredClone(initialDefinition);changed.sections[0].title="آخر نسخة";
 await db.query("select lub.save_form_draft($1,$2::jsonb,1)",[latest,JSON.stringify(changed)]);
 const copy=(await db.query<{id:string}>("select lub.duplicate_form($1) as id",[template])).rows[0].id;
 expect(copy).not.toBe(template);
 expect((await db.query<{name:string}>("select name from lub.form_templates where id=$1",[copy])).rows[0].name).toBe("نسخة من طلب انضمام");
 const versions=(await db.query<{status_code:string;definition:unknown}>("select status_code,definition from lub.form_versions where form_template_id=$1",[copy])).rows;
 expect(versions).toHaveLength(1);expect(versions[0]).toEqual({status_code:"Draft",definition:changed});
 expect((await db.query("select id from lub.registration_rounds where form_template_id=$1",[copy])).rows).toHaveLength(0);
 await asUser(student);await denied(()=>db.query("select lub.duplicate_form($1)",[template]));
});
it("deletes all versions only for an unused owned form, preserving copies and used forms",async()=>{
 await denied(()=>db.query("select lub.delete_form($1)",[template]));
 const unused=(await db.query<{id:string}>("select lub.create_form($1,'غير مستخدم',$2) as id",[org,template])).rows[0].id;
 const published=(await db.query<{id:string}>("select id from lub.form_versions where form_template_id=$1",[unused])).rows[0].id;
 await db.query("select lub.publish_form_version($1)",[published]);
 await db.query("select lub.start_form_draft($1)",[unused]);
 const copy=(await db.query<{id:string}>("select lub.create_form($1,'نسخة مستقلة',$2) as id",[org,unused])).rows[0].id;
 await asUser(student);await denied(()=>db.query("select lub.delete_form($1)",[unused]));
 await asUser(leader);await denied(()=>db.query("delete from lub.form_versions where id=$1",[published]));
 await db.query("select lub.delete_form($1)",[unused]);
 await owner();expect((await db.query("select id from lub.form_versions where form_template_id=$1",[unused])).rows).toHaveLength(0);
 expect((await db.query("select id from lub.form_templates where id=$1",[unused])).rows).toHaveLength(0);
 expect((await db.query<{source_template_id:string|null}>("select source_template_id from lub.form_templates where id=$1",[copy])).rows[0].source_template_id).toBeNull();
 expect((await db.query("select id from lub.registration_rounds where id=$1",[round])).rows).toHaveLength(1);
});
it("does not allow a delegated form editor to delete templates",async()=>{
 const unused=(await db.query<{id:string}>("select lub.create_form($1,'للاختبار',null) as id",[org])).rows[0].id;
 await owner();const membership=(await db.query<{id:string}>("insert into lub.organization_memberships(organization_id,user_id) values($1,$2) returning id",[org,other])).rows[0].id;
 await asUser(leader);await db.query("select lub.grant_application_permission($1,'FORMS_MANAGE',null,null)",[membership]);
 await asUser(other);await denied(()=>db.query("select lub.delete_form($1)",[unused]));
});

it("preserves forms referenced by events even when they have no registration rounds",async()=>{
 const unused=(await db.query<{id:string}>("select lub.create_form($1,'نموذج فعالية',null) as id",[org])).rows[0].id;
 await owner();await db.query("insert into lub.events(organization_id,created_by_user_id,title,description,location_type_code,location_text,starts_at,ends_at,registration_opens_at,registration_closes_at,registration_form_template_id) values($1,$2,'فعالية','وصف','In_Person','قاعة',now()+interval '1 day',now()+interval '2 days',now(),now()+interval '1 hour',$3)",[org,leader,unused]);
 await asUser(leader);expect((await db.query<{allowed:boolean}>("select lub.can_delete_form($1) as allowed",[unused])).rows[0].allowed).toBe(false);
 await denied(()=>db.query("select lub.delete_form($1)",[unused]));
});

it("repairs absent Storage policies without allowing foreign uploads or private reads",async()=>{
 await owner();
 await db.exec("drop policy lub_files_insert on storage.objects; drop policy lub_files_read on storage.objects; drop policy lub_files_delete on storage.objects; drop policy public_event_posters on storage.objects");
 await db.exec(readFileSync("drizzle/0046_restore_application_storage_policies.sql","utf8"));
 const key=student+"/30000000-0000-4000-8000-000000000099";
 await asUser(student);await db.query("insert into storage.objects(bucket_id,name,owner_id) values('lub-application-files',$1,$2)",[key,student]);
 expect((await db.query("select id from storage.objects where name=$1",[key])).rows).toHaveLength(1);
 await asUser(other);expect((await db.query("select id from storage.objects where name=$1",[key])).rows).toHaveLength(0);
 await denied(()=>db.query("insert into storage.objects(bucket_id,name) values('lub-application-files',$1)",[student+"/30000000-0000-4000-8000-000000000098"]));
 await asUser(student);await db.query("delete from storage.objects where name=$1",[key]);
 await owner();expect((await db.query("select id from storage.objects where name=$1",[key])).rows).toHaveLength(0);
});

it("allows paused rounds to reopen, requires extending expired rounds and prevents two live rounds",async()=>{
 await db.query("select lub.change_round_status($1,'Closed')",[round]);
 await db.query("select lub.change_round_status($1,'Open')",[round]);
 const second=(await db.query<{id:string}>("select lub.create_registration_round($1,$2,'جولة أخرى',now(),now()+interval '2 days',true) as id",[org,template])).rows[0].id;
 await denied(()=>db.query("select lub.change_round_status($1,'Open')",[second]));
 await db.query("select lub.change_round_status($1,'Closed')",[round]);
 await owner();await db.query("update lub.registration_rounds set opens_at=now()-interval '2 days',closes_at=now()-interval '1 day' where id=$1",[round]);
 await asUser(leader);await denied(()=>db.query("select lub.change_round_status($1,'Open')",[round]));
 await db.query("select lub.save_registration_round($1,$2,$3,'الجولة الممددة',now()-interval '2 days',now()+interval '1 day',true,true)",[round,org,template]);
 expect((await db.query<{open:boolean}>("select lub.round_is_open($1) as open",[round])).rows[0].open).toBe(true);
});
it("deletes a round's applications and answers while preserving accepted memberships",async()=>{
 const app=await submit();await asUser(leader);await db.query("select lub.decide_application($1,'Accepted','')",[app]);
 const member=(await db.query<{id:string}>("select accepted_membership_id as id from lub.membership_applications where id=$1",[app])).rows[0].id;
 await asUser(other);await denied(()=>db.query("select lub.delete_registration_round($1)",[round]));
 await asUser(leader);await db.query("select lub.delete_registration_round($1)",[round]);
 await owner();expect((await db.query("select id from lub.registration_rounds where id=$1",[round])).rows).toHaveLength(0);
 expect((await db.query("select id from lub.membership_applications where id=$1",[app])).rows).toHaveLength(0);
 expect((await db.query("select id from lub.form_responses where respondent_user_id=$1",[student])).rows).toHaveLength(0);
 const rows=(await db.query<{status_code:string;source_application_id:string|null}>("select status_code,source_application_id from lub.organization_memberships where id=$1",[member])).rows;
 expect(rows[0]).toEqual({status_code:'Active',source_application_id:null});
});

it("moves a member within the organization and confirms removal of committee leadership",async()=>{
 const app=await submit();await asUser(leader);await db.query("select lub.decide_application($1,'Accepted','')",[app]);
 const member=(await db.query<{id:string}>("select accepted_membership_id as id from lub.membership_applications where id=$1",[app])).rows[0].id;
 await owner();const next=(await db.query<{id:string}>("insert into lub.committees(organization_id,name) values($1,'لجنة ثانية') returning id",[org])).rows[0].id;
 await db.query("insert into lub.role_assignments(organization_membership_id,organization_id,committee_id,role_code,assigned_by_user_id) values($1,$2,$3,'CL',$4)",[member,org,committee,leader]);
 await asUser(student);await denied(()=>db.query("select lub.move_member_committee($1,$2,true)",[member,next]));
 await asUser(leader);await denied(()=>db.query("select lub.move_member_committee($1,$2,false)",[member,next]));
 await db.query("select lub.move_member_committee($1,$2,true)",[member,next]);await owner();
 expect((await db.query("select committee_id from lub.committee_memberships where organization_membership_id=$1 and status_code='Active'",[member])).rows).toEqual([{committee_id:next}]);
 expect((await db.query<{end_date:string|null}>("select end_date from lub.role_assignments where organization_membership_id=$1 and role_code='CL'",[member])).rows[0].end_date).not.toBeNull();
 await asUser(leader);await db.query("select lub.move_member_committee($1,null,true)",[member]);await owner();
 expect((await db.query("select id from lub.committee_memberships where organization_membership_id=$1 and status_code='Active'",[member])).rows).toHaveLength(0);
});

it("keeps incomplete round drafts private and validates publication",async()=>{
 const draft=(await db.query<{id:string}>("select lub.save_registration_round(null,$1,null,'',null,null,true,false) as id",[org])).rows[0].id;
 await denied(()=>db.query("select lub.change_round_status($1,'Open')",[draft]));
 await owner();await db.exec("select set_config('request.jwt.claim.sub','',true);set local role anon");expect((await db.query("select id from lub.registration_rounds where id=$1",[draft])).rows).toHaveLength(0);
 await asUser(leader);await db.query("select lub.change_round_status($1,'Closed')",[round]);
 await db.exec("reset role;select set_config('request.jwt.claim.sub','',true);set local role anon");expect((await db.query("select id from lub.registration_rounds where id=$1",[round])).rows).toHaveLength(0);
});

it("preserves a rejection reason for the applicant and in the decision timeline",async()=>{const application=await submit();await asUser(leader);await db.query("select lub.decide_application($1,'Rejected','اكتملت المقاعد')",[application]);await asUser(student);expect((await db.query("select reason from lub.application_status_history where application_id=$1 and to_status_code='Rejected'",[application])).rows).toEqual([{reason:'اكتملت المقاعد'}]);await asUser(other);expect((await db.query("select reason from lub.application_status_history where application_id=$1",[application])).rows).toEqual([]);});

it("resolves explicit committee answers against current organization scope and updates hierarchical options",async()=>{
 await owner();const child=(await db.query<{id:string}>("insert into lub.committees(organization_id,parent_committee_id,name) values($1,$2,'الفرعية') returning id",[org,committee])).rows[0].id;
 await asUser(student);expect((await db.query("select name from lub.form_committee_options($1) where id=$2",[org,child])).rows).toEqual([{name:'التقنية / الفرعية'}]);
 await denied(()=>db.query("select lub.submit_application($1,$2,$3::jsonb,null,null,null)",[round,version,JSON.stringify({[initialDefinition.sections[0].fields[0].id]:'إجابة',[committeeQuestion]:other})]));
 const app=(await db.query<{id:string}>("select lub.submit_application($1,$2,$3::jsonb,null,null,null) as id",[round,version,JSON.stringify({[initialDefinition.sections[0].fields[0].id]:'إجابة',[committeeQuestion]:child})])).rows[0].id;
 expect((await db.query<{labels:{answers:Record<string,string>}}>("select lub.application_committee_labels($1) as labels",[app])).rows[0].labels.answers[committeeQuestion]).toBe('الفرعية');
 await asUser(leader);await owner();await db.query("update lub.committees set status_code='Archived',archived_at=now() where id=$1",[child]);await asUser(student);expect((await db.query("select id from lub.form_committee_options($1) where id=$2",[org,child])).rows).toEqual([]);
 await denied(()=>db.query("select lub.submit_application($1,$2,$3::jsonb,null,$4,1)",[round,version,JSON.stringify({[initialDefinition.sections[0].fields[0].id]:'إجابة',[committeeQuestion]:child}),app]));
 expect((await db.query<{labels:{answers:Record<string,string>}}>("select lub.application_committee_labels($1) as labels",[app])).rows[0].labels.answers[committeeQuestion]).toBe('الفرعية');
 await asUser(other);expect((await db.query("select lub.application_committee_labels($1) as labels",[app])).rows[0]).toEqual({labels:null});
});

it("migrates legacy forms by creating versions while retaining published responses, selected committees and draft edits",async()=>{
 await db.query("select lub.change_round_status($1,'Closed')",[round]);
 const legacy=(await db.query<{id:string}>("select lub.create_form($1,'نموذج سابق',null) as id",[org])).rows[0].id;
 const old=(await db.query<{id:string}>("select id from lub.form_versions where form_template_id=$1",[legacy])).rows[0].id;
 await db.query("select lub.save_form_draft($1,$2::jsonb,1)",[old,JSON.stringify(initialDefinition)]);await db.query("select lub.publish_form_version($1)",[old]);
 const previousRound=(await db.query<{id:string}>("select lub.create_registration_round($1,$2,'جولة سابقة',now()-interval '1 hour',now()+interval '1 day',true) as id",[org,legacy])).rows[0].id;await db.query("select lub.change_round_status($1,'Open')",[previousRound]);
 const draft=(await db.query<{id:string}>("select lub.start_form_draft($1) as id",[legacy])).rows[0].id;
 const edited=structuredClone(initialDefinition);edited.sections[0].fields[0].label='تعديل غير منشور';await db.query("select lub.save_form_draft($1,$2::jsonb,1)",[draft,JSON.stringify(edited)]);
 await owner();const response=(await db.query<{id:string}>("insert into lub.form_responses(form_version_id,respondent_user_id,answers) values($1,$2,$3::jsonb) returning id",[old,student,JSON.stringify({[initialDefinition.sections[0].fields[0].id]:'إجابتي القديمة'})])).rows[0].id;
 const app=(await db.query<{id:string}>("insert into lub.membership_applications(registration_round_id,applicant_user_id,requested_committee_id,form_response_id) values($1,$2,$3,$4) returning id",[previousRound,student,committee,response])).rows[0].id;
 const sql=readFileSync('drizzle/0052_explicit_committee_questions.sql','utf8').split('-- BEGIN legacy committee conversion')[1].split('-- END legacy committee conversion')[0];await db.exec(sql);
 expect((await db.query("select answers,form_version_id from lub.form_responses where id=$1",[response])).rows[0]).toEqual({answers:{[initialDefinition.sections[0].fields[0].id]:'إجابتي القديمة'},form_version_id:old});
 const versions=(await db.query<{id:string;status_code:string;definition:typeof initialDefinition}>("select id,status_code,definition from lub.form_versions where form_template_id=$1 order by version_number",[legacy])).rows;
 expect(versions).toHaveLength(4);expect(versions[0].definition).toEqual(initialDefinition);expect(versions[1].status_code).toBe('Retired');expect(versions[3].definition.sections[0].fields[0].label).toBe('تعديل غير منشور');expect(versions[2].definition.sections[0].fields.at(-1)?.type).toBe('Committee');
 await asUser(student);await db.query("select lub.submit_application($1,$2,$3::jsonb,null,$4,1)",[previousRound,old,JSON.stringify({[initialDefinition.sections[0].fields[0].id]:'إجابة معدلة'}),app]);expect((await db.query("select requested_committee_id from lub.membership_applications where id=$1",[app])).rows[0]).toEqual({requested_committee_id:committee});
 await asUser(leader);await denied(()=>db.query("select lub.save_form_draft($1,$2::jsonb,1)",[old,JSON.stringify(edited)]));
});

it("does not infer a committee for a new form without an explicit committee question",async()=>{
 const draft=(await db.query<{id:string}>("select lub.start_form_draft($1) as id",[template])).rows[0].id;await db.query("select lub.save_form_draft($1,$2::jsonb,1)",[draft,JSON.stringify(initialDefinition)]);await db.query("select lub.publish_form_version($1)",[draft]);
 await asUser(student);const app=(await db.query<{id:string}>("select lub.submit_application($1,$2,$3::jsonb,$4,null,null) as id",[round,draft,JSON.stringify({[initialDefinition.sections[0].fields[0].id]:'إجابة'}),committee])).rows[0].id;
 expect((await db.query("select requested_committee_id from lub.membership_applications where id=$1",[app])).rows[0]).toEqual({requested_committee_id:null});
});
