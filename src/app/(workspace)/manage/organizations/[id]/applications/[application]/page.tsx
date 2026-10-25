import { NativeSelect } from "@/components/ui/native-select";
import {localizedMetadata} from "@/lib/localized-metadata";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireVerifiedProxyIdentity } from "@/features/auth/session";
import { getApplicationDetail } from "@/features/forms/repository";
import { ApplicationDetail } from "@/features/forms/application-detail";
import { WorkflowForm } from "@/features/forms/mutation-form";
import { getPreferences } from "@/lib/preferences";
import { FormField } from "@/components/form-field";
export async function generateMetadata(){return localizedMetadata('طلبات الأعضاء','Member applications');}
export default async function ReviewPage({params}:{params:Promise<{id:string;application:string}>}) {
 const [user,{locale}]=await Promise.all([requireVerifiedProxyIdentity(),getPreferences()]);const en=locale==="en";const {id,application}=await params;if(!z.uuid().safeParse(id).success||!z.uuid().safeParse(application).success)notFound();
 const detail=await getApplicationDetail(user.id,application);if(!detail||detail.organization_id!==id||!detail.canStaff)notFound();
 return <><section className="panel p-6"><ApplicationDetail detail={detail} locale={locale}/></section>
 {detail.canReview&&<div className="mt-6 grid gap-6 lg:grid-cols-2">{["Submitted","Interview"].includes(detail.status_code)&&<section className="panel p-6"><h2 className="mb-4 text-xl font-semibold">{en?"Application decision":"قرار الطلب"}</h2><WorkflowForm operation="decide" fields={{application}} label={en?"Save decision":"حفظ القرار"} locale={locale}><FormField  label={<>{en?"Decision":"القرار"}</>}><NativeSelect name="status"><option value="Interview">{en?"Invite to interview":"دعوة مقابلة"}</option><option value="Accepted">{en?"Accept and create membership":"قبول وإنشاء عضوية"}</option><option value="Rejected">{en?"Reject":"رفض"}</option></NativeSelect></FormField><FormField  label={<>{en?"Interview message":"رسالة المقابلة"}</>}><textarea name="message" maxLength={3000}/></FormField></WorkflowForm></section>}
 <section className="panel p-6"><h2 className="mb-4 text-xl font-semibold">{en?"Internal note":"ملاحظة داخلية"}</h2><WorkflowForm operation="note" fields={{application}} label={en?"Save note":"حفظ الملاحظة"} locale={locale}><FormField  label={<>{en?"Note":"الملاحظة"}</>}><textarea name="body" required maxLength={3000}/></FormField></WorkflowForm></section></div>}</>;
}
