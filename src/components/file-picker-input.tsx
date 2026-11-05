"use client";

import {displayFileName} from "@/lib/file-name";
import {t as translateUi} from "@/lib/i18n";
import { useId, useRef, useState, type ChangeEvent } from "react";
import {UploadArea} from "./upload-area";

import { Input } from "@/components/ui/input";
import type { Locale } from "@/lib/preferences";

export function FilePickerInput({
  accept,
  disabled = false,
  locale = "ar",
  onChange,hint,
  id: providedId,
  ariaLabel,
}: {
  accept: string;hint?:string;
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
  const formats=accept.split(",").map(value=>({"application/pdf":"PDF","image/jpeg":"JPEG","image/png":"PNG","image/webp":"WebP"})[value.trim()]??value.trim()).join(" / ");

  return <div className="flex min-w-0 flex-col gap-2">
    <Input
      ref={inputRef}
      id={id}
      type="file"
      hidden
      accept={accept}
      disabled={disabled}
      tabIndex={-1}
      aria-label={ariaLabel ?? (translateUi((en) ? "en" : "ar", "اختيار ملف", "Choose a file"))}
      onChange={event => { setFileName(event.target.files?.[0]?.name ?? ""); onChange(event); }}
    />
    <UploadArea locale={locale} kind={accept.startsWith("image/")?"image":"file"} hint={hint??formats} disabled={disabled} onChoose={choose} onDrop={file=>{const input=inputRef.current;if(!input)return;const files=new DataTransfer();files.items.add(file);input.files=files.files;input.dispatchEvent(new Event("change",{bubbles:true}));}}/>
    <span className="min-w-0 break-words text-sm text-muted" aria-live="polite">
      {displayFileName(fileName) || (translateUi((en) ? "en" : "ar", "لم يتم اختيار ملف", "No file selected"))}
    </span>
  </div>;
}
