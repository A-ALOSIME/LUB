"use server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import { withUser } from "@/db/client";
import { requireUser } from "@/features/auth/session";
import { definitionSchema, validateAnswers } from "./definition";
import { getRound } from "./repository";
export type WorkflowState = { error?: string; success?: string; bulk?: string };
const uuid = (form: FormData, name: string) => z.uuid().parse(form.get(name));
const optionalUuid = (form: FormData, name: string) => form.get(name) ? uuid(form,name) : null;
const text = (form: FormData, name: string, max = 120) => z.string().trim().min(1).max(max).parse(form.get(name));
function json(form: FormData, name: string, max: number) { const value=z.string().max(max).parse(form.get(name)); return JSON.parse(value) as unknown; }
export async function mutateWorkflow(_previous: WorkflowState, form: FormData): Promise<WorkflowState> {
 const user = await requireUser(); let bulk: string | undefined;
 try {
  const operation = z.enum(["create-form","save-form","publish-form","draft-form","create-round","round-status","submit","withdraw","decide","note","bulk","grant","end-grant"]).parse(form.get("operation"));
  const query = await (async () => {
   if (form.get("undoBulk")) return sql`select lub.undo_application_bulk(${uuid(form,"undoBulk")})`;
   switch(operation) {
    case "create-form": return sql`select lub.create_form(${uuid(form,"org")},${text(form,"title")},${optionalUuid(form,"source")})`;
    case "save-form": return sql`select lub.save_form_draft(${uuid(form,"version")},${JSON.stringify(definitionSchema.parse(json(form,"definition",128000)))}::jsonb,${z.coerce.number().int().positive().parse(form.get("revision"))})`;
    case "publish-form": return sql`select lub.publish_form_version(${uuid(form,"version")})`;
    case "draft-form": return sql`select lub.start_form_draft(${uuid(form,"template")})`;
    case "create-round": {
     const opens=z.iso.datetime({ offset:true }).parse(form.get("opens")); const closes=z.iso.datetime({ offset:true }).parse(form.get("closes"));
     if (new Date(closes)<=new Date(opens)) throw new Error("dates");
     return sql`select lub.create_registration_round(${uuid(form,"org")},${uuid(form,"template")},${text(form,"title")},${opens}::timestamptz,${closes}::timestamptz,${form.get("withdrawal")==="on"})`;
    }
    case "round-status": return sql`select lub.change_round_status(${uuid(form,"round")},${z.enum(["Open","Closed","Archived"]).parse(form.get("status"))})`;
    case "submit": {
     const round=await getRound(uuid(form,"round"),user.id); if (!round) throw new Error("round");
     const application=optionalUuid(form,"application"); const detail=application && round.application?.id===application ? round.application : undefined;
     if(application&&!detail)throw new Error("application");
     const version=detail?.version ?? round.version; if (!version || version.id!==uuid(form,"version")) throw new Error("version");
     const answers=validateAnswers(definitionSchema.parse(version.definition),json(form,"answers",256000));
     return sql`select lub.submit_application(${round.id},${version.id},${JSON.stringify(answers)}::jsonb,${optionalUuid(form,"committee")},${application},${application ? z.coerce.number().int().positive().parse(form.get("revision")) : null})`;
    }
    case "withdraw": return sql`select lub.withdraw_application(${uuid(form,"application")})`;
    case "decide": return sql`select lub.decide_application(${uuid(form,"application")},${z.enum(["Accepted","Rejected","Interview"]).parse(form.get("status"))},${z.string().trim().max(3000).parse(form.get("message") ?? "")})`;
    case "note": return sql`select lub.add_application_note(${uuid(form,"application")},${text(form,"body",3000)})`;
    case "bulk": {
     const ids=z.array(z.uuid()).min(1).max(100).parse(form.getAll("selected"));
     return sql`select lub.bulk_decide_applications(${ids}::uuid[],${z.enum(["Accepted","Rejected","Interview"]).parse(form.get("status"))},${z.string().trim().max(3000).parse(form.get("message") ?? "")}) as id`;
    }
    case "grant": return sql`select lub.grant_application_permission(${uuid(form,"member")},${z.enum(["FORMS_MANAGE","REGISTRATION_ROUNDS_MANAGE","APPLICATIONS_VIEW","APPLICATIONS_REVIEW","APPLICATIONS_BULK_ACTION"]).parse(form.get("capability"))},${optionalUuid(form,"committee")},${form.get("ends") ? z.iso.datetime({offset:true}).parse(form.get("ends")) : null}::timestamptz)`;
    case "end-grant": return sql`select lub.end_application_permission(${uuid(form,"grant")})`;
   }
  })();
  const result=await withUser(user.id,tx=>tx.execute(query));
  if (operation==="bulk" && !form.get("undoBulk")) bulk=z.uuid().parse(result[0]?.id);
 } catch { return { error:"تعذّر الحفظ. راجع الحقول والصلاحيات؛ حدّث الصفحة إذا تغيّرت نسخة النموذج أو حالة الطلب. رسالة المقابلة مطلوبة عند اختيار مقابلة." }; }
 updateTag("public-organizations"); revalidatePath("/manage","layout"); revalidatePath("/organizations","layout"); revalidatePath("/applications");
 return { success: form.get("undoBulk") ? "تم التراجع عن الطلبات التي لم تتغير بعد العملية؛ التغييرات اللاحقة محفوظة." : "تم حفظ التغيير.", bulk };
}
