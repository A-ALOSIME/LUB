import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import type { FormDefinition } from "@/features/forms/definition";

const id = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let db: PGlite;
async function actor(n: number) {
  await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('role','authenticated',true)", [id(n)]);
}
async function denied(run: () => Promise<unknown>) {
  await db.exec("savepoint denied"); await expect(run()).rejects.toThrow(); await db.exec("rollback to savepoint denied; release savepoint denied");
}
type StoredForm = { id: string; name: string; versions: Array<{ id: string; revision: number; status_code: string; definition: FormDefinition }> };
async function library(org = id(100), selected: string | null = null) { return (await db.query<{ data: StoredForm[] }>("select lub.form_library($1,$2) data", [org, selected])).rows[0].data; }
async function create(name = "طلب الانضمام", source: string | null = null) { return (await db.query<{ id: string }>("select lub.create_form($1,$2,$3) id", [id(100), name, source])).rows[0].id; }
const definition = (): FormDefinition => ({ layout: "SinglePage", sections: [{ id: id(800), title: "بيانات الطلب", description: "", fields: [
  { id: id(801), type: "Checkbox", label: "أوافق على الشروط", help: "", required: false, options: [], maxLength: 300 },
  { id: id(802), type: "LongText", label: "لماذا ترغب بالانضمام؟", help: "", required: true, options: [], maxLength: 500, condition: { fieldId: id(801), operator: "Answered", value: "true" } },
] }] });
beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;");
  for (const file of ["schema18.sql", "administration18.sql", "forms18.sql", "form-library18.sql", "campaigns18.sql"]) await db.exec(readFileSync(`scripts/schema-simplification/${file}`, "utf8"));
}, 30000);
beforeEach(async () => {
  await db.exec("begin");
  for (let n = 1; n <= 3; n++) {
    await db.query("insert into auth.users values($1)", [id(n)]);
    await db.query("insert into lub.users(id,email,email_verified_at,full_name_ar,university_id_ciphertext,university_id_lookup_hash,major_name,academic_level,onboarded_at) values($1,$2,now(),'طالب اختبار','encrypted',$3,'نظم معلومات','5',now())", [id(n), `form18-${n}@example.invalid`, String(n).repeat(64)]);
  }
  for (const n of [100, 101]) await db.query("insert into lub.organizations(id,type_code,slug,name_ar) values($1,'Club',$2,'جهة اختبار')", [id(n), `form-org-${n}`]);
  await db.query("insert into lub.organization_memberships(id,organization_id,user_id) values($1,$2,$3)", [id(200), id(100), id(1)]);
  await db.query("insert into lub.access_assignments(user_id,organization_id,organization_membership_id,role_code,assigned_by_user_id) values($1,$2,$3,'OL',$1)", [id(1), id(100), id(200)]);
  await actor(1);
});
afterEach(async () => { await db.exec("rollback"); });
afterAll(async () => { await db?.close(); });

it("stores a current form inline with no separate template or version table", async () => {
  const form = await create(); const rows = await library(id(100), form);
  expect(rows).toMatchObject([{ id: form, name: "طلب الانضمام", versions: [{ id: form, revision: 1, status_code: "Draft" }] }]);
  expect(rows[0].versions[0].definition.sections).toHaveLength(1);
  expect((await library())[0].versions[0]).not.toHaveProperty("definition");
  await db.exec("reset role"); expect((await db.query("select to_regclass('lub.form_versions') old,to_regclass('lub.form_templates') templates")).rows).toEqual([{ old: null, templates: null }]);
});
it("authorizes the owning organization and hides draft forms from members and other organizations", async () => {
  const form = await create(); await denied(() => library(id(101)));
  await actor(2); await denied(() => create()); await denied(() => library());
  await denied(() => db.query("select lub.save_form_draft($1,$2::jsonb,1)", [form, JSON.stringify(definition())]));
  await denied(() => db.query("select forms from lub.organizations where id=$1", [id(100)]));
  await db.exec("reset role;set local role anon"); await denied(() => library());
});
it("updates a published form directly with optimistic revision checks and one current definition", async () => {
  const form = await create(); await db.query("select lub.save_form_draft($1,$2::jsonb,1)", [form, JSON.stringify(definition())]);
  await db.query("select lub.publish_form_version($1)", [form]);
  const before = (await library(id(100), form))[0].versions[0];
  const edited = definition(); edited.sections[0].fields[1].label = "حدثنا عن خبرتك";
  await db.query("select lub.save_form_draft($1,$2::jsonb,2)", [form, JSON.stringify(edited)]);
  await denied(() => db.query("select lub.save_form_draft($1,$2::jsonb,2)", [form, JSON.stringify(definition())]));
  const after = (await library(id(100), form))[0].versions;
  expect(after).toHaveLength(1); expect(after[0]).toMatchObject({ revision: 3, status_code: "Published", definition: edited });
  expect(before.definition.sections[0].fields[1].label).toBe("لماذا ترغب بالانضمام؟");
});
it("duplicates a form with independent content and rejects deleting a form used by a campaign", async () => {
  const original = await create();
  const copy = (await db.query<{ id: string }>("select lub.duplicate_form($1) id", [original])).rows[0].id;
  expect(copy).not.toBe(original); expect(await library()).toHaveLength(2);
  await db.query("select lub.save_form_draft($1,$2::jsonb,1)", [copy, JSON.stringify(definition())]);
  expect((await library(id(100), original)).find(row => row.id === original)?.versions[0].definition).not.toEqual(definition());
  await db.exec("reset role");
  await db.query("insert into lub.academic_terms(id,academic_year,term_code,name_ar,start_date,end_date) values($1,'2026','T1','الفصل الأول',current_date,current_date+90)", [id(500)]);
  await db.query("insert into lub.membership_campaigns(organization_id,kind,academic_term_id,title,form_id,opens_at,closes_at) values($1,'Registration',$2,'تسجيل',$3,now(),now()+interval '1 day')", [id(100), id(500), original]);
  await actor(1); await denied(() => db.query("select lub.delete_form($1)", [original]));
  await db.query("select lub.delete_form($1)", [copy]); expect((await library()).map(row => row.id)).toEqual([original]);
});
it("keeps conditional required questions hidden, unrequired and unsaved when the condition is false", async () => {
  const d = definition();
  await db.query("select lub.validate_form_definition($1::jsonb)", [JSON.stringify(d)]);
  expect((await db.query<{ answers: object }>("select lub.validate_form_answers($1::jsonb,$2::jsonb) answers", [JSON.stringify(d), JSON.stringify({ [id(802)]: "لا تحفظ الإجابة المخفية" })])).rows[0].answers).toEqual({});
  await denied(() => db.query("select lub.validate_form_answers($1::jsonb,$2::jsonb)", [JSON.stringify(d), JSON.stringify({ [id(801)]: true })]));
  expect((await db.query<{ answers: object }>("select lub.validate_form_answers($1::jsonb,$2::jsonb) answers", [JSON.stringify(d), JSON.stringify({ [id(801)]: true, [id(802)]: "خبرتي في التصميم" })])).rows[0].answers).toEqual({ [id(801)]: true, [id(802)]: "خبرتي في التصميم" });
});
it("checks file ownership and preserves per-question attachment references", async () => {
  const d = definition(); d.sections[0].fields = [{ id: id(803), type: "File", label: "أرفق عملك", help: "", required: true, options: [], maxLength: 300 }];
  await db.exec("reset role");
  for (const n of [1, 2]) await db.query("insert into lub.assets(id,owner_user_id,object_key,file_name,mime_type,size_bytes) values($1,$2,$3,'ملف.pdf','application/pdf',10)", [id(900 + n), id(n), `${id(n)}/${id(900 + n)}.pdf`]);
  await actor(1);
  await denied(() => db.query("select lub.validate_form_answers($1::jsonb,$2::jsonb)", [JSON.stringify(d), JSON.stringify({ [id(803)]: id(902) })]));
  expect((await db.query<{ answers: object }>("select lub.validate_form_answers($1::jsonb,$2::jsonb) answers", [JSON.stringify(d), JSON.stringify({ [id(803)]: id(901) })])).rows[0].answers).toEqual({ [id(803)]: id(901) });
});
it("validates nested form ownership/publication for campaigns and prevents dangling references", async () => {
  const form = await create(); await db.exec("reset role");
  await denied(() => db.query("insert into lub.membership_campaigns(organization_id,kind,title,form_id) values($1,'Registration','مسودة',$2)", [id(101), form]));
  await db.query("insert into lub.membership_campaigns(organization_id,kind,title,form_id) values($1,'Registration','مسودة',$2)", [id(100), form]);
  await denied(() => db.query("update lub.membership_campaigns set status_code='Open',opens_at=now(),closes_at=now()+interval '1 day' where organization_id=$1", [id(100)]));
  await actor(1); await db.query("select lub.publish_form_version($1)", [form]);
  await db.exec("reset role");
  await db.query("update lub.membership_campaigns set status_code='Open',opens_at=now(),closes_at=now()+interval '1 day' where organization_id=$1", [id(100)]);
  await denied(() => db.query("update lub.organizations set forms='[]' where id=$1", [id(100)]));
  await denied(() => db.query("insert into lub.organization_content(organization_id,kind,title,form_id) values($1,'Event','فعالية',$2)", [id(101), form]));
});
async function publishedRound() {
  const form = await create(); await db.query("select lub.save_form_draft($1,$2::jsonb,1)", [form, JSON.stringify(definition())]);
  await db.query("select lub.publish_form_version($1)", [form]);
  const round = (await db.query<{ id: string }>("select lub.save_registration_round(null,$1,$2,'جولة التسجيل',now()-interval '1 hour',now()+interval '1 day',true,true) id", [id(100), form])).rows[0].id;
  return { form, round };
}
async function submit(round: string, form: string, text: string, application: string | null = null, revision: number | null = null) {
  return (await db.query<{ id: string }>("select lub.submit_application($1,$2,$3::jsonb,null,$4,$5) id", [round, form, JSON.stringify({ [id(801)]: true, [id(802)]: text }), application, revision])).rows[0].id;
}
it("keeps the actual submitted question snapshot after edits and uses the new definition for later applicants", async () => {
  const { form, round } = await publishedRound(); await actor(2); const first = await submit(round, form, "إجابة أولى");
  await actor(1); const edited = definition(); edited.sections[0].fields[1].label = "حدثنا عن خبرتك";
  await db.query("select lub.save_form_draft($1,$2::jsonb,2)", [form, JSON.stringify(edited)]);
  await actor(3); const second = await submit(round, form, "إجابة ثانية");
  await actor(2); await submit(round, form, "عدّلت إجابتي", first, 1);
  await denied(() => submit(round, form, "تعديل قديم", first, 1));
  await denied(() => submit(round, form, "طلب مكرر"));
  await db.exec("reset role");
  const records = (await db.query<{ id: string; form_snapshot: { definition: FormDefinition }; answers: object; response_revision: number }>("select id,form_snapshot,answers,response_revision from lub.membership_cases")).rows;
  expect(records.find(row => row.id === first)?.form_snapshot.definition).toEqual(definition());
  expect(records.find(row => row.id === second)?.form_snapshot.definition).toEqual(edited);
  expect(records.find(row => row.id === first)).toMatchObject({ answers: { [id(802)]: "عدّلت إجابتي" }, response_revision: 2 });
});
it("checks campaign eligibility on the server and maintains withdrawal/reapplication history", async () => {
  const { form, round } = await publishedRound();
  await db.query("select lub.set_round_requirements($1,0,'[\"علوم حاسب\"]'::jsonb)", [round]);
  await actor(2); await denied(() => submit(round, form, "محاولة غير مؤهلة"));
  await actor(1); await db.query("select lub.set_round_requirements($1,0,'[\"نظم معلومات\"]'::jsonb)", [round]);
  await actor(2); const first = await submit(round, form, "طلبي الأول");
  await actor(3); await denied(() => db.query("select lub.withdraw_application($1)", [first]));
  await actor(2); await db.query("select lub.withdraw_application($1)", [first]); const second = await submit(round, form, "طلبي الثاني"); expect(second).not.toBe(first);
  await db.exec("reset role");
  expect((await db.query<{ to_status_code: string }>("select to_status_code from lub.history_events where membership_case_id=$1 order by occurred_at,id", [first])).rows.map(row => row.to_status_code).sort()).toEqual(["Submitted", "Withdrawn"]);
});
it("atomically accepts applicants into membership and preserves the decision reason and timeline", async () => {
  const { form, round } = await publishedRound(); await actor(2); const first = await submit(round, form, "طلبي");
  await actor(3); const second = await submit(round, form, "طلب آخر"); await denied(() => db.query("select lub.decide_application($1,'Accepted','')", [first]));
  await actor(1); await db.query("select lub.decide_application($1,'Accepted','مرحباً بك')", [first]);
  await db.query("select lub.decide_application($1,'Rejected','لا يستوفي المتطلبات')", [second]);
  await denied(() => db.query("select lub.decide_application($1,'Rejected','قرار مكرر')", [first]));
  await actor(2); await denied(() => submit(round, form, "أنا عضو حالياً"));
  await db.exec("reset role");
  expect((await db.query<{ user_id: string }>("select user_id from lub.organization_memberships where user_id in ($1,$2)", [id(2), id(3)])).rows).toEqual([{ user_id: id(2) }]);
  expect((await db.query<{ decision_note: string }>("select decision_note from lub.membership_cases where id=$1", [second])).rows[0].decision_note).toBe("لا يستوفي المتطلبات");
  expect((await db.query<{ total: number }>("select count(*)::int total from lub.history_events where membership_case_id in ($1,$2)", [first, second])).rows[0].total).toBe(4);
});
it("keeps bulk decisions atomic and permits reapplication after a previously accepted membership ends", async () => {
  const { form, round } = await publishedRound(); await actor(2); const first = await submit(round, form, "طلب أول"); await actor(3); const second = await submit(round, form, "طلب ثان");
  await actor(1); await denied(() => db.query("select lub.bulk_decide_applications($1::uuid[],'Accepted','')", [[first, id(999)]]));
  await db.exec("reset role"); expect((await db.query<{ status_code: string }>("select status_code from lub.membership_cases where id=$1", [first])).rows[0].status_code).toBe("Submitted");
  await actor(2); await denied(() => db.query("select lub.bulk_decide_applications($1::uuid[],'Accepted','')", [[first, second]]));
  await actor(1); expect((await db.query<{ count: number }>("select lub.bulk_decide_applications($1::uuid[],'Accepted','') count", [[first, second]])).rows[0].count).toBe(2);
  await db.exec("reset role"); await db.query("update lub.organization_memberships set status_code='Ended',end_date=lub.today_riyadh() where user_id=$1", [id(2)]);
  await actor(2); const replacement = await submit(round, form, "عودة بعد انتهاء العضوية"); expect(replacement).not.toBe(first);
});
it("rejects attempts to rewrite a submitted question snapshot or detach its answers from its fields", async () => {
  const { form, round } = await publishedRound(); await actor(2); const application = await submit(round, form, "إجابتي");
  await db.exec("reset role"); await denied(() => db.query("update lub.membership_cases set form_snapshot='{}' where id=$1", [application]));
  await denied(() => db.query("update lub.membership_cases set answers=$2::jsonb where id=$1", [application, JSON.stringify({ [id(999)]: "حقل غير معروف" })]));
});
