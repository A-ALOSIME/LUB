"use client";
import {Upload} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Spinner} from "@/components/ui/spinner";
import {createTranslator} from "@/lib/i18n";
import type {Locale} from "@/lib/preferences";
export function UploadArea({locale="ar",kind="image",hint,disabled=false,busy=false,onChoose,onDrop}:{locale?:Locale;kind?:"image"|"file";hint?:string;disabled?:boolean;busy?:boolean;onChoose:()=>void;onDrop:(file:File)=>void}){
 const t=createTranslator(locale);
 return <Button type="button" variant="outline" disabled={disabled||busy} className="upload-area h-auto w-full flex-col gap-3 whitespace-normal border-dashed py-6 text-center" onClick={onChoose} onDragOver={event=>{if(!disabled&&!busy)event.preventDefault();}} onDrop={event=>{event.preventDefault();if(!disabled&&!busy&&event.dataTransfer.files[0])onDrop(event.dataTransfer.files[0]);}}>
 {busy?<Spinner/>:<Upload aria-hidden="true"/>}<span>{busy?t("جارٍ الرفع…","Uploading…"):kind==="image"?t("اسحب الصورة هنا أو اضغط للاختيار","Drop an image here or click to choose"):t("اسحب الملف هنا أو اضغط للاختيار","Drop a file here or click to choose")}</span>{hint&&<span className="text-xs text-muted-foreground">{hint}</span>}</Button>;
}
