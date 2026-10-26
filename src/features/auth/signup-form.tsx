"use client";
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
  major: string;
  academicLevel: string;
  phone: string;
};

const emptyDraft: SignupDraft = {
  email: "",
  fullName: "",
  universityId: "",
  major: "",
  academicLevel: "",
  phone: "",
};

type TextField = "email" | "fullName" | "universityId" | "major" | "academicLevel" | "phone";

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
    <p role="status" className="leading-8 text-muted">{en ? "If this email is eligible for sign-up, a 6-digit verification code will arrive at " : "إذا كان البريد مؤهلًا للتسجيل، سيصلك رمز تحقق من 6 أرقام على "}<bdi className="font-medium text-ink">{emailToVerify}</bdi>{en ? ". Enter it below, or follow the confirmation link in the same email to complete your account." : ". أدخله أدناه، أو استخدم رابط التأكيد في نفس الرسالة لإكمال حسابك."}</p>
    <p className="text-sm leading-7 text-muted">{en ? "If the code does not arrive within a minute, check your spam folder or your university email quarantine, then choose “Change details or request a new code” to try again." : "إذا لم يصلك الرمز خلال دقيقة، تحقّق من مجلد البريد العشوائي (Spam) أو الرسائل المحجوزة في بريد الجامعة، ثم اضغط «تعديل البيانات أو طلب رمز جديد» للمحاولة مرة أخرى."}</p>
    <SignupOtpForm email={emailToVerify} returnTo={returnTo} locale={locale} />
    <button type="button" onClick={() => setChangeDetails(true)} className="text-link">{en ? "Change details or request a new code" : "تعديل البيانات أو طلب رمز جديد"}</button>
  </div> : <form action={send} onSubmit={() => setChangeDetails(false)} className="space-y-5">
    <input type="hidden" name="returnTo" value={returnTo} />
    <input type="hidden" name="mode" value="signup" />
    <div>
      <label htmlFor="signup-email">{en ? "Email address" : "البريد الإلكتروني"}</label>
      <input id="signup-email" name="email" type="email" dir="ltr" autoComplete="email" placeholder="you@example.com" required maxLength={254} value={draft.email} onChange={event => updateText("email", event.currentTarget.value)} aria-invalid={Boolean(error("email"))} aria-describedby={error("email") ? "email-error" : "email-help"} />
      <p id="email-help" className="mt-2 text-sm leading-7 text-muted">{en ? "After you send your details, we will email a 6-digit verification code." : "بعد إرسال بياناتك، نرسل لك رمز تحقق من 6 أرقام إلى بريدك."}</p>
      {fieldError("email")}
    </div>
    <div>
      <label htmlFor="signup-full-name">{en ? "Full name in Arabic" : "الاسم الكامل بالعربية"}</label>
      <input id="signup-full-name" name="fullName" autoComplete="name" required minLength={3} maxLength={120} value={draft.fullName} onChange={event => updateText("fullName", event.currentTarget.value)} {...fieldProps("fullName")} />
      {fieldError("fullName")}
    </div>
    <div>
      <label htmlFor="signup-university-id">{en ? "University number" : "الرقم الجامعي"}</label>
      <input id="signup-university-id" name="universityId" dir={en ? "ltr" : "rtl"} inputMode="numeric" autoComplete="off" required minLength={6} maxLength={15} value={draft.universityId} onChange={event => updateText("universityId", event.currentTarget.value)} aria-invalid={Boolean(error("universityId"))} aria-describedby={error("universityId") ? "universityId-error university-id-help" : "university-id-help"} />
      <p id="university-id-help" className="mt-2 text-sm leading-7 text-muted">{en ? "Stored securely and never shown on your public profile." : "يُحفظ الرقم الجامعي بشكل آمن ولا يظهر في ملفك العام."}</p>
      {fieldError("universityId")}
    </div>
    <div className="grid gap-5 sm:grid-cols-2">
      <div>
        <label htmlFor="signup-major">{en ? "Major" : "التخصص"}</label>
        <input id="signup-major" name="major" required minLength={2} maxLength={120} value={draft.major} onChange={event => updateText("major", event.currentTarget.value)} {...fieldProps("major")} />
        {fieldError("major")}
      </div>
      <div>
        <label htmlFor="signup-academic-level">{en ? "Academic level" : "المستوى الدراسي"}</label>
        <NativeSelect id="signup-academic-level" name="academicLevel" required value={draft.academicLevel} onChange={event => updateText("academicLevel", event.currentTarget.value)} {...fieldProps("academicLevel")}>
          <option value="" disabled>{en ? "Select level" : "اختر المستوى"}</option>
          {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={String(index + 1)}>{en ? `Level ${index + 1}` : `المستوى ${index + 1}`}</option>)}
          <option value="graduate">{en ? "Graduate studies" : "دراسات عليا"}</option>
        </NativeSelect>
        {fieldError("academicLevel")}
      </div>
    </div>
    <div>
      <label htmlFor="signup-phone">{en ? "Phone number" : "رقم الهاتف"} <span className="text-sm font-normal text-muted">{en ? "(optional)" : "(اختياري)"}</span></label>
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
    <div><label htmlFor="signup-token">{en ? "Verification code" : "رمز التحقق"}</label><input id="signup-token" name="token" dir={en ? "ltr" : "rtl"} inputMode="numeric" autoComplete="one-time-code" required maxLength={6} minLength={6} aria-invalid={Boolean(state.error)} aria-describedby={state.error ? "signup-verification-error" : undefined} className="text-center text-xl tracking-[.4em]" /></div>
    {state.error && <p className="error-message" id="signup-verification-error" role="alert">{actionFeedback(state.error, locale)}</p>}
    <button disabled={pending} className="button w-full">{en ? pending ? "Verifying…" : "Verify and create account" : pending ? "جارٍ التحقق…" : "تحقق وأنشئ الحساب"}</button>
  </form>;
}
