"use client";

import {t as translateUi} from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { callingCodes, joinPhone, phoneDigits, splitPhone } from "@/lib/phone";
import type { Locale } from "@/lib/preferences";

export function PhoneInput({ id, name, value, defaultValue = "", onChange, locale = "ar", ...props }: Omit<React.ComponentProps<typeof Input>, "value" | "defaultValue" | "onChange" | "type"> & {
  value?: string; defaultValue?: string; onChange?: (value: string) => void; locale?: Locale;
}) {
  const [parts, setParts] = useState(() => splitPhone(value ?? defaultValue));
  const ref = useRef<HTMLDivElement>(null);
  const [lastValue, setLastValue] = useState(value ?? defaultValue);
  useEffect(() => {
    const form = ref.current?.closest("form");
    const reset = (event: Event) => { queueMicrotask(() => { if (!event.defaultPrevented) setParts(splitPhone(defaultValue)); }); };
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [defaultValue]);
  // Controlled callers may restore a saved snapshot after undo or submission.
  if (value !== undefined && value !== lastValue) {
    setLastValue(value);
    if (value !== joinPhone(parts.code, parts.number)) setParts(splitPhone(value));
  }
  function update(next: typeof parts) {
    setParts(next);
    const combined = joinPhone(next.code, next.number);
    setLastValue(combined);
    onChange?.(combined);
  }
  const en = locale === "en";
  return <div className="phone-input" ref={ref} dir="ltr">
    {name && <input type="hidden" name={name} value={joinPhone(parts.code, parts.number)} readOnly />}
    <NativeSelect aria-label={translateUi((en) ? "en" : "ar", "رمز الدولة", "Country calling code")} value={parts.code} onChange={event => update({ ...parts, code: event.target.value })} disabled={props.disabled} dir="ltr" autoComplete="tel-country-code">
      <NativeSelectOption value="966">+966</NativeSelectOption>
      {!callingCodes.includes(parts.code) && <NativeSelectOption value={parts.code}>+{parts.code}</NativeSelectOption>}
      {callingCodes.filter(code => code !== "966").map(code => <NativeSelectOption key={code} value={code}>+{code}</NativeSelectOption>)}
    </NativeSelect>
    <Input {...props} id={id} type="tel" inputMode="tel" autoComplete="tel-national" dir="ltr" className="phone-national-input" maxLength={15} value={parts.number} onChange={event => {
      const text = event.target.value;
      const digits = phoneDigits(text);
      update(/^\s*(\+|00)/.test(text) || digits.startsWith("966") && digits.length > 10 ? splitPhone(text) : { ...parts, number: digits });
    }} />
  </div>;
}
