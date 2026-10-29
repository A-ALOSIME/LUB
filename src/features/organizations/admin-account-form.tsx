"use client";

import {t as translateUi} from "@/lib/i18n";
import { useActionState } from "react";
import { useActionToast } from "@/components/action-toast";
import type { Locale } from "@/lib/preferences";
import type { FormState } from "@/lib/validation";
import { actionFeedback } from "@/lib/action-feedback";
import { saveAdminAccountName } from "./admin-account-actions";
import {EmailChangeDialog,PasswordChangeDialog} from "@/features/profile/security-dialogs";
import { FormField } from "@/components/form-field";

export function AdminAccountForm({ fullName, email, locale,pendingEmail }: { pendingEmail?:string; fullName: string; email: string; locale: Locale }) {
  const en = locale === "en";
  const [state, action, pending] = useActionState<FormState, FormData>(saveAdminAccountName, {});
  useActionToast(state, locale);
  const nameError = state.fieldErrors?.fullName?.[0];

  return <div className="flex flex-col gap-5"><form action={action} className="space-y-5">
    <FormField  id="admin-full-name" label={<>{translateUi((en) ? "en" : "ar", "الاسم الظاهر", "Display name")}</>}>
      <input id="admin-full-name" name="fullName" autoComplete="name" defaultValue={fullName} required minLength={3} maxLength={120} aria-invalid={Boolean(nameError)} aria-describedby={nameError ? "admin-full-name-error" : undefined} />
      {nameError && <p id="admin-full-name-error" className="mt-2 text-sm text-red-800">{actionFeedback(nameError, locale)}</p>}
    </FormField>
    <p className="text-sm leading-7 text-muted">{translateUi((en) ? "en" : "ar", "البريد المتحقق منه", "Verified email")}: <bdi>{email}</bdi></p>
    {state.error && <p role="alert" className="error-message">{actionFeedback(state.error, locale)}</p>}
    <button className="button" disabled={pending}>{pending ? (translateUi((en) ? "en" : "ar", "جارٍ الحفظ…", "Saving…")) : (translateUi((en) ? "en" : "ar", "حفظ الاسم", "Save name"))}</button>
  </form><div className="flex flex-wrap gap-3"><EmailChangeDialog email={email} pendingEmail={pendingEmail} administrative locale={locale}/><PasswordChangeDialog locale={locale}/></div></div>;
}
