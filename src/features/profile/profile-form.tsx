"use client";

import { useActionState } from "react";
import { saveProfile } from "./actions";
import type { FormState } from "@/lib/validation";
import type { StudentProfile } from "./repository";
import type {Locale} from "@/lib/preferences";
import {actionFeedback} from "@/lib/action-feedback";

export function ProfileForm({ profile, email, returnTo, locale="ar" }: { profile?: StudentProfile; email: string; returnTo?: string; locale?:Locale }) {
  const en=locale==="en";
  const [state, save, pending] = useActionState<FormState, FormData>(saveProfile, {});
  const error = (name: string) => state.fieldErrors?.[name]?.[0];
  const errors = (name: string) => ({ "aria-invalid": Boolean(error(name)), "aria-describedby": error(name) ? `${name}-error` : undefined });
  const fieldError = (name: string) => error(name) && <p id={`${name}-error`} className="mt-2 text-sm text-red-800">{actionFeedback(error(name),locale)}</p>;
  // React resets forms after a resolved action, including validation failures.
  // Keep the user's entries on failure; successful saves navigate away.
  return <form action={save} onReset={(event) => event.preventDefault()} className="space-y-8">
    {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
    <fieldset className="space-y-5"><legend className="mb-5 text-lg font-semibold">{en?"Basic details":"بياناتك الأساسية"}</legend>
      <div><label htmlFor="fullName">{en?"Full name in Arabic":"الاسم الكامل بالعربية"}</label><input id="fullName" name="fullName" autoComplete="name" required minLength={3} maxLength={120} defaultValue={profile?.fullName} {...errors("fullName")} />{fieldError("fullName")}</div>
      {!profile && <div><label htmlFor="universityId">{en?"University number":"الرقم الجامعي"}</label><input id="universityId" name="universityId" dir="ltr" inputMode="numeric" autoComplete="off" required minLength={6} maxLength={15} {...errors("universityId")} /><p className="mt-2 text-sm leading-7 text-muted">{en?"Stored securely and never shown on your public profile.":"يُحفظ بشكل آمن، ولا يظهر في ملفك العام."}</p>{fieldError("universityId")}</div>}
      <div className="grid gap-5 sm:grid-cols-2">
        <div><label htmlFor="major">{en?"Major":"التخصص"}</label><input id="major" name="major" required minLength={2} maxLength={120} defaultValue={profile?.major} {...errors("major")} />{fieldError("major")}</div>
        <div><label htmlFor="academicLevel">{en?"Academic level":"المستوى الدراسي"}</label><select id="academicLevel" name="academicLevel" required defaultValue={profile?.academicLevel ?? ""} {...errors("academicLevel")}><option value="" disabled>{en?"Select level":"اختر المستوى"}</option>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={String(index + 1)}>{en?`Level ${index+1}`:`المستوى ${index + 1}`}</option>)}<option value="graduate">{en?"Graduate studies":"دراسات عليا"}</option></select>{fieldError("academicLevel")}</div>
      </div>
      <div><label htmlFor="phone">{en?"Phone number":"رقم الهاتف"} <span className="text-sm font-normal text-muted">{en?"(optional)":"(اختياري)"}</span></label><input id="phone" name="phone" type="tel" dir="ltr" autoComplete="tel" maxLength={16} defaultValue={profile?.phone ?? ""} {...errors("phone")} />{fieldError("phone")}</div>
      <p className="text-sm leading-7 text-muted">{en?"Verified email: ":"البريد المتحقق منه: "}<bdi>{email}</bdi>{profile && <><br />{en?"Your university number is saved; you do not need to enter it again.":"رقمك الجامعي محفوظ ولا تحتاج إدخاله مرة ثانية."}</>}</p>
    </fieldset>
    <fieldset className="border-t border-line pt-6"><legend className="px-1 text-lg font-semibold">{en?"Privacy":"الخصوصية"}</legend>
      <label className="flex items-start gap-3"><input type="checkbox" name="publicProfileEnabled" defaultChecked={profile?.publicProfileEnabled ?? false} className="mt-1 size-5 min-h-0 shrink-0 accent-action" /><span>{en?"Allow my public profile to appear":"السماح بظهور ملفي العام"}<span className="mt-1 block text-sm leading-7 font-normal text-muted">{en?"Your choice is saved for when public profiles become available. Your university details remain private.":"اختيارك محفوظ ويُستخدم عند إتاحة الملفات العامة. بياناتك الجامعية تبقى خاصة."}</span></span></label>
      <label className="mt-4 flex items-start gap-3"><input type="checkbox" name="showTotalHours" defaultChecked={profile?.showTotalHours ?? true} className="mt-1 size-5 min-h-0 shrink-0 accent-action" /><span>{en?"Show my total hours on my public profile":"إظهار إجمالي ساعاتي في الملف العام"}</span></label>
    </fieldset>
    {state.error && <div role="alert" className="error-message">{actionFeedback(state.error,locale)}</div>}
    <button disabled={pending} className="button w-full sm:w-auto">{en?pending?"Saving…":profile?"Save changes":"Save and continue":pending ? "جارٍ الحفظ…" : profile ? "حفظ التعديلات" : "حفظ ومتابعة"}</button>
  </form>;
}
