"use client";

import {t as translateUi} from "@/lib/i18n";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DialogClose } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { formatRiyadhDateTime } from "@/lib/datetime";
import type { Locale } from "@/lib/preferences";

type Preview = { title: string; description: string; starts: string; ends: string; location: string; poster: string; ownsPoster:boolean };

export function EventDraftPreview({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const en = locale === "en";

  useEffect(() => () => { if (preview?.poster && preview.ownsPoster) URL.revokeObjectURL(preview.poster); }, [preview?.poster, preview?.ownsPoster]);

  function showPreview(button: HTMLButtonElement) {
    const form = button.form;
    if (!form) return;
    const data = new FormData(form);
    const file = form.querySelector<HTMLInputElement>('input[type="file"][accept="image/jpeg,image/png"]')?.files?.[0];
    setPreview({
      title: String(data.get("title") || ""),
      description: String(data.get("description") || ""),
      starts: String(data.get("starts") || ""),
      ends: String(data.get("ends") || ""),
      location: String(data.get("location") || ""),
      poster: file ? URL.createObjectURL(file) : form.querySelector<HTMLElement>("[data-preview-url]")?.dataset.previewUrl ?? "", ownsPoster:!!file,
    });
    setOpen(true);
  }

  return <>
    <Button type="button" variant="outline" onClick={event => showPreview(event.currentTarget)}>{translateUi((en) ? "en" : "ar", "معاينة المسودة", "Preview draft")}</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent dir={en ? "ltr" : "rtl"} showCloseButton={false} className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader className="relative pe-9 text-start">
          <DialogTitle>{translateUi((en) ? "en" : "ar", "معاينة المسودة", "Draft preview")}</DialogTitle>
          <DialogClose render={<Button type="button" variant="ghost" size="icon-sm" className="absolute end-0 top-0" aria-label={translateUi((en) ? "en" : "ar", "إغلاق المعاينة", "Close preview")} title={translateUi((en) ? "en" : "ar", "إغلاق", "Close")}><X aria-hidden="true" /></Button>} />
        </DialogHeader>
        {preview?.poster && <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-mist"><Image src={preview.poster} alt="" fill unoptimized sizes="(max-width: 640px) 100vw, 36rem" className="object-contain" /></div>}
        <div className="space-y-3">
          <h3 dir="auto" className="text-2xl font-bold">{preview?.title || (translateUi((en) ? "en" : "ar", "فعالية بلا عنوان", "Untitled event"))}</h3>
          {preview?.description && <p dir="auto" className="whitespace-pre-line leading-7 text-muted">{preview.description}</p>}
          {preview?.starts && <p className="text-sm text-muted">{preview.ends
            ? en ? <>{"From "}<bdi>{formatRiyadhDateTime(preview.starts, locale)}</bdi>{" to "}<bdi>{formatRiyadhDateTime(preview.ends, locale)}</bdi></> : <>من <bdi>{formatRiyadhDateTime(preview.starts, locale)}</bdi> إلى <bdi>{formatRiyadhDateTime(preview.ends, locale)}</bdi></>
            : <>{translateUi((en) ? "en" : "ar", "تبدأ: ", "Starts: ")}<bdi>{formatRiyadhDateTime(preview.starts, locale)}</bdi></>}</p>}
          {preview?.location && <p dir="auto" className="text-sm text-muted">{translateUi((en) ? "en" : "ar", "المكان:", "Location:")} {preview.location}</p>}
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
