"use client";
import {useState} from "react";
import {Download,History} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Popover,PopoverTrigger,PopoverContent} from "@/components/ui/popover";
import {Tooltip,TooltipTrigger,TooltipContent} from "@/components/ui/tooltip";
import {Alert,AlertDescription} from "@/components/ui/alert";
import {toast} from "@/components/ui/toast";
import {createTranslator} from "@/lib/i18n";
import {recordCount} from "@/lib/display";
import {formatRiyadhDateTime} from "@/lib/datetime";
import type {Locale} from "@/lib/preferences";
import type {MemberFilters} from "./member-types";
import {loadMemberExportAudit} from "./member-data-actions";
export function MemberExportButton({organization,filters,locale,leader}:{organization:string;filters:MemberFilters;locale:Locale;leader:boolean}){
 const c=createTranslator(locale),[pending,setPending]=useState(false),[error,setError]=useState<string|null>(null);
 const [audit,setAudit]=useState<Array<{actor:string;at:string;query:string;status:string;committee:string|null;count:number}>|null>(null);
 async function exportRows(){setPending(true);setError(null);try{const endpoint=`/api/organizations/${organization}/members/export`,response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...filters,locale})});if(!response.ok)throw new Error(response.status===429?'limit':'failed');const data=await response.json();if(typeof data.ticket!=='string')throw new Error('failed');const file=await fetch(`${endpoint}?ticket=${encodeURIComponent(data.ticket)}&locale=${locale}`,{cache:"no-store"});if(!file.ok)throw new Error("failed");const blobUrl=URL.createObjectURL(await file.blob());const link=document.createElement("a");link.href=blobUrl;link.download="lub-members.csv";document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(blobUrl),30000);toast.add({title:c("بدأ تحميل الملف","Download started"),type:'success',timeout:3000});}catch(issue){setError(issue instanceof Error&&issue.message==='limit'?c("وصلت للحد المسموح للتصدير. حاول بعد ساعة.","The hourly export limit was reached. Try again later."):c("تعذّر التصدير. حاول مجددًا.","Export failed. Try again."));}finally{setPending(false);}}
 return <><Tooltip><TooltipTrigger render={<Button variant="outline" disabled={pending} onClick={exportRows} aria-label={c("تصدير الأعضاء","Export members")}/>}><Download/><span className="hidden sm:inline">{pending?c("جاري التصدير","Exporting"):c("تصدير","Export")}</span></TooltipTrigger><TooltipContent>{c("تصدير الأعضاء حسب الفلاتر الحالية","Export members using the current filters")}</TooltipContent></Tooltip>
 {leader&&<Popover onOpenChange={open=>{if(open)void loadMemberExportAudit(organization).then(result=>{if(result.data)setAudit(result.data);});}}><Tooltip><TooltipTrigger render={<PopoverTrigger render={<Button variant="ghost" size="icon" aria-label={c("سجل التصدير","Export history")}/>}/>}><History/></TooltipTrigger><TooltipContent>{c("سجل التصدير","Export history")}</TooltipContent></Tooltip><PopoverContent className="max-h-96 w-[min(28rem,calc(100vw-2rem))] overflow-y-auto"><h3 className="mb-3 font-medium">{c("سجل التصدير","Export history")}</h3>{audit===null?<p>{c("جاري التحميل","Loading")}</p>:audit.length?<ul className="flex flex-col gap-4">{audit.map((entry,i)=><li key={i}><p>{entry.actor} · {recordCount(entry.count,locale)}</p><p className="text-sm text-muted-foreground">{formatRiyadhDateTime(entry.at,locale)} · {entry.committee??c("كل اللجان","All committees")} · {entry.status==='all'?c("الكل","All"):entry.status==='Active'?c("نشطة","Active"):entry.status==='Ended'?c("منتهية","Ended"):c("غير نشطة","Inactive")}{entry.query&&` · ${entry.query}`}</p></li>)}</ul>:<p className="text-sm text-muted-foreground">{c("لا توجد عمليات تصدير بعد","No exports yet")}</p>}</PopoverContent></Popover>}
 {error&&<Alert className="basis-full"><AlertDescription>{error}</AlertDescription></Alert>}</>;
}
