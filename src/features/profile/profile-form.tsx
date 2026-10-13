"use client";

import { useActionState } from "react";
import { LoaderCircle, Save, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { actionFeedback } from "@/lib/action-feedback";
import type { Locale } from "@/lib/preferences";
import type { FormState } from "@/lib/validation";
import { saveProfile } from "./actions";
import { ProfileDetailsSection, ProfilePrivacySection } from "./profile-form-sections";
import type { StudentProfile } from "./repository";

export function ProfileForm({
  profile,
  email,
  returnTo,
  locale = "ar",
}: {
  profile?: StudentProfile;
  email: string;
  returnTo?: string;
  locale?: Locale;
}) {
  const en = locale === "en";
  const [state, save, pending] = useActionState<FormState, FormData>(saveProfile, {});
  const cardTitle = profile
    ? en
      ? "Account settings"
      : "إعدادات الحساب"
    : en
      ? "Your details"
      : "بيانات حسابك";
  const cardDescription = profile
    ? en
      ? "Manage your personal details and public profile preferences."
      : "إدارة بياناتك الشخصية وتفضيلات ظهور ملفك العام."
    : en
      ? "Add your basic details once to use them across your account."
      : "أكمل بياناتك الأساسية مرة واحدة لاستخدامها في حسابك.";
  const saveLabel = en
    ? pending
      ? "Saving…"
      : profile
        ? "Save changes"
        : "Save and continue"
    : pending
      ? "جارٍ الحفظ…"
      : profile
        ? "حفظ التعديلات"
        : "حفظ ومتابعة";

  // Prevent React's post-action reset from clearing entries after validation errors.
  return (
    <Card className="account-settings-card">
      <form
        action={save}
        onReset={(event) => event.preventDefault()}
        className="account-settings-form"
        dir={en ? "ltr" : "rtl"}
      >
        {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}

        <CardHeader className="account-settings-card-header">
          <div>
            <CardTitle>{cardTitle}</CardTitle>
            <CardDescription>{cardDescription}</CardDescription>
          </div>
          <CardAction>
            <span className="account-settings-secure-note">
              <ShieldCheck aria-hidden="true" />
              {en ? "Private by default" : "بياناتك محمية"}
            </span>
          </CardAction>
        </CardHeader>

        <CardContent className="account-settings-content">
          <ProfileDetailsSection
            profile={profile}
            email={email}
            locale={locale}
            errors={state.fieldErrors}
          />
          <div className="account-settings-divider" role="presentation" />
          <ProfilePrivacySection profile={profile} locale={locale} />
          {state.error && (
            <div role="alert" className="account-settings-form-error">
              {actionFeedback(state.error, locale)}
            </div>
          )}
        </CardContent>

        <CardFooter className="account-settings-footer">
          <p className="account-settings-footer-note">
            <ShieldCheck aria-hidden="true" />
            <span>
              {en
                ? "Your university number and account email are never public."
                : "رقمك الجامعي وبريد حسابك لا يظهران للعامة."}
            </span>
          </p>
          <Button type="submit" size="lg" disabled={pending} className="account-settings-save">
            {pending ? (
              <LoaderCircle className="animate-spin" data-icon="inline-start" aria-hidden="true" />
            ) : (
              <Save data-icon="inline-start" aria-hidden="true" />
            )}
            {saveLabel}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
