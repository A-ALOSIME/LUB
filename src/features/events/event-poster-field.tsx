"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import Image from "next/image";
import type { Locale } from "@/lib/preferences";

function posterUploadMessage(code: string | undefined, status: number, locale: Locale) {
  const en = locale === "en";
  const messages: Record<string, [string, string]> = {
    session_required: ["انتهت الجلسة. حدّث الصفحة وسجّل الدخول ثم أعد المحاولة.", "Your session expired. Refresh the page, sign in, and try again."],
    organization_permission_required: ["لا تملك صلاحية رفع بوستر لهذه الجهة.", "You do not have permission to upload a poster for this organization."],
    file_too_large: ["حجم الصورة أكبر من 5 ميجابايت.", "The image is larger than 5 MB."],
    unsupported_poster_type: ["استخدم صورة JPEG أو PNG.", "Use a JPEG or PNG image."],
    invalid_file: ["تعذّر قراءة الصورة. جرّب ملف JPEG أو PNG صالحاً.", "The image could not be read. Choose a valid JPEG or PNG file."],
    origin_not_allowed: ["تعذّر التحقق من مصدر الطلب. حدّث الصفحة ثم أعد المحاولة.", "The request source could not be verified. Refresh the page and try again."],
    storage_unavailable: ["خدمة التخزين رفضت الرفع. أعد المحاولة بعد قليل.", "Storage could not accept the upload. Try again shortly."],
    asset_registration_unavailable: ["تعذّر إكمال تسجيل الصورة. أعد المحاولة بعد قليل.", "The image could not be registered. Try again shortly."],
    authorization_unavailable: ["تعذّر التحقق من صلاحية الجهة. أعد المحاولة بعد قليل.", "The organization permission could not be checked. Try again shortly."],
  };
  const fallback = messages[code ?? ""]
    ?? (status === 401 ? messages.session_required
      : status === 403 ? messages.organization_permission_required
        : status === 413 ? messages.file_too_large
          : ["تعذّر رفع البوستر الآن. تحقق من الاتصال ثم أعد المحاولة.", "The poster could not be uploaded. Check your connection and try again."]);
  return fallback[en ? 1 : 0];
}

export function EventPosterField({ organization, locale }: { organization: string; locale: Locale }) {
  const [asset, setAsset] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const en = locale === "en";
  const c = (ar: string, english: string) => en ? english : ar;

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function upload(file?: File) {
    if (!file) return;
    setPending(true);
    setError("");
    setAsset("");
    setPreview("");
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("organization", organization);
      const response = await fetch("/files/upload?purpose=event-poster", { method: "POST", body });
      const result = await response.json().catch(() => null) as { id?: string; error?: string } | null;
      if (!response.ok || !result?.id) {
        setError(posterUploadMessage(result?.error, response.status, locale));
        return;
      }
      setAsset(result.id);
      setPreview(URL.createObjectURL(file));
    } catch {
      setError(posterUploadMessage(undefined, 0, locale));
    } finally {
      setPending(false);
    }
  }

  function drop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    void upload(event.dataTransfer.files?.[0]);
  }

  return <section className="event-poster-upload" aria-label={c("بوستر الفعالية", "Event poster")}>
    <input type="hidden" name="poster" value={asset} />
    <label onDragOver={event => event.preventDefault()} onDrop={drop} className="mt-4 grid min-h-24 cursor-pointer place-content-center gap-1 rounded-lg border border-dashed border-line px-4 py-5 text-center hover:bg-surface/60">
      <span className="font-medium">{pending ? c("جارٍ الرفع…", "Uploading…") : c("اسحب البوستر هنا أو اضغط للاختيار", "Drop a poster here or click to choose")}</span>
      <span className="text-xs text-muted">JPEG أو PNG · 5 MB</span>
      <input ref={input} type="file" className="sr-only" accept="image/jpeg,image/png" disabled={pending} aria-label={c("صورة بوستر الفعالية", "Event poster image")} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; void upload(file); }} />
    </label>
    {pending && <p role="status" className="mt-2 text-sm text-muted">{c("جارٍ رفع الصورة…", "Uploading image…")}</p>}
    {error && <p role="alert" className="error-message mt-3">{error}</p>}
    {preview && <div className="event-poster-preview"><Image src={preview} alt={c("معاينة بوستر الفعالية", "Event poster preview")} fill unoptimized sizes="(max-width: 767px) 100vw, 32rem" className="object-cover" /><span>{c("تم رفع البوستر وسيرتبط بالفعالية عند الحفظ.", "Poster uploaded. It will be attached when you save the event.")}</span></div>}
  </section>;
}
