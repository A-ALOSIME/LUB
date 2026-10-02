"use server";
import {z} from "zod";
import {sql} from "drizzle-orm";
import {revalidatePath,updateTag} from "next/cache";
import {withUser} from "@/db/client";
import {requireUser} from "@/features/auth/session";
import type {WorkflowState} from "@/features/forms/actions";
const id=(f:FormData,k:string)=>z.uuid().parse(f.get(k));
const optionalId=(f:FormData,k:string)=>f.get(k)?id(f,k):null;
const text=(f:FormData,k:string,max:number,min=0)=>z.string().trim().min(min).max(max).parse(f.get(k)??"");
const date=(f:FormData,k:string)=>z.iso.datetime({offset:true}).parse(f.get(k));
const revision=(f:FormData)=>z.coerce.number().int().positive().parse(f.get("revision"));
export async function mutateEvent(_previous:WorkflowState,f:FormData):Promise<WorkflowState>{
 const user=await requireUser();try{
 const operation=z.enum(["save","status","duplicate","register","cancel","attendance","contribution","attach","grant","end-grant","feature","public-content"]).parse(f.get("operation"));
 const query=(()=>{switch(operation){
 case "save":return sql`select lub.save_event(${optionalId(f,"event")},${id(f,"org")},${text(f,"title",120,2)},${text(f,"description",6000)},${z.enum(["In_Person","Online","Hybrid"]).parse(f.get("locationType"))},${text(f,"location",500)||null},${f.get("url")?z.url({protocol:/^https$/}).parse(f.get("url")):null},${date(f,"starts")}::timestamptz,${date(f,"ends")}::timestamptz,${date(f,"opens")}::timestamptz,${date(f,"closes")}::timestamptz,${f.get("capacity")?z.coerce.number().int().min(1).max(10000).parse(f.get("capacity")):null}::int,${optionalId(f,"template")},${z.coerce.number().min(0).max(1000).multipleOf(.01).parse(f.get("hours"))}::numeric,${f.get("event")?revision(f):null}::int)`;
 case "status":{const status=z.enum(["Published","Completed","Cancelled"]).parse(f.get("status"));if(f.get("confirm")!=="on")throw new Error();return sql`select lub.change_event_status(${id(f,"event")},${status},${revision(f)})`;}
 case "duplicate":return sql`select lub.duplicate_event(${id(f,"event")})`;
 case "register":return sql`select lub.register_event(${id(f,"event")},${optionalId(f,"version")},${text(f,"answers",128000)||"{}"}::jsonb,${f.get("revision")?revision(f):null}::int)`;
 case "cancel":if(f.get("confirm")!=="on")throw new Error();return sql`select lub.cancel_event_registration(${id(f,"registration")})`;
 case "attendance":return sql`select lub.mark_event_attendance(${id(f,"registration")},${z.enum(["Pending","Present","Absent","Excused"]).parse(f.get("status"))})`;
 case "contribution":return sql`select lub.verify_event_contribution(${id(f,"event")},${id(f,"student")},${z.enum(["Presenter","Trainer","Core_Contributor"]).parse(f.get("kind"))},${text(f,"title",120,2)})`;
 case "attach":return sql`select lub.attach_event_asset(${id(f,"event")},${id(f,"asset")},${z.enum(["Approval","Attendance","Report","Photo"]).parse(f.get("kind"))})`;
 case "grant":return sql`select lub.grant_event_permission(${id(f,"member")},${z.enum(["EVENTS_MANAGE","EVENT_ATTENDANCE_MANAGE","EVENT_CONTRIBUTIONS_MANAGE"]).parse(f.get("capability"))},${f.get("ends")?date(f,"ends"):null}::timestamptz)`;
 case "end-grant":return sql`select lub.end_event_permission(${id(f,"grant")})`;
 case "feature":return sql`select lub.set_featured_event(${id(f,"event")},${f.get("featured")==="on"})`;
 case "public-content":{
  const report=text(f,"report",5000);
  const photos=z.array(z.string().url().refine(value=>{const url=new URL(value);return url.protocol==="https:"&&!url.username&&!url.password&&!/\s/.test(value);})).max(4).parse(text(f,"photos",8200).split(/\r?\n/).map(value=>value.trim()).filter(Boolean));
  return sql`select lub.set_event_public_content(${id(f,"event")},${report},array[${sql.join(photos.map(value=>sql`${value}`),sql`, `)}]::text[])`;
 }
 }})();await withUser(user.id,tx=>tx.execute(query));
 }catch{return{error:"تعذّر حفظ التغيير. راجع الحقول والصلاحيات وحدّث الصفحة. التسجيل له موعد وسعة؛ الإكمال يحتاج انتهاء الفعالية ومراجعة الحضور وفصلًا يغطي ساعات الأعضاء."};}
 updateTag("events");updateTag("public-organizations");revalidatePath("/events","layout");revalidatePath("/organizations","layout");revalidatePath("/manage","layout");revalidatePath("/me");revalidatePath("/hours");revalidatePath("/notifications");return{success:"تم حفظ التغيير."};
}
