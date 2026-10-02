"use server";
import {z} from "zod";
import {sql} from "drizzle-orm";
import {revalidatePath} from "next/cache";
import {withUser} from "@/db/client";
import {requireUser} from "@/features/auth/session";
import {normalizeDigits} from "@/lib/validation";
import type {WorkflowState} from "@/features/forms/actions";
const id=(f:FormData,k:string)=>z.uuid().parse(f.get(k));
const optionalId=(f:FormData,k:string)=>f.get(k)?id(f,k):null;
const text=(f:FormData,k:string,max:number,min=0)=>z.string().trim().min(min).max(max).parse(f.get(k)??"");
const checked=(f:FormData,k:string)=>f.get(k)==="on";
export async function mutateTalent(_previous:WorkflowState,f:FormData):Promise<WorkflowState>{const user=await requireUser();try{
 const operation=z.enum(["settings","link","remove-link","skill","remove-skill","project","organization","event","contribution"]).parse(f.get("operation"));
 const query=(()=>{switch(operation){
 case "settings":return sql`select lub.save_talent_settings(${text(f,"bio",1000)},${checked(f,"enabled")},${checked(f,"hours")},${checked(f,"roles")},${checked(f,"events")},${checked(f,"projects")})`;
 case "link":{const kind=z.enum(["Email","Phone","Website","LinkedIn","GitHub"]).parse(f.get("kind"));const input=text(f,"value",2048,1);const value=kind==="Email"?z.email().max(254).parse(input):kind==="Phone"?z.string().regex(/^\+?[0-9]{8,15}$/).parse(normalizeDigits(input)):z.url({protocol:/^https$/}).parse(input);return sql`select lub.save_talent_link(${optionalId(f,"link")},${kind},${text(f,"label",80,1)},${value},${checked(f,"visible")})`;}
 case "remove-link":return sql`select lub.remove_talent_link(${id(f,"link")})`;
 case "skill":return sql`select lub.save_talent_skill(${text(f,"name",80,2)},${checked(f,"visible")})`;
 case "remove-skill":return sql`select lub.remove_talent_skill(${text(f,"name",80,2)})`;
 case "project":return sql`select lub.save_talent_project(${optionalId(f,"project")},${optionalId(f,"participant")},${optionalId(f,"contribution")},${text(f,"title",120,2)},${text(f,"description",1000)},${checked(f,"visible")},${checked(f,"featured")})`;
 case "organization":return sql`select lub.set_talent_organization(${id(f,"org")},${checked(f,"hours")},${checked(f,"history")})`;
 case "event":return sql`select lub.set_talent_event(${id(f,"registration")},${checked(f,"visible")})`;
 case "contribution":return sql`select lub.set_talent_contribution(${id(f,"contribution")},${checked(f,"visible")})`;
 }})();await withUser(user.id,tx=>tx.execute(query));
 }catch{return {error:"تعذّر حفظ الملف المهاري. راجع الحقول؛ الروابط تبدأ بـ HTTPS، والإنجاز يحتاج نشاطًا معتمدًا تملكه داخل LUB."};}
 revalidatePath("/talent","layout");revalidatePath("/account/talent");revalidatePath("/me");return{success:"تم حفظ خيارات الملف المهاري والخصوصية."};}
