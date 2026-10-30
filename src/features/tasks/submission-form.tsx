"use client";

import {displayFileName} from "@/lib/file-name";
import {createTranslator} from "@/lib/i18n";
import {useState} from "react";
import {TaskForm} from "./task-form";
import {FilePickerInput} from "@/components/file-picker-input";
import type {Locale} from "@/lib/preferences";
import {X} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Tooltip,TooltipTrigger,TooltipContent} from "@/components/ui/tooltip";
import {Textarea} from "@/components/ui/textarea";
import type {SubmissionErrorCode} from "./submission-errors";
import { FormField } from "@/components/form-field";
export function SubmissionForm({participant,revision,lastRevision,locale="ar"}:{participant:string;revision:number;lastRevision:number;locale?:Locale}){
 const en=locale==="en",c=createTranslator(en ? "en" : "ar");
 const [assets,setAssets]=useState<Array<{id:string;name:string}>>([]);const [uploading,setUploading]=useState(false);const [error,setError]=useState<SubmissionErrorCode>();
 async function upload(file?:File){if(!file)return;setError(undefined);setUploading(true);try{
  if(assets.length>=5)throw new Error("limit");const body=new FormData();body.set("file",file);const response=await fetch("/files/upload",{method:"POST",body});const result=await response.json() as {id?:string;name?:string;error?:string};
  if(!response.ok||!result.id||!result.name){setError(response.status===401||response.status===403?"access":result.error==="upload_unavailable"?"setup":response.status>=500?"service":"upload");return;}setAssets(current=>[...current,{id:result.id!,name:result.name!}]);
 }catch(error){setError(error instanceof Error&&error.message==="limit"?"upload":"service");}finally{setUploading(false);}}
 return <TaskForm operation="submit" fields={{participant,revision:String(revision),lastRevision:String(lastRevision)}} label={c("إرسال نسخة التسليم","Submit deliverable version")} disabled={uploading} locale={locale} onSubmitStart={()=>setError(undefined)} uploadError={error}>
 <FormField  label={<>{c("وصف المخرج","Deliverable description")}</>}><Textarea name="message" maxLength={6000} rows={5}/></FormField>
 <div className="grid gap-2"><span className="text-sm font-medium">{c("مرفق التسليم","Submission attachment")}</span><FilePickerInput accept="application/pdf,image/jpeg,image/png" locale={locale} ariaLabel={c("مرفق التسليم","Submission attachment")} onChange={e=>void upload(e.target.files?.[0])}/></div>
 <p role="status" className="text-sm text-muted">{uploading?c("جارٍ رفع المرفق…","Uploading attachment…"):c("حتى خمسة ملفات، كل ملف حتى 5 ميجابايت.","Up to five files, each up to 5 MB.")}</p>
 <ul className="space-y-3">{assets.map(a=><li key={a.id} className="flex flex-wrap items-center gap-3 break-all"><input type="hidden" name="asset" value={a.id}/><a href={`/files/${a.id}`} className="text-link" dir="auto">{displayFileName(a.name)}</a><Tooltip><TooltipTrigger render={<Button type="button" variant="ghost" size="icon-sm" aria-label={c(`إزالة المرفق: ${displayFileName(a.name)}`,`Remove attachment: ${displayFileName(a.name)}`)} onClick={()=>setAssets(current=>current.filter(x=>x.id!==a.id))}><X/></Button>}/><TooltipContent>{c("إزالة المرفق","Remove attachment")}</TooltipContent></Tooltip></li>)}</ul>
 </TaskForm>;
}
