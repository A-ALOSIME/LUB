"use client";
import {NumberText} from "@/components/number-text";
import {createTranslator} from "@/lib/i18n";
import {startTransition,useActionState,useState} from "react";
import {useRouter} from "next/navigation";
import {Card,CardHeader,CardTitle,CardContent} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {Badge} from "@/components/ui/badge";
import {Input} from "@/components/ui/input";
import {FormField} from "@/components/form-field";
import {Alert,AlertDescription} from "@/components/ui/alert";
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogAction,AlertDialogCancel} from "@/components/ui/alert-dialog";
import {useActionToast} from "@/components/action-toast";
import {actionFeedback} from "@/lib/action-feedback";
import {mutateOrganization} from "./actions";
import type {MutationState} from "./validation";
import type {Locale} from "@/lib/preferences";
export function AdminAccessManager({admins,currentUser,locale}:{admins:Array<{userId:string;fullName:string}>;currentUser:string;locale:Locale}) {
 const en=locale==="en",c=createTranslator(en ? "en" : "ar"),router=useRouter();
 const [email,setEmail]=useState(""),[decision,setDecision]=useState<{operation:"grant-admin"|"end-admin";name:string;target?:string}|null>(null);
 const [state,action,pending]=useActionState<MutationState,FormData>(async(previous,form)=>{const result=await mutateOrganization(previous,form);if(result.success){setDecision(null);setEmail("");router.refresh();}return result;},{});
 useActionToast(state,locale);
 function confirm(){if(!decision)return;const data=new FormData();data.set("operation",decision.operation);data.set("confirmed","on");if(decision.operation==="grant-admin")data.set("email",decision.name);else data.set("targetUserId",decision.target!);startTransition(()=>action(data));}
 return <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
  <Card><CardHeader className="flex flex-row items-center justify-between gap-3"><CardTitle>{c("المشرفون الحاليون","Current administrators")}</CardTitle><Badge variant="secondary"><NumberText value={admins.length}/></Badge></CardHeader><CardContent><ul className="divide-y divide-border">{admins.map(admin=><li key={admin.userId} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"><p><bdi>{admin.fullName}</bdi>{admin.userId===currentUser&&<span className="ms-2 text-sm text-muted-foreground">{c("(أنت)","(you)")}</span>}</p>{admin.userId!==currentUser&&<Button variant="danger-outline" size="sm" disabled={admins.length<=1} onClick={()=>setDecision({operation:"end-admin",name:admin.fullName,target:admin.userId})}>{c("سحب الصلاحية","Revoke access")}</Button>}</li>)}</ul></CardContent></Card>
  <Card><CardHeader><CardTitle>{c("إضافة مشرف عام","Add administrator")}</CardTitle></CardHeader><CardContent><form className="flex flex-col gap-4" onSubmit={event=>{event.preventDefault();setDecision({operation:"grant-admin",name:email.trim()});}}><FormField id="grant-admin-email" label={c("بريد الحساب المتحقق والمكتمل","Verified, onboarded account email")} required><Input id="grant-admin-email" type="email" dir="ltr" required maxLength={254} value={email} placeholder="name@example.com" onChange={e=>setEmail(e.target.value)}/></FormField><Button type="submit" className="self-start">{c("منح الصلاحية","Grant access")}</Button></form></CardContent></Card>
  <AlertDialog open={!!decision} onOpenChange={open=>{if(!open&&!pending)setDecision(null);}}><AlertDialogContent dir={en?"ltr":"rtl"}><AlertDialogHeader><AlertDialogTitle>{decision?.operation==="grant-admin"?c(`منح الصلاحية إلى ${decision.name}؟`,`Grant access to ${decision.name}?`):c(`سحب صلاحية ${decision?.name}؟`,`Revoke ${decision?.name} access?`)}</AlertDialogTitle><AlertDialogDescription>{decision?.operation==="grant-admin"?c("سيتمكن الحساب من إدارة الجهات والمشرفين وإعدادات النظام. لا تمنحه هذه الصلاحية صلاحيات تشغيل الأندية.","This account can manage organizations, administrators and system settings. This does not grant club operational permissions."):c("ستنتهي صلاحية إدارة النظام لهذا الحساب مع الاحتفاظ بسجل الصلاحيات.","End system management access and retain permission history.")}</AlertDialogDescription></AlertDialogHeader>{state.error&&<Alert variant="destructive"><AlertDescription>{actionFeedback(state.error,locale)}</AlertDescription></Alert>}<AlertDialogFooter><AlertDialogAction disabled={pending} variant={decision?.operation==="end-admin"?"danger-outline":"default"} onClick={confirm}>{pending?c("جاري الحفظ…","Saving…"):c("تأكيد","Confirm")}</AlertDialogAction><AlertDialogCancel disabled={pending}>{c("إلغاء","Cancel")}</AlertDialogCancel></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </div>;
}
