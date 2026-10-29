"use client";

import {t as translateUi} from "@/lib/i18n";
import { useId, useRef, useState, type ChangeEvent } from "react";
import { FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/lib/preferences";

export function FilePickerInput({
  accept,
  disabled = false,
  locale = "ar",
  onChange,
  id: providedId,
  ariaLabel,
}: {
  accept: string;
  disabled?: boolean;
  locale?: Locale;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  id?: string;
  ariaLabel?: string;
}) {
  const generatedId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const en = locale === "en";
  const id = providedId ?? generatedId;
  const choose = () => inputRef.current?.click();

  return <div className="flex min-w-0 flex-wrap items-center gap-2">
    <Input
      ref={inputRef}
      id={id}
      type="file"
      accept={accept}
      disabled={disabled}
      tabIndex={-1}
      aria-label={ariaLabel ?? (translateUi((en) ? "en" : "ar", "اختيار ملف", "Choose a file"))}
      className="sr-only"
      onChange={event => { setFileName(event.target.files?.[0]?.name ?? ""); onChange(event); }}
    />
    <Button type="button" variant="outline" disabled={disabled} onClick={choose}>
      <FileUp aria-hidden="true" />
      {translateUi((en) ? "en" : "ar", "اختيار ملف", "Choose file")}
    </Button>
    <span className="min-w-0 truncate text-sm text-muted" aria-live="polite">
      {fileName || (translateUi((en) ? "en" : "ar", "لم يتم اختيار ملف", "No file selected"))}
    </span>
  </div>;
}
