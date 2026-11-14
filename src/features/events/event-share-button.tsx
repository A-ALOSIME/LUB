"use client";

import {Share2} from "lucide-react";
import {Button} from "@/components/ui/button";
import {toast} from "@/components/ui/toast";
import {createTranslator} from "@/lib/i18n";
import type {Locale} from "@/lib/preferences";

export function EventShareButton({id, title, locale}: {id: string; title: string; locale: Locale}) {
  const t = createTranslator(locale);

  async function share() {
    const url = new URL(`/events/${id}`, window.location.origin).href;
    if (navigator.share) {
      try {
        await navigator.share({title, url});
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.add({title: t("تم نسخ الرابط", "Link copied"), type: "success", timeout: 3000});
    } catch {
      toast.add({title: t("تعذّرت مشاركة الرابط", "Could not share the link"), type: "error"});
    }
  }

  return <Button variant="outline" className="min-h-10" onClick={() => void share()}>
    <Share2 data-icon="inline-start"/>{t("مشاركة الفعالية", "Share event")}
  </Button>;
}
