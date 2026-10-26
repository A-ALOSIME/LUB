"use client";
import {useEffect,useRef,useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import {Alert,AlertDescription} from "@/components/ui/alert";
import {Button} from "@/components/ui/button";
import {Skeleton} from "@/components/ui/skeleton";
import {mutateWorkflow} from "./actions";
import type {Locale} from "@/lib/preferences";

// A navigation intent starts an authorized POST; server rendering never writes.
export function OpenPublishedEditor({template,locale}:{template:string;locale:Locale}){
 const started=useRef(false),[error,setError]=useState(""),[pending,start]=useTransition();const router=useRouter();
 function open(){start(async()=>{try{const form=new FormData();form.set("operation","draft-form");form.set("template",template);const result=await mutateWorkflow({},form);if(result.error){setError(result.error);return;}router.refresh();}catch{setError(locale==="en"?"Could not open the editor. Try again.":"تعذّر فتح المحرر. أعد المحاولة.");}});}
 useEffect(()=>{if(!started.current){started.current=true;open();}});
 return error?<Alert variant="destructive"><AlertDescription>{error}<Button variant="outline" disabled={pending} onClick={open}>{locale==="en"?"Retry":"إعادة المحاولة"}</Button></AlertDescription></Alert>:<Skeleton className="h-32 w-full" aria-label={locale==="en"?"Opening editor":"جارٍ فتح المحرر"}/>;
}
