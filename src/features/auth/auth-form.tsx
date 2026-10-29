"use client";

import {t as translateUi} from "@/lib/i18n";
import { useActionState, useState } from "react";
import { useActionToast } from "@/components/action-toast";
import Link from "next/link";
import { requestCode, verifyCode, type CodeState } from "./actions";
import type { FormState } from "@/lib/validation";
import type { Locale } from "@/lib/preferences";
import {actionFeedback} from "@/lib/action-feedback";
import { SignupFlow } from "./signup-form";

export function AuthForm({ mode, available, returnTo = "/me", locale="ar" }: { mode: "login" | "signup"; available: boolean; returnTo?: string; locale?: Locale }) {
  const en=locale==="en";
  return <div>
    {!available && <p className="error-message mb-6" role="status">{translateUi((en) ? "en" : "ar", "تسجيل الدخول غير متاح الآن. حاول لاحقًا.", "Sign-in is unavailable right now. Please try later.")}</p>}
    {mode === "signup" ? <SignupFlow available={available} returnTo={returnTo} locale={locale} /> : <LoginFlow available={available} returnTo={returnTo} locale={locale} />}
    <p className="mt-8 border-t border-line pt-6 text-sm text-muted">{en?mode==="signup"?"Already have an account? ":"New here? ":mode === "signup" ? "عندك حساب؟ " : "ما عندك حساب؟ "}<Link className="text-link" href={(mode === "login" ? "/signup" : "/login") + (returnTo !== "/me" ? `?next=${encodeURIComponent(returnTo)}` : "")}>{en?mode==="signup"?"Log in":"Sign up":mode === "signup" ? "تسجيل الدخول" : "إنشاء حساب"}</Link></p>
  </div>;
}

function LoginFlow({ available, returnTo, locale }: { available: boolean; returnTo: string; locale: Locale }) {
  const en=locale==="en";
  const [state, send, sending] = useActionState<CodeState, FormData>(requestCode, {});
  useActionToast(state, locale);
  const [changeEmail, setChangeEmail] = useState(false);
  const verifyingEmail = !changeEmail && !sending ? state.email : undefined;
  return <>
    {verifyingEmail ? <div className="space-y-5"><p role="status" className="leading-8 text-muted">{translateUi((en) ? "en" : "ar", "إذا كان البريد مؤهّلًا للدخول، سيصلك رمز تحقق من 6 أرقام على ", "If this email is eligible, a 6-digit verification code will arrive at ")}<bdi className="font-medium text-ink">{verifyingEmail}</bdi>{translateUi((en) ? "en" : "ar", ". أدخله أدناه، وافحص الرسائل غير المرغوب فيها إذا ما وصلك.", ". Enter it below and check your spam folder if needed.")}</p><OtpVerification email={verifyingEmail} returnTo={returnTo} locale={locale} /><button type="button" onClick={() => setChangeEmail(true)} className="text-link">{translateUi((en) ? "en" : "ar", "تغيير البريد أو طلب رمز جديد", "Change email or request a new code")}</button></div> : <form action={send} onSubmit={() => setChangeEmail(false)} className="space-y-5">
      <input type="hidden" name="returnTo" value={returnTo} /><input type="hidden" name="mode" value="login" />
      <div><label htmlFor="email">{translateUi((en) ? "en" : "ar", "البريد الإلكتروني", "Email address")}</label><input id="email" name="email" type="email" dir="ltr" autoComplete="email" placeholder="you@example.com" required maxLength={254} defaultValue={state.email} aria-invalid={Boolean(state.error)} aria-describedby="email-help" /></div>
      <p id="email-help" className="text-sm leading-7 text-muted">{translateUi((en) ? "en" : "ar", "نرسل لك رمزًا من 6 أرقام للتحقق من بريدك والدخول؛ ما تحتاج كلمة مرور.", "We'll email you a 6-digit code to verify your address and sign in. No password needed.")}</p>
      {state.error && <p className="error-message" role="alert">{actionFeedback(state.error,locale)}</p>}
      <button disabled={!available || sending} className="button w-full">{en?sending?"Sending code…":"Send verification code":sending ? "جارٍ إرسال الرمز…" : "إرسال رمز التحقق"}</button>
    </form>}
  </>;
}

function OtpVerification({ email, returnTo, locale }: { email: string; returnTo: string; locale: Locale }) {
  const en=locale==="en";
  const [state, verify, pending] = useActionState<FormState, FormData>(verifyCode, {});
  useActionToast(state, locale);
  return <form action={verify} className="space-y-5">
    <input type="hidden" name="returnTo" value={returnTo} /><input type="hidden" name="email" value={email} /><input type="hidden" name="mode" value="login" />
    <div><label htmlFor="token">{translateUi((en) ? "en" : "ar", "رمز التحقق", "Verification code")}</label><input id="token" name="token" dir={en ? "ltr" : "rtl"} inputMode="numeric" autoComplete="one-time-code" required maxLength={6} minLength={6} aria-invalid={Boolean(state.error)} aria-describedby={state.error ? "verification-error" : undefined} className="text-center text-xl tracking-[.4em]" /></div>
    {state.error && <p className="error-message" id="verification-error" role="alert">{actionFeedback(state.error,locale)}</p>}
    <button disabled={pending} className="button w-full">{en?pending?"Verifying…":"Verify and sign in":pending ? "جارٍ التحقق…" : "تحقق وادخل"}</button>
  </form>;
}
