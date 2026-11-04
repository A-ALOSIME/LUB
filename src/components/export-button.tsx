"use client";
import Link from "next/link";
import {Download} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Tooltip,TooltipContent,TooltipTrigger} from "@/components/ui/tooltip";
import {useI18n} from "@/components/i18n-provider";
export function ExportButton({href,disabled,onClick,hint}:{href?:string;disabled?:boolean;onClick?:()=>void;hint?:string}){
 const {t}=useI18n(),label=t("تصدير","Export");
 return <Tooltip><TooltipTrigger render={<span className="inline-flex"/>}><Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onClick} aria-label={label} {...(href?{nativeButton:false,render:<Link href={href}/>}:{})}><Download data-icon="inline-end"/>{label}</Button></TooltipTrigger><TooltipContent>{hint??label}</TooltipContent></Tooltip>;
}
