"use server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { withUser } from "@/db/client";
import { requireUser } from "@/features/auth/session";
export type TaskState={error?:string;success?:string;task?:string};
const id=(f:FormData,k:string)=>z.uuid().parse(f.get(k));
const optionalId=(f:FormData,k:string)=>f.get(k)?id(f,k):null;
const text=(f:FormData,k:string,max:number,min=1)=>z.string().trim().min(min).max(max).parse(f.get(k)??"");
const revision=(f:FormData,k="revision")=>z.coerce.number().int().positive().parse(f.get(k));
const hours=(f:FormData,k="hours")=>z.coerce.number().finite().min(0).max(1000).multipleOf(0.01).parse(f.get(k));
const date=(f:FormData,k:string)=>f.get(k)?z.iso.datetime({offset:true}).parse(f.get(k)):null;
export async function mutateTask(_previous:TaskState,f:FormData):Promise<TaskState>{
 const user=await requireUser();let target:string|undefined;
 try{
 const operation=z.enum(["save-task","link-event","status","template","join","start","submit","review","close","read","grant","end-grant"]).parse(f.get("operation"));
 const query=(()=>{
 switch(operation){
 case "link-event":return sql`select lub.link_task_event(${id(f,"task")},${optionalId(f,"event")},${revision(f)})`;
 case "save-task":if(f.get("rule")){if(f.get("task"))throw new Error();return sql`select lub.save_task_with_rule(${id(f,"org")},${optionalId(f,"committee")},${optionalId(f,"template")},${text(f,"title",120,2)},${text(f,"description",6000)},${date(f,"starts")}::timestamptz,${date(f,"due")}::timestamptz,${id(f,"rule")}) as id`;}return sql`select lub.save_task(${optionalId(f,"task")},${id(f,"org")},${optionalId(f,"committee")},${optionalId(f,"template")},${text(f,"title",120,2)},${text(f,"description",6000)},${date(f,"starts")}::timestamptz,${date(f,"due")}::timestamptz,${hours(f)}::numeric,${f.get("task")?revision(f):null}::int) as id`;
 case "status":{const status=z.enum(["Open","Completed","Cancelled"]).parse(f.get("status"));if(status!=="Open"&&f.get("confirm")!=="on")throw new Error("confirmation");return sql`select lub.change_task_status(${id(f,"task")},${status},${revision(f)})`;}
 case "template":return sql`select lub.save_task_template(${optionalId(f,"template")},${id(f,"org")},${optionalId(f,"committee")},${text(f,"title",120,2)},${text(f,"description",6000,f.get("source")?0:1)},${hours(f)}::numeric,${f.get("active")==="on"},${f.get("template")?revision(f):null}::int,${optionalId(f,"source")})`;
 case "join":return sql`select lub.join_task(${id(f,"task")})`;
 case "start":return sql`select lub.start_task_participation(${id(f,"participant")})`;
 case "submit":return sql`select lub.submit_task(${id(f,"participant")},${text(f,"message",6000,0)},${z.array(z.uuid()).max(5).parse(f.getAll("asset"))}::uuid[],${z.coerce.number().int().min(0).parse(f.get("lastRevision"))},${revision(f)})`;
 case "review":return sql`select lub.review_task_submission(${id(f,"submission")},${z.enum(["Approved","Rejected"]).parse(f.get("status"))},${text(f,"note",3000,0)},${f.get("hours")?hours(f):null}::numeric)`;
 case "close":if(f.get("confirm")!=="on")throw new Error("confirmation");return sql`select lub.close_task_participant(${id(f,"participant")})`;
 case "read":return sql`select lub.read_task_notification(${id(f,"notification")})`;
 case "grant":return sql`select lub.grant_task_permission(${id(f,"member")},${z.enum(["TASKS_MANAGE","TASK_TEMPLATES_MANAGE"]).parse(f.get("capability"))},${optionalId(f,"committee")},${date(f,"ends")}::timestamptz)`;
 case "end-grant":return sql`select lub.end_task_permission(${id(f,"grant")})`;
 }
 })();const rows=await withUser(user.id,tx=>tx.execute(query));
 if(operation==="save-task")target=z.uuid().parse(rows[0]?.id);
 }catch{return{error:"تعذّر حفظ التغيير. راجع الحقول والصلاحيات؛ حدّث الصفحة إذا تغيرت المهمة أو المشاركة. رفض التسليم يحتاج ملاحظة؛ اعتماد المهمة يحتاج فصلًا أكاديميًا يغطي تاريخ الاعتماد."};}
 revalidatePath("/tasks","layout");revalidatePath("/manage","layout");revalidatePath("/notifications");revalidatePath("/me");
 return {success:"تم حفظ التغيير.",task:target};
}
