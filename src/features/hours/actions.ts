"use server";
import {z} from "zod";
import {sql} from "drizzle-orm";
import {revalidatePath} from "next/cache";
import {withUser} from "@/db/client";
import {requireUser} from "@/features/auth/session";
export type HoursState={error?:string;success?:string};
const id=(f:FormData,k:string)=>z.uuid().parse(f.get(k));
const optionalId=(f:FormData,k:string)=>f.get(k)?id(f,k):null;
const text=(f:FormData,k:string,max:number,min=1)=>z.string().trim().min(min).max(max).parse(f.get(k)??"");
const day=(f:FormData,k:string)=>z.iso.date().parse(f.get(k));
const date=(f:FormData,k:string)=>z.iso.datetime({offset:true}).parse(f.get(k));
const amount=(f:FormData)=>z.coerce.number().finite().min(0).max(1000).multipleOf(0.01).parse(f.get("hours"));
export async function mutateHours(_previous:HoursState,f:FormData):Promise<HoursState>{
 const user=await requireUser();
 try{
 const op=z.enum(["term","add","self","review","rule","self-policy","import","campaign","exclude","campaign-status","respond","grant","end-grant"]).parse(f.get("operation"));
 const query=(()=>{switch(op){
 case "term":return sql`select lub.create_academic_term(${text(f,"year",20,2)},${text(f,"code",20)},${text(f,"name",120,2)},${day(f,"starts")}::date,${day(f,"ends")}::date)`;
 case "add":case "self":return sql`select lub.add_hours(${id(f,"member")},${optionalId(f,"committee")},${id(f,"term")},${amount(f)}::numeric,${day(f,"day")}::date,${text(f,"reason",3000)},${op==="self"})`;
 case "review":{const status=z.enum(["Approved","Rejected","Voided"]).parse(f.get("status"));if(status==="Voided"&&f.get("confirm")!=="on")throw new Error();return sql`select lub.review_hours(${id(f,"record")},${status},${text(f,"note",3000,status==="Approved"?0:1)})`;}
 case "rule":return sql`select lub.save_hour_rule(${optionalId(f,"rule")},${id(f,"org")},${optionalId(f,"committee")},${optionalId(f,"template")},${text(f,"name",120,2)},${amount(f)}::numeric,${day(f,"starts")}::date,${f.get("ends")?day(f,"ends"):null}::date,${f.get("active")==="on"},${f.get("rule")?z.coerce.number().int().positive().parse(f.get("revision")):null}::int)`;
 case "self-policy":return sql`select lub.set_self_report_hours(${id(f,"org")},${f.get("enabled")==="on"})`;
 case "import":return sql`select lub.import_task_hours(${id(f,"participant")})`;
 case "campaign":return sql`select lub.create_renewal(${id(f,"org")},${id(f,"term")},${date(f,"opens")}::timestamptz,${date(f,"closes")}::timestamptz,${f.get("leaders")==="on"})`;
 case "exclude":return sql`select lub.exclude_renewal_member(${id(f,"campaign")},${id(f,"member")},${text(f,"reason",300,f.get("excluded")==="on"?1:0)},${f.get("excluded")==="on"})`;
 case "campaign-status":{const status=z.enum(["Open","Closed","Archived"]).parse(f.get("status"));if(f.get("confirm")!=="on")throw new Error();return sql`select lub.change_renewal_status(${id(f,"campaign")},${status})`;}
 case "respond":return sql`select lub.respond_renewal(${id(f,"response")},${z.enum(["Renewed","Declined"]).parse(f.get("decision"))})`;
 case "grant":return sql`select lub.grant_hours_permission(${id(f,"member")},${z.enum(["HOURS_APPROVE","HOURS_MANUAL_ADD","HOUR_RULES_MANAGE","RENEWALS_MANAGE"]).parse(f.get("capability"))},${optionalId(f,"committee")},${f.get("ends")?date(f,"ends"):null}::timestamptz)`;
 case "end-grant":if(f.get("confirm")!=="on")throw new Error();return sql`select lub.end_hours_permission(${id(f,"grant")})`;
 }})();await withUser(user.id,tx=>tx.execute(query));
 }catch{return{error:"تعذّر حفظ التغيير. راجع الحقول، الفصل الأكاديمي والصلاحيات، وحدّث الصفحة إذا تغير السجل. الرفض والإبطال يحتاجان سببًا."};}
 revalidatePath("/hours");revalidatePath("/renewals");revalidatePath("/manage","layout");revalidatePath("/tasks","layout");revalidatePath("/me");revalidatePath("/notifications");
 return {success:"تم حفظ التغيير."};
}
