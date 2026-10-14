"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/preferences";

export function ContactVisibilityButton({ name, label, visible, locale, hideLabel, showLabel }: {
  name: string;
  label: string;
  visible: boolean;
  locale: Locale;
  hideLabel?: string;
  showLabel?: string;
}) {
  const [isVisible, setIsVisible] = useState(visible);
  const en = locale === "en";
  const actionLabel = isVisible
    ? hideLabel ?? (en ? `Hide ${label} from the public profile` : `إخفاء ${label} من الملف العام`)
    : showLabel ?? (en ? `Show ${label} on the public profile` : `إظهار ${label} للعامة`);

  return <>
    <input type="hidden" name={name} value={isVisible ? "true" : "false"} readOnly />
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={actionLabel}
      aria-pressed={isVisible}
      title={actionLabel}
      onClick={() => setIsVisible((current) => !current)}
    >
      {isVisible
        ? <Eye aria-hidden="true" className="text-primary" />
        : <EyeOff aria-hidden="true" className="text-muted-foreground" />}
    </Button>
  </>;
}
