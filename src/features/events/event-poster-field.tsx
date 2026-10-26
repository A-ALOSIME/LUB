"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {Upload, Pencil, Trash2} from "lucide-react";
import {Button} from "@/components/ui/button";
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
  const [retryFile, setRetryFile] = useState<File>();
  const en = locale === "en";
  const c = (ar: string, english: string) => en ? english : ar;

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function upload(file?: File) {
    if (!file) return;
    setRetryFile(undefined);
    if(file.size>5*1024*1024){setError(posterUploadMessage("file_too_large",413,locale));return;}
    if(!["image/jpeg","image/png"].includes(file.type)){setError(posterUploadMessage("unsupported_poster_type",400,locale));return;}
    setRetryFile(file);
    setPending(true);
    input.current?.setCustomValidity(c("انتظر اكتمال رفع الصورة.","Wait for the image upload."));
    setError("");
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
      setRetryFile(undefined);
    } catch {
      setError(posterUploadMessage(undefined, 0, locale));
    } finally {
      setPending(false);
      input.current?.setCustomValidity("");
    }
  }

  function remove() {setRetryFile(undefined);setAsset("");setPreview("");setError("");if(input.current){input.current.value="";input.current.setCustomValidity("");}}
  return <section className="event-poster-upload" aria-label={c("بوستر الفعالية","Event poster")} data-preview-url={preview}>
    <input type="hidden" name="poster" value={asset}/>
    <span className="event-poster-label">{c("بوستر الفعالية","Event poster")}</span>
    <input ref={input} type="file" className="sr-only" accept="image/jpeg,image/png" disabled={pending} aria-label={c("صورة بوستر الفعالية","Event poster image")} onInvalid={event=>event.preventDefault()} onChange={event=>void upload(event.target.files?.[0])}/>
    {preview?<><div className="event-poster-preview"><Image src={preview} alt={c("معاينة بوستر الفعالية","Event poster preview")} fill unoptimized sizes="(max-width:767px) 100vw, 32rem" className="object-cover"/></div><div className="flex gap-2"><Button type="button" variant="outline" size="sm" disabled={pending} onClick={()=>input.current?.click()}><Pencil/>{c("تغيير","Change")}</Button><Button type="button" variant="ghost" size="sm" disabled={pending} onClick={remove}><Trash2/>{c("حذف","Remove")}</Button></div></>:<div className="event-poster-dropzone" onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();void upload(event.dataTransfer.files?.[0]);}}><Button type="button" variant="ghost" disabled={pending} onClick={()=>input.current?.click()}><Upload/><span>{pending?c("جارٍ الرفع…","Uploading…"):c("اسحب الصورة هنا أو اضغط للاختيار","Drop an image here or click to choose")}</span></Button><p><bdi>PNG</bdi> {c("أو","or")} <bdi>JPEG</bdi> · {c("حد أقصى","Maximum")} <bdi>5MB</bdi></p></div>}
    {pending&&<p role="status">{c("جارٍ رفع الصورة…","Uploading image…")}</p>}{error&&<div className="flex flex-wrap items-center gap-2"><p role="alert" className="error-message">{error}</p>{retryFile&&<Button type="button" variant="outline" size="sm" disabled={pending} onClick={()=>void upload(retryFile)}>{c("إعادة المحاولة","Retry")}</Button>}</div>}
  </section>;
}
