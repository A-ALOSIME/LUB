import { storageFixture } from "./storage-fixture";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { readdirSync, readFileSync } from "node:fs";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { discoverySchema, organizationProfileSchema } from "@/features/organizations/validation";

let engine: PGlite;
let database: PgliteDatabase<typeof schema>;
let scopedReads=0;
let visitorSelects=0;
type Tx = Parameters<Parameters<PgliteDatabase<typeof schema>["transaction"]>[0]>[0];
vi.mock("server-only", () => ({}));
vi.mock("next/cache",()=>({unstable_cache:(fn:unknown)=>fn}));
vi.mock("@/db/client", () => ({
  getDb: () => ({execute: async (query: Parameters<Tx["execute"]>[0]) => (await database.execute(query)).rows}),
  withUser: async <T>(id: string, operation: (tx: Tx) => Promise<T>) => database.transaction(async tx => {
    await tx.execute(sql`select set_config('request.jwt.claim.sub',${id},true)`); await tx.execute(sql`set local role authenticated`); return operation(new Proxy(tx, {get(target,key){if(key==="execute")return async(query:Parameters<Tx["execute"]>[0])=>{scopedReads++;return(await target.execute(query)).rows;};return Reflect.get(target,key);}}));
  }),
  withVisitor: async <T>(operation: (tx: Tx) => Promise<T>) => database.transaction(async tx => {
    await tx.execute(sql`select set_config('request.jwt.claim.sub','',true)`); await tx.execute(sql`set local role anon`); return operation(new Proxy(tx, {get(target,key){if(key==="select")return (...args:Parameters<Tx["select"]>)=>{visitorSelects++;return target.select(...args);};if(key==="execute")return async(query:Parameters<Tx["execute"]>[0])=>(await target.execute(query)).rows;return Reflect.get(target,key);}}));
  }),
}));
import { getPublicDirectory, getPublicOrganization } from "@/features/organizations/public-repository";
import { createOrganization, appointPrimaryLeader, saveOrganizationProfile, saveAnnouncement, getManagementAccess, getManagementDashboard, getManagementOrganization, saveCommittee, copyCommittee, setCommitteeStatus, getMembershipHistory } from "@/features/organizations/management-repository";

const admin = "00000000-0000-4000-8000-000000000001";
const leader = "00000000-0000-4000-8000-000000000002";
const org = "00000000-0000-4000-8000-000000000101";
beforeEach(async () => {
  engine = new PGlite(); database = drizzle(engine, { schema });
  await engine.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
    insert into auth.users values ('${admin}'),('${leader}');`);
  await storageFixture(engine);
  for (const file of readdirSync("drizzle").filter(x => x.endsWith(".sql")).sort()) await engine.exec(readFileSync(`drizzle/${file}`, "utf8"));
  await engine.exec(`insert into lub.users(id,email,email_verified_at) values ('${admin}','admin@example.invalid',now()),('${leader}','leader@example.invalid',now());
    insert into lub.student_profiles(user_id,full_name_ar,university_id_ciphertext,university_id_lookup_hash,major_name,academic_level) values
    ('${admin}','المشرف','secret1','${"a".repeat(64)}','الحاسب','4'),('${leader}','القائد','secret2','${"b".repeat(64)}','الحاسب','4');
    insert into lub.global_role_assignments(user_id,role_code,assigned_by_user_id) values('${admin}','SA','${admin}');
    insert into lub.organizations(id,type_code,slug,name_ar) values('${org}','Club','tech','نادي التقنية');
    insert into lub.organizations(type_code,slug,name_ar,status_code,archived_at) values('Council','history','المجلس السابق','Archived',now());
    insert into lub.committees(organization_id,name,is_public) values('${org}','اللجنة العامة',true),('${org}','اللجنة الخاصة',false);`);
}, 30000);
afterEach(async () => { await engine.close(); });

it("publishes only authorized public announcements and retains one pinned item", async () => {
  await appointPrimaryLeader(admin, org, "leader@example.invalid");
  await expect(saveAnnouncement(admin, org, { title: "خبر", body: "عام", published: true, pinned: false })).rejects.toThrow();
  const first = await saveAnnouncement(leader, org, { title: "إعلان أول", body: "تفاصيل أولى", published: true, pinned: true });
  const draft = await saveAnnouncement(leader, org, { title: "مسودة", body: "سر", published: false, pinned: false });
  const second = await saveAnnouncement(leader, org, { title: "إعلان ثان", body: "تفاصيل ثانية", published: true, pinned: true });
  const publicPage = await getPublicOrganization("tech");
  expect(publicPage?.announcements.map(item => item.id)).toEqual([second, first]);
  expect(publicPage?.announcements.map(item => item.pinned)).toEqual([true, false]);
  expect(JSON.stringify(publicPage)).not.toContain("مسودة");
  await saveAnnouncement(leader, org, { title: "مسودة", body: "سر", published: true, pinned: false }, draft);
  expect((await getPublicOrganization("tech"))?.announcements).toHaveLength(3);
  await expect(saveAnnouncement(admin, org, { title: "تعديل", body: "غير مسموح", published: true, pinned: false }, first)).rejects.toThrow();
});

it("features only a published event from its own organization", async () => {
  await appointPrimaryLeader(admin, org, "leader@example.invalid");
  await engine.query("select set_config('request.jwt.claim.sub',$1,false)", [leader]); await engine.exec("set role authenticated");
  const created = await engine.query<{id:string}>("select lub.save_event(null,$1,'فعالية مميزة','وصف','In_Person','قاعة',null,now()+interval '1 day',now()+interval '2 days',now()-interval '1 hour',now()+interval '12 hours',5,null,0,null) as id", [org]);
  const event = created.rows[0].id;
  await expect(engine.query("select lub.set_featured_event($1,true)", [event])).rejects.toThrow();
  await engine.query("select lub.change_event_status($1,'Published',1)", [event]);
  await engine.query("select lub.set_featured_event($1,true)", [event]);
  await engine.exec("reset role");
  const publicPage = await getPublicOrganization("tech");
  expect(publicPage?.upcomingEvents[0]).toMatchObject({ id: event, featured: true });
  await engine.query("select set_config('request.jwt.claim.sub',$1,false)", [admin]); await engine.exec("set role authenticated");
  await expect(engine.query("select lub.set_featured_event($1,false)", [event])).rejects.toThrow();
  await engine.exec("reset role");
});

it("publishes only chosen event report and photo links without exposing operational assets", async () => {
  const {eventDetail} = await import("@/features/events/repository");
  await appointPrimaryLeader(admin, org, "leader@example.invalid");
  await engine.query("select set_config('request.jwt.claim.sub',$1,false)", [leader]); await engine.exec("set role authenticated");
  const created = await engine.query<{id:string}>("select lub.save_event(null,$1,'تقرير فعالية','وصف','In_Person','قاعة',null,now()+interval '1 day',now()+interval '2 days',now()-interval '1 hour',now()+interval '12 hours',5,null,0,null) as id", [org]);
  const event = created.rows[0].id;
  await expect(engine.query("select lub.set_event_public_content($1,'ملخص',array['https://example.com/photo.png'])", [event])).rejects.toThrow();
  await engine.query("select lub.change_event_status($1,'Published',1)", [event]);
  await expect(engine.query("select lub.set_event_public_content($1,'ملخص',array['http://example.com/photo.png'])", [event])).rejects.toThrow();
  await engine.query("select lub.set_event_public_content($1,'ملخص منشور',array['https://example.com/photo.png'])", [event]);
  await engine.exec("reset role");
  const publicEvent = await eventDetail(null,event);
  expect(publicEvent?.event.public_report).toBe("ملخص منشور");
  expect(publicEvent?.event.public_photos).toEqual(["https://example.com/photo.png"]);
  expect(publicEvent?.assets).toEqual([]);
  await engine.query("select set_config('request.jwt.claim.sub',$1,false)", [admin]); await engine.exec("set role authenticated");
  await expect(engine.query("select lub.set_event_public_content($1,'تغيير',array[]::text[])", [event])).rejects.toThrow();
  await engine.exec("reset role");
});

it("executes safe talent DTOs and combines private readiness with workspace in one query",async()=>{
 const {talentDirectory,publicTalent,talentWorkspace}=await import("@/features/talent/repository");const pages={organizations:0,events:0,projects:0,sources:0};
 expect(await publicTalent(leader,pages)).toBeNull();expect(await talentDirectory("",null,0)).toEqual([]);scopedReads=0;const workspace=await talentWorkspace(leader,pages);expect(scopedReads).toBe(1);expect(workspace?.onboarded).toBe(true);expect(workspace?.settings).toEqual({});
 await engine.query("select set_config('request.jwt.claim.sub',$1,false)",[leader]);await engine.exec("set role authenticated");await engine.query("select lub.save_talent_settings('نبذة',true,true,true,true,true)");await engine.query("select lub.save_talent_skill('تصميم',true)");await engine.exec("reset role");
 expect((await talentDirectory("القائد","تصميم",0)).map(p=>p.id)).toEqual([leader]);expect((await publicTalent(leader,pages))?.skills).toEqual(["تصميم"]);expect(JSON.stringify(await publicTalent(leader,pages))).not.toMatch(/secret2|lookup|university/);
});

it("reads published event discovery anonymously and private event data in one scoped query",async()=>{
 const {listEvents,eventDetail,eventWorkspace}=await import("@/features/events/repository");
 await appointPrimaryLeader(admin,org,"leader@example.invalid");
 await engine.query("select set_config('request.jwt.claim.sub',$1,false)",[leader]);await engine.exec("set role authenticated");
 const e=(await engine.query<{id:string}>("select lub.save_event(null,$1,'فعالية الاختبار','وصف','In_Person','قاعة',null,now()+interval '1 day',now()+interval '2 days',now()-interval '1 hour',now()+interval '12 hours',5,null,0,null) as id",[org])).rows[0].id;
 await engine.exec("reset role");expect(await eventDetail(null,e)).toBeUndefined();
 await engine.query("select set_config('request.jwt.claim.sub',$1,false)",[leader]);await engine.exec("set role authenticated");await engine.query("select lub.change_event_status($1,'Published',1)",[e]);await engine.exec("reset role");
 const visible=await eventDetail(null,e);expect(visible?.remaining).toBe(5);expect(visible?.own).toBeNull();expect(visible?.registrations).toEqual([]);expect((await listEvents("","upcoming",0)).map(x=>x.id)).toEqual([e]);
 scopedReads=0;const ops=await eventDetail(leader,e);expect(scopedReads).toBe(1);expect(ops?.canManage).toBe(true);scopedReads=0;expect((await eventWorkspace(leader,org,0))?.events).toHaveLength(1);expect(scopedReads).toBe(1);
 expect((await eventDetail(admin,e))?.canManage).toBe(false);expect(await eventWorkspace(admin,org,0)).toBeUndefined();
});

it("combines public organization sections in one select and filters only published upcoming events and open rounds",async()=>{
 const{taskDetail}=await import("@/features/tasks/repository");const{initialDefinition}=await import("@/features/forms/definition");
 await appointPrimaryLeader(admin,org,"leader@example.invalid");await engine.query("select set_config('request.jwt.claim.sub',$1,false)",[leader]);await engine.exec("set role authenticated");
 const event=(await engine.query<{id:string}>("select lub.save_event(null,$1,'فعالية عامة','وصف','In_Person','قاعة',null,now()+interval '1 day',now()+interval '2 days',now()-interval '1 hour',now()+interval '12 hours',5,null,0,null) as id",[org])).rows[0].id;
 const task=(await engine.query<{id:string}>("select lub.save_task(null,$1,null,null,'مهمة مرتبطة','وصف داخلي',null,null,0,null) as id",[org])).rows[0].id;await engine.query("select lub.link_task_event($1,$2,1)",[task,event]);await engine.exec("reset role");
 visitorSelects=0;expect((await getPublicOrganization('tech'))?.upcomingEvents).toEqual([]);expect(visitorSelects).toBe(1);expect((await getPublicDirectory(discoverySchema.parse({upcoming:'on'}))).organizations).toEqual([]);expect((await getPublicDirectory(discoverySchema.parse({open:'on'}))).organizations).toEqual([]);
 scopedReads=0;expect((await taskDetail(leader,task))?.linkedEvent?.id).toBe(event);expect(scopedReads).toBe(1);expect(await taskDetail(admin,task)).toBeUndefined();
 await engine.query("select set_config('request.jwt.claim.sub',$1,false)",[leader]);await engine.exec("set role authenticated");await engine.query("select lub.change_event_status($1,'Published',1)",[event]);
 const template=(await engine.query<{id:string}>("select lub.create_form($1,'نموذج عام',null) as id",[org])).rows[0].id;const version=(await engine.query<{id:string}>("select id from lub.form_versions where form_template_id=$1",[template])).rows[0].id;
 await engine.query("select lub.save_form_draft($1,$2::jsonb,1)",[version,JSON.stringify(initialDefinition)]);await engine.query("select lub.publish_form_version($1)",[version]);const round=(await engine.query<{id:string}>("select lub.create_registration_round($1,$2,'التسجيل المفتوح',now()-interval '1 hour',now()+interval '1 day',true) as id",[org,template])).rows[0].id;await engine.query("select lub.change_round_status($1,'Open')",[round]);await engine.exec("reset role");
 await engine.query("insert into lub.committees(organization_id,name,is_public) select $1,'لجنة '||i,true from generate_series(1,26)i",[org]);
 visitorSelects=0;const detail=await getPublicOrganization('tech');expect(visitorSelects).toBe(1);expect(detail?.upcomingEvents.map(e=>e.id)).toEqual([event]);expect(detail?.rounds).toEqual([{id:round,title:'التسجيل المفتوح',open:true}]);expect(detail?.moreCommittees).toBe(true);expect((await getPublicOrganization('tech',1))?.committees).toHaveLength(2);
 expect((await getPublicDirectory(discoverySchema.parse({upcoming:'on',open:'on'}))).organizations.map(o=>o.id)).toEqual([org]);
});

it("reads paginated document headers in one scoped query without assets or full snapshots",async()=>{
 const {documentWorkspace,myDocuments,documentAsset}=await import("@/features/documents/repository");
 await appointPrimaryLeader(admin,org,"leader@example.invalid");
 const member=(await engine.query<{id:string}>("insert into lub.organization_memberships(organization_id,user_id) values($1,$2) returning id",[org,admin])).rows[0].id;
 await engine.query("select set_config('request.jwt.claim.sub',$1,false)",[admin]);await engine.exec("set role authenticated");const term=(await engine.query<{id:string}>("select lub.create_academic_term('2026','T1','الفصل الأول',current_date-5,current_date+5) as id")).rows[0].id;
 await engine.exec("reset role");await engine.query("select set_config('request.jwt.claim.sub',$1,false)",[leader]);await engine.exec("set role authenticated");await engine.query("select lub.add_hours($1,null,$2,2.5,current_date,'عمل',false)",[member,term]);
 let first='';for(let i=0;i<27;i++){
  const upload=(await engine.query<{document_id:string;upload_attempt:string;storage_key:string}>("with created as materialized(select lub.generate_document($1,null,'Hours_Certificate',$2,'All',null,null,null) as id) select upload.* from created cross join lateral lub.document_upload(created.id) upload",[org,member])).rows[0];first=upload.document_id;
  await engine.query("insert into storage.objects(bucket_id,name,owner_id) values('lub-generated-documents',$1,$2)",[upload.storage_key,leader]);await engine.query('select lub.complete_document($1,$2,true)',[first,upload.upload_attempt]);
 }
 await engine.exec("reset role");scopedReads=0;const own=await myDocuments(admin,0);expect(scopedReads).toBe(1);expect(own?.items).toHaveLength(26);expect(own?.items[0].canArchive).toBe(false);expect(JSON.stringify(own)).not.toContain('data_snapshot_json');expect(JSON.stringify(own)).not.toContain('secret1');expect((await myDocuments(admin,1))?.items).toHaveLength(2);
 scopedReads=0;const workspace=await documentWorkspace(leader,org,null,0,0);expect(scopedReads).toBe(1);expect(workspace?.account.onboarded).toBe(true);expect(workspace?.items).toHaveLength(26);expect(workspace?.members).toHaveLength(1);expect(workspace?.members[0]).toEqual({id:member,name:'المشرف',start_date:expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),end_date:null});expect(workspace?.grants).toEqual([]);expect(workspace?.items[0].total).toBe('2.50');expect(await documentWorkspace(admin,org,null,0,0)).toBeUndefined();expect((await documentAsset(admin,first))?.mime_type).toBe('text/html');
 await engine.query("select set_config('request.jwt.claim.sub',$1,false)",[leader]);await engine.exec("set role authenticated");await engine.query("select lub.grant_report_permission($1,null,null)",[member]);await engine.exec("reset role");
 const managed=await getManagementOrganization(admin,org);expect(managed?.organization.canReports).toBe(true);expect(managed?.organization.canHours).toBe(false);expect((await getManagementDashboard(admin)).access.organizations.map(o=>o.id)).toEqual([org]);
});

it("reads hours and renewals with scoped totals, bounded lists and the genuine repository SQL",async()=>{
 const {myHours,hoursWorkspace,termWorkspace}=await import("@/features/hours/repository");
 const {myRenewals,renewalWorkspace}=await import("@/features/renewals/repository");
 await appointPrimaryLeader(admin,org,"leader@example.invalid");
 const member=(await engine.query<{id:string}>("insert into lub.organization_memberships(organization_id,user_id) values($1,$2) returning id",[org,admin])).rows[0].id;
 await engine.query("select set_config('request.jwt.claim.sub',$1,false)",[admin]);await engine.exec("set role authenticated");
 const term=(await engine.query<{id:string}>("select lub.create_academic_term('2026','T1','الفصل الأول',current_date-30,current_date+90) as id")).rows[0].id;
 await engine.exec("reset role");await engine.query("select set_config('request.jwt.claim.sub',$1,false)",[leader]);await engine.exec("set role authenticated");
 for(let i=0;i<27;i++)await engine.query("select lub.add_hours($1,null,$2,1.5,current_date,'عمل تطوعي',false)",[member,term]);
 const c=(await engine.query<{id:string}>("select lub.create_renewal($1,$2,now()-interval '1 hour',now()+interval '1 day',false) as id",[org,term])).rows[0].id;
 await engine.query("select lub.change_renewal_status($1,'Open')",[c]);await engine.exec("reset role");
 scopedReads=0;const own=await myHours(admin,term,0);expect(scopedReads).toBe(1);expect(own?.account.onboarded).toBe(true);expect(own?.total).toBe("40.50");expect(own?.records).toHaveLength(26);expect(own?.records[0].decisions).toHaveLength(1);expect((await myHours(admin,term,1))?.records).toHaveLength(2);
 expect((await myHours(leader,term,0))?.records).toHaveLength(0);
 const filters={term,committee:null,page:0,memberPage:0,rulePage:0};scopedReads=0;const workspace=await hoursWorkspace(leader,org,filters);expect(scopedReads).toBe(1);expect(workspace?.total).toBe("40.50");expect(workspace?.scopes[0].approve).toBe(true);expect(workspace?.members).toHaveLength(2);expect(workspace?.records[0].owner).toBe("المشرف");expect(await hoursWorkspace(admin,org,filters)).toBeUndefined();
 expect((await termWorkspace(admin))?.canManage).toBe(true);expect((await termWorkspace(leader))?.canManage).toBe(false);
 scopedReads=0;const renewals=await myRenewals(admin,0);expect(scopedReads).toBe(1);expect(renewals?.items).toHaveLength(1);expect(renewals?.items[0].response.canRespond).toBe(true);
 scopedReads=0;const renew=await renewalWorkspace(leader,org,c,0,0);expect(scopedReads).toBe(1);expect(renew?.selected?.id).toBe(c);expect(renew?.responses).toHaveLength(2);expect(renew?.counts[0].count).toBe(2);expect(await renewalWorkspace(admin,org,c,0,0)).toBeUndefined();
 const {getMyPageData}=await import("@/features/organizations/my-page-repository");expect((await getMyPageData(admin)).hours).toBe("40.50");
});

it("reads scoped tasks, selected submissions, personal summaries and former-member history through real repository SQL",async()=>{
 await engine.exec("insert into lub.academic_terms(academic_year,term_code,name_ar,start_date,end_date) values('test','T1','الفصل التجريبي',current_date-30,current_date+90)");
 const {listTasks,taskWorkspace,taskDetail,taskNotifications}=await import("@/features/tasks/repository");
 const {getMyPageData}=await import("@/features/organizations/my-page-repository");
 await appointPrimaryLeader(admin,org,"leader@example.invalid");
 const member=(await engine.query<{id:string}>("insert into lub.organization_memberships(organization_id,user_id) values($1,$2) returning id",[org,admin])).rows[0].id;
 await engine.query("select set_config('request.jwt.claim.sub',$1,false)",[leader]);await engine.exec("set role authenticated");
 const task=(await engine.query<{id:string}>("select lub.save_task(null,$1,null,null,'مهمة فعلية','وصفها',null,null,2,null) as id",[org])).rows[0].id;
 await engine.query("select lub.change_task_status($1,'Open',1)",[task]);await engine.exec("reset role");
 expect((await taskWorkspace(leader,org))?.scopes[0].tasks).toBe(true);expect(await taskWorkspace(admin,org)).toBeUndefined();
 expect((await listTasks(admin,{page:0})).items[0].task.id).toBe(task);
 await engine.query("select set_config('request.jwt.claim.sub',$1,false)",[admin]);await engine.exec("set role authenticated");
 const participant=(await engine.query<{id:string}>("select lub.join_task($1) as id",[task])).rows[0].id;
 const submission=(await engine.query<{id:string}>("select lub.submit_task($1,'مخرج',array[]::uuid[],0,2) as id",[participant])).rows[0].id;await engine.exec("reset role");
 const detail=await taskDetail(leader,task,participant);expect(detail?.selected?.id).toBe(participant);expect(detail?.submissions[0].id).toBe(submission);expect(detail?.submissions[0].task_snapshot.description).toBe("وصفها");expect(detail?.team[0].name).toBe("المشرف");
 expect((await getMyPageData(admin)).tasks[0].id).toBe(task);
 await engine.query("select set_config('request.jwt.claim.sub',$1,false)",[leader]);await engine.exec("set role authenticated");await engine.query("select lub.review_task_submission($1,'Rejected','تعديل',null)",[submission]);await engine.exec("reset role");
 expect((await taskNotifications(admin,0))[0].target_url).toBe(`/tasks/${task}`);
 await engine.query("update lub.organization_memberships set status_code='Ended',end_date=current_date where id=$1",[member]);
 const history=await taskDetail(admin,task);expect(history?.current).toBe(false);expect(history?.team).toEqual([]);expect(history?.submissions[0].message).toBe("مخرج");expect((await listTasks(admin,{page:0,mine:true})).items[0].historical).toBe(true);
});

it("reads active organizations without an account, and explicitly includes archives when requested", async () => {
  const page = await getPublicDirectory(discoverySchema.parse({}));
  expect(page.organizations.map(x => x.slug)).toEqual(["tech"]);
  expect((await getPublicDirectory(discoverySchema.parse({ inactive: "on" }))).organizations).toHaveLength(2);
  expect((await getPublicDirectory(discoverySchema.parse({ type: "Council", inactive: "on" }))).organizations.map(x => x.slug)).toEqual(["history"]);
});
it("uses literal bounded name search and does not let SQL wildcards widen it", async () => {
  expect((await getPublicDirectory(discoverySchema.parse({ q: "التقنية" }))).organizations).toHaveLength(1);
  expect((await getPublicDirectory(discoverySchema.parse({ q: "%" }))).organizations).toHaveLength(0);
});
it("returns an explicit public projection and hides private committees and identifiers", async () => {
  const detail = await getPublicOrganization("tech");
  expect(detail?.committees.map(x => x.name)).toEqual(["اللجنة العامة"]);
  expect(JSON.stringify(detail)).not.toMatch(/secret|ciphertext|lookup_hash|email|membership|permission/i);
  expect(await getPublicOrganization("does-not-exist")).toBeUndefined();
  expect(await getPublicOrganization("../me")).toBeUndefined();
  expect((await getPublicOrganization("history"))?.organization.statusCode).toBe("Archived");
});
it("keeps pagination bounded while preserving a next-page signal", async () => {
  await engine.exec("insert into lub.organizations(type_code,slug,name_ar) select 'Club','club-'||n,'نادي '||n from generate_series(1,25) n");
  const first = await getPublicDirectory(discoverySchema.parse({}));
  const second = await getPublicDirectory(discoverySchema.parse({ page: 2 }));
  expect(first.organizations).toHaveLength(24); expect(first.hasNext).toBe(true);
  expect(second.organizations).toHaveLength(2); expect(second.hasNext).toBe(false);
});

it("creates an organization only for SA and exposes operational scope only after appointment", async () => {
  await expect(createOrganization(leader, { nameAr: "نادي جديد", slug: "new", typeCode: "Club", summary: "", mission: "" })).rejects.toThrow();
  const created = await createOrganization(admin, { nameAr: "نادي جديد", slug: "new", typeCode: "Club", summary: "نبذة", mission: "" });
  expect((await getManagementAccess(admin)).organizations).toHaveLength(0);
  await appointPrimaryLeader(admin, created.id, "leader@example.invalid");
  expect((await getManagementAccess(leader)).organizations.map(x => x.id)).toEqual([created.id]);
  expect((await getMembershipHistory(leader)).map(x => x.organizationName)).toEqual(["نادي جديد"]);
  expect((await getMembershipHistory(leader))[0].roles.map(x => x.code)).toEqual(["OL"]);
  expect(await getManagementOrganization(admin, created.id)).toBeUndefined();
});

it("isolates administrative roster data in the combined dashboard", async () => {
  const dashboard = await getManagementDashboard(admin);
  expect(dashboard.access.superAdmin).toBe(true);
  expect(dashboard.admins).toEqual([{ userId: admin, fullName: "المشرف" }]);
  expect(dashboard.roster).toHaveLength(2);
  const student = await getManagementDashboard(leader);
  expect(student.admins).toEqual([]);
  expect(student.roster).toEqual([]);
  expect(student.access.superAdmin).toBe(false);
});

it("keeps ended leadership roles in the student's own membership history", async () => {
  await appointPrimaryLeader(admin, org, "leader@example.invalid");
  await appointPrimaryLeader(admin, org, "admin@example.invalid");
  const [history] = await getMembershipHistory(leader);
  expect(history.statusCode).toBe("Active");
  expect(history.endDate).toBeNull();
  expect(history.roles[0].code).toBe("OL");
  expect(history.roles[0].endDate).not.toBeNull();
});
it("saves public profile, distinct interests and contacts atomically and audits the changes", async () => {
  await appointPrimaryLeader(admin, org, "leader@example.invalid");
  await saveOrganizationProfile(leader, org, organizationProfileSchema.parse({ nameAr: "نادي التقنية", summary: "نبذة جديدة", mission: "رسالتنا", logoUrl: "https://example.com/logo.png", showLeadershipPublicly: true, tagNames: "تقني، تطوعي، تقني", websiteUrl: "https://example.com" }));
  const detail = await getPublicOrganization("tech");
  expect(detail?.organization.tags).toEqual(["تطوعي", "تقني"]);
  expect(detail?.organization.logoUrl).toBe("https://example.com/logo.png");
  expect(detail?.contacts.map(x => x.url)).toEqual(["https://example.com"]);
  expect(detail?.leadership).toEqual([{ fullName: "القائد", roleCode: "OL" }]);
  const tag = (await engine.query<{ id: string }>("select id from lub.tags where name_ar=$1", ["تقني"])).rows[0];
  expect((await getPublicDirectory(discoverySchema.parse({ tag: tag.id }))).organizations).toHaveLength(1);
  const audits = (await engine.query("select action_code,metadata from lub.audit_log where organization_id=$1", [org])).rows;
  expect(audits.length).toBeGreaterThan(2);
  expect(JSON.stringify(audits)).not.toMatch(/example.com|secret|ciphertext|نبذة/);
});
it("creates and copies committees without copying private roles or memberships, then archives them", async () => {
  await appointPrimaryLeader(admin, org, "leader@example.invalid");
  const created = await saveCommittee(leader, org, { name: "لجنة التصميم", description: "نعمل على التصاميم", isPublic: false });
  const copied = await copyCommittee(leader, org, created.id);
  const managed = await getManagementOrganization(leader, org);
  expect(managed?.committees.some(x => x.id === copied.id && x.copiedFromCommitteeId === created.id)).toBe(true);
  expect((await getPublicOrganization("tech"))?.committees.some(x => x.id === copied.id)).toBe(false);
  await setCommitteeStatus(leader, org, created.id, "Archived");
  expect((await getManagementOrganization(leader, org))?.committees.find(x => x.id === created.id)?.statusCode).toBe("Archived");
  await expect(saveCommittee(admin, org, { name: "مرفوضة", description: "", isPublic: true })).rejects.toThrow();
});
it("rolls back profile and audit updates when a child record cannot be stored", async () => {
  await appointPrimaryLeader(admin, org, "leader@example.invalid");
  const before = (await engine.query("select count(*)::int as n from lub.audit_log")).rows;
  await expect(saveOrganizationProfile(leader, org, { nameAr: "اسم لن يحفظ", summary: "", mission: "", logoUrl: "", showLeadershipPublicly: true, tagNames: ["x".repeat(41)], websiteUrl: "" })).rejects.toThrow();
  expect((await getPublicOrganization("tech"))?.organization.nameAr).toBe("نادي التقنية");
  expect((await engine.query("select count(*)::int as n from lub.audit_log")).rows).toEqual(before);
});

it("renders and edits only the assigned committee for a committee leader", async () => {
  const { rows: memberRows } = await engine.query<{ id: string }>("insert into lub.organization_memberships(organization_id,user_id) values($1,$2) returning id", [org, leader]);
  const { rows: committeeRows } = await engine.query<{ id: string }>("select id from lub.committees where organization_id=$1 and not is_public", [org]);
  const ownCommittee = committeeRows[0].id;
  await engine.query("insert into lub.role_assignments(organization_membership_id,organization_id,committee_id,role_code,assigned_by_user_id) values($1,$2,$3,'CL',$4)", [memberRows[0].id, org, ownCommittee, admin]);
  const access = await getManagementAccess(leader);
  expect(access.organizations).toHaveLength(1);
  expect(access.organizations[0].canEdit).toBe(false);
  expect(access.organizations[0].canManageCommittees).toBe(false);
  expect((await getManagementOrganization(leader, org))?.committees.map(x => x.id)).toEqual([ownCommittee]);
  await saveCommittee(leader, org, { name: "لجنتي", description: "محدّثة", isPublic: false }, ownCommittee);
  expect((await getManagementOrganization(leader, org))?.committees[0].name).toBe("لجنتي");
  await expect(copyCommittee(leader, org, ownCommittee)).rejects.toThrow();
});


it("executes the workflow repository with actual RLS and bounded question payloads",async()=>{
 await appointPrimaryLeader(admin,org,"leader@example.invalid");
 const {getWorkspace,getRound,publicRounds,listApplications,getApplicationDetail,ownApplication}=await import("@/features/forms/repository");
 const {initialDefinition}=await import("@/features/forms/definition");
 await engine.exec("begin");await engine.query("select set_config('request.jwt.claim.sub',$1,true)",[leader]);await engine.exec("set local role authenticated");
 const template=(await engine.query<{id:string}>("select lub.create_form($1,'تسجيل',null) as id",[org])).rows[0].id;
 const version=(await engine.query<{id:string}>("select id from lub.form_versions where form_template_id=$1",[template])).rows[0].id;
 await engine.query("select lub.save_form_draft($1,$2::jsonb,1)",[version,JSON.stringify(initialDefinition)]);
 await engine.query("select lub.publish_form_version($1)",[version]);
 const round=(await engine.query<{id:string}>("select lub.create_registration_round($1,$2,'انضمام',now()-interval '1 hour',now()+interval '1 day',true) as id",[org,template])).rows[0].id;
 await engine.query("select lub.change_round_status($1,'Open')",[round]);await engine.exec("commit");
 expect((await getWorkspace(leader,org,template))?.templates.find(t=>t.id===template)?.versions[0].definition).toEqual(initialDefinition);
 expect((await getWorkspace(leader,org))?.templates.find(t=>t.id===template)?.versions[0].definition).toBeUndefined();
 expect((await publicRounds(org))[0].id).toBe(round);expect((await getRound(round))?.version.id).toBe(version);
 await engine.exec("begin");await engine.query("select set_config('request.jwt.claim.sub',$1,true)",[admin]);await engine.exec("set local role authenticated");
 const app=(await engine.query<{id:string}>("select lub.submit_application($1,$2,$3::jsonb,null,null,null) as id",[round,version,JSON.stringify({[initialDefinition.sections[0].fields[0].id]:"مشاركة"})])).rows[0].id;await engine.exec("commit");
 expect((await listApplications(leader,org))[0].name).toBe("المشرف");expect((await getApplicationDetail(admin,app))?.answers).toEqual({[initialDefinition.sections[0].fields[0].id]:"مشاركة"});
 expect(await ownApplication(admin,round)).toBe(app);
});
it("supplies the personal dashboard in one scoped read without another user's private records",async()=>{
 const {getMyPageData}=await import("@/features/organizations/my-page-repository");
 await engine.exec(`insert into lub.profile_settings(user_id) values('${leader}'),('${admin}')`);
 await appointPrimaryLeader(admin,org,"leader@example.invalid");
 const data=await getMyPageData(leader);expect(data.profile?.fullName).toBe("القائد");expect(data.access.superAdmin).toBe(false);expect(data.memberships[0].roles[0].code).toBe("OL");
 expect(JSON.stringify(data)).not.toMatch(/secret|lookup|example|المشرف/);
});
