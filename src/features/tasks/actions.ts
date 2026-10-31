"use server";
import {activitySkillKeys} from "@/features/talent/activity-skill-input";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import { withUser } from "@/db/client";
import { requireUser } from "@/features/auth/session";
import { studentOperationError } from "@/features/auth/authorization";
import {SubmissionFault,classifySubmissionError,submissionErrorMessage,type SubmissionErrorCode} from "./submission-errors";
export type TaskState={error?:string;success?:string;task?:string;submissionError?:SubmissionErrorCode};
const id=(f:FormData,k:string)=>z.uuid().parse(f.get(k));
const optionalId=(f:FormData,k:string)=>f.get(k)?id(f,k):null;
const text=(f:FormData,k:string,max:number,min=1)=>z.string().trim().min(min).max(max).parse(f.get(k)??"");
const revision=(f:FormData,k="revision")=>z.coerce.number().int().positive().parse(f.get(k));
const hours=(f:FormData,k="hours")=>z.coerce.number().finite().min(0).max(1000).multipleOf(0.01).parse(f.get(k));
const date=(f:FormData,k:string)=>f.get(k)?z.iso.datetime({offset:true}).parse(f.get(k)):null;
export async function readTaskNotification(notification:string):Promise<TaskState>{
 const user=await requireUser();const adminError=await studentOperationError(user.id);if(adminError)return{error:adminError};
 try{await withUser(user.id,tx=>tx.execute(sql`select lub.read_task_notification(${z.uuid().parse(notification)})`));}
 catch{return{error:"تعذّر تحديث الإشعار. حدّث الصفحة وحاول مرة ثانية."};}
 revalidatePath("/notifications");return{success:"تم تحديد الإشعار كمقروء."};
}
export async function mutateTask(_previous:TaskState,f:FormData):Promise<TaskState>{
 const user=await requireUser();let target:string|undefined;
 try{
 const operation=z.enum(["save-task","delete","withdraw","link-event","status","template","join","start","submit","review","close","read","read-all"]).parse(f.get("operation"));
 if(["join","start","submit","withdraw","read","read-all"].includes(operation)){const adminError=await studentOperationError(user.id);if(adminError)return operation==="submit"?{error:submissionErrorMessage("access","ar"),submissionError:"access"}:{error:adminError};}
 const query=(()=>{
 switch(operation){
 case "delete":if(f.get("confirm")!=="on")throw new Error("confirmation");return sql`select lub.delete_task(${id(f,"task")},${revision(f)})`;
 case "withdraw":if(f.get("confirm")!=="on")throw new Error("confirmation");return sql`select lub.withdraw_task_participation(${id(f,"participant")})`;
 case "link-event":return sql`select lub.link_task_event(${id(f,"task")},${optionalId(f,"event")},${revision(f)})`;
 case "save-task":if(f.get("rule")){if(f.get("task"))throw new Error();return sql`select lub.save_task_with_rule(${id(f,"org")},${optionalId(f,"committee")},${optionalId(f,"template")},${text(f,"title",120,2)},${text(f,"description",6000)},${date(f,"starts")}::timestamptz,${date(f,"due")}::timestamptz,${id(f,"rule")}) as id`;}return sql`select lub.save_task(${optionalId(f,"task")},${id(f,"org")},${optionalId(f,"committee")},${optionalId(f,"template")},${text(f,"title",120,2)},${text(f,"description",6000)},${date(f,"starts")}::timestamptz,${date(f,"due")}::timestamptz,${hours(f)}::numeric,${f.get("task")?revision(f):null}::int) as id`;
 case "status":{const status=z.enum(["Open","Completed","Cancelled"]).parse(f.get("status"));if(status!=="Open"&&f.get("confirm")!=="on")throw new Error("confirmation");return sql`select lub.change_task_status(${id(f,"task")},${status},${revision(f)})`;}
 case "template":return sql`select lub.save_task_template(${optionalId(f,"template")},${id(f,"org")},${optionalId(f,"committee")},${text(f,"title",120,2)},${text(f,"description",6000,f.get("source")?0:1)},${hours(f)}::numeric,${f.get("active")==="on"},${f.get("template")?revision(f):null}::int,${optionalId(f,"source")})`;
 case "join":return sql`select lub.join_task(${id(f,"task")})`;
 case "start":return sql`select lub.start_task_participation(${id(f,"participant")})`;
 case "submit":{
  const assets=z.array(z.uuid()).max(5).parse(f.getAll("asset")),message=text(f,"message",6000,0);
  if(!message&&!assets.length)throw new SubmissionFault("empty");
  if(new Set(assets).size!==assets.length)throw new SubmissionFault("attachment");
  return sql`select lub.submit_task(${id(f,"participant")},${message},ARRAY[${sql.join(assets.map(asset=>sql`${asset}`),sql`, `)}]::uuid[],${z.coerce.number().int().min(0).parse(f.get("lastRevision"))},${revision(f)})`;
 }
 case "review":return sql`select lub.review_task_submission(${id(f,"submission")},${z.enum(["Approved","Rejected"]).parse(f.get("status"))},${text(f,"note",3000,0)},${f.get("hours")?hours(f):null}::numeric)`;
 case "close":if(f.get("confirm")!=="on")throw new Error("confirmation");return sql`select lub.close_task_participant(${id(f,"participant")})`;
 case "read":return sql`select lub.read_task_notification(${id(f,"notification")})`;
 case "read-all":return sql`select lub.read_task_notification(n.id) from lub.notifications n where n.recipient_user_id=${user.id} and n.read_at is null`;
 }
 })();
 const rows=await withUser(user.id,async tx=>{
  if(operation==="submit"){
   const [current]=await tx.execute(sql`select p.status_code,t.status_code as task_status,t.revision,
    coalesce((select max(s.revision_number) from lub.task_submissions s where s.task_participant_id=p.id),0) as last_revision
    from lub.task_participants p join lub.tasks t on t.id=p.task_id where p.id=${id(f,"participant")} and p.user_id=${user.id}`);
   if(!current)throw new SubmissionFault("access");
   if(current.task_status!=="Open")throw new SubmissionFault("unavailable");
   if(Number(current.revision)!==revision(f))throw new SubmissionFault("task-changed");
   if(current.status_code==="Submitted")throw new SubmissionFault("pending");
   if(!["Joined","In_Progress"].includes(String(current.status_code)))throw new SubmissionFault("unavailable");
   if(Number(current.last_revision)!==Number(f.get("lastRevision")))throw new SubmissionFault("submission-changed");
  }
  if(operation!=="save-task")return tx.execute(query);
  const intent=z.enum(["draft","publish","template"]).parse(f.get("intent")||"draft");
  if(intent==="template"){
   if(f.get("task"))throw new Error("New templates only");
   await tx.execute(sql`select lub.save_task_template(null,${id(f,"org")},${optionalId(f,"committee")},${text(f,"title",120,2)},${text(f,"description",6000)},${hours(f)}::numeric,true,null,null)`);
   return [];
  }
  const skills=activitySkillKeys(f);
  const saved=await tx.execute(query);const task=z.uuid().parse(saved[0]?.id);
  if(skills!==null)await tx.execute(sql`select lub.set_activity_skill_tags('Task',${task},${JSON.stringify(skills)}::jsonb,(select revision from lub.tasks where id=${task}))`);
  if(f.get("poster")||f.get("removePoster")==="true")await tx.execute(sql`select lub.set_task_image(${task},${optionalId(f,"poster")},(select revision from lub.tasks where id=${task}))`);
  if(intent==="publish")await tx.execute(sql`select lub.change_task_status(${task},'Open',(select revision from lub.tasks where id=${task}))`);
  return [{id:task}];
 });
 if(operation==="save-task"&&rows[0]?.id)target=z.uuid().parse(rows[0].id);
 }catch(error){if(f.get("operation")==="submit"){const submissionError=classifySubmissionError(error);return{submissionError,error:submissionErrorMessage(submissionError,"ar")};}return{error:"تعذّر حفظ التغيير. راجع الحقول والصلاحيات؛ حدّث الصفحة إذا تغيرت المهمة أو المشاركة. رفض التسليم يحتاج ملاحظة؛ اعتماد المهمة يحتاج فصلًا أكاديميًا يغطي تاريخ الاعتماد."};}
 if(["read","read-all"].includes(String(f.get("operation")))){revalidatePath("/notifications");return{success:"تم تحديد الإشعارات كمقروءة."};}
 updateTag("public-talent");
 revalidatePath("/tasks","layout");revalidatePath("/activity");revalidatePath("/manage","layout");revalidatePath("/notifications");revalidatePath("/me");
 return {success:"تم حفظ التغيير.",task:target};
}
