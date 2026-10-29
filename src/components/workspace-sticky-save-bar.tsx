"use client";

import {t as translateUi} from "@/lib/i18n";
import { LoaderCircle, RotateCcw, Save } from "lucide-react";
import { useLayoutEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/preferences";

export function WorkspaceStickySaveBar({
  formId,
  locale,
  visible,
  pending,
  onUndo,
  actions,
  message,
}: {
  formId: string;
  locale: Locale;
  visible: boolean;
  pending: boolean;
  onUndo: () => void;
  actions?: ReactNode;
  message?: ReactNode;
}) {
  const [bounds, setBounds] = useState<{ left: number; width: number }>();
  useLayoutEffect(() => {
    if (!visible) return;
    const anchor = document.getElementById(formId);
    if (!anchor) return;
    const measure = () => { const rect = anchor.getBoundingClientRect(); setBounds({ left: rect.left, width: rect.width }); };
    measure();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(anchor);
    window.addEventListener("resize", measure);
    document.addEventListener("scroll", measure, true);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); document.removeEventListener("scroll", measure, true); };
  }, [formId, visible]);
  if (!visible) return null;

  const en = locale === "en";
  return <div className="workspace-sticky-save-bar" style={bounds ? { left: bounds.left, width: bounds.width, right: "auto" } : undefined} data-ignore-dirty role="status" aria-live="polite">
    <div className="workspace-sticky-save-bar-inner" dir={en ? "ltr" : "rtl"}>
      <span className="workspace-sticky-save-message">{message !== undefined ? message : translateUi((en) ? "en" : "ar", "لديك تغييرات غير محفوظة", "You have unsaved changes")}</span>
      <div className="workspace-sticky-save-actions">
        {actions ?? <><Button type="submit" form={formId} disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin" data-icon="inline-start" aria-hidden="true" /> : <Save data-icon="inline-start" aria-hidden="true" />}
          {pending ? translateUi((en) ? "en" : "ar", "جاري الحفظ", "Saving…") : translateUi((en) ? "en" : "ar", "حفظ", "Save")}
        </Button>
        <Button type="button" variant="outline" disabled={pending} onClick={onUndo}>
          <RotateCcw data-icon="inline-start" aria-hidden="true" />{translateUi((en) ? "en" : "ar", "تراجع", "Undo")}
        </Button></>}
      </div>
    </div>
  </div>;
}
