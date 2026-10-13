"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MutationForm } from "@/features/organizations/mutation-form";
import type { Locale } from "@/lib/preferences";

type Announcement = { id: string; title: string; body: string; published: boolean; pinned: boolean };

export function AnnouncementDialog({ organizationId, announcement, locale }: {
  organizationId: string;
  announcement?: Announcement;
  locale: Locale;
}) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const closeAfterSave = useCallback(() => { setOpen(false); setSaved(true); }, []);
  const en = locale === "en";

  return <>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant={announcement ? "outline" : "default"} className="h-10 px-4" />}>
        {announcement ? en ? "Edit" : "تعديل" : en ? "Add announcement" : "إضافة إعلان"}
      </DialogTrigger>
      <DialogContent dir={en ? "ltr" : "rtl"} showCloseButton={false} className="max-h-[min(90dvh,46rem)] max-w-2xl gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-line px-6 py-5 text-start">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-xl font-bold">{announcement ? en ? "Edit announcement" : "تعديل الإعلان" : en ? "New announcement" : "إعلان جديد"}</DialogTitle>
              <DialogDescription className="mt-2 leading-6">{en ? "Choose whether visitors can see this announcement." : "حدّد ما إذا كان الإعلان سيظهر للزوار."}</DialogDescription>
            </div>
            <DialogClose render={<Button type="button" variant="ghost" size="icon" aria-label={en ? "Close" : "إغلاق"} />}>
              <span aria-hidden="true">×</span>
            </DialogClose>
          </div>
        </DialogHeader>
        <div className="space-y-5 px-6 py-6">
          <MutationForm
            operation="save-announcement"
            fields={{ organizationId, ...(announcement ? { announcementId: announcement.id } : {}) }}
            submitLabel={announcement ? en ? "Save changes" : "حفظ التعديل" : en ? "Save announcement" : "حفظ الإعلان"}
            locale={locale}
            onSuccess={closeAfterSave}
          >
            <div className="space-y-2"><label htmlFor={`announcement-title-${announcement?.id ?? "new"}`}>{en ? "Title" : "العنوان"}</label><Input id={`announcement-title-${announcement?.id ?? "new"}`} name="title" dir="auto" minLength={2} maxLength={120} defaultValue={announcement?.title} required /></div>
            <div className="space-y-2"><label htmlFor={`announcement-body-${announcement?.id ?? "new"}`}>{en ? "Text" : "النص"}</label><Textarea id={`announcement-body-${announcement?.id ?? "new"}`} name="body" dir="auto" rows={5} maxLength={5000} defaultValue={announcement?.body} required /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label><input type="checkbox" name="published" defaultChecked={announcement?.published} />{en ? "Publish publicly" : "نشر للعامة"}</label>
              <label><input type="checkbox" name="pinned" defaultChecked={announcement?.pinned} />{en ? "Pin announcement" : "تثبيت الإعلان"}</label>
            </div>
          </MutationForm>
          {announcement && <div className="border-t border-line pt-5"><MutationForm operation="archive-announcement" fields={{ organizationId, announcementId: announcement.id }} submitLabel={en ? "Archive announcement" : "أرشفة الإعلان"} confirmLabel={en ? "I confirm archiving this announcement" : "أؤكد أرشفة الإعلان وإخفاءه عن الصفحة العامة"} locale={locale} onSuccess={closeAfterSave} /></div>}
        </div>
      </DialogContent>
    </Dialog>
    {saved && <span role="status" className="text-sm text-action">{en ? "Saved" : "تم الحفظ"}</span>}
  </>;
}
