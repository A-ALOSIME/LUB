"use client";

import { LoaderCircle, RotateCcw, Save } from "lucide-react";
import { useLayoutEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/preferences";

export function WorkspaceStickySaveBar({
  formId,
  locale,
  visible,
  pending,
  onUndo,
}: {
  formId: string;
  locale: Locale;
  visible: boolean;
  pending: boolean;
  onUndo: () => void;
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
      <span className="workspace-sticky-save-message">{en ? "You have unsaved changes" : "لديك تغييرات غير محفوظة"}</span>
      <div className="workspace-sticky-save-actions">
        <Button type="submit" form={formId} disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin" data-icon="inline-start" aria-hidden="true" /> : <Save data-icon="inline-start" aria-hidden="true" />}
          {pending ? en ? "Saving…" : "جاري الحفظ" : en ? "Save" : "حفظ"}
        </Button>
        <Button type="button" variant="outline" disabled={pending} onClick={onUndo}>
          <RotateCcw data-icon="inline-start" aria-hidden="true" />{en ? "Undo" : "تراجع"}
        </Button>
      </div>
    </div>
  </div>;
}
