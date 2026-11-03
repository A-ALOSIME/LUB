"use client";
import {useState,useTransition} from "react";
import {UserRoundMinus} from "lucide-react";
import {useRouter} from "next/navigation";
import {RowAction} from "@/components/row-action";
import {Button} from "@/components/ui/button";
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogAction,AlertDialogCancel} from "@/components/ui/alert-dialog";
import {toast} from "@/components/ui/toast";
import {createTranslator} from "@/lib/i18n";
import {mutateEvent} from "./actions";
import type {Locale} from "@/lib/preferences";
export function RemoveEventRegistration({id,name,allowed,locale,full=false,onSuccess,organization}:{organization?:string;id:string;name:string;allowed:boolean;locale:Locale;full?:boolean;onSuccess?:()=>void}){
 const c=createTranslator(locale),[open,setOpen]=useState(false),[pending,start]=useTransition(),router=useRouter(),label=c("إزالة التسجيل","Remove registration");
 return <>{full?<Button variant="secondary" disabled={!allowed||pending} onClick={()=>setOpen(true)}>{label}</Button>:<RowAction label={label} disabled={!allowed||pending} onClick={()=>setOpen(true)}><UserRoundMinus/></RowAction>}<AlertDialog open={open} onOpenChange={setOpen}><AlertDialogContent dir={locale==="ar"?"rtl":"ltr"}><AlertDialogHeader><AlertDialogTitle>{c(`إزالة تسجيل ${name}؟`,`Remove ${name}'s registration?`)}</AlertDialogTitle><AlertDialogDescription>{c("سيُلغى التسجيل مع الاحتفاظ بالسجل السابق.","The registration will be cancelled and its history retained.")}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogAction disabled={pending} onClick={e=>{e.preventDefault();start(async()=>{const form=new FormData();form.set("operation","remove-registration");form.set("registration",id);if(organization)form.set("org",organization);form.set("confirm","on");const result=await mutateEvent({},form);if(result.error){toast.add({title:result.error,type:"error",timeout:0});return;}setOpen(false);onSuccess?.();window.dispatchEvent(new CustomEvent("organization-events-changed",{detail:{organization}}));router.refresh();toast.add({title:c("تمت إزالة التسجيل","Registration removed"),type:"success",timeout:3000});});}}>{label}</AlertDialogAction><AlertDialogCancel>{c("إلغاء","Cancel")}</AlertDialogCancel></AlertDialogFooter></AlertDialogContent></AlertDialog></>;
}
