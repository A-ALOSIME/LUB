"use client";
import Image from "next/image";
import {Button} from "@/components/ui/button";
import {Dialog,DialogTrigger,DialogContent,DialogTitle} from "@/components/ui/dialog";
import {createTranslator} from "@/lib/i18n";
import type {Locale} from "@/lib/preferences";
export function TaskPoster({src,title,locale}:{src:string;title:string;locale:Locale}){
 const t=createTranslator(locale);
 return <Dialog><DialogTrigger render={<Button variant="ghost" className="h-auto w-full p-0" aria-label={t("تكبير صورة المهمة","Enlarge task image")}/> }><Image src={src} width={1000} height={1000} unoptimized alt={title} className="h-auto w-full rounded-lg"/></DialogTrigger><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl"><DialogTitle>{title}</DialogTitle><Image src={src} width={1600} height={1600} unoptimized alt={title} className="h-auto w-full"/></DialogContent></Dialog>;
}
