import {t as translateUi} from "@/lib/i18n";
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
 {detail.canReview&&<div className="mt-6 grid gap-6 lg:grid-cols-2">{["Submitted","Interview"].includes(detail.status_code)&&<section className="panel p-6"><h2 className="mb-4 text-xl font-semibold">{translateUi((en) ? "en" : "ar", "قرار الطلب", "Application decision")}</h2><WorkflowForm operation="decide" fields={{application}} label={translateUi((en) ? "en" : "ar", "حفظ القرار", "Save decision")} locale={locale}><FormField  label={<>{translateUi((en) ? "en" : "ar", "القرار", "Decision")}</>}><NativeSelect name="status"><option value="Interview">{translateUi((en) ? "en" : "ar", "دعوة مقابلة", "Invite to interview")}</option><option value="Accepted">{translateUi((en) ? "en" : "ar", "قبول وإنشاء عضوية", "Accept and create membership")}</option><option value="Rejected">{translateUi((en) ? "en" : "ar", "رفض", "Reject")}</option></NativeSelect></FormField><FormField  label={<>{translateUi((en) ? "en" : "ar", "رسالة المقابلة", "Interview message")}</>}><textarea name="message" maxLength={3000}/></FormField></WorkflowForm></section>}
 <section className="panel p-6"><h2 className="mb-4 text-xl font-semibold">{translateUi((en) ? "en" : "ar", "ملاحظة داخلية", "Internal note")}</h2><WorkflowForm operation="note" fields={{application}} label={translateUi((en) ? "en" : "ar", "حفظ الملاحظة", "Save note")} locale={locale}><FormField  label={<>{translateUi((en) ? "en" : "ar", "الملاحظة", "Note")}</>}><textarea name="body" required maxLength={3000}/></FormField></WorkflowForm></section></div>}</>;
}
