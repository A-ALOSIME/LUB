import {t as translateUi} from "@/lib/i18n";
import {studentMajors,studentMajorsEn,normalizeMajor} from "@/lib/student-identity";
import {EmailChangeDialog} from "./security-dialogs";
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
import type { AccountProfile } from "./repository";

type FieldErrors = FormState["fieldErrors"];
type TextFieldName = "fullName" | "universityId" | "nationalId" | "phone";

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
  pendingEmail,
}: {
  pendingEmail?:string;
  profile?: AccountProfile;
  email: string;
  locale: Locale;
  errors?: FieldErrors;
}) {
  const en = locale === "en";
  const academicLevelField = (
    <Field className="account-settings-field">
      <FieldLabel htmlFor="academicLevel">
        {translateUi((en) ? "en" : "ar", "المستوى الدراسي", "Academic level")}
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
          {translateUi((en) ? "en" : "ar", "اختر المستوى", "Select your level")}
        </NativeSelectOption>
        {Array.from({ length: 12 }, (_, index) => (
          <NativeSelectOption key={index + 1} value={String(index + 1)}>
            {academicLevel(String(index+1),locale)}
          </NativeSelectOption>
        ))}
        <NativeSelectOption value="graduate">
          {translateUi((en) ? "en" : "ar", "دراسات عليا", "Graduate studies")}
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
      aria-label={translateUi((en) ? "en" : "ar", "البريد المتحقق منه", "Verified email")}
    >
      <span className="account-settings-email-icon" aria-hidden="true">
        <Mail />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {translateUi((en) ? "en" : "ar", "البريد المتحقق منه", "Verified email")}
        </p>
        <div className="account-settings-email-address">
          <p className="m-0 break-all text-sm text-muted-foreground">
            <bdi>{email}</bdi>
          </p>
          <span className="account-settings-verified">{translateUi((en) ? "en" : "ar", "موثّق", "Verified")}</span>
        </div>
      </div>
      {profile&&<EmailChangeDialog email={email} pendingEmail={pendingEmail} locale={locale}/>}
    </div>
  );

  const phoneField = (
    <Field className="account-settings-field">
      <FieldLabel htmlFor="phone">{translateUi((en) ? "en" : "ar", "رقم الهاتف (اختياري)", "Phone number (optional)")}</FieldLabel>
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
            label={translateUi((en) ? "en" : "ar", "الاسم الكامل بالعربية", "Full name in Arabic")}
            value={profile?.fullName}
            locale={locale}
            errors={errors}
            required
            minLength={3}
            maxLength={120}
            autoComplete="name"
          />
          <Field className="account-settings-field">
            <FieldLabel htmlFor="major">{translateUi((en) ? "en" : "ar", 'التخصص', 'Major')}</FieldLabel>
            <NativeSelect id="major" name="major" required defaultValue={normalizeMajor(profile?.major??'')} aria-invalid={Boolean(errors?.major?.[0])} aria-describedby={errors?.major?.[0]?'major-error':undefined}>
              <NativeSelectOption value="" disabled>{translateUi((en) ? "en" : "ar", 'اختر التخصص', 'Select your major')}</NativeSelectOption>
              {studentMajors.map((major,index)=><NativeSelectOption key={major} value={major}>{en?studentMajorsEn[index]:major}</NativeSelectOption>)}
            </NativeSelect>
            {errors?.major?.[0]&&<p id="major-error" className="text-sm text-destructive">{actionFeedback(errors.major[0],locale)}</p>}
          </Field>
        </div>
        <div className="account-settings-field-row">
          <ProfileTextField name="universityId" label={translateUi((en) ? "en" : "ar", 'الرقم الجامعي', 'University number')} value={profile?.universityId} locale={locale} errors={errors} required minLength={6} maxLength={15} dir="ltr" inputMode="numeric" autoComplete="off"/>
          <ProfileTextField name="nationalId" label={translateUi((en) ? "en" : "ar", 'رقم الهوية الوطنية أو الإقامة', 'National / resident ID')} value={profile?.nationalId} locale={locale} errors={errors} required minLength={10} maxLength={10} dir="ltr" inputMode="numeric" autoComplete="off" hint={translateUi((en) ? "en" : "ar", 'محفوظ بتشفير، ولا يظهر إلا لك وللمشرف العام المخوّل.', 'Encrypted; visible only to you and authorized system administrators.')}/>
        </div>
        <div className="account-settings-field-row">{academicLevelField}{profile?phoneField:null}</div>
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
