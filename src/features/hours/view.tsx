import {t as translateUi} from "@/lib/i18n";
import { NativeSelect } from "@/components/ui/native-select";
import { HoursRecordTable } from "./hours-record-table";
import { academicTerm } from "@/lib/display";
import {redirect} from "next/navigation";
import type {AccountReadiness,HourRecord,Term} from "./repository";
import type {Locale} from "@/lib/preferences";
import {DatePickerField} from "@/features/forms/date-input";
import { FormField } from "@/components/form-field";
export const hourLabels:Record<string,string>={Pending:"بانتظار الاعتماد",Approved:"معتمدة",Rejected:"مرفوضة",Voided:"مبطلة",TASK:"مهمة",MANUAL:"إضافة يدوية",SELF_REPORTED:"طلب ذاتي",Draft:"مسودة",Open:"مفتوحة",Closed:"مغلقة",Archived:"مؤرشفة",Renewed:"جدد العضوية",Declined:"رفض التجديد",No_Response:"لم يرد"};
export const hourLabelsEn:Record<string,string>={Pending:"Pending approval",Approved:"Approved",Rejected:"Rejected",Voided:"Voided",TASK:"Task",MANUAL:"Manual entry",SELF_REPORTED:"Self-reported",Draft:"Draft",Open:"Open",Closed:"Closed",Archived:"Archived",Renewed:"Renewed membership",Declined:"Declined renewal",No_Response:"No response"};
export function checkReadiness(value:AccountReadiness|undefined){if(value?.status==="Inactive")redirect("/account-unavailable");if(!value?.onboarded)redirect("/onboarding");}
export function TermSelect({terms,value,all=false,locale="ar",className,compact=false}:{terms:Term[];value?:string;all?:boolean;locale?:Locale;className?:string;compact?:boolean}) {
 const en=locale==="en";
 const control=<NativeSelect aria-label={translateUi((en) ? "en" : "ar", "الفصل الدراسي", "Academic term")} name="term" required={!all} defaultValue={value??""}><option value="">{all?translateUi((en) ? "en" : "ar", "كل الفصول", "All terms"):translateUi((en) ? "en" : "ar", "اختر الفصل", "Choose term")}</option>{terms.map(t=><option key={t.id} value={t.id} dir="auto">{academicTerm(t.name_ar,locale)} · {t.academic_year}</option>)}</NativeSelect>;
 return compact?control:<FormField className={className} label={translateUi((en) ? "en" : "ar", "الفصل الأكاديمي", "Academic term")}>{control}</FormField>;
}
export function HoursFields({locale="ar"}:{locale?:Locale}){const en=locale==="en";return <><DatePickerField name="day" label={translateUi((en) ? "en" : "ar", "تاريخ العمل", "Work date")} required locale={locale}/><FormField  label={<>{translateUi((en) ? "en" : "ar", "عدد الساعات", "Hours")}</>}><input type="number" name="hours" min={0} max={1000} step="0.01" required/></FormField><FormField  label={<>{translateUi((en) ? "en" : "ar", "وصف العمل وسبب الإضافة", "Work description and reason for entry")}</>}><textarea name="reason" required maxLength={3000} rows={3}/></FormField></>;}
export function HoursList({items,locale="ar"}:{items:HourRecord[];locale?:Locale}){return items.length?<HoursRecordTable items={items} locale={locale} personal/>:<p className="workspace-empty">{translateUi((locale==="en") ? "en" : "ar", "لا توجد سجلات ساعات.", "No hours records.")}</p>;}
