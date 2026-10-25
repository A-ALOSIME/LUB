"use client";

import { useCallback, useState } from "react";
import { Eye, Undo2, TriangleAlert } from "lucide-react";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { RowAction } from "@/components/row-action";
import { buttonVariants } from "@/components/ui/button";
import type { Locale } from "@/lib/preferences";
import { WorkflowForm } from "./mutation-form";

type ApplicationRowActionsProps = {
  applicationId: string;
  organization: string;
  detailsHref: string;
  canWithdraw: boolean;
  locale: Locale;
  preview: boolean;
};

export function ApplicationRowActions({ applicationId, organization, detailsHref, canWithdraw, locale, preview }: ApplicationRowActionsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const en = locale === "en";
  const closeAfterSuccess = useCallback(() => setConfirmOpen(false), []);

  return <>
    <div className="flex flex-wrap items-center gap-1"><RowAction label={en?"View details":"عرض التفاصيل"} href={preview?undefined:detailsHref} disabled={preview}><Eye/></RowAction>{canWithdraw?<RowAction danger label={en?"Withdraw application":"سحب الطلب"} disabled={preview} onClick={()=>setConfirmOpen(true)}><Undo2/></RowAction>:<span className="row-action-space"/>}</div>

    {!preview && <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <AlertDialogContent dir={en ? "ltr" : "rtl"}>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2"><TriangleAlert className="text-destructive"/>{en?`Withdraw application to ${organization}?`:`سحب طلب الانضمام لـ${organization}؟`}</AlertDialogTitle>
          <AlertDialogDescription>
            {en
              ? `Your application to ${organization} will be withdrawn. You can apply again while registration is open.`
              : `ستتغير حالة طلبك إلى ${organization} إلى مسحوب، ولن يعود ضمن الطلبات قيد المراجعة. تقدر تقدم مرة أخرى ما دام التسجيل مفتوحًا.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{en ? "Keep application" : "إبقاء الطلب"}</AlertDialogCancel>
          <WorkflowForm
            operation="withdraw"
            fields={{ application: applicationId }}
            label={en ? "Withdraw" : "اسحب الطلب"}
            locale={locale}
            buttonClassName={buttonVariants({ variant: "destructive", size: "sm" })}
            onSuccess={closeAfterSuccess}
          />
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>}
  </>;
}
