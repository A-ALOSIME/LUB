"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {Upload, Pencil, Trash2} from "lucide-react";
import {Button} from "@/components/ui/button";
import type { Locale } from "@/lib/preferences";

async function compactPoster(file: File) {
  if(file.type!=="image/webp"&&(file.size<=512*1024 || typeof createImageBitmap!=="function"))return file;
  const bitmap=await createImageBitmap(file);
  try {
    const scale=Math.min(1,1400/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement("canvas");
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));
    canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const context=canvas.getContext("2d");if(!context)return file;
    context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,file.type==="image/webp"?"image/jpeg":file.type,.8));
    if(file.type==="image/webp"){if(!blob)throw new Error("Image conversion failed");return new File([blob],file.name.replace(/\.webp$/i,".jpg"),{type:"image/jpeg"});}
    return blob&&blob.size<file.size?new File([blob],file.name,{type:file.type}):file;
  } finally {bitmap.close();}
}

function posterUploadMessage(code: string | undefined, status: number, locale: Locale, purpose="event-poster") {
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
  const message=code==="unsupported_poster_type"&&purpose==="announcement-image"?(en?"Use a JPEG, PNG or WebP image.":"استخدم صورة JPEG أو PNG أو WebP."):fallback[en ? 1 : 0];return purpose==="event-poster"?message:message.replaceAll("بوستر","صورة").replaceAll("poster","image");
}

export function EventPosterField({organization,locale,event,hasPoster=false}:{organization:string;locale:Locale;event?:string;hasPoster?:boolean}) {
 return <EntityImageField organization={organization} locale={locale} initialPreview={event&&hasPoster?`/event-posters/${event}`:""}/>;
}
export function EntityImageField({organization,locale,committee,initialPreview="",purpose="event-poster"}:{organization:string;locale:Locale;committee?:string|null;initialPreview?:string;purpose?:"event-poster"|"task-image"|"announcement-image"}) {
  const [asset, setAsset] = useState("");
  const [removed,setRemoved]=useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(initialPreview);
  const input = useRef<HTMLInputElement>(null);
  const [retryFile, setRetryFile] = useState<File>();
  const en = locale === "en";
  const c = (ar: string, english: string) => en ? english : ar;

  useEffect(()=>{input.current?.setCustomValidity(pending?(en?"Wait for the image upload.":"انتظر اكتمال رفع الصورة."):error);},[pending,error,en]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function upload(file?: File) {
    if (!file) return;
    setRetryFile(undefined);
    if(file.size>5*1024*1024){setError(posterUploadMessage("file_too_large",413,locale,purpose));return;}
    if(!["image/jpeg","image/png",...(purpose==="announcement-image"?["image/webp"]:[])].includes(file.type)){setError(posterUploadMessage("unsupported_poster_type",400,locale,purpose));return;}
    setRemoved(false);setPreview(URL.createObjectURL(file));
    setRetryFile(file);
    setPending(true);
    input.current?.setCustomValidity(c("انتظر اكتمال رفع الصورة.","Wait for the image upload."));
    setError("");
    try {
      const body = new FormData();
      body.set("file", await compactPoster(file));
      body.set("organization", organization);
      if(committee)body.set("committee",committee);
      const response = await fetch(`/files/upload?purpose=${purpose}`, { method: "POST", body });
      const result = await response.json().catch(() => null) as { id?: string; error?: string } | null;
      if (!response.ok || !result?.id) {
        setError(posterUploadMessage(result?.error, response.status, locale,purpose));
        return;
      }
      setAsset(result.id);
      setPreview(`/files/${result.id}/preview`);
      setRetryFile(undefined);
    } catch {
      setError(posterUploadMessage(undefined, 0, locale,purpose));
    } finally {
      setPending(false);
      input.current?.setCustomValidity("");
    }
  }

  function remove() {setRemoved(true);setRetryFile(undefined);setAsset("");setPreview("");setError("");if(input.current){input.current.value="";input.current.setCustomValidity("");}}
  const imageLabel=purpose==="task-image"?c("صورة المهمة","Task image"):purpose==="announcement-image"?c("صورة الإعلان","Announcement image"):c("بوستر الفعالية","Event poster");
  return <section className="event-poster-upload" aria-label={imageLabel} data-preview-url={preview}>
    <input type="hidden" name="poster" value={asset}/><input type="hidden" name="removePoster" value={String(removed)}/>
    <span className="event-poster-label">{imageLabel}{purpose!=="event-poster"&&c(" (اختياري)"," (optional)")}</span>
    <input className="sr-only" tabIndex={-1} aria-hidden="true" required value={pending||error?"":"ready"} onChange={()=>{}} onInvalid={event=>event.preventDefault()}/>
    <input ref={input} type="file" className="sr-only" accept={purpose==="announcement-image"?"image/jpeg,image/png,image/webp":"image/jpeg,image/png"} disabled={pending} aria-label={purpose==="event-poster"?c("صورة بوستر الفعالية","Event poster image"):imageLabel} onInvalid={event=>event.preventDefault()} onChange={event=>void upload(event.target.files?.[0])}/>
    {preview?<><div className="event-poster-preview"><Image src={preview} alt={purpose==="event-poster"?c("معاينة بوستر الفعالية","Event poster preview"):imageLabel} fill unoptimized sizes="(max-width:767px) 100vw, 32rem" className="object-contain"/></div><div className="flex gap-2"><Button type="button" variant="outline" size="sm" disabled={pending} onClick={()=>input.current?.click()}><Pencil/>{c("تغيير","Change")}</Button><Button type="button" variant="ghost" size="sm" disabled={pending} onClick={remove}><Trash2/>{c("حذف","Remove")}</Button></div></>:<div className="event-poster-dropzone" onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();void upload(event.dataTransfer.files?.[0]);}}><Button type="button" variant="ghost" disabled={pending} onClick={()=>input.current?.click()}><Upload/><span>{pending?c("جارٍ الرفع…","Uploading…"):c("اسحب الصورة هنا أو اضغط للاختيار","Drop an image here or click to choose")}</span></Button><p><bdi>PNG</bdi> {c("أو","or")} <bdi>JPEG</bdi>{purpose==="announcement-image"&&<> {c("أو","or")} <bdi>WebP</bdi></>} · {c("حد أقصى","Maximum")} <bdi>5MB</bdi></p></div>}
    {pending&&<p role="status">{c("جارٍ رفع الصورة…","Uploading image…")}</p>}{error&&<div className="flex flex-wrap items-center gap-2"><p role="alert" className="error-message">{error}</p>{retryFile&&<Button type="button" variant="outline" size="sm" disabled={pending} onClick={()=>void upload(retryFile)}>{c("إعادة المحاولة","Retry")}</Button>}</div>}
  </section>;
}
