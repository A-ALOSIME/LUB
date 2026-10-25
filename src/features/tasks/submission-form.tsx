"use client";
import {useEffect,useRef,useState} from "react";
import {TaskForm} from "./task-form";
import {FilePickerInput} from "@/components/file-picker-input";
import type {Locale} from "@/lib/preferences";
import { FormField } from "@/components/form-field";
export function SubmissionForm({participant,revision,lastRevision,locale="ar"}:{participant:string;revision:number;lastRevision:number;locale?:Locale}){
 const en=locale==="en",c=(ar:string,english:string)=>en?english:ar;
 const [assets,setAssets]=useState<Array<{id:string;name:string}>>([]);const [uploading,setUploading]=useState(false);const [error,setError]=useState("");const alert=useRef<HTMLParagraphElement>(null);
 useEffect(()=>{if(error)alert.current?.focus();},[error]);
 async function upload(file?:File){if(!file)return;setError("");setUploading(true);try{
  if(assets.length>=5)throw new Error("limit");const body=new FormData();body.set("file",file);const response=await fetch("/files/upload",{method:"POST",body});const result=await response.json() as {id?:string;name?:string};
  if(!response.ok||!result.id||!result.name)throw new Error("upload");setAssets(current=>[...current,{id:result.id!,name:result.name!}]);
 }catch{setError(c("تعذّر رفع المرفق. حتى خمسة ملفات PDF أو JPEG أو PNG، كل ملف حتى 5 ميجابايت.","Upload failed. Add up to five PDF, JPEG or PNG files, each up to 5 MB."));}finally{setUploading(false);}}
 return <TaskForm operation="submit" fields={{participant,revision:String(revision),lastRevision:String(lastRevision)}} label={c("إرسال نسخة التسليم","Submit deliverable version")} disabled={uploading} locale={locale}>
 <FormField  label={<>{c("وصف المخرج","Deliverable description")}</>}><textarea name="message" maxLength={6000} rows={5}/></FormField>
 <div className="grid gap-2"><span className="text-sm font-medium">{c("مرفق التسليم","Submission attachment")}</span><FilePickerInput accept="application/pdf,image/jpeg,image/png" locale={locale} ariaLabel={c("مرفق التسليم","Submission attachment")} onChange={e=>void upload(e.target.files?.[0])}/></div>
 <p role="status" className="text-sm text-muted">{uploading?c("جارٍ رفع المرفق…","Uploading attachment…"):c("حتى خمسة ملفات، كل ملف حتى 5 ميجابايت.","Up to five files, each up to 5 MB.")}</p>
 <ul className="space-y-3">{assets.map(a=><li key={a.id} className="flex flex-wrap items-center gap-3 break-all"><input type="hidden" name="asset" value={a.id}/><a href={`/files/${a.id}`} className="text-link" dir="auto">{a.name}</a><button type="button" className="button button-secondary" onClick={()=>setAssets(current=>current.filter(x=>x.id!==a.id))}>{c("إزالة من التسليم","Remove from submission")}</button></li>)}</ul>
 {error&&<p ref={alert} tabIndex={-1} role="alert" className="error-message">{error}</p>}</TaskForm>;
}
