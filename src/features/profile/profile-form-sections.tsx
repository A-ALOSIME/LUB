import { academicLevel } from "@/lib/display";
import type { ReactNode } from "react";
import { Mail } from "lucide-react";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/phone-input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { actionFeedback } from "@/lib/action-feedback";
import type { Locale } from "@/lib/preferences";
import type { FormState } from "@/lib/validation";
import type { StudentProfile } from "./repository";

type FieldErrors = FormState["fieldErrors"];
type TextFieldName = "fullName" | "universityId" | "major" | "phone";

function ProfileTextField({
  name,
  label,
  value,
  locale,
  errors,
  required,
  minLength,
  maxLength,
  autoComplete,
  dir,
  inputMode,
  hint,
}: {
  name: TextFieldName;
  label: ReactNode;
  value?: string;
  locale: Locale;
  errors?: FieldErrors;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  autoComplete?: string;
  dir?: "ltr" | "rtl";
  inputMode?: "numeric";
  hint?: string;
}) {
  const message = errors?.[name]?.[0];
  const hintId = hint ? `${name}-hint` : undefined;
  const errorId = message ? `${name}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <Field className="account-settings-field">
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input
        id={name}
        name={name}
        dir={dir}
        inputMode={inputMode}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        defaultValue={value}
        aria-invalid={Boolean(message)}
        aria-describedby={describedBy}
      />
      {hint && <FieldDescription id={hintId}>{hint}</FieldDescription>}
      {message && (
        <p id={errorId} className="text-sm text-destructive" aria-live="polite">
          {actionFeedback(message, locale)}
        </p>
      )}
    </Field>
  );
}
export function ProfileDetailsSection({
  profile,
  email,
  locale,
  errors,
}: {
  profile?: StudentProfile;
  email: string;
  locale: Locale;
  errors?: FieldErrors;
}) {
  const en = locale === "en";
  const academicLevelField = (
    <Field className="account-settings-field">
      <FieldLabel htmlFor="academicLevel">
        {en ? "Academic level" : "المستوى الدراسي"}
      </FieldLabel>
      <NativeSelect
        id="academicLevel"
        name="academicLevel"
        required
        defaultValue={profile?.academicLevel ?? ""}
        className="account-settings-select"
        aria-invalid={Boolean(errors?.academicLevel?.[0])}
        aria-describedby={errors?.academicLevel?.[0] ? "academicLevel-error" : undefined}
      >
        <NativeSelectOption value="" disabled>
          {en ? "Select your level" : "اختر المستوى"}
        </NativeSelectOption>
        {Array.from({ length: 12 }, (_, index) => (
          <NativeSelectOption key={index + 1} value={String(index + 1)}>
            {academicLevel(String(index+1),locale)}
          </NativeSelectOption>
        ))}
        <NativeSelectOption value="graduate">
          {en ? "Graduate studies" : "دراسات عليا"}
        </NativeSelectOption>
      </NativeSelect>
      {errors?.academicLevel?.[0] && (
        <p id="academicLevel-error" className="text-sm text-destructive" aria-live="polite">
          {actionFeedback(errors.academicLevel[0], locale)}
        </p>
      )}
    </Field>
  );
  const emailField = (
    <div
      className="account-settings-email"
      role="group"
      aria-label={en ? "Verified email" : "البريد المتحقق منه"}
    >
      <span className="account-settings-email-icon" aria-hidden="true">
        <Mail />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {en ? "Verified email" : "البريد المتحقق منه"}
        </p>
        <div className="account-settings-email-address">
          <p className="m-0 break-all text-sm text-muted-foreground">
            <bdi>{email}</bdi>
          </p>
          <span className="account-settings-verified">{en ? "Verified" : "موثّق"}</span>
        </div>
      </div>
    </div>
  );

  const phoneField = (
    <Field className="account-settings-field">
      <FieldLabel htmlFor="phone">{en ? "Phone number (optional)" : "رقم الهاتف (اختياري)"}</FieldLabel>
      <PhoneInput id="phone" name="phone" defaultValue={profile?.phone ?? ""} locale={locale} aria-invalid={Boolean(errors?.phone?.[0])} aria-describedby={errors?.phone?.[0] ? "phone-error" : undefined} />
      {errors?.phone?.[0] && <p id="phone-error" className="text-sm text-destructive">{actionFeedback(errors.phone[0], locale)}</p>}
    </Field>
  );

  return (
    <FieldSet className="account-settings-section">
      <FieldGroup className="account-settings-fields">
        <div className="account-settings-field-row">
          <ProfileTextField
            name="fullName"
            label={en ? "Full name in Arabic" : "الاسم الكامل بالعربية"}
            value={profile?.fullName}
            locale={locale}
            errors={errors}
            required
            minLength={3}
            maxLength={120}
            autoComplete="name"
          />
          <ProfileTextField
            name="major"
            label={en ? "Major" : "التخصص"}
            value={profile?.major}
            locale={locale}
            errors={errors}
            required
            minLength={2}
            maxLength={120}
          />
        </div>
        <div className="account-settings-field-row">
          {!profile && (
            <ProfileTextField
              name="universityId"
              label={en ? "University number" : "الرقم الجامعي"}
              locale={locale}
              errors={errors}
              required
              minLength={6}
              maxLength={15}
              dir={en ? "ltr" : "rtl"}
              inputMode="numeric"
            />
          )}
          {academicLevelField}
          {profile ? phoneField : null}
        </div>
        {!profile ? (
          <div className="account-settings-field-row">
            {phoneField}
            {emailField}
          </div>
        ) : (
          <>
            <div className="account-settings-divider" aria-hidden="true" />
            {emailField}
          </>
        )}
      </FieldGroup>
    </FieldSet>
  );
}
