"use client";
import {useState,useActionState} from "react";
import {useRouter} from "next/navigation";
import {Plus} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Spinner} from "@/components/ui/spinner";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter} from "@/components/ui/dialog";
import {FormField} from "@/components/form-field";
import {DataTable} from "@/components/data-table";
import {NumberText} from "@/components/number-text";
import {toast} from "@/components/ui/toast";
import {createTranslator} from "@/lib/i18n";
import {actionFeedback} from "@/lib/action-feedback";
import {mutateOrganization} from "./actions";
import type {Locale} from "@/lib/preferences";
export function AdminAccessManager({admins,currentUser,locale}:{admins:Array<{userId:string;fullName:string;email?:string}>;currentUser:string;locale:Locale}){
 const t=createTranslator(locale),router=useRouter(),[open,setOpen]=useState(false),[email,setEmail]=useState("");
 const [state,action,pending]=useActionState(async(previous:import("./validation").MutationState,form:FormData)=>{const result=await mutateOrganization(previous,form);if(result.success){setOpen(false);setEmail("");router.refresh();toast.add({title:t("تم منح الصلاحية","Access granted"),type:"success"});}return result;},{});
 return <div className="flex min-w-0 flex-col gap-4"><div className="flex flex-wrap items-center justify-between gap-3"><p>{t("المشرفون الحاليون","Current administrators")} · <NumberText value={admins.length}/></p><Button onClick={()=>setOpen(true)}><Plus/>{t("إضافة مشرف","Add administrator")}</Button></div>
 <DataTable compact items={admins.map(admin=>({...admin,id:admin.userId}))} locale={locale} tableKey="system-admins" label={t("المشرفون العامون","Administrators")} columns={[{id:"name",label:t("المشرف","Administrator"),render:row=><>{row.fullName}{row.userId===currentUser&&` ${t("(أنت)","(you)")}`}</>},{id:"email",label:t("البريد","Email"),render:row=><bdi dir="ltr">{row.email}</bdi>}]}/>
 <Dialog open={open} onOpenChange={next=>{if(!pending)setOpen(next);}}><DialogContent dir={locale==="ar"?"rtl":"ltr"}><DialogHeader><DialogTitle>{t("إضافة مشرف عام","Add administrator")}</DialogTitle><DialogDescription>{t("بريد الحساب المتحقق والمكتمل","Verified, onboarded account email")}</DialogDescription></DialogHeader><form action={action} className="flex flex-col gap-4"><input type="hidden" name="operation" value="grant-admin"/><input type="hidden" name="confirmed" value="on"/><FormField label={t("البريد","Email")} required error={state.error?actionFeedback(state.error,locale):undefined}><Input name="email" type="email" dir="ltr" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} autoFocus aria-invalid={!!state.error}/></FormField><DialogFooter><Button type="submit" disabled={pending||!email.trim()}>{pending&&<Spinner/>}{t("منح الصلاحية","Grant access")}</Button></DialogFooter></form></DialogContent></Dialog></div>;
}
