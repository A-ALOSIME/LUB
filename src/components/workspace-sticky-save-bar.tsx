"use client";

import { LoaderCircle, RotateCcw, Save } from "lucide-react";
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
  if (!visible) return null;

  const en = locale === "en";
  return <div className="workspace-sticky-save-bar" data-ignore-dirty role="status" aria-live="polite">
    <div className="workspace-sticky-save-bar-inner" dir={en ? "ltr" : "rtl"}>
      <span className="workspace-sticky-save-message">{en ? "You have unsaved changes" : "لديك تغييرات غير محفوظة"}</span>
      <div className="workspace-sticky-save-actions">
        <Button type="submit" form={formId} size="sm" disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin" data-icon="inline-start" aria-hidden="true" /> : <Save data-icon="inline-start" aria-hidden="true" />}
          {pending ? en ? "Saving…" : "جارٍ الحفظ…" : en ? "Save" : "حفظ"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onUndo}>
          <RotateCcw data-icon="inline-start" aria-hidden="true" />{en ? "Undo" : "تراجع"}
        </Button>
      </div>
    </div>
  </div>;
}
