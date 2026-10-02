"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { requestCode, verifyCode, type CodeState } from "./actions";
import type { FormState } from "@/lib/validation";
import type { Locale } from "@/lib/preferences";
import {actionFeedback} from "@/lib/action-feedback";

export function AuthForm({ mode, available, returnTo = "/me", locale="ar" }: { mode: "login" | "signup"; available: boolean; returnTo?: string; locale?: Locale }) {
  const en=locale==="en";
  const [state, send, sending] = useActionState<CodeState, FormData>(requestCode, {});
  const [changeEmail, setChangeEmail] = useState(false);
  const verifyingEmail = !changeEmail && !sending ? state.email : undefined;
  return <div>
    {!available && <p className="error-message mb-6" role="status">{en?"Sign-in is unavailable right now. Please try later.":"تسجيل الدخول غير متاح الآن. حاول لاحقًا."}</p>}
    {verifyingEmail ? <div className="space-y-5"><p role="status" className="leading-8 text-muted">{en?"If this email is eligible, an 8-digit verification code will arrive at ":"إذا كان البريد مؤهّلًا للدخول، سيصلك رمز تحقق من 8 أرقام على "}<bdi className="font-medium text-ink">{verifyingEmail}</bdi>{en?". Enter it below and check your spam folder if needed.":". أدخله أدناه، وافحص الرسائل غير المرغوب فيها إذا ما وصلك."}</p><OtpVerification email={verifyingEmail} returnTo={returnTo} locale={locale} /><button type="button" onClick={() => setChangeEmail(true)} className="text-link">{en?"Change email or request a new code":"تغيير البريد أو طلب رمز جديد"}</button></div> : <form action={send} onSubmit={() => setChangeEmail(false)} className="space-y-5">
      <input type="hidden" name="returnTo" value={returnTo} /><input type="hidden" name="mode" value={mode} />
      <div><label htmlFor="email">{en?"Email address":"البريد الإلكتروني"}</label><input id="email" name="email" type="email" dir="ltr" autoComplete="email" placeholder="you@example.com" required maxLength={254} defaultValue={state.email} aria-invalid={Boolean(state.error)} aria-describedby="email-help" /></div>
      <p id="email-help" className="text-sm leading-7 text-muted">{en?"We'll email you an 8-digit code to verify your address and sign in. No password needed.":"نرسل لك رمزًا من 8 أرقام للتحقق من بريدك والدخول؛ ما تحتاج كلمة مرور."}</p>
      {state.error && <p className="error-message" role="alert">{actionFeedback(state.error,locale)}</p>}
      <button disabled={!available || sending} className="button w-full">{en?sending?"Sending code…":"Send verification code":sending ? "جارٍ إرسال الرمز…" : "إرسال رمز التحقق"}</button>
    </form>}
    <p className="mt-8 border-t border-line pt-6 text-sm text-muted">{en?mode==="login"?"New here? ":"Already have an account? ":mode === "login" ? "ما عندك حساب؟ " : "عندك حساب؟ "}<Link className="text-link" href={(mode === "login" ? "/signup" : "/login") + (returnTo !== "/me" ? `?next=${encodeURIComponent(returnTo)}` : "")}>{en?mode==="login"?"Sign up":"Log in":mode === "login" ? "إنشاء حساب" : "تسجيل الدخول"}</Link></p>
  </div>;
}

function OtpVerification({ email, returnTo, locale }: { email: string; returnTo: string; locale: Locale }) {
  const en=locale==="en";
  const [state, verify, pending] = useActionState<FormState, FormData>(verifyCode, {});
  return <form action={verify} className="space-y-5">
    <input type="hidden" name="returnTo" value={returnTo} /><input type="hidden" name="email" value={email} />
    <div><label htmlFor="token">{en?"Verification code":"رمز التحقق"}</label><input id="token" name="token" dir="ltr" inputMode="numeric" autoComplete="one-time-code" required maxLength={8} minLength={8} aria-invalid={Boolean(state.error)} aria-describedby={state.error ? "verification-error" : undefined} className="text-center text-xl tracking-[.4em]" /></div>
    {state.error && <p className="error-message" id="verification-error" role="alert">{actionFeedback(state.error,locale)}</p>}
    <button disabled={pending} className="button w-full">{en?pending?"Verifying…":"Verify and sign in":pending ? "جارٍ التحقق…" : "تحقق وادخل"}</button>
  </form>;
}
