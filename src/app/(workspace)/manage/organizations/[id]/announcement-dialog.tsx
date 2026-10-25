"use client";

import { useCallback, useState } from "react";
import { Megaphone,Pencil } from "lucide-react";
import { ManagementActionSheet } from "@/components/management-action-sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MutationForm } from "@/features/organizations/mutation-form";
import type { Locale } from "@/lib/preferences";

type Announcement = { id: string; title: string; body: string; published: boolean; pinned: boolean };

export function AnnouncementDialog({ organizationId, announcement, locale, open: controlledOpen, onOpenChange, showTrigger = true, triggerLabel }: {
  organizationId: string;
  announcement?: Announcement;
  locale: Locale;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
  triggerLabel?: string;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const [saved, setSaved] = useState(false);
  const [published, setPublished] = useState(announcement?.published ?? false);
  const [pinned, setPinned] = useState(announcement?.pinned ?? false);
  const setOpen = useCallback((next: boolean) => {
    if (next) {
      setPublished(announcement?.published ?? false);
      setPinned(announcement?.pinned ?? false);
    }
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  }, [announcement?.pinned, announcement?.published, controlledOpen, onOpenChange]);
  const closeAfterSave = useCallback(() => { setOpen(false); setSaved(true); }, [setOpen]);
  const en = locale === "en";
  const c = (ar: string, english: string) => en ? english : ar;
  const title = announcement ? c("تعديل الإعلان", "Edit announcement") : c("إعلان جديد", "New announcement");

  return <>
    <ManagementActionSheet
      label={triggerLabel ?? (announcement ? c("تعديل", "Edit") : c("إضافة إعلان", "Add announcement"))}
      title={title}
      locale={locale}
      rowAction={Boolean(announcement)}
      icon={announcement?<Pencil/>:<Megaphone aria-hidden="true"/>}
      variant={announcement ? "outline" : "default"}
      open={open}
      onOpenChange={setOpen}
      hideTrigger={!showTrigger}
    >
      <MutationForm
        operation="save-announcement"
        fields={{ organizationId, ...(announcement ? { announcementId: announcement.id } : {}) }}
        submitLabel={announcement ? c("حفظ التعديل", "Save changes") : c("حفظ الإعلان", "Save announcement")}
        locale={locale}
        onSuccess={closeAfterSave}
      >
        <div className="grid gap-2">
          <label htmlFor={`announcement-title-${announcement?.id ?? "new"}`} className="text-sm font-medium">{c("العنوان", "Title")}</label>
          <Input id={`announcement-title-${announcement?.id ?? "new"}`} name="title" dir={locale === "en" ? "ltr" : "rtl"} minLength={2} maxLength={120} defaultValue={announcement?.title} required />
        </div>
        <div className="grid gap-2">
          <label htmlFor={`announcement-body-${announcement?.id ?? "new"}`} className="text-sm font-medium">{c("النص", "Text")}</label>
          <Textarea id={`announcement-body-${announcement?.id ?? "new"}`} name="body" dir={locale === "en" ? "ltr" : "rtl"} rows={7} maxLength={5000} defaultValue={announcement?.body} required />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="published" checked={published} onChange={event => { setPublished(event.target.checked); if (!event.target.checked) setPinned(false); }} />{c("نشر للعامة", "Publish publicly")}</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="pinned" checked={pinned} disabled={!published} onChange={event => setPinned(event.target.checked)} />{c("تثبيت الإعلان", "Pin announcement")}</label>
        </div>
      </MutationForm>
      {announcement && <div className="border-t border-line pt-4">
        <MutationForm
          operation="archive-announcement"
          fields={{ organizationId, announcementId: announcement.id }}
          submitLabel={c("أرشفة الإعلان", "Archive announcement")}
          confirmLabel={c("أؤكد أرشفة الإعلان وإخفاءه عن الصفحة العامة", "I confirm archiving this announcement")}
          locale={locale}
          onSuccess={closeAfterSave}
          buttonClassName="button button-secondary button-compact w-fit"
          cancelInModal={false}
          inlineFooter
        />
      </div>}
    </ManagementActionSheet>
    {saved && <span role="status" className="text-sm text-action">{c("تم الحفظ", "Saved")}</span>}
  </>;
}
