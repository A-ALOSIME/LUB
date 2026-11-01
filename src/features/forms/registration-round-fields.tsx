"use client";
import {createTranslator} from "@/lib/i18n";
import type {Round} from "./repository";
import Link from "next/link";
import {Checkbox} from "@/components/ui/checkbox";
import {studentMajors,studentMajorsEn} from "@/lib/student-identity";
import {FieldSet,FieldLegend} from "@/components/ui/field";
import {Input} from "@/components/ui/input";
import {NativeSelect} from "@/components/ui/native-select";
import {Switch} from "@/components/ui/switch";
import {Field, FieldContent, FieldDescription, FieldGroup, FieldLabel} from "@/components/ui/field";
import {ValidatedField} from "@/components/validated-field";
import {DateRangeInput} from "./date-input";
import type {Locale} from "@/lib/preferences";

export function RegistrationRoundFields({templates,locale,formHref,value}:{templates:Array<{id:string;name:string}>;locale:Locale;formHref?:string;value?:Round}) {
  const en=locale==="en",c=createTranslator(en ? "en" : "ar");
  return <FieldGroup className="registration-round-fields">
    <ValidatedField id="registration-round-title" label={c("عنوان الجولة","Round title")} required locale={locale}><Input id="registration-round-title" name="title" required minLength={2} maxLength={120} defaultValue={value?.title}/></ValidatedField>
    <ValidatedField id="registration-round-template" label={c("النموذج المنشور","Published form")} required locale={locale}><NativeSelect id="registration-round-template" name="template" required defaultValue={value?.form_template_id??""}><option value="">{c("اختر نموذجًا","Select a form")}</option>{templates.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</NativeSelect>{!templates.length&&<FieldDescription>{c("لا توجد نماذج منشورة لهذه الجهة.","There are no published forms for this organization.")} {formHref?<Link href={formHref} className="text-primary underline">{c("انتقل إلى النماذج لإنشاء نموذج.","Go to forms to create one.")}</Link>:c("اطلب من مسؤول النماذج نشر نموذج أولًا.","Ask a forms manager to publish a form first.")}</FieldDescription>}</ValidatedField>
    <DateRangeInput startName="opens" endName="closes" label={c("فترة التسجيل","Registration period")} startValue={value?.opens_at} endValue={value?.closes_at} required includeTime locale={locale}/>
    <input type="hidden" name="requirements-present" value="on"/>
    <ValidatedField id="round-minimum-hours" label={c("الحد الأدنى للساعات المعتمدة","Minimum approved hours")} hint={c("إجمالي الساعات المعتمدة على المنصة. 0 يعني بدون حد أدنى.","Total approved platform hours. 0 means no minimum.")} locale={locale}><Input id="round-minimum-hours" type="number" min={0} max={100000} step="0.01" name="minimumHours" defaultValue={value?.minimum_approved_hours??0}/></ValidatedField>
    <FieldSet><FieldLegend>{c("التخصصات المسموحة","Allowed majors")}</FieldLegend><FieldDescription>{c("اتركها بدون تحديد للسماح بجميع التخصصات.","Leave all unchecked to allow every major.")}</FieldDescription>{studentMajors.map((major,index)=><Field key={major} orientation="horizontal"><Checkbox id={`round-major-${index}`} name="allowedMajor" value={major} defaultChecked={value?.allowed_majors?.includes(major)??false}/><FieldLabel htmlFor={`round-major-${index}`}>{en?studentMajorsEn[index]:major}</FieldLabel></Field>)}</FieldSet>
    {value&&<Link href={formHref??"#"} className="text-primary underline">{c("تعديل الأسئلة","Edit questions")}</Link>}
    <Field orientation="horizontal" className="items-start"><Switch id="registration-round-withdrawal" name="withdrawal" value="on" defaultChecked={value?.allow_withdrawal??true}/><FieldContent><FieldLabel htmlFor="registration-round-withdrawal">{c("السماح بسحب الطلب قبل القرار النهائي","Allow withdrawal before the final decision")}</FieldLabel><FieldDescription>{c("يمكن للطالب سحب طلبه ما دامت الجهة لم تتخذ قرارًا نهائيًا.","Students can withdraw until the organization makes a final decision.")}</FieldDescription></FieldContent></Field>
  </FieldGroup>;
}
