"use client";
import {useTransition} from "react";
import {useRouter} from "next/navigation";
import {Pin,PinOff} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Tooltip,TooltipProvider,TooltipContent,TooltipTrigger} from "@/components/ui/tooltip";
import {toast} from "@/components/ui/toast";
import {createTranslator} from "@/lib/i18n";
import {mutateEvent} from "./actions";
import type {Locale} from "@/lib/preferences";
export function EventPinAction({id,pinned,locale}:{id:string;pinned:boolean;locale:Locale}){const [pending,start]=useTransition(),router=useRouter(),c=createTranslator(locale),label=pinned?c('فك تثبيت الفعالية','Unpin event'):c('تثبيت الفعالية','Pin event');return <TooltipProvider><Tooltip><TooltipTrigger render={<Button variant="ghost" size="icon" disabled={pending} aria-label={label} onClick={()=>start(async()=>{const form=new FormData();form.set('operation','feature');form.set('event',id);if(!pinned)form.set('featured','on');try{const result=await mutateEvent({},form);if(result.error){toast.add({title:c('تعذّر تغيير التثبيت. تحقق من صلاحيتك وحاول مجددًا.','Could not change pin status. Check your permissions and try again.'),type:'error',timeout:0});return;}toast.add({title:c('تم الحفظ','Saved'),type:'success',timeout:3000});router.refresh();}catch{toast.add({title:c('تعذّر الحفظ، حاول مجددًا','Could not save. Try again.'),type:'error',timeout:0});}})}/>}>{pinned?<PinOff/>:<Pin/>}</TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip></TooltipProvider>;}
