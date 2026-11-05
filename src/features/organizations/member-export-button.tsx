"use client";
import {ExportButton} from "@/components/export-button";
import {useState} from "react";
import {Alert,AlertDescription} from "@/components/ui/alert";
import {toast} from "@/components/ui/toast";
import {createTranslator} from "@/lib/i18n";
import type {Locale} from "@/lib/preferences";
import type {MemberFilters} from "./member-types";
export function MemberExportButton({organization,filters,locale}:{organization:string;filters:MemberFilters;locale:Locale;leader:boolean}){
 const c=createTranslator(locale),[pending,setPending]=useState(false),[error,setError]=useState<string|null>(null);
 async function exportRows(){setPending(true);setError(null);try{const endpoint=`/api/organizations/${organization}/members/export`,response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...filters,locale})});if(!response.ok)throw new Error(response.status===429?'limit':'failed');const data=await response.json();if(typeof data.ticket!=='string')throw new Error('failed');const file=await fetch(`${endpoint}?ticket=${encodeURIComponent(data.ticket)}&locale=${locale}`,{cache:"no-store"});if(!file.ok)throw new Error("failed");const blobUrl=URL.createObjectURL(await file.blob());const link=document.createElement("a");link.href=blobUrl;link.download=file.headers.get("Content-Disposition")?.match(/filename="([a-zA-Z0-9-]+\.xlsx)"/)?.[1]??"members.xlsx";document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(blobUrl),30000);toast.add({title:c("بدأ تحميل الملف","Download started"),type:'success',timeout:3000});}catch(issue){setError(issue instanceof Error&&issue.message==='limit'?c("وصلت للحد المسموح للتصدير. حاول بعد ساعة.","The hourly export limit was reached. Try again later."):c("تعذّر التصدير. حاول مجددًا.","Export failed. Try again."));}finally{setPending(false);}}
 return <><ExportButton disabled={pending} onClick={()=>void exportRows()} hint={c("تصدير الأعضاء حسب الفلاتر الحالية","Export members using the current filters")}/>

 {error&&<Alert className="basis-full"><AlertDescription>{error}</AlertDescription></Alert>}</>;
}
