"use client";
import {useRef,useState} from "react";
import {X} from "lucide-react";
import {assetStorageName} from "@/features/forms/asset-storage";
import {displayFileName} from "@/lib/file-name";
import {createTranslator} from "@/lib/i18n";
import type {Locale} from "@/lib/preferences";
import {FilePickerInput} from "@/components/file-picker-input";
import {Button} from "@/components/ui/button";
import {Tooltip,TooltipTrigger,TooltipContent} from "@/components/ui/tooltip";
import {Textarea} from "@/components/ui/textarea";
import {FormField} from "@/components/form-field";
import {TaskForm} from "./task-form";
import {uploadErrorCode,type SubmissionErrorCode} from "./submission-errors";
type Attachment={key:string;file:File;asset?:string};
export function SubmissionForm({participant,revision,lastRevision,locale="ar"}:{participant:string;revision:number;lastRevision:number;locale?:Locale}){
 const c=createTranslator(locale),items=useRef<Attachment[]>([]);
 const [attachments,setAttachments]=useState<Attachment[]>([]),[message,setMessage]=useState("");
 const [uploading,setUploading]=useState(false),[error,setError]=useState<SubmissionErrorCode>();
 function update(next:Attachment[]){items.current=next;setAttachments(next);}
 async function upload(item:Attachment):Promise<SubmissionErrorCode|undefined>{
  if(item.file.size>5*1024*1024)return "file-size";
  if(item.file.type&&!["application/pdf","image/jpeg","image/png"].includes(item.file.type))return "file-type";
  try{
   const body=new FormData();body.set("displayName",item.file.name);body.set("file",item.file,item.file.type?assetStorageName(item.key,item.file.type):`${item.key}.bin`);
   const response=await fetch("/files/upload",{method:"POST",body,signal:AbortSignal.timeout(20000)});
   const result=await response.json() as {id?:string;error?:string};
   if(!response.ok||!result.id)return uploadErrorCode(response.status,result.error);
   update(items.current.map(current=>current.key===item.key?{...current,asset:result.id}:current));
  }catch{return "service";}
 }
 async function select(file?:File){
  if(!file)return;setError(undefined);if(items.current.length>=5){setError("upload");return;}
  const item={key:crypto.randomUUID(),file};update([...items.current,item]);setUploading(true);
  try{setError(await upload(item));}finally{setUploading(false);}
 }
 async function prepare(form:FormData){
  for(const item of items.current){if(!item.asset){const failure=await upload(item);if(failure)return failure;}}
  form.delete("asset");for(const item of items.current){if(item.asset)form.append("asset",item.asset);}
 }
 return <TaskForm operation="submit" fields={{participant,revision:String(revision),lastRevision:String(lastRevision)}} label={c("إرسال نسخة التسليم","Submit deliverable version")} disabled={uploading} locale={locale} onSubmitStart={()=>setError(undefined)} uploadError={error} beforeAction={prepare} onSuccess={()=>{setMessage("");update([]);}}>
  <FormField label={c("وصف المخرج","Deliverable description")}><Textarea name="message" value={message} onChange={event=>setMessage(event.target.value)} maxLength={6000} rows={5}/></FormField>
  <FormField label={c("مرفق التسليم","Submission attachment")}><FilePickerInput accept="application/pdf,image/jpeg,image/png" locale={locale} ariaLabel={c("مرفق التسليم","Submission attachment")} onChange={event=>void select(event.target.files?.[0])}/></FormField>
  <p role="status" className="text-sm text-muted-foreground">{uploading?c("جارٍ رفع المرفق…","Uploading attachment…"):c("حتى خمسة ملفات، كل ملف حتى 5 ميجابايت.","Up to five files, each up to 5 MB.")}</p>
  <ul className="flex flex-col gap-3">{attachments.map(item=><li key={item.key} className="flex min-w-0 items-center gap-2 break-all">{item.asset?<><input type="hidden" name="asset" value={item.asset}/><a href={`/files/${item.asset}`} className="text-link" dir="auto">{displayFileName(item.file.name)}</a></>:<bdi>{displayFileName(item.file.name)}</bdi>}<Tooltip><TooltipTrigger render={<Button type="button" variant="ghost" size="icon-sm" aria-label={c("إزالة المرفق","Remove attachment")} onClick={()=>{update(items.current.filter(current=>current.key!==item.key));setError(undefined);}}><X/></Button>}/><TooltipContent>{c("إزالة المرفق","Remove attachment")}</TooltipContent></Tooltip></li>)}</ul>
 </TaskForm>;
}
