"use client";
import {t as translateUi} from "@/lib/i18n";
import {studentMajors,studentMajorsEn} from "@/lib/student-identity";
import {academicLevel} from "@/lib/display";
import {NativeSelect} from "@/components/ui/native-select";

import { useActionState, useState } from "react";
import { requestCode, verifyCode, type CodeState } from "./actions";
import type { FormState } from "@/lib/validation";
import type { Locale } from "@/lib/preferences";
import { actionFeedback } from "@/lib/action-feedback";
import { PhoneInput } from "@/components/phone-input";
import { useActionToast } from "@/components/action-toast";

type SignupDraft = {
  email: string;
  fullName: string;
  universityId: string;
  nationalId:string;
  major: string;
  academicLevel: string;
  phone: string;
};

const emptyDraft: SignupDraft = {
  email: "",
  fullName: "",
  universityId: "",
  nationalId:"",
  major: "",
  academicLevel: "",
  phone: "",
};

type TextField = "email" | "fullName" | "universityId" | "nationalId" | "major" | "academicLevel" | "phone";

export function SignupFlow({ available, returnTo, locale }: { available: boolean; returnTo: string; locale: Locale }) {
  const en = locale === "en";
  const [state, send, sending] = useActionState<CodeState, FormData>(requestCode, {});
  useActionToast(state, locale);
  const [changeDetails, setChangeDetails] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const emailToVerify = !changeDetails && !sending ? state.email : undefined;
  const updateText = (field: TextField, value: string) => setDraft(current => ({ ...current, [field]: value }));
  const error = (field: string) => state.fieldErrors?.[field]?.[0];
  const fieldError = (field: string) => error(field) && <p id={`${field}-error`} className="mt-2 text-sm text-red-800">{actionFeedback(error(field), locale)}</p>;
  const fieldProps = (field: string) => ({ "aria-invalid": Boolean(error(field)), "aria-describedby": error(field) ? `${field}-error` : undefined });

  return emailToVerify ? <div className="space-y-5">
    <p role="status" className="leading-8 text-muted">{translateUi((en) ? "en" : "ar", "إذا كان البريد مؤهلًا للتسجيل، سيصلك رمز تحقق من 6 أرقام على ", "If this email is eligible for sign-up, a 6-digit verification code will arrive at ")}<bdi className="font-medium text-ink">{emailToVerify}</bdi>{translateUi((en) ? "en" : "ar", ". أدخله أدناه، أو استخدم رابط التأكيد في نفس الرسالة لإكمال حسابك.", ". Enter it below, or follow the confirmation link in the same email to complete your account.")}</p>
    <p className="text-sm leading-7 text-muted">{translateUi((en) ? "en" : "ar", "إذا لم يصلك الرمز خلال دقيقة، تحقّق من مجلد البريد العشوائي (Spam) أو الرسائل المحجوزة في بريد الجامعة، ثم اضغط «تعديل البيانات أو طلب رمز جديد» للمحاولة مرة أخرى.", "If the code does not arrive within a minute, check your spam folder or your university email quarantine, then choose “Change details or request a new code” to try again.")}</p>
    <SignupOtpForm email={emailToVerify} returnTo={returnTo} locale={locale} />
    <button type="button" onClick={() => setChangeDetails(true)} className="text-link">{translateUi((en) ? "en" : "ar", "تعديل البيانات أو طلب رمز جديد", "Change details or request a new code")}</button>
  </div> : <form action={send} onSubmit={() => setChangeDetails(false)} className="space-y-5">
    <input type="hidden" name="returnTo" value={returnTo} />
    <input type="hidden" name="mode" value="signup" />
    <div>
      <label htmlFor="signup-email">{translateUi((en) ? "en" : "ar", "البريد الإلكتروني", "Email address")}</label>
      <input id="signup-email" name="email" type="email" dir="ltr" autoComplete="email" placeholder="you@example.com" required maxLength={254} value={draft.email} onChange={event => updateText("email", event.currentTarget.value)} aria-invalid={Boolean(error("email"))} aria-describedby={error("email") ? "email-error" : "email-help"} />
      <p id="email-help" className="mt-2 text-sm leading-7 text-muted">{translateUi((en) ? "en" : "ar", "بعد إرسال بياناتك، نرسل لك رمز تحقق من 6 أرقام إلى بريدك.", "After you send your details, we will email a 6-digit verification code.")}</p>
      {fieldError("email")}
    </div>
    <div>
      <label htmlFor="signup-full-name">{translateUi((en) ? "en" : "ar", "الاسم الكامل بالعربية", "Full name in Arabic")}</label>
      <input id="signup-full-name" name="fullName" autoComplete="name" required minLength={3} maxLength={120} value={draft.fullName} onChange={event => updateText("fullName", event.currentTarget.value)} {...fieldProps("fullName")} />
      {fieldError("fullName")}
    </div>
    <div>
      <label htmlFor="signup-university-id">{translateUi((en) ? "en" : "ar", "الرقم الجامعي", "University number")}</label>
      <input id="signup-university-id" name="universityId" dir={en ? "ltr" : "rtl"} inputMode="numeric" autoComplete="off" required minLength={6} maxLength={15} value={draft.universityId} onChange={event => updateText("universityId", event.currentTarget.value)} aria-invalid={Boolean(error("universityId"))} aria-describedby={error("universityId") ? "universityId-error university-id-help" : "university-id-help"} />
      <p id="university-id-help" className="mt-2 text-sm leading-7 text-muted">{translateUi((en) ? "en" : "ar", "يُحفظ الرقم الجامعي بشكل آمن ولا يظهر في ملفك العام.", "Stored securely and never shown on your public profile.")}</p>
      {fieldError("universityId")}
    </div>
    <div><label htmlFor="signup-national-id">{translateUi((en) ? "en" : "ar", 'رقم الهوية الوطنية أو الإقامة', 'National / resident ID')}</label><input id="signup-national-id" name="nationalId" dir="ltr" inputMode="numeric" autoComplete="off" required minLength={10} maxLength={10} value={draft.nationalId} onChange={event=>updateText('nationalId',event.currentTarget.value)} {...fieldProps('nationalId')}/><p className="mt-2 text-sm text-muted-foreground">{translateUi((en) ? "en" : "ar", 'يُحفظ مشفّرًا ولا يظهر للعامة.', 'Stored encrypted and never shown publicly.')}</p>{fieldError('nationalId')}</div>
    <div className="grid gap-5 sm:grid-cols-2">
      <div>
        <label htmlFor="signup-major">{translateUi((en) ? "en" : "ar", "التخصص", "Major")}</label>
        <NativeSelect id="signup-major" name="major" required value={draft.major} onChange={event=>updateText('major',event.currentTarget.value)} {...fieldProps('major')}><option value="" disabled>{translateUi((en) ? "en" : "ar", 'اختر التخصص', 'Select your major')}</option>{studentMajors.map((major,index)=><option key={major} value={major}>{en?studentMajorsEn[index]:major}</option>)}</NativeSelect>
        {fieldError("major")}
      </div>
      <div>
        <label htmlFor="signup-academic-level">{translateUi((en) ? "en" : "ar", "المستوى الدراسي", "Academic level")}</label>
        <NativeSelect id="signup-academic-level" name="academicLevel" required value={draft.academicLevel} onChange={event => updateText("academicLevel", event.currentTarget.value)} {...fieldProps("academicLevel")}>
          <option value="" disabled>{translateUi((en) ? "en" : "ar", "اختر المستوى", "Select level")}</option>
          {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={String(index + 1)}>{academicLevel(String(index+1),locale)}</option>)}
          <option value="graduate">{translateUi((en) ? "en" : "ar", "دراسات عليا", "Graduate studies")}</option>
        </NativeSelect>
        {fieldError("academicLevel")}
      </div>
    </div>
    <div>
      <label htmlFor="signup-phone">{translateUi((en) ? "en" : "ar", "رقم الهاتف", "Phone number")} <span className="text-sm font-normal text-muted">{translateUi((en) ? "en" : "ar", "(اختياري)", "(optional)")}</span></label>
      <PhoneInput id="signup-phone" name="phone" locale={locale} value={draft.phone} onChange={value => updateText("phone", value)} {...fieldProps("phone")} />
      {fieldError("phone")}
    </div>
    {state.error && <p className="error-message" role="alert">{actionFeedback(state.error, locale)}</p>}
    <button disabled={!available || sending} className="button w-full">{en ? sending ? "Sending code…" : "Send verification code" : sending ? "جارٍ إرسال الرمز…" : "إرسال رمز التحقق"}</button>
  </form>;
}

function SignupOtpForm({ email, returnTo, locale }: { email: string; returnTo: string; locale: Locale }) {
  const en = locale === "en";
  const [state, verify, pending] = useActionState<FormState, FormData>(verifyCode, {});
  useActionToast(state, locale);
  return <form action={verify} className="space-y-5">
    <input type="hidden" name="returnTo" value={returnTo} />
    <input type="hidden" name="mode" value="signup" />
    <input type="hidden" name="email" value={email} />
    <div><label htmlFor="signup-token">{translateUi((en) ? "en" : "ar", "رمز التحقق", "Verification code")}</label><input id="signup-token" name="token" dir={en ? "ltr" : "rtl"} inputMode="numeric" autoComplete="one-time-code" required maxLength={6} minLength={6} aria-invalid={Boolean(state.error)} aria-describedby={state.error ? "signup-verification-error" : undefined} className="text-center text-xl tracking-[.4em]" /></div>
    {state.error && <p className="error-message" id="signup-verification-error" role="alert">{actionFeedback(state.error, locale)}</p>}
    <button disabled={pending} className="button w-full">{en ? pending ? "Verifying…" : "Verify and create account" : pending ? "جارٍ التحقق…" : "تحقق وأنشئ الحساب"}</button>
  </form>;
}
