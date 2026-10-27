"use client";
import {useEffect, useRef, useState} from "react";
import {Pencil, Trash2} from "lucide-react";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar";
import {Button} from "@/components/ui/button";
import type {Locale} from "@/lib/preferences";
import {avatarMaxBytes, stripAvatarMetadata} from "./avatar-file";

export async function prepareAvatar(file: File, fit: "cover" | "contain" = "cover") {
  if (!["image/jpeg","image/png"].includes(file.type) || !file.size || file.size > 2 * 1024 * 1024) throw new Error("Use JPG or PNG up to 2 MB");
  const bitmap = await createImageBitmap(file, {imageOrientation:"from-image"});
  try {
    if (bitmap.width > 8192 || bitmap.height > 8192) throw new Error("Image too large");
    const canvas = document.createElement("canvas"); canvas.width = 256; canvas.height = 256;
    const context = canvas.getContext("2d"); if (!context) throw new Error("Image unavailable");
    const side = Math.min(bitmap.width,bitmap.height);
    if(fit==="contain") {
      const scale=256/Math.max(bitmap.width,bitmap.height),width=bitmap.width*scale,height=bitmap.height*scale;
      context.drawImage(bitmap,(256-width)/2,(256-height)/2,width,height);
    } else context.drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,256,256);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve,"image/webp",.78));
    if (!blob || blob.type !== "image/webp" || blob.size > avatarMaxBytes + 8192) throw new Error("Image unavailable");
    const bytes = stripAvatarMetadata(new Uint8Array(await blob.arrayBuffer()));
    return new File([new Uint8Array(bytes)],"avatar.webp",{type:"image/webp"});
  } finally { bitmap.close(); }
}

export function AvatarPicker({name,src,locale,onChange,onProcessing,error:serverError}:{name:string;src?:string;locale:Locale;onChange:(file:File|null)=>void;onProcessing:(busy:boolean)=>void;error?:string}) {
  const [preview,setPreview] = useState<string|undefined>(src), [localUrl,setLocalUrl] = useState(""), [error,setError] = useState(""), [busy,setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null); const en = locale === "en";
  useEffect(()=>()=>{if(localUrl)URL.revokeObjectURL(localUrl)},[localUrl]);
  async function choose(file?:File) {
    if(!file)return;setError("");setBusy(true);onProcessing(true);
    try {const converted=await prepareAvatar(file),url=URL.createObjectURL(converted);setLocalUrl(url);setPreview(url);input.current?.setCustomValidity("");onChange(converted);}
    catch {const message=en?"Choose a valid JPG or PNG up to 2 MB.":"اختر صورة JPG أو PNG صالحة بحجم لا يتجاوز 2MB.";setError(message);input.current?.setCustomValidity(message);}
    finally {setBusy(false);onProcessing(false);}
  }
  return <div className="account-avatar-picker">
    <Avatar className="account-avatar-large"><AvatarImage src={preview} alt={en?"Your account photo":"صورة حسابك"}/><AvatarFallback>{name.trim().charAt(0)||"ل"}</AvatarFallback></Avatar>
    <div className="flex items-center gap-2"><Button type="button" variant="outline" size="sm" disabled={busy} onClick={()=>input.current?.click()}><Pencil data-icon="inline-start"/>{en?"Change photo":"تغيير الصورة"}</Button>{preview&&<Button type="button" variant="ghost" size="sm" disabled={busy} onClick={()=>{setPreview(undefined);setError("");setLocalUrl("");input.current?.setCustomValidity("");onChange(null);}}><Trash2 data-icon="inline-start"/>{en?"Remove photo":"حذف الصورة"}</Button>}</div>
    <input ref={input} disabled={busy} type="file" accept="image/jpeg,image/png" aria-label={en?"Choose account photo":"اختيار صورة الحساب"} className="sr-only" onInvalid={event=>event.preventDefault()} onChange={event=>{const file=event.target.files?.[0];event.target.value="";void choose(file);}}/>
    {(error||serverError)&&<p role="alert" className="text-sm text-destructive">{error||serverError}</p>}
  </div>;
}
