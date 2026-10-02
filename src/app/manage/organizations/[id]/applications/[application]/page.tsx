import {localizedMetadata} from "@/lib/localized-metadata";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/features/auth/session";
import { getApplicationDetail } from "@/features/forms/repository";
import { ApplicationDetail } from "@/features/forms/application-detail";
import { WorkflowForm } from "@/features/forms/mutation-form";
import { getPreferences } from "@/lib/preferences";
export async function generateMetadata(){return localizedMetadata('مراجعة طلب الانضمام','Review membership application');}
export default async function ReviewPage({params}:{params:Promise<{id:string;application:string}>}) {
 const [user,{locale}]=await Promise.all([requireUser(),getPreferences()]);const en=locale==="en";const {id,application}=await params;if(!z.uuid().safeParse(id).success||!z.uuid().safeParse(application).success)notFound();
 const detail=await getApplicationDetail(user.id,application);if(!detail||detail.organization_id!==id||!detail.canStaff)notFound();
 return <><Link className="text-link" href={`/manage/organizations/${id}/applications`}>{en?"Forms and applications":"النماذج والطلبات"}</Link><h1 className="my-6 text-3xl font-bold">{en?"Review membership application":"مراجعة طلب الانضمام"}</h1><section className="panel p-6"><ApplicationDetail detail={detail} locale={locale}/></section>
 {detail.canReview&&<div className="mt-6 grid gap-6 lg:grid-cols-2">{["Submitted","Interview"].includes(detail.status_code)&&<section className="panel p-6"><h2 className="mb-4 text-xl font-semibold">{en?"Application decision":"قرار الطلب"}</h2><WorkflowForm operation="decide" fields={{application}} label={en?"Save decision":"حفظ القرار"} locale={locale}><label>{en?"Decision":"القرار"}<select name="status"><option value="Interview">{en?"Invite to interview":"دعوة مقابلة"}</option><option value="Accepted">{en?"Accept and create membership":"قبول وإنشاء عضوية"}</option><option value="Rejected">{en?"Reject":"رفض"}</option></select></label><label>{en?"Interview message":"رسالة المقابلة"}<textarea name="message" maxLength={3000}/></label><p className="text-sm leading-7 text-muted">{en?"The applicant can see the interview message. Acceptance or rejection closes the application for editing.":"رسالة المقابلة تظهر للطالب. القبول أو الرفض يقفل تعديل الطلب."}</p></WorkflowForm></section>}
 <section className="panel p-6"><h2 className="mb-4 text-xl font-semibold">{en?"Internal note":"ملاحظة داخلية"}</h2><WorkflowForm operation="note" fields={{application}} label={en?"Save note":"حفظ الملاحظة"} locale={locale}><label>{en?"Note":"الملاحظة"}<textarea name="body" required maxLength={3000}/></label><p className="text-sm text-muted">{en?"Visible only to reviewers.":"متاحة للمراجعين فقط."}</p></WorkflowForm></section></div>}</>;
}
