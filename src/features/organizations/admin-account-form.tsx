"use client";

import { useActionState } from "react";
import type { Locale } from "@/lib/preferences";
import type { FormState } from "@/lib/validation";
import { actionFeedback } from "@/lib/action-feedback";
import { saveAdminAccountName } from "./admin-account-actions";

export function AdminAccountForm({ fullName, email, locale }: { fullName: string; email: string; locale: Locale }) {
  const en = locale === "en";
  const [state, action, pending] = useActionState<FormState, FormData>(saveAdminAccountName, {});
  const nameError = state.fieldErrors?.fullName?.[0];

  return <form action={action} className="space-y-5">
    <div>
      <label htmlFor="admin-full-name">{en ? "Display name" : "الاسم الظاهر"}</label>
      <input id="admin-full-name" name="fullName" autoComplete="name" defaultValue={fullName} required minLength={3} maxLength={120} aria-invalid={Boolean(nameError)} aria-describedby={nameError ? "admin-full-name-error" : undefined} />
      {nameError && <p id="admin-full-name-error" className="mt-2 text-sm text-red-800">{actionFeedback(nameError, locale)}</p>}
    </div>
    <p className="text-sm leading-7 text-muted">{en ? "Verified email" : "البريد المتحقق منه"}: <bdi>{email}</bdi></p>
    {state.error && <p role="alert" className="error-message">{actionFeedback(state.error, locale)}</p>}
    <button className="button" disabled={pending}>{pending ? (en ? "Saving…" : "جارٍ الحفظ…") : (en ? "Save name" : "حفظ الاسم")}</button>
  </form>;
}
