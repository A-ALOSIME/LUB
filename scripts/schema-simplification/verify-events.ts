import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFileSync,writeFileSync} from "node:fs";
import {join} from "node:path";
import postgres from "postgres";
import {requireOutsideRepository,requireSandboxUrl} from "./guards";
async function verify(){
 const destination=process.env.LUB_BASELINE_DIRECTORY;if(!destination)throw new Error("Private sandbox configuration required.");
 const directory=requireOutsideRepository(destination,process.cwd());
 const config:{databaseUrl:string}=JSON.parse(readFileSync(join(directory,"sandbox.json"),"utf8"));
 const db=postgres(requireSandboxUrl(config.databaseUrl).toString(),{max:1,ssl:false,onnotice:()=>{}});
 const leader=randomUUID(),student=randomUUID(),org=randomUUID(),term=randomUUID(),asset=randomUUID();let event:string|undefined;
 try{
  for(const account of [leader,student]){
   await db`insert into auth.users(id) values(${account})`;
   await db`insert into lub.users(id,email,email_verified_at,full_name_ar,university_id_ciphertext,university_id_lookup_hash,major_name,academic_level,onboarded_at) values(${account},${`event-proof-${account}@example.invalid`},now(),'حساب اختبار','encrypted',${account.replaceAll("-","").repeat(2)},'نظم معلومات','5',now())`;
  }
  await db`insert into lub.organizations(id,type_code,slug,name_ar) values(${org},'Club',${`event-proof-${org}`},'جهة اختبار')`;
  const [membership]=await db<{id:string}[]>`insert into lub.organization_memberships(organization_id,user_id,start_date) values(${org},${leader},lub.today_riyadh()-3) returning id`;
  const [member]=await db<{id:string}[]>`insert into lub.organization_memberships(organization_id,user_id,start_date) values(${org},${student},lub.today_riyadh()-3) returning id`;
  await db`insert into lub.access_assignments(user_id,organization_id,organization_membership_id,role_code,assigned_by_user_id) values(${leader},${org},${membership.id},'OL',${leader})`;
  await db`insert into lub.assets(id,owner_user_id,object_key,file_name,mime_type,size_bytes,image_width,image_height) values(${asset},${leader},${`${leader}/${asset}.png`},'بوستر.png','image/png',100,900,1600)`;
  event=await db.begin(async tx=>{
   await tx`select set_config('request.jwt.claim.sub',${leader},true),set_config('role','authenticated',true)`;
   const [row]=await tx<{id:string}[]>`select lub.save_and_publish_event(null,${org},'فعالية اختبار','وصفها','In_Person','قاعة',null,now()+interval '1 day',now()+interval '2 days',now()-interval '1 day',now()+interval '1 hour',20,null,3,null,${asset},true) id`;
   return row.id;
  });
  const [poster]=await db`select * from lub.public_event_poster(${event})`;assert.equal(poster.object_key,`${leader}/${asset}.png`);
  await db.begin(async tx=>{
   await tx`select set_config('request.jwt.claim.sub',${leader},true),set_config('role','authenticated',true)`;
   await tx`select lub.event_list_action(${event!},'archive',3)`;
   await tx`select lub.event_list_action(${event!},'restore',4)`;
  });
  const registration=await db.begin(async tx=>{
   await tx`select set_config('request.jwt.claim.sub',${student},true),set_config('role','authenticated',true)`;
   const [row]=await tx<{id:string}[]>`select lub.register_event(${event!},null,'{}',null) id`;
   await tx`select lub.cancel_event_registration(${row.id})`;
   await tx`select lub.reapply_event_registration(${row.id})`;return row.id;
  });
  await db.begin(async tx=>{
   await tx`select set_config('request.jwt.claim.sub',${leader},true),set_config('role','authenticated',true)`;
   await tx`select lub.review_event_registrations(${[registration]}::uuid[],'Accepted','')`;
  });
  // Advance an isolated fixture to an elapsed event; this is not a UI or wall-clock test.
  await db`update lub.organization_content set starts_at=now()-interval '2 hours',ends_at=now()-interval '1 hour',registration_opens_at=now()-interval '2 days',registration_closes_at=now()-interval '1 day' where id=${event}`;
  await db.begin(async tx=>{
   await tx`select set_config('request.jwt.claim.sub',${leader},true),set_config('role','authenticated',true)`;
   await tx`select lub.mark_event_attendance(${registration},'Present')`;
  });
  await db`insert into lub.academic_terms(id,academic_year,term_code,name_ar,start_date,end_date) values(${term},'proof',${term.slice(0,8)},'فصل اختبار',lub.today_riyadh()-2,lub.today_riyadh()+2)`;
  await db.begin(async tx=>{
   await tx`select set_config('request.jwt.claim.sub',${leader},true),set_config('role','authenticated',true)`;
   await tx`select lub.change_event_status(${event!},'Completed',5)`;
  });
  const [hours]=await db<{count:number;amount:string}[]>`select jsonb_array_length(hours) count,(hours->0->>'hours') amount from lub.organization_memberships where id=${member.id}`;
  assert.equal(hours.count,1);assert.equal(Number(hours.amount),3);
  const result={database:"owned local PostgreSQL",publishedPoster:true,archiveRestore:true,completedAttendanceFixture:true,hourAwards:1,hours:3,registrationWorkflowTested:true,withdrawReapplyAccepted:true,httpTested:false};
  writeFileSync(join(directory,"event-verification.json"),JSON.stringify(result,null,2),{mode:0o600});console.log(JSON.stringify(result));
 }finally{
  await db`delete from lub.history_events where organization_id=${org}`;await db`delete from lub.event_registrations where organization_id=${org}`;
  await db`delete from lub.organization_content where organization_id=${org}`;await db`delete from lub.access_assignments where organization_id=${org}`;
  await db`delete from lub.organization_memberships where organization_id=${org}`;await db`delete from lub.organizations where id=${org}`;
  await db`delete from lub.assets where id=${asset}`;await db`delete from lub.academic_terms where id=${term}`;
  await db`delete from lub.users where id in ${db([leader,student])}`;await db`delete from auth.users where id in ${db([leader,student])}`;await db.end();
 }
}
verify().catch(error=>{console.error("Owned local event verification failed:",error.code??error.name);process.exitCode=1;});
