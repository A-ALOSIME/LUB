import {localizedMetadata} from "@/lib/localized-metadata";
import {notFound} from "next/navigation";
import {requireVerifiedProxyIdentity} from "@/features/auth/session";
import {termWorkspace} from "@/features/hours/repository";
import {checkReadiness} from "@/features/hours/view";
import {HoursForm} from "@/features/hours/form";
import {getPreferences} from "@/lib/preferences";
import {isSuperAdminUser} from "@/features/auth/authorization";
import { FormField } from "@/components/form-field";
export async function generateMetadata(){return localizedMetadata('الفصول الأكاديمية','Academic terms');}
export default async function TermsPage(){
 const [user,{locale}]=await Promise.all([requireVerifiedProxyIdentity(),getPreferences()]),en=locale==="en";const data=await termWorkspace(user.id);if(!await isSuperAdminUser(user.id))checkReadiness(data?.account);if(!data?.canManage)notFound();
 return <div className="space-y-8"><div><h1 className="text-3xl font-bold">{en?"Academic terms":"الفصول الأكاديمية"}</h1><p className="mt-3 leading-8 text-muted">{en?"Define official terms and dates before approving task hours. Saved terms are fixed and their dates cannot overlap.":"عرّف الفصول الرسمية وتواريخها قبل اعتماد ساعات المهام. الفصل المحفوظ ثابت، ولا تتداخل تواريخ الفصول."}</p></div><section className="panel p-6"><h2 className="mb-5 text-xl font-semibold">{en?"Add term":"إضافة فصل"}</h2><HoursForm operation="term" label={en?"Create term":"تعريف الفصل"} locale={locale}><FormField  label={<>{en?"Academic year":"السنة الأكاديمية"}</>}><input name="year" required minLength={2} maxLength={20} placeholder="2026-2027"/></FormField><FormField  label={<>{en?"Term code":"رمز الفصل"}</>}><input name="code" required maxLength={20} placeholder="T1"/></FormField><FormField  label={<>{en?"Term name":"اسم الفصل"}</>}><input name="name" required minLength={2} maxLength={120}/></FormField><div className="grid gap-4 sm:grid-cols-2"><FormField  label={<>{en?"Start":"البداية"}</>}><input name="starts" type="date" required/></FormField><FormField  label={<>{en?"End":"النهاية"}</>}><input name="ends" type="date" required/></FormField></div></HoursForm></section><ul className="space-y-4">{data.terms.map(t=><li key={t.id} className="panel p-5"><h2 dir="auto" className="font-semibold">{t.name_ar} · {t.academic_year}</h2><p className="mt-3 text-sm text-muted">{t.term_code} · {t.start_date} {en?"to":"إلى"} {t.end_date}</p></li>)}</ul></div>;
}
