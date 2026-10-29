"use client";

import {createTranslator} from "@/lib/i18n";
import { useCallback, useState } from "react";
import { Archive, RotateCcw } from "lucide-react";
import { ManagementActionSheet } from "@/components/management-action-sheet";
import { MutationForm } from "@/features/organizations/mutation-form";
import type { Locale } from "@/lib/preferences";

export function CommitteeStatusDialog({ organizationId, committeeId, committeeName, archived, locale, open: controlledOpen, onOpenChange, hideTrigger = false }: { organizationId: string; committeeId: string; committeeName?:string; archived: boolean; locale: Locale; open?: boolean; onOpenChange?: (open: boolean) => void; hideTrigger?: boolean }) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen ?? localOpen;
  const setOpen = onOpenChange ?? setLocalOpen;
  const closeAfterSave = useCallback(() => setOpen(false), [setOpen]);
  const en = locale === "en";
  const c = createTranslator(en ? "en" : "ar");
  const action = archived ? c("استعادة", "Restore") : c("أرشفة", "Archive");

  return <ManagementActionSheet label={action} title={`${action} ${committeeName??c("اللجنة","committee")}؟`} locale={locale} icon={archived ? <RotateCcw aria-hidden="true" /> : <Archive aria-hidden="true" />} open={open} onOpenChange={setOpen} hideTrigger={hideTrigger}>
    <p className="mb-3 text-sm leading-6 text-muted">{archived ? c("ستعود اللجنة إلى القائمة النشطة.", "This committee will return to the active list.") : c("تُحفظ سجلات اللجنة وتختفي من القائمة النشطة.", "Committee history is preserved while it is removed from the active list.")}</p>
    <MutationForm operation="committee-status" fields={{ organizationId, committeeId, status: archived ? "Active" : "Archived" }} submitLabel={c("تأكيد الإجراء", "Confirm action")} confirmLabel={archived ? c("أؤكد استعادة اللجنة", "I confirm restoring this committee") : c("أؤكد أرشفة اللجنة مع حفظ تاريخها", "I confirm archiving this committee while preserving its history")} locale={locale} onSuccess={closeAfterSave} />
  </ManagementActionSheet>;
}
