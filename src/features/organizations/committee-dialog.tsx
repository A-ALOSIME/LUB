"use client";

import { useCallback, useState } from "react";
import { ManagementActionSheet } from "@/components/management-action-sheet";
import { CommitteeFields } from "@/features/organizations/form-fields";
import { MutationForm } from "@/features/organizations/mutation-form";
import type { Locale } from "@/lib/preferences";

type Committee = { id: string; name: string; description: string; isPublic: boolean; parentCommitteeId?: string | null };

export function CommitteeDialog({ organizationId, locale, committee, parentCommitteeId, parentOptions = [], open: controlledOpen, onOpenChange, hideTrigger = false }: { organizationId: string; locale: Locale; committee?: Committee; parentCommitteeId?: string; parentOptions?: Array<{ id: string; name: string }>; open?: boolean; onOpenChange?: (open: boolean) => void; hideTrigger?: boolean }) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen ?? localOpen;
  const setOpen = onOpenChange ?? setLocalOpen;
  const closeAfterSave = useCallback(() => setOpen(false), [setOpen]);
  const en = locale === "en";
  const c = (ar: string, english: string) => en ? english : ar;
  const prefix = committee?.id ?? "new-committee";

  const title = committee ? c("تعديل اللجنة", "Edit committee") : c("لجنة جديدة", "New committee");
  return <ManagementActionSheet label={committee ? c("تعديل", "Edit") : c("لجنة جديدة", "New committee")} title={title} locale={locale} open={open} onOpenChange={setOpen} hideTrigger={hideTrigger} variant={committee ? "outline" : "default"}>
    <MutationForm operation="save-committee" fields={{ organizationId, ...(committee ? { committeeId: committee.id } : {}) }} submitLabel={committee ? c("حفظ التعديل", "Save changes") : c("إنشاء اللجنة", "Create committee")} locale={locale} onSuccess={closeAfterSave}>
      <CommitteeFields prefix={prefix} value={committee ?? (parentCommitteeId ? { name: "", description: "", isPublic: true, parentCommitteeId } : undefined)} locale={locale} parentOptions={parentOptions.filter(option => option.id !== committee?.id)} />
    </MutationForm>
  </ManagementActionSheet>;
}
