"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {useRouter} from "next/navigation";
import { Eye, Pencil, Copy, Trash2 } from "lucide-react";
import { RowAction } from "@/components/row-action";
import { relativeDate } from "@/lib/relative-date";
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogAction,AlertDialogCancel} from "@/components/ui/alert-dialog";
import {toast} from "@/components/ui/toast";
import {mutateWorkflow} from "./actions";
import { OrganizationStatusBadge } from "@/features/organizations/organization-status-badge";
import type { Locale } from "@/lib/preferences";
import type { Template } from "./repository";

function formatVersionCount(value: number, locale: Locale) {
  if (locale === "en") return `${value} ${value === 1 ? "version" : "versions"}`;
  if (value === 1) return "نسخة واحدة";
  if (value === 2) return "نسختان";
  if (value >= 3 && value <= 10) return `${value} نسخ`;
  return `${value} نسخة`;
}

export function RegistrationTemplateRow({ template, organization, locale }: { template: Template; organization: string; locale: Locale }) {
  const [deleteOpen,setDeleteOpen]=useState(false),[pending,startTransition]=useTransition();
  const router=useRouter();
  const en = locale === "en";
  const c = (ar: string, english: string) => en ? english : ar;
  const base = `/manage/organizations/${organization}/renewals`;
  const editHref = `${base}?section=forms&template=${template.id}`;
  const latest = template.versions[0];
  const hasPublishedVersion = template.versions.some(version => version.status_code === "Published");
  const state = latest?.status_code === "Draft" ? "Draft" : hasPublishedVersion ? "Published" : "Draft";

  const canDelete=!!template.can_delete && (template.round_count??0)===0;
  const deleteHint=(template.round_count??0)>0?c(`مستخدم في ${template.round_count} جولات`,`Used by ${template.round_count} rounds`):(template.event_count??0)>0?c("مستخدم في فعالية","Used by an event"):!canDelete?c("الحذف متاح لقائد الجهة أو نائبه فقط","Only organization leaders and deputies can delete forms"):c("حذف النموذج","Delete form");
  function perform(operation:"delete-form"|"duplicate-form") {
    startTransition(async()=>{
      try {
        const form=new FormData();form.set("operation",operation);form.set("template",template.id);
        const result=await mutateWorkflow({},form);
        if(result.error){toast.add({title:result.error,type:"error",timeout:0});return;}
        setDeleteOpen(false);router.refresh();
        toast.add({title:operation==="duplicate-form"?c("تم إنشاء نسخة","Copy created"):c("تم حذف النموذج","Form deleted"),type:"success",timeout:3000,...(result.templateId?{actionProps:{children:c("فتح","Open"),onClick:()=>router.push(`${base}?section=forms&template=${result.templateId}`)}}:{})});
      }catch{toast.add({title:c("تعذّر تنفيذ الإجراء. أعد المحاولة.","Action failed. Try again."),type:"error",timeout:0});}
    });
  }
  return <li className="registration-template-row flex min-w-0 flex-col items-stretch gap-3 py-3 transition-colors hover:bg-accent/50 sm:flex-row sm:items-center sm:justify-between">
    <div className="min-w-0">
      <Link dir="auto" href={editHref} className="break-words font-medium text-foreground hover:text-primary hover:underline">{template.name}</Link>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <OrganizationStatusBadge status={state === "Published" ? "published" : "draft"}>{en ? state : state === "Published" ? "منشور" : "مسودة"}</OrganizationStatusBadge>
        <span aria-hidden="true">·</span><span>{formatVersionCount(template.version_count ?? template.versions.length, locale)}</span><span aria-hidden="true">·</span><span>{c("آخر تحديث","Updated")}: {template.updated_at?relativeDate(template.updated_at,locale):c("غير متاح","Unavailable")}</span><span aria-hidden="true">·</span><span>{template.round_count??0} {c("جولات تستخدمه","rounds using this form")}</span>
      </div>
    </div>
    <div className="registration-template-actions flex shrink-0 flex-wrap items-center gap-1">
      <RowAction href={editHref} label={state==="Draft"?c("تعديل المسودة","Edit draft"):c("عرض النموذج","View form")}>{state==="Draft"?<Pencil/>:<Eye/>}</RowAction>
      <RowAction label={c("تكرار النموذج","Duplicate form")} disabled={pending} onClick={()=>perform("duplicate-form")}><Copy/></RowAction>
      <RowAction label={c("حذف النموذج","Delete form")} hint={deleteHint} className="template-delete-action" disabled={!canDelete||pending} onClick={()=>setDeleteOpen(true)}><Trash2/></RowAction>
    </div>
    <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}><AlertDialogContent dir={en?"ltr":"rtl"}><AlertDialogHeader><AlertDialogTitle>{c(`حذف النموذج «${template.name}»؟`,`Delete “${template.name}”?`)}</AlertDialogTitle><AlertDialogDescription>{c("سيُحذف بكل نسخه ولا يمكن التراجع.","All versions will be deleted. This cannot be undone.")}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogAction variant="danger-outline" disabled={pending} onClick={event=>{event.preventDefault();perform("delete-form");}}>{pending?c("جارٍ الحذف…","Deleting…"):c("حذف النموذج","Delete form")}</AlertDialogAction><AlertDialogCancel disabled={pending}>{c("إلغاء","Cancel")}</AlertDialogCancel></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </li>;
}
