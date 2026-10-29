"use client";

import {t as translateUi} from "@/lib/i18n";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/preferences";

export function ContactVisibilityButton({ name, label, visible, locale, hideLabel, showLabel, visibleText, hiddenText, onVisibilityChange }: {
  name: string;
  label: string;
  visible: boolean;
  locale: Locale;
  hideLabel?: string;
  showLabel?: string;
  visibleText?: string;
  hiddenText?: string;
  onVisibilityChange?: () => void;
}) {
  const [isVisible, setIsVisible] = useState(visible);
  const en = locale === "en";
  const actionLabel = isVisible
    ? hideLabel ?? (translateUi((en) ? "en" : "ar", `إخفاء ${label} من الملف العام`, `Hide ${label} from the public profile`))
    : showLabel ?? (translateUi((en) ? "en" : "ar", `إظهار ${label} للعامة`, `Show ${label} on the public profile`));

  return <>
    <input type="hidden" name={name} value={isVisible ? "true" : "false"} readOnly />
    <Button
      type="button"
      variant={isVisible ? "default" : "ghost"}
      size="sm"
      className={isVisible ? "h-auto min-h-7 max-w-full whitespace-nowrap px-2 py-1 text-xs" : "h-auto min-h-7 max-w-full whitespace-nowrap px-2 py-1 text-xs text-muted-foreground"}
      aria-label={actionLabel}
      aria-pressed={isVisible}
      title={actionLabel}
      onClick={() => {
        onVisibilityChange?.();
        setIsVisible((current) => !current);
      }}
    >
      {isVisible
        ? <Eye aria-hidden="true" />
        : <EyeOff aria-hidden="true" />}
      <span>{isVisible ? visibleText ?? (translateUi((en) ? "en" : "ar", "عام", "Public")) : hiddenText ?? (translateUi((en) ? "en" : "ar", "خاص", "Private"))}</span>
    </Button>
  </>;
}
