"use client";
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
      label={en ? "Change email" : "تغيير البريد"}
      title={en ? "Change email address" : "تغيير البريد الإلكتروني"}
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
          {en
            ? "Your current email stays active until confirmation is complete."
            : "يبقى بريدك الحالي فعالًا حتى اكتمال التأكيد."}{" "}
          <bdi>{email}</bdi>
        </FieldDescription>
        {state.pendingEmail ? (
          <>
            <p>
              {en ? "New email:" : "البريد الجديد:"}{" "}
              <bdi>{state.pendingEmail}</bdi>
            </p>
            <FormField
              label={en ? "Verification code" : "رمز التحقق"}
              hint={
                en
                  ? "Check the new inbox. Your current inbox may also require a separate confirmation."
                  : "تحقق من البريد الجديد. قد يصلك تأكيد إضافي إلى البريد الحالي حسب إعدادات الأمان."
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
            label={en ? "New email address" : "البريد الإلكتروني الجديد"}
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
                {en ? "Edit address" : "تعديل العنوان"}
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
      label={en ? "Change password" : "تغيير كلمة المرور"}
      title={en ? "Change password" : "تغيير كلمة المرور"}
      icon={<KeyRound />}
      locale={locale}
      open={open}
      onOpenChange={setOpen}
      mobileBottomSheet
    >
      <form action={action} className="flex flex-col gap-5">
        <FormField
          label={en ? "New password" : "كلمة المرور الجديدة"}
          hint={en ? "At least 12 characters." : "12 حرفًا على الأقل."}
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
        <FormField label={en ? "Confirm password" : "تأكيد كلمة المرور"}>
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
          label={en ? "Save password" : "حفظ كلمة المرور"}
        />
      </form>
    </ManagementActionSheet>
  );
}
