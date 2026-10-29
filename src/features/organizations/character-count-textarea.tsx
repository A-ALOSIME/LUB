"use client";

import {t as translateUi} from "@/lib/i18n";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import type { Locale } from "@/lib/preferences";
import { useProfileFormState } from "./profile-form-state";

export function OrganizationCharacterCountTextarea({ id, name, defaultValue, maxLength, locale, rows = 2, placeholder }: {
  id: string;
  name: string;
  defaultValue: string | null;
  maxLength: number;
  locale: Locale;
  rows?: number;
  placeholder?: string;
}) {
  const { resetKey, resetValues } = useProfileFormState();
  const value = Object.hasOwn(resetValues, name) ? resetValues[name] : defaultValue ?? "";

  return <CharacterCountTextarea key={resetKey} id={id} name={name} defaultValue={value} maxLength={maxLength} locale={locale} rows={rows} placeholder={placeholder} />;
}

function CharacterCountTextarea({ id, name, defaultValue, maxLength, locale, rows, placeholder }: {
  id: string;
  name: string;
  defaultValue: string;
  maxLength: number;
  locale: Locale;
  rows: number;
  placeholder?: string;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const en = locale === "en";

  return <div className="organization-character-count">
    <Textarea id={id} name={name} dir={en ? "ltr" : "rtl"} rows={rows} maxLength={maxLength} placeholder={placeholder} value={value} onChange={event => setValue(event.target.value)} />
    <span>{translateUi((en) ? "en" : "ar", `${value.length} من ${maxLength}`, `${value.length} of ${maxLength}`)}</span>
  </div>;
}
