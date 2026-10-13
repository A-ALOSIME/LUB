import type { ReactNode } from "react";
import { Mail } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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

  return (
    <FieldSet className="account-settings-section">
      <FieldLegend className="account-settings-legend">
        {en ? "Personal details" : "البيانات الأساسية"}
      </FieldLegend>
      <FieldDescription>
        {en
          ? "These details are used to identify your student account."
          : "تُستخدم هذه البيانات للتعريف بحسابك الطلابي."}
      </FieldDescription>

      <FieldGroup className="account-settings-fields">
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

        {!profile && (
          <ProfileTextField
            name="universityId"
            label={en ? "University number" : "الرقم الجامعي"}
            locale={locale}
            errors={errors}
            required
            minLength={6}
            maxLength={15}
            dir="ltr"
            inputMode="numeric"
            hint={
              en
                ? "Stored securely and never shown on your public profile."
                : "يُحفظ بشكل آمن ولا يظهر في ملفك العام."
            }
          />
        )}

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
                {en ? `Level ${index + 1}` : `المستوى ${index + 1}`}
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

        <ProfileTextField
          name="phone"
          label={
            <>
              {en ? "Phone number" : "رقم الهاتف"}
              <span className="font-normal text-muted-foreground">
                {en ? "(optional)" : "(اختياري)"}
              </span>
            </>
          }
          value={profile?.phone ?? ""}
          locale={locale}
          errors={errors}
          maxLength={16}
          autoComplete="tel"
          dir="ltr"
        />
      </FieldGroup>

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
    </FieldSet>
  );
}

export function ProfilePrivacySection({
  profile,
  locale,
}: {
  profile?: StudentProfile;
  locale: Locale;
}) {
  const en = locale === "en";
  const options = [
    {
      name: "publicProfileEnabled",
      label: en ? "Show my public profile" : "السماح بظهور ملفي العام",
      checked: profile?.publicProfileEnabled ?? false,
    },
    {
      name: "showTotalHours",
      label: en ? "Show total hours" : "إظهار إجمالي ساعاتي",
      checked: profile?.showTotalHours ?? true,
    },
  ] as const;

  return (
    <FieldSet className="account-settings-section">
      <FieldLegend className="account-settings-legend">
        {en ? "Privacy" : "الخصوصية"}
      </FieldLegend>
      <FieldDescription>
        {en
          ? "Choose what other members can see on your public profile."
          : "اختر المعلومات التي يمكن للأعضاء رؤيتها في ملفك العام."}
      </FieldDescription>

      <FieldGroup className="account-settings-privacy-options">
        {options.map((option) => (
          <Field
            key={option.name}
            orientation="horizontal"
            className="account-settings-privacy-option"
          >
            <Checkbox
              id={option.name}
              name={option.name}
              value="on"
              defaultChecked={option.checked}
              className="account-settings-checkbox"
            />
            <FieldLabel htmlFor={option.name} className="account-settings-field-label">
              {option.label}
            </FieldLabel>
          </Field>
        ))}
      </FieldGroup>
    </FieldSet>
  );
}
