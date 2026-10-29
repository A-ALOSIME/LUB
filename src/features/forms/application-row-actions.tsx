"use client";

import {t as translateUi} from "@/lib/i18n";
import { useCallback, useState, useTransition } from "react";
import { Eye, Undo2, TriangleAlert } from "lucide-react";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { RowAction } from "@/components/row-action";
import { buttonVariants } from "@/components/ui/button";
import type { Locale } from "@/lib/preferences";
import { ManagementActionSheet } from "@/components/management-action-sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ApplicationDetail } from "./application-detail";
import { loadOwnApplicationPanel } from "./application-panel-actions";
import { WorkflowForm } from "./mutation-form";

type ApplicationRowActionsProps = {
  applicationId: string;
  organization: string;
  detailsHref: string;
  canWithdraw: boolean;
  locale: Locale;
  preview: boolean;
};

export function ApplicationRowActions({ applicationId, organization, canWithdraw, locale, preview }: ApplicationRowActionsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [detailsOpen,setDetailsOpen]=useState(false),[loading,startTransition]=useTransition();
  const [result,setResult]=useState<Awaited<ReturnType<typeof loadOwnApplicationPanel>>|null>(null);
  const en = locale === "en";
  const closeAfterSuccess = useCallback(() => setConfirmOpen(false), []);

  return <>
    <div className="flex flex-wrap items-center gap-1"><RowAction label={translateUi((en) ? "en" : "ar", "عرض التفاصيل", "View details")} disabled={preview} onClick={()=>{setDetailsOpen(true);setResult(null);startTransition(async()=>{try{setResult(await loadOwnApplicationPanel(applicationId));}catch{setResult({error:true});}});}}><Eye/></RowAction>{canWithdraw?<RowAction danger label={translateUi((en) ? "en" : "ar", "سحب الطلب", "Withdraw application")} disabled={preview} onClick={()=>setConfirmOpen(true)}><Undo2/></RowAction>:<span className="row-action-space"/>}</div>

    <ManagementActionSheet label={translateUi((en) ? "en" : "ar", "تفاصيل الطلب", "Application details")} title={organization} locale={locale} presentation="sheet" open={detailsOpen} onOpenChange={setDetailsOpen} hideTrigger mobileBottomSheet width="wide">
      {loading?<Skeleton className="h-40 w-full"/>:result?.detail?<div className="flex flex-col gap-4"><h2 className="font-semibold">{result.detail.campaign_title}</h2><ApplicationDetail detail={result.detail} locale={locale}/></div>:result?.error?<Alert variant="destructive"><AlertDescription>{translateUi((en) ? "en" : "ar", "تعذّر عرض الطلب. حاول مرة ثانية.", "Unable to load this application. Please try again.")}</AlertDescription></Alert>:null}
    </ManagementActionSheet>
    {!preview && <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <AlertDialogContent dir={en ? "ltr" : "rtl"}>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2"><TriangleAlert className="text-destructive"/>{translateUi((en) ? "en" : "ar", `سحب طلب الانضمام لـ${organization}؟`, `Withdraw application to ${organization}?`)}</AlertDialogTitle>
          <AlertDialogDescription>
            {translateUi((en) ? "en" : "ar", `ستتغير حالة طلبك إلى ${organization} إلى مسحوب، ولن يعود ضمن الطلبات قيد المراجعة. تقدر تقدم مرة أخرى ما دام التسجيل مفتوحًا.`, `Your application to ${organization} will be withdrawn. You can apply again while registration is open.`)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{translateUi((en) ? "en" : "ar", "إبقاء الطلب", "Keep application")}</AlertDialogCancel>
          <WorkflowForm
            operation="withdraw"
            fields={{ application: applicationId }}
            label={translateUi((en) ? "en" : "ar", "اسحب الطلب", "Withdraw")}
            locale={locale}
            buttonClassName={buttonVariants({ variant: "destructive", size: "sm" })}
            onSuccess={closeAfterSuccess}
          />
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>}
  </>;
}
