"use client";

import {useState,useTransition} from "react";
import {ClipboardClock} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Tooltip,TooltipTrigger,TooltipContent} from "@/components/ui/tooltip";
import {toast} from "@/components/ui/toast";
import {createTranslator} from "@/lib/i18n";
import type {Locale} from "@/lib/preferences";
import {mutateHours} from "./actions";

export function SelfReportPolicy({org,enabled,locale}:{org:string;enabled:boolean;locale:Locale}){
 const [checked,setChecked]=useState(enabled),[pending,start]=useTransition(),t=createTranslator(locale);
 const label=t("طلب الساعات الذاتي","Self-reported hours");
 function change(value:boolean){const previous=checked;setChecked(value);start(async()=>{
  const form=new FormData();form.set("operation","self-policy");form.set("org",org);if(value)form.set("enabled","on");
  try{const result=await mutateHours({},form);if(result.error)throw new Error();toast.add({title:t("تم الحفظ","Saved"),type:"success",timeout:3000});window.dispatchEvent(new Event("activity-changed"));}
  catch{setChecked(previous);toast.add({title:t("تعذّر حفظ الإعداد. حاول مجددًا.","The setting could not be saved. Try again."),type:"error",timeout:0});}
 });}
 return <Tooltip><TooltipTrigger render={<Button type="button" variant="outline" size="icon-sm" aria-label={label} aria-pressed={checked} disabled={pending} onClick={()=>change(!checked)}/>}><ClipboardClock/></TooltipTrigger><TooltipContent>{label} · {checked?t("مفعّل","Enabled"):t("متوقف","Disabled")}</TooltipContent></Tooltip>;
}
