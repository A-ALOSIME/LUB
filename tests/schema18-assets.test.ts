import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import { storageFixture } from "./storage-fixture";
const id = (n: number) => `50000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let db: PGlite;
async function actor(n: number) { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('role','authenticated',true)", [id(n)]); }
async function denied(run: () => Promise<unknown>) { await db.exec("savepoint denied"); await expect(run()).rejects.toThrow(); await db.exec("rollback to savepoint denied; release savepoint denied"); }
async function asset(n: number, name = "تسليم عربي.pdf", mime = "application/pdf") { const key = `${id(3)}/${id(n)}.${mime === "application/pdf" ? "pdf" : "png"}`; await db.query("select lub.register_application_asset($1,$2,$3,$4,100)", [id(n), key, name, mime]); return key; }
beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;");
  await storageFixture(db);
  for (const file of ["schema18.sql", "administration18.sql", "forms18.sql", "form-library18.sql", "campaigns18.sql", "hours18.sql", "tasks18.sql", "assets18.sql"]) await db.exec(readFileSync(`scripts/schema-simplification/${file}`, "utf8"));
}, 30000);
beforeEach(async () => {
  await db.exec("begin");
  for (let n = 1; n <= 4; n++) {
    await db.query("insert into auth.users values($1)", [id(n)]);
    await db.query("insert into lub.users(id,email,email_verified_at,full_name_ar,university_id_ciphertext,university_id_lookup_hash,major_name,academic_level,onboarded_at) values($1,$2,now(),'طالب','encrypted',$3,'نظم معلومات','5',now())", [id(n), `asset18-${n}@example.invalid`, String(n).repeat(64)]);
  }
  await db.query("insert into lub.organizations(id,type_code,slug,name_ar) values($1,'Club','asset-org','جهة')", [id(100)]);
  for (const n of [200, 201]) await db.query("insert into lub.committees(id,organization_id,name) values($1,$2,'لجنة')", [id(n), id(100)]);
  for (let n = 1; n <= 3; n++) await db.query("insert into lub.organization_memberships(id,organization_id,user_id) values($1,$2,$3)", [id(300 + n), id(100), id(n)]);
  for (const [n, committee] of [[1, 200], [2, 201]]) await db.query("insert into lub.access_assignments(user_id,organization_id,organization_membership_id,committee_id,role_code,assigned_by_user_id) values($1,$2,$3,$4,'CL',$1)", [id(n), id(100), id(300 + n), id(committee)]);
  await db.query("insert into lub.committee_memberships(organization_id,organization_membership_id,committee_id) values($1,$2,$3)", [id(100), id(303), id(200)]);
});
afterEach(async () => { await db.exec("rollback"); }); afterAll(async () => { await db?.close(); });

it("stores Arabic and English display names separately from strict ASCII storage keys", async () => {
  await actor(3); await asset(901); await asset(902, "output.pdf");
  expect((await db.query<{ file_name: string }>("select file_name from lub.assets order by id")).rows.map(r => r.file_name)).toEqual(["تسليم عربي.pdf", "output.pdf"]);
  await denied(() => db.query("select lub.register_application_asset($1,$2,'a.pdf','application/pdf',10)", [id(903), `${id(3)}/اسم.pdf`]));
  await denied(() => db.query("select lub.register_application_asset($1,$2,'a.pdf','application/pdf',10)", [id(903), `${id(4)}/${id(903)}.pdf`]));
  await denied(() => asset(903, "../file.pdf")); await denied(() => asset(903, "a\nb.pdf"));
});
it("rejects unsupported/oversized assets, duplicate ids and a 31st daily upload", async () => {
  await actor(3); await denied(() => db.query("select lub.register_application_asset($1,$2,'a.pdf','application/pdf',5242881)", [id(901), `${id(3)}/${id(901)}.pdf`]));
  await denied(() => asset(901, "file.svg", "image/svg+xml"));
  for (let n = 901; n <= 930; n++) await asset(n);
  await denied(() => asset(901)); await denied(() => asset(931));
});
it("allows only the owner and the correct task reviewer to read submitted files", async () => {
  await actor(3); const key = await asset(901); await db.query("insert into storage.objects(bucket_id,name) values('lub-application-files',$1)", [key]);
  await actor(1); const task = (await db.query<{ id: string }>("select lub.save_task(null,$1,$2,'مهمة تصميم','أنجز التصميم',null,null,5,null) id", [id(100), id(200)])).rows[0].id;
  await db.query("select lub.change_task_status($1,'Open',1)", [task]); await actor(3);
  const participant = (await db.query<{ id: string }>("select lub.join_task($1) id", [task])).rows[0].id;
  await db.query("select lub.submit_task($1,'عمل مكتمل',ARRAY[$2]::uuid[],0,2)", [participant, id(901)]);
  for (const n of [1, 3]) { await actor(n); expect((await db.query("select id from lub.assets where id=$1", [id(901)])).rows).toHaveLength(1); }
  for (const n of [2, 4]) { await actor(n); expect((await db.query("select id from lub.assets where id=$1", [id(901)])).rows).toHaveLength(0); }
  await actor(3); expect((await db.query<{ allowed: boolean }>("select lub.can_delete_asset_object($1) allowed", [key])).rows[0].allowed).toBe(false);
  expect((await db.query("delete from storage.objects where bucket_id='lub-application-files' and name=$1 returning id", [key])).rows).toEqual([]);
});
it("restricts public access to explicitly published content media and revokes it when archived", async () => {
  await actor(3); const key = await asset(901, "poster.png", "image/png"); await asset(902);
  await db.exec("reset role"); await db.query("insert into lub.organization_content(id,organization_id,kind,title,status_code,primary_image_id,published_at,attachments) values($1,$2,'Announcement','إعلان','Published',$3,now(),$4)", [id(700), id(100), id(901), JSON.stringify([{ id: id(902), assetId: id(902) }])]);
  await db.exec("set local role anon"); expect((await db.query<{ allowed: boolean }>("select lub.can_read_public_asset_object($1) allowed", [key])).rows[0].allowed).toBe(true);
  expect((await db.query<{ allowed: boolean }>("select lub.can_read_public_asset_object($1) allowed", [`${id(3)}/${id(902)}.pdf`])).rows[0].allowed).toBe(false);
  await db.exec("reset role"); await db.query("update lub.organization_content set archived_at=now() where id=$1", [id(700)]); await db.exec("set local role anon");
  expect((await db.query<{ allowed: boolean }>("select lub.can_read_public_asset_object($1) allowed", [key])).rows[0].allowed).toBe(false);
});
it("validates thumbnail/dimensions and blocks metadata edits by other users", async () => {
  await actor(3); await asset(901, "image.png", "image/png");
  await db.query("select lub.set_asset_image_dimensions($1,800,1200)", [id(901)]);
  const thumbnail = Buffer.from([137,80,78,71,13,10,26,10]).toString("base64"); await db.query("select lub.set_asset_thumbnail($1,$2)", [id(901), thumbnail]);
  await denied(() => db.query("select lub.set_asset_image_dimensions($1,null,12)", [id(901)])); await denied(() => db.query("select lub.set_asset_thumbnail($1,'not png')", [id(901)]));
  await actor(4); await denied(() => db.query("select lub.set_asset_image_dimensions($1,1,1)", [id(901)])); await denied(() => db.query("select lub.set_asset_thumbnail($1,$2)", [id(901), thumbnail]));
});
it("enforces storage ownership and retains files referenced by nested answers", async () => {
  await actor(3); const key = await asset(901); await db.query("insert into storage.objects(bucket_id,name) values('lub-application-files',$1)", [key]);
  await actor(4); expect((await db.query("select id from storage.objects where name=$1", [key])).rows).toEqual([]);
  await denied(() => db.query("insert into storage.objects(bucket_id,name) values('lub-application-files',$1)", [`${id(3)}/${id(902)}.pdf`]));
  await db.exec("reset role"); await db.query("insert into lub.membership_campaigns(id,organization_id,kind,title) values($1,$2,'Registration','ترم')", [id(800), id(100)]);
  const definition = { layout: "SinglePage", sections: [{ id: id(810), title: "بيانات", description: "", fields: [{ id: id(811), type: "File", label: "أرفق ملفك", help: "", required: true, options: [], maxLength: 300 }] }] };
  await actor(3); await db.exec("reset role");
  await db.query("insert into lub.membership_cases(id,campaign_id,organization_id,user_id,kind,status_code,form_snapshot,answers,attachments) values($1,$2,$3,$4,'Registration','Submitted',$5,$6,$7)", [id(801),id(800),id(100),id(3),JSON.stringify({definition}), JSON.stringify({[id(811)]:id(901)}),JSON.stringify([{ id: id(811), assetId: id(901) }])]);
  await denied(() => db.query("delete from lub.assets where id=$1", [id(901)]));
  await denied(() => db.query("update lub.membership_cases set attachments=$1 where id=$2", [JSON.stringify([{ id:"portfolio",assetId:id(999) }]), id(801)]));
  await actor(3); expect((await db.query("delete from storage.objects where name=$1 returning id", [key])).rows).toEqual([]);
});
it("cleans up an own uploaded object when registering its metadata fails", async () => {
  await actor(3); const key = `${id(3)}/${id(901)}.pdf`;
  await db.query("insert into storage.objects(bucket_id,name) values('lub-application-files',$1)", [key]);
  expect((await db.query("delete from storage.objects where name=$1 returning id", [key])).rows).toHaveLength(1);
  await db.exec("reset role"); await db.query("update lub.users set status_code='Inactive' where id=$1", [id(3)]);
  await actor(3); await denied(() => asset(902));
  await denied(() => db.query("insert into storage.objects(bucket_id,name) values('lub-application-files',$1)", [key]));
});
