"use client";

import { useActionState, useState } from "react";
import { LoaderCircle, RotateCcw, Save, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { actionFeedback } from "@/lib/action-feedback";
import type { Locale } from "@/lib/preferences";
import type { FormState } from "@/lib/validation";
import { saveProfile } from "./actions";
import { AvatarPicker } from "./avatar-picker";
import { ProfileDetailsSection } from "./profile-form-sections";
import { useActionToast } from "@/components/action-toast";
import type { AccountProfile } from "./repository";

export function ProfileForm({
  profile,
  avatarUrl,
  email,
  returnTo,
  pendingEmail,
  locale = "ar",
}: {
  profile?: AccountProfile;
  avatarUrl?: string;
  email: string;
  returnTo?: string;
  pendingEmail?:string;
  locale?: Locale;
}) {
  const en = locale === "en";
  const [avatar, setAvatar] = useState<File | null>();
  const [processing, setProcessing] = useState(false);
  const [state, save, pending] = useActionState<FormState, FormData>(async (previous, form) => {
    if (avatar !== undefined) { form.set("avatarAction", avatar ? "replace" : "remove"); if (avatar) form.set("avatar", avatar); }
    return saveProfile(previous, form);
  }, {});
  useActionToast(state, locale);
  const [dirty, setDirty] = useState(false);
  const saveLabel = profile
    ? en ? "Save changes" : "حفظ التعديلات"
    : en ? "Save details" : "حفظ البيانات";

  // Prevent React's post-action reset from clearing entries after validation errors.
  return (
    <>
      <Card className="account-settings-card">
        <form
          id="account-settings-form"
          action={save}
          onReset={(event) => event.preventDefault()}
          onInputCapture={event=>{if((event.target as HTMLElement).closest("form")===event.currentTarget)setDirty(true);}}
          onChangeCapture={event=>{if((event.target as HTMLElement).closest("form")===event.currentTarget)setDirty(true);}}
          className="account-settings-form"
          dir={en ? "ltr" : "rtl"}
        >
          {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}

          <CardContent className="account-settings-content">
            {profile && <AvatarPicker name={profile.fullName} src={avatarUrl} locale={locale} onProcessing={setProcessing} onChange={file=>{setAvatar(file);setDirty(true);}} error={state.fieldErrors?.avatar?.[0]}/>}
            <ProfileDetailsSection
              pendingEmail={pendingEmail}
              profile={profile}
              email={email}
              locale={locale}
              errors={state.fieldErrors}
            />
            {state.error && (
              <div role="alert" className="account-settings-form-error">
                {actionFeedback(state.error, locale)}
              </div>
            )}
          </CardContent>
          <CardFooter className="account-settings-footer">
            {dirty && (
              <span className="account-settings-footer-status" role="status" aria-live="polite">
                {en ? "You have unsaved changes" : "لديك تغييرات غير محفوظة"}
              </span>
            )}
            <div className="account-settings-footer-actions">
              <Button
                type="submit"
                className="account-settings-save"
                disabled={pending || processing}
              >
                {pending ? (
                  <LoaderCircle className="animate-spin" data-icon="inline-start" aria-hidden="true" />
                ) : (
                  <Save data-icon="inline-start" aria-hidden="true" />
                )}
                {pending ? en ? "Saving…" : "جارٍ الحفظ…" : saveLabel}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="account-settings-undo"
                disabled={!dirty || pending || processing}
                onClick={() => window.location.reload()}
              >
                <RotateCcw data-icon="inline-start" aria-hidden="true" />
                {en ? "Undo" : "تراجع"}
              </Button>
            </div>
          </CardFooter>
        </form>
      </Card>

      <Card className="account-settings-privacy-card" dir={en ? "ltr" : "rtl"}>
        <CardContent className="account-settings-privacy-content">
          <h2 className="account-settings-privacy-title">{en ? "Privacy" : "الخصوصية"}</h2>
          <p className="account-settings-footer-note">
            <ShieldCheck aria-hidden="true" />
            <span>{en ? "Your university number and account email are never public." : "رقمك الجامعي وبريد حسابك لا يظهران للعامة."}</span>
          </p>
        </CardContent>
      </Card>
    </>
  );
}
