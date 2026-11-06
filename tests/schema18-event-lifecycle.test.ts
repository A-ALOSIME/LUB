import {PGlite} from "@electric-sql/pglite";
import {readFileSync} from "node:fs";
import {afterAll,afterEach,beforeAll,beforeEach,expect,it} from "vitest";
import {storageFixture} from "./storage-fixture";
const id=(n:number)=>`b0000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
let db:PGlite;
async function actor(n:number){await db.exec("reset role");await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('role','authenticated',true)",[id(n)]);}
async function visitor(){await db.exec("reset role");await db.query("select set_config('request.jwt.claim.sub','',true),set_config('role','anon',true)");}
async function denied(run:()=>Promise<unknown>){await db.exec("savepoint denied");await expect(run()).rejects.toThrow();await db.exec("rollback to savepoint denied;release savepoint denied");}
async function create(){return(await db.query<{id:string}>("select lub.save_event(null,$1,'فعالية اختبار','وصف الفعالية','In_Person','قاعة الحاسب',null,now()+interval '2 days',now()+interval '3 days',now()-interval '1 day',now()+interval '1 day',20,null,3,null) id",[id(100)])).rows[0].id;}
beforeAll(async()=>{
 db=new PGlite();await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;");await storageFixture(db);
 for(const file of ["schema18.sql","administration18.sql","forms18.sql","form-library18.sql","campaigns18.sql","hours18.sql","tasks18.sql","assets18.sql","announcements18.sql","events18.sql","event-registration18.sql"])await db.exec(readFileSync(`scripts/schema-simplification/${file}`,"utf8"));
},30000);
beforeEach(async()=>{
 await db.exec("begin");for(let n=1;n<=3;n++){await db.query("insert into auth.users values($1)",[id(n)]);await db.query("insert into lub.users(id,email,email_verified_at,full_name_ar,university_id_ciphertext,university_id_lookup_hash,major_name,academic_level,onboarded_at) values($1,$2,now(),'طالب','encrypted',$3,'نظم معلومات','5',now())",[id(n),`event18-${n}@example.invalid`,String(n).repeat(64)]);}
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
 const target=await create();await db.query("select lub.set_event_public_content($1,'تقرير الفعالية',array['https://example.invalid/photo.png']::text[])",[target]);
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
