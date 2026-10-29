"use client";
import {t as translateUi} from "@/lib/i18n";
import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, KeyRound } from "lucide-react";
import {
  ManagementActionSheet,
  ManagementActionFooter,
} from "@/components/management-action-sheet";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldDescription } from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useActionToast } from "@/components/action-toast";
import { actionFeedback } from "@/lib/action-feedback";
import type { Locale } from "@/lib/preferences";
import type { FormState } from "@/lib/validation";
import {
  changeAccountEmail,
  changeAccountPassword,
  type EmailChangeState,
} from "./security-actions";

export function EmailChangeDialog({
  email,
  pendingEmail,
  administrative = false,
  locale = "ar",
}: {
  email: string;
  pendingEmail?: string;
  administrative?: boolean;
  locale?: Locale;
}) {
  const [open, setOpen] = useState(false),
    router = useRouter(),
    en = locale === "en";
  const [state, action, pending] = useActionState<EmailChangeState, FormData>(
    async (previous, form) => {
      const result = await changeAccountEmail(previous, form);
      if (result.completed) {
        setOpen(false);
        router.refresh();
      }
      return result;
    },
    { pendingEmail },
  );
  useActionToast(state, locale);
  return (
    <ManagementActionSheet
      label={translateUi((en) ? "en" : "ar", "تغيير البريد", "Change email")}
      title={translateUi((en) ? "en" : "ar", "تغيير البريد الإلكتروني", "Change email address")}
      icon={<Pencil />}
      locale={locale}
      open={open}
      onOpenChange={setOpen}
      mobileBottomSheet
    >
      <form action={action} className="flex flex-col gap-5">
        <input
          type="hidden"
          name="operation"
          value={state.pendingEmail ? "confirm" : "request"}
        />
        <input
          type="hidden"
          name="returnTo"
          value={administrative ? "/manage/account" : "/account"}
        />
        <FieldDescription>
          {translateUi((en) ? "en" : "ar", "يبقى بريدك الحالي فعالًا حتى اكتمال التأكيد.", "Your current email stays active until confirmation is complete.")}{" "}
          <bdi>{email}</bdi>
        </FieldDescription>
        {state.pendingEmail ? (
          <>
            <p>
              {translateUi((en) ? "en" : "ar", "البريد الجديد:", "New email:")}{" "}
              <bdi>{state.pendingEmail}</bdi>
            </p>
            <FormField
              label={translateUi((en) ? "en" : "ar", "رمز التحقق", "Verification code")}
              hint={
                translateUi((en) ? "en" : "ar", "أدخل رمز أي من البريدين. إذا طُلب تأكيدهما، أدخل رمز البريد الآخر بعده.", "Enter the code from either inbox. If both require confirmation, enter the other code next.")
              }
            >
              <Input
                name="token"
                inputMode="numeric"
                autoComplete="one-time-code"
                dir="ltr"
                required
                minLength={6}
                maxLength={6}
              />
            </FormField>
          </>
        ) : (
          <FormField
            label={translateUi((en) ? "en" : "ar", "البريد الإلكتروني الجديد", "New email address")}
          >
            <Input
              name="email"
              type="email"
              dir="ltr"
              autoComplete="email"
              required
              maxLength={254}
            />
          </FormField>
        )}
        {state.error && (
          <Alert variant="destructive">
            <AlertDescription>
              {actionFeedback(state.error, locale)}
            </AlertDescription>
          </Alert>
        )}
        {state.success && state.pendingEmail && (
          <p role="status" className="text-sm text-muted-foreground">
            {actionFeedback(state.success, locale)}
          </p>
        )}
        <ManagementActionFooter
          secondaryAction={
            state.pendingEmail ? (
              <Button
                variant="ghost"
                type="submit"
                name="intent"
                value="edit"
                formNoValidate
                disabled={pending}
              >
                {translateUi((en) ? "en" : "ar", "تعديل العنوان", "Edit address")}
              </Button>
            ) : undefined
          }
          pending={pending}
          label={
            en
              ? state.pendingEmail
                ? "Confirm email"
                : "Send confirmation code"
              : state.pendingEmail
                ? "تأكيد البريد"
                : "إرسال رمز التأكيد"
          }
        />
      </form>
    </ManagementActionSheet>
  );
}

export function PasswordChangeDialog({ locale = "ar" }: { locale?: Locale }) {
  const [open, setOpen] = useState(false),
    en = locale === "en";
  const [state, action, pending] = useActionState<FormState, FormData>(
    async (previous, form) => {
      const result = await changeAccountPassword(previous, form);
      if (result.success) setOpen(false);
      return result;
    },
    {},
  );
  useActionToast(state, locale);
  return (
    <ManagementActionSheet
      label={translateUi((en) ? "en" : "ar", "تغيير كلمة المرور", "Change password")}
      title={translateUi((en) ? "en" : "ar", "تغيير كلمة المرور", "Change password")}
      icon={<KeyRound />}
      locale={locale}
      open={open}
      onOpenChange={setOpen}
      mobileBottomSheet
    >
      <form action={action} className="flex flex-col gap-5">
        <FormField
          label={translateUi((en) ? "en" : "ar", "كلمة المرور الجديدة", "New password")}
          hint={translateUi((en) ? "en" : "ar", "12 حرفًا على الأقل.", "At least 12 characters.")}
        >
          <Input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
          />
        </FormField>
        <FormField label={translateUi((en) ? "en" : "ar", "تأكيد كلمة المرور", "Confirm password")}>
          <Input
            name="confirmation"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
          />
        </FormField>
        {state.error && (
          <Alert variant="destructive">
            <AlertDescription>
              {actionFeedback(state.error, locale)}
            </AlertDescription>
          </Alert>
        )}
        <ManagementActionFooter
          pending={pending}
          label={translateUi((en) ? "en" : "ar", "حفظ كلمة المرور", "Save password")}
        />
      </form>
    </ManagementActionSheet>
  );
}
