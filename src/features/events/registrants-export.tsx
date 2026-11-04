"use client";
import {useState} from "react";
import {ExportButton} from "@/components/export-button";
import {Alert,AlertDescription} from "@/components/ui/alert";
import {toast} from "@/components/ui/toast";
import {createTranslator} from "@/lib/i18n";
import type {Locale} from "@/lib/preferences";
export function RegistrantsExport({organization,event,q,state,allowed,locale}:{organization?:string;event:string;q:string;state:string;allowed:boolean;locale:Locale}){
 const c=createTranslator(locale),[pending,setPending]=useState(false),[error,setError]=useState("");
 async function download(){setPending(true);setError("");try{
  const response=await fetch(`/api/organizations/${organization}/registrants/export`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({event,committee:null,q,state,locale}),cache:"no-store"});if(!response.ok)throw new Error(response.status===429?"quota":"unavailable");
  const url=URL.createObjectURL(await response.blob()),link=document.createElement("a");link.href=url;link.download=response.headers.get("Content-Disposition")?.match(/filename="([a-zA-Z0-9-]+\.xlsx)"/)?.[1]??"registrants.xlsx";document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);toast.add({title:c("بدأ تحميل الملف","Download started"),type:"success",timeout:3000});
 }catch(issue){setError(issue instanceof Error&&issue.message==="quota"?c("وصلت للحد المسموح للتصدير. حاول بعد ساعة.","The hourly export limit was reached. Try again later."):c("تعذّر التصدير. راجع صلاحياتك وحاول مجددًا.","Export failed. Check your permissions and try again."));}finally{setPending(false);}}
 return <><ExportButton hint={!allowed?c("تحتاج صلاحية تصدير التقارير","Report export permission is required"):!event?c("اختر فعالية لتصدير المقبولين والمرصودين فيها","Select an event to export its accepted and recorded registrants"):c("تصدير المقبولين والمرصودين حسب الفلاتر الحالية","Export accepted and recorded registrants using the current filters")} disabled={pending||!organization||!event||!allowed} onClick={()=>void download()}/>{error&&<Alert className="basis-full"><AlertDescription>{error}</AlertDescription></Alert>}</>;
}
