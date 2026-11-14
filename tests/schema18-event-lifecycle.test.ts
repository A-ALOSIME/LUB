import {PGlite} from "@electric-sql/pglite";
import {drizzle,type PgliteDatabase} from "drizzle-orm/pglite";
import {type SQL} from "drizzle-orm";
import {readFileSync} from "node:fs";
import {afterAll,afterEach,beforeAll,beforeEach,expect,it,vi} from "vitest";
import {storageFixture} from "./storage-fixture";
const id=(n:number)=>`b0000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
let db:PGlite,database:PgliteDatabase;
let reads=0,currentUser:string;
type Executor={execute:(query:SQL)=>Promise<Record<string,unknown>[]>};
async function scoped<T>(user:string|null,operation:(tx:Executor)=>Promise<T>){
 await db.exec("savepoint source_read");
 try{
  await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('role',$2,true)",[user??"",user?"authenticated":"anon"]);
  const result=await operation({execute:async query=>{reads++;return (await database.execute(query)).rows as Record<string,unknown>[];}});
  await db.exec("release savepoint source_read");
  return result;
 }catch(error){await db.exec("rollback to savepoint source_read;release savepoint source_read");throw error;}
}
vi.mock("server-only",()=>({}));
vi.mock("next/cache",()=>({unstable_cache:<T>(fn:T)=>fn,updateTag:vi.fn(),revalidatePath:vi.fn()}));
vi.mock("@/features/auth/session",()=>({requireUser:async()=>({id:currentUser})}));
vi.mock("@/features/auth/authorization",()=>({studentOperationError:async()=>undefined}));
vi.mock("@/db/client",()=>({withUser:scoped,withVisitor:<T>(operation:(tx:Executor)=>Promise<T>)=>scoped(null,operation)}));
import {mutateEvent} from "@/features/events/actions";
import {eventDetail,listEvents,myEvents,publicEventMetadata} from "@/features/events/repository";
import {eventRegistrants} from "@/features/events/review-repository";
import {organizationEventsVersion} from "@/features/events/management-version";
import {eventWorkspaceOverview,privateEventPoster} from "@/features/events/workspace";
import {eventEditor} from "@/features/events/editor-repository";
async function actor(n:number){currentUser=id(n);await db.exec("reset role");await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('role','authenticated',true)",[id(n)]);}
async function visitor(){await db.exec("reset role");await db.query("select set_config('request.jwt.claim.sub','',true),set_config('role','anon',true)");}
async function denied(run:()=>Promise<unknown>){await db.exec("savepoint denied");await expect(run()).rejects.toThrow();await db.exec("rollback to savepoint denied;release savepoint denied");}
async function create(){return(await db.query<{id:string}>("select lub.save_event(null,$1,'فعالية اختبار','وصف الفعالية','In_Person','قاعة الحاسب',null,now()+interval '2 days',now()+interval '3 days',now()-interval '1 day',now()+interval '1 day',20,null,3,null) id",[id(100)])).rows[0].id;}
beforeAll(async()=>{
 db=new PGlite();database=drizzle(db);await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;");await storageFixture(db);
 for(const file of ["schema18.sql","administration18.sql","forms18.sql","form-library18.sql","campaigns18.sql","hours18.sql","tasks18.sql","assets18.sql","announcements18.sql","events18.sql","event-registration18.sql","skill-catalog18.sql","skills18.sql","event-reads18.sql"])await db.exec(readFileSync(`scripts/schema-simplification/${file}`,"utf8"));
},30000);
beforeEach(async()=>{
 reads=0;await db.exec("begin");for(let n=1;n<=3;n++){await db.query("insert into auth.users values($1)",[id(n)]);await db.query("insert into lub.users(id,email,email_verified_at,full_name_ar,university_id_ciphertext,university_id_lookup_hash,major_name,academic_level,onboarded_at) values($1,$2,now(),'طالب','encrypted',$3,'نظم معلومات','5',now())",[id(n),`event18-${n}@example.invalid`,String(n).repeat(64)]);}
 await db.query("insert into lub.organizations(id,type_code,slug,name_ar) values($1,'Club','event-org','جهة')",[id(100)]);
 for(let n=1;n<=3;n++)await db.query("insert into lub.organization_memberships(id,organization_id,user_id,start_date) values($1,$2,$3,lub.today_riyadh()-10)",[id(300+n),id(100),id(n)]);
 for(const[n,role]of [[1,"OL"],[2,"HRD"]])await db.query("insert into lub.access_assignments(user_id,organization_id,organization_membership_id,role_code,assigned_by_user_id) values($1,$2,$3,$4,$5)",[id(Number(n)),id(100),id(300+Number(n)),role,id(1)]);
 await actor(1);
});
afterEach(async()=>{await db.exec("rollback");});afterAll(async()=>{await db?.close();});
it("creates an incomplete draft, rejects publication, and permits cancellation without dates",async()=>{
 const target=(await db.query<{id:string}>("select lub.save_event(null,$1,'','','Unknown',null,null,null,null,null,null,null,null,0,null) id",[id(100)])).rows[0].id;
 await denied(()=>db.query("select lub.change_event_status($1,'Published',1)",[target]));await db.query("select lub.change_event_status($1,'Cancelled',1)",[target]);
 expect((await db.query<{state:string}>("select status_code state from lub.organization_content where id=$1",[target])).rows[0].state).toBe("Cancelled");
});
it("publishes complete details with a natural-ratio poster and blocks stale edits and foreign files",async()=>{
 const target=await create();await db.exec("reset role");for(const[n,owner]of [[900,1],[901,3]])await db.query("insert into lub.assets(id,owner_user_id,object_key,file_name,mime_type,size_bytes,image_width,image_height) values($1,$2,$3,'بوستر.png','image/png',100,900,1600)",[id(n),id(owner),`${id(owner)}/${id(n)}.png`]);await actor(1);
 await denied(()=>db.query("select lub.set_event_poster($1,$2)",[target,id(901)]));await db.query("select lub.set_event_poster($1,$2)",[target,id(900)]);await db.query("select lub.change_event_status($1,'Published',2)",[target]);
 await denied(()=>db.query("select lub.change_event_status($1,'Draft',2)",[target]));await visitor();expect((await db.query("select * from lub.public_event_poster($1)",[target])).rows).toHaveLength(1);
 expect((await db.query<{data:unknown}>("select lub.public_event_poster_dimensions($1) data",[target])).rows[0].data).toEqual({width:900,height:1600});
});
it("archives/restores without changing the original state and duplicates into an independent draft",async()=>{
 const target=await create();await db.query("select lub.change_event_status($1,'Published',1)",[target]);await db.query("select lub.event_list_action($1,'archive',2)",[target]);
 await visitor();expect((await db.query<{allowed:boolean}>("select lub.can_read_event($1) allowed",[target])).rows[0].allowed).toBe(false);
 await actor(1);await db.query("select lub.event_list_action($1,'restore',3)",[target]);const duplicate=(await db.query<{id:string}>("select lub.duplicate_event($1) id",[target])).rows[0].id;
 expect(duplicate).not.toBe(target);expect((await db.query<{state:string}>("select status_code state from lub.organization_content where id=$1",[duplicate])).rows[0].state).toBe("Draft");
 await db.query("select lub.event_list_action($1,'delete',1)",[duplicate]);expect((await db.query("select id from lub.organization_content where id=$1 and deleted_at is null",[duplicate])).rows).toEqual([]);
});
it("keeps imported archival events readable and restores incomplete imports as drafts",async()=>{
 await db.exec("reset role");await db.query("insert into lub.organization_content(id,organization_id,kind,title,status_code,published_at,source_date_text) values($1,$2,'Event','فعالية أرشيفية','Archived',now(),'خلال الفصل الأول')",[id(800),id(100)]);await actor(1);
 await db.query("select lub.event_list_action($1,'restore',1)",[id(800)]);expect((await db.query<{state:string;date:string}>("select status_code state,source_date_text date from lub.organization_content where id=$1",[id(800)])).rows[0]).toEqual({state:"Draft",date:"خلال الفصل الأول"});
});
it("retains external public-photo URLs without confusing them with stored asset references",async()=>{
 const target=await create();await db.query("select lub.change_event_status($1,'Published',1)",[target]);await db.query("select lub.set_event_public_content($1,'تقرير الفعالية',array['https://example.invalid/photo.png']::text[])",[target]);
 const photos=(await db.query<{photos:Array<{url:string}>}>("select public_photos photos from lub.organization_content where id=$1",[target])).rows[0].photos;expect(photos).toMatchObject([{url:"https://example.invalid/photo.png"}]);
 await denied(()=>db.query("select lub.set_event_public_content($1,'',array['javascript:alert(1)']::text[])",[target]));await actor(2);await denied(()=>create());
});
it("completes an event with attendance, awards each member once, and retains cancelled public information",async()=>{
 const target=await create();await db.query("select lub.change_event_status($1,'Published',1)",[target]);await db.exec("reset role");
 await db.query("update lub.organization_content set starts_at=now()-interval '2 hours',ends_at=now()-interval '1 hour',registration_opens_at=now()-interval '2 days',registration_closes_at=now()-interval '1 day' where id=$1",[target]);
 await db.query("insert into lub.event_registrations(id,event_id,organization_id,user_id,review_status_code,attendance,checked_in_at) values($1,$2,$3,$4,'Accepted','Present',now())",[id(900),target,id(100),id(3)]);
 await actor(1);await denied(()=>db.query("select lub.change_event_status($1,'Completed',2)",[target]));await db.exec("reset role");await db.query("insert into lub.academic_terms(id,academic_year,term_code,name_ar,start_date,end_date) values($1,'2026','T1','الفصل الأول',lub.today_riyadh()-1,lub.today_riyadh()+10)",[id(500)]);await actor(1);
 await db.query("select lub.change_event_status($1,'Completed',2)",[target]);await denied(()=>db.query("select lub.change_event_status($1,'Completed',3)",[target]));await db.exec("reset role");
 expect((await db.query<{hours:Array<{hours:number;source_id:string}>}>("select hours from lub.organization_memberships where id=$1",[id(303)])).rows[0].hours).toMatchObject([{hours:3,source_id:id(900)}]);
 await actor(1);const cancelled=await create();await db.query("select lub.change_event_status($1,'Published',1)",[cancelled]);await db.query("select lub.change_event_status($1,'Cancelled',2)",[cancelled]);await visitor();expect((await db.query<{allowed:boolean}>("select lub.can_read_event($1) allowed",[cancelled])).rows[0].allowed).toBe(true);
});
it("registers, withdraws, reapplies and accepts the same student without duplicate registrations",async()=>{
 const target=await create();await db.query("select lub.change_event_status($1,'Published',1)",[target]);await actor(3);
 const registration=(await db.query<{id:string}>("select lub.register_event($1,null,'{}',null) id",[target])).rows[0].id;
 await db.query("select lub.cancel_event_registration($1)",[registration]);await db.query("select lub.reapply_event_registration($1)",[registration]);await actor(2);
 expect((await db.query<{changed:number}>("select lub.review_event_registrations(ARRAY[$1]::uuid[],'Accepted','') changed",[registration])).rows[0].changed).toBe(1);
 await db.exec("reset role");expect((await db.query("select id from lub.event_registrations where event_id=$1",[target])).rows).toEqual([{id:registration}]);
 expect((await db.query<{status:string;attendance:string}>("select review_status_code status,attendance from lub.event_registrations where id=$1",[registration])).rows[0]).toEqual({status:"Accepted",attendance:"Pending"});
});
it("checks capacity, owner, period and review state on registration mutations",async()=>{
 const target=await create();await db.query("select lub.change_event_status($1,'Published',1)",[target]);await db.exec("reset role");await db.query("update lub.organization_content set capacity=1 where id=$1",[target]);await actor(3);
 const registration=(await db.query<{id:string}>("select lub.register_event($1,null,'{}',null) id",[target])).rows[0].id;
 await actor(2);await denied(()=>db.query("select lub.register_event($1,null,'{}',null)",[target]));await denied(()=>db.query("select lub.cancel_event_registration($1)",[registration]));
 await db.query("select lub.review_event_registrations(ARRAY[$1]::uuid[],'Accepted','')",[registration]);await denied(()=>db.query("select lub.review_event_registrations(ARRAY[$1]::uuid[],'Rejected','')",[registration]));
 await db.exec("reset role");await db.query("update lub.organization_content set starts_at=now()-interval '1 hour',ends_at=now()+interval '1 hour',registration_opens_at=now()-interval '2 days',registration_closes_at=now()-interval '1 day' where id=$1",[target]);await actor(3);await denied(()=>db.query("select lub.cancel_event_registration($1)",[registration]));
});
it("keeps the submitted form snapshot after the live form changes and cleans hidden answers",async()=>{
 const form=(await db.query<{id:string}>("select lub.create_form($1,'نموذج فعالية',null) id",[id(100)])).rows[0].id;
 const definition={layout:"SinglePage",sections:[{id:id(801),title:"التقديم",description:"",fields:[{id:id(802),type:"Checkbox",label:"أوافق",help:"",required:false,options:[],maxLength:300},{id:id(803),type:"LongText",label:"تفاصيل",help:"",required:true,options:[],maxLength:300,condition:{fieldId:id(802),operator:"Answered",value:"true"}}]}]};
 await db.query("select lub.save_form_draft($1,$2,1)",[form,JSON.stringify(definition)]);await db.query("select lub.publish_form_version($1)",[form]);
 const target=await create();await db.exec("reset role");await db.query("update lub.organization_content set form_id=$1 where id=$2",[form,target]);await actor(1);await db.query("select lub.change_event_status($1,'Published',1)",[target]);await actor(3);
 const registration=(await db.query<{id:string}>("select lub.register_event($1,$2,$3,null) id",[target,form,JSON.stringify({[id(803)]:"إجابة مخفية"})])).rows[0].id;
 await actor(1);definition.sections[0].fields[0].label="عنوان جديد";await db.query("select lub.save_form_draft($1,$2,2)",[form,JSON.stringify(definition)]);await db.exec("reset role");
 const saved=(await db.query<{snapshot:{definition:{sections:Array<{fields:Array<{label:string}>}>}};answers:unknown}>("select form_snapshot snapshot,answers from lub.event_registrations where id=$1",[registration])).rows[0];
 expect(saved.snapshot.definition.sections[0].fields[0].label).toBe("أوافق");expect(saved.answers).toEqual({});
});
it("reviews a batch atomically and limits attendance marking to accepted registrations after the event",async()=>{
 const target=await create();await db.query("select lub.change_event_status($1,'Published',1)",[target]);await actor(3);
 const registration=(await db.query<{id:string}>("select lub.register_event($1,null,'{}',null) id",[target])).rows[0].id;await actor(2);
 await denied(()=>db.query("select lub.review_event_registrations(ARRAY[$1,$2]::uuid[],'Accepted','')",[registration,id(999)]));
 await db.query("select lub.review_event_registrations(ARRAY[$1]::uuid[],'Accepted','')",[registration]);await denied(()=>db.query("select lub.mark_event_attendance($1,'Present')",[registration]));
 await db.exec("reset role");await db.query("update lub.organization_content set starts_at=now()-interval '2 hours',ends_at=now()-interval '1 hour',registration_opens_at=now()-interval '2 days',registration_closes_at=now()-interval '1 day' where id=$1",[target]);await actor(2);await db.query("select lub.mark_event_attendance($1,'Present')",[registration]);
 await actor(3);await denied(()=>db.query("select lub.mark_event_attendance($1,'Absent')",[registration]));
 expect((await db.query<{state:string}>("select attendance state from lub.event_registrations where id=$1",[registration])).rows[0].state).toBe("Present");
});

function form(values: Record<string, string>, skills?: string[]) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  if (skills) {
    data.set("skills-present", "on");
    for (const skill of skills) data.append("skill", skill);
  }
  return data;
}
async function eventRevision(event:string){
 return (await db.query<{revision:number}>("select revision from lub.organization_content where id=$1",[event])).rows[0].revision;
}
async function evidence(){
 return (await db.query<{skills:Array<{events:number}>}>("select lub.public_profile_skills($1) skills",[id(403)])).rows[0].skills[0];
}
it("stores event selections with publication and counts verified completed events, never registration alone", async () => {
  const now = Date.now(),
    iso = (hours: number) => new Date(now + hours * 3600000).toISOString();
  const values = {
    operation: "save",
    org:id(100),
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
  expect((await eventDetail(id(1), event))?.event.skills).toMatchObject([
    { key: "python" },
  ]);
  const before = await eventRevision(event);
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
  expect((await eventDetail(id(1), event))?.event.title).toBe(values.title);
  await db.exec("reset role");
  await db.query("insert into lub.academic_terms(academic_year,term_code,name_ar,start_date,end_date) values('2026','T1','الفصل الأول',lub.today_riyadh()-2,lub.today_riyadh()+10)");
  await db.query("update lub.users set public_slug=$1,public_profile_enabled=true where id=$2",[id(403),id(3)]);
  await actor(3);
  await db.query("select lub.save_profile_skill_selection($1,$2)",[id(403),JSON.stringify([{key:"python",featured:true}])]);
  expect((await eventDetail(id(3), event))?.event.skills).toMatchObject([{key:"python"}]);
  expect((await eventDetail(null, event))?.event.skills).toMatchObject([{key:"python"}]);
  await actor(3);
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
    "update lub.organization_content set starts_at=now()-interval '2 hours',ends_at=now()-interval '1 hour',registration_opens_at=now()-interval '2 days',registration_closes_at=now()-interval '1 day' where id=$1",
    [event],
  );
  await actor(1);
  await db.query("select lub.review_event_registrations(ARRAY[$1]::uuid[],'Accepted','')",[registration]);
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
      revision: String(await eventRevision(event)),
    }),
  );
  expect(completed.success).toBeDefined();
  expect((await evidence()).events).toBe(1);
});

it("reads public discovery, student activity and scoped management from shared content",async()=>{
 const target=await create();
 expect(await eventDetail(null,target)).toBeUndefined();
 expect(await eventDetail(id(3),target)).toBeUndefined();
 expect(await eventEditor(id(3),id(100),target)).toBeUndefined();
 expect(await listEvents("","all",0)).toEqual([]);
 await db.exec("reset role");
 await db.query("insert into auth.users values($1)",[id(4)]);
 await db.query("insert into lub.users(id,email,email_verified_at) values($1,'supervisor@example.invalid',now())",[id(4)]);
 await db.query("insert into lub.access_assignments(user_id,role_code,assigned_by_user_id) values($1,'SA',$1)",[id(4)]);
 await actor(1);
 await db.query("select lub.change_event_status($1,'Published',1)",[target]);
 expect((await listEvents("اختبار","upcoming",0)).map(x=>x.id)).toEqual([target]);
 expect(await publicEventMetadata(target)).toMatchObject({id:target,title:"فعالية اختبار",slug:"event-org"});
 expect(await eventDetail(null,target)).toMatchObject({remaining:20,own:null,registrations:[],assets:[],canManage:false});
 reads=0;
 expect(await eventDetail(id(1),target)).toMatchObject({canManage:true,canFeature:true});
 expect(reads).toBe(1);
 reads=0;
 expect((await eventWorkspaceOverview(id(1),id(100),0))?.events).toMatchObject([{id:target,registrant_count:0}]);
 expect(reads).toBe(1);
 expect((await eventDetail(id(4),target))?.canManage).toBe(false);
 expect(await eventWorkspaceOverview(id(4),id(100),0)).toBeUndefined();
 expect(await eventEditor(id(1),id(100),target)).toMatchObject({event:{id:target,revision:2},templates:[]});
 await actor(2);await denied(()=>db.query("select lub.set_featured_event($1,true)",[target]));
 await actor(1);await db.query("select lub.set_featured_event($1,true)",[target]);
 expect((await eventDetail(null,target))?.event.is_featured).toBe(true);
 await actor(3);
 const registration=(await db.query<{id:string}>("select lub.register_event($1,null,'{}',null) id",[target])).rows[0].id;
 expect((await myEvents(id(3),null,{status:"pending"})).events).toMatchObject([{id:target,registration_id:registration,canWithdraw:true}]);
 expect((await myEvents(id(2),null)).events).toEqual([]);
 expect(await eventDetail(id(3),target)).toMatchObject({remaining:19,own:{id:registration}});
 expect((await eventDetail(id(2),target))?.own).toBeNull();
 await actor(2);await db.query("select lub.review_event_registrations(ARRAY[$1]::uuid[],'Accepted','')",[registration]);
 reads=0;
 const review=await eventRegistrants(id(1),id(100));
 expect(reads).toBe(1);expect(review.accepted).toBe(1);
 expect(review.items[0]).toMatchObject({name:"طالب",review_status_code:"Accepted"});
 expect(JSON.stringify(review)).not.toMatch(/university|ciphertext|lookup_hash|avatar|encrypted/);
 expect((await eventRegistrants(id(4),id(100))).items).toEqual([]);
 await actor(3);await db.query("select lub.cancel_event_registration($1)",[registration]);
 expect((await myEvents(id(3),null,{status:"cancelled"})).events).toMatchObject([{id:target,canWithdraw:false,canReapply:true}]);
});

it("reads chosen public links while protecting operational attachments and draft posters",async()=>{
 const target=await create();await db.exec("reset role");
 for(const n of [900,901])await db.query("insert into lub.assets(id,owner_user_id,object_key,file_name,mime_type,size_bytes) values($1,$2,$3,'ملف.png','image/png',100)",[id(n),id(1),`${id(1)}/${id(n)}.png`]);
 await actor(1);
 await db.query("select lub.set_event_poster($1,$2)",[target,id(900)]);
 await db.query("select lub.attach_event_asset($1,$2,'Report')",[target,id(901)]);
 expect(await privateEventPoster(id(3),target)).toBeUndefined();
 expect(await privateEventPoster(id(1),target)).toMatchObject({object_key:`${id(1)}/${id(900)}.png`});
 await denied(()=>db.query("select lub.set_event_public_content($1,'ملخص',array['https://example.invalid/photo.png'])",[target]));
 await db.query("select lub.change_event_status($1,'Published',3)",[target]);
 await denied(()=>db.query("select lub.set_event_public_content($1,'ملخص',array['http://example.invalid/photo.png'])",[target]));
 await db.query("select lub.set_event_public_content($1,'ملخص منشور',array['https://example.invalid/photo.png'])",[target]);
 expect(await eventDetail(null,target)).toMatchObject({event:{public_report:"ملخص منشور",public_photos:["https://example.invalid/photo.png"]},assets:[]});
 expect((await eventDetail(id(1),target))?.assets).toEqual([{id:id(901),file_name:"ملف.png",asset_type_code:"Report"}]);
 expect((await eventDetail(id(3),target))?.assets).toEqual([]);
 await denied(()=>db.query("select lub.set_event_public_content($1,'تغيير',array[]::text[])",[target]));
});

it("bounds management bootstrap and pages while searching the full organization list",async()=>{
 await db.exec("reset role");
 await db.query("insert into lub.organization_content(organization_id,kind,title) select $1,'Event','فعالية '||i from generate_series(1,54) i",[id(100)]);
 expect((await eventWorkspaceOverview(id(1),id(100),null))?.events).toHaveLength(51);
 const first=(await eventWorkspaceOverview(id(1),id(100),0,{eventStatus:"Draft"}))!.events;
 const second=(await eventWorkspaceOverview(id(1),id(100),1,{eventStatus:"Draft"}))!.events;
 expect(first).toHaveLength(26);expect(second).toHaveLength(26);
 expect(first.slice(0,25).some(row=>second.some(other=>other.id===row.id))).toBe(false);
 expect((await eventWorkspaceOverview(id(1),id(100),0,{eventSearch:"فعالية 53"}))?.events).toMatchObject([{title:"فعالية 53"}]);
 expect(await eventWorkspaceOverview(id(3),id(100),0)).toBeUndefined();
});

it("loads registrations across pages and invalidates only authorized cache versions on a decision",async()=>{
 for(let i=0;i<28;i++){
  await actor(1);const target=await create();await db.query("select lub.change_event_status($1,'Published',1)",[target]);
  await actor(3);await db.query("select lub.register_event($1,null,'{}',null)",[target]);
 }
 expect((await eventWorkspaceOverview(id(1),id(100),0))?.events).toHaveLength(26);
 expect((await eventWorkspaceOverview(id(1),id(100),null))?.events).toHaveLength(28);
 const list=await eventRegistrants(id(1),id(100),null,"","",null,false);
 expect(list.items).toHaveLength(28);expect(list.options).toHaveLength(28);expect(list.pending).toBe(28);
 expect(list.items[0]).toMatchObject({answers:null,definition:null,history:[]});
 expect((await eventRegistrants(id(3),id(100),null,"","",null)).items).toHaveLength(0);
 expect(await organizationEventsVersion(id(3),id(100))).toBeNull();
 const before=await organizationEventsVersion(id(1),id(100));expect(before).toHaveLength(32);
 await db.query("select lub.review_event_registrations(ARRAY[$1]::uuid[],'Rejected','سبب القرار')",[list.items[0].id]);
 expect(await organizationEventsVersion(id(1),id(100))).not.toBe(before);
 const result=await eventRegistrants(id(2),id(100),null,"","",0,true,list.items[0].id);
 expect(result.items).toMatchObject([{review_status_code:"Rejected",canRemove:false,history:expect.arrayContaining([expect.objectContaining({status_code:"Rejected",reason:"سبب القرار"})])}]);
 await denied(()=>db.query("select lub.remove_event_registration($1)",[list.items[0].id]));
 await actor(1);await db.query("select lub.remove_event_registration($1)",[list.items[0].id]);
 expect((await myEvents(id(3),null,{status:"cancelled"})).events).toMatchObject([{registration_id:list.items[0].id}]);
 await db.exec("reset role");await db.query("update lub.users set is_test_account=true where id=$1",[id(3)]);
 const counted=await eventRegistrants(id(1),id(100),null,"","",null,false);
 expect(counted.items).toHaveLength(27);expect(counted.pending).toBe(0);
});

it("limits the online attendance link to the accepted attendee and the event period", async () => {
 const url = "https://example.invalid/private-meeting";
 const target = (await db.query<{id:string}>(`select lub.save_event(null,$1,'Online workshop','Description','Online','Zoom',$2,
   now()+interval '2 days',now()+interval '3 days',now()-interval '1 day',now()+interval '1 day',20,null,3,null) id`, [id(100),url])).rows[0].id;
 await db.query("select lub.change_event_status($1,'Published',1)",[target]);
 await actor(3);
 const registration = (await db.query<{id:string}>("select lub.register_event($1,null,'{}',null) id",[target])).rows[0].id;
 await actor(2);
 await db.query("select lub.review_event_registrations(ARRAY[$1]::uuid[],'Accepted','')",[registration]);
 expect((await eventDetail(id(3),target))?.event).toMatchObject({online_url:null,attendance_url:null});
 expect((await eventEditor(id(1),id(100),target))?.event.online_url).toBe(url);

 await db.exec("reset role");
 await db.query(`update lub.organization_content set starts_at=now()-interval '1 hour',ends_at=now()+interval '1 hour',
   registration_opens_at=now()-interval '2 days',registration_closes_at=now()-interval '2 hours' where id=$1`,[target]);
 expect((await eventDetail(id(3),target))?.event).toMatchObject({online_url:null,attendance_url:url});
 expect((await eventDetail(id(2),target))?.event.attendance_url).toBeNull();
 expect((await eventDetail(null,target))?.event).toMatchObject({online_url:null,attendance_url:null});
 expect((await listEvents("","all",0)).find(event=>event.id===target)?.online_url).toBeNull();
 await actor(3);
 await denied(()=>db.query("select online_url from lub.organization_content where id=$1",[target]));
 expect((await db.query("select id from lub.organization_content where id=$1",[target])).rows).toEqual([{id:target}]);
 await db.exec("reset role");
 await db.query("update lub.event_registrations set review_status_code='Pending' where id=$1",[registration]);
 expect((await eventDetail(id(3),target))?.event.attendance_url).toBeNull();
 await db.exec("reset role");
 await db.query("update lub.event_registrations set review_status_code='Accepted' where id=$1",[registration]);
 await db.query("update lub.organization_content set ends_at=now()-interval '30 minutes' where id=$1",[target]);
 expect((await eventDetail(id(3),target))?.event.attendance_url).toBeNull();
});
