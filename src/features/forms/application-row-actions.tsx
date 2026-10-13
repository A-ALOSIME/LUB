"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Eye, MoreHorizontal, Undo2 } from "lucide-react";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={en ? `Actions for ${organization}` : `إجراءات ${organization}`} />}>
        <MoreHorizontal aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" dir={en ? "ltr" : "rtl"}>
        <DropdownMenuGroup>
          {preview
            ? <DropdownMenuItem disabled><Eye aria-hidden="true" />{en ? "View details" : "عرض التفاصيل"}</DropdownMenuItem>
            : <DropdownMenuItem render={<Link href={detailsHref} />}><Eye aria-hidden="true" />{en ? "View details" : "عرض التفاصيل"}</DropdownMenuItem>}
          {canWithdraw && <DropdownMenuItem variant="destructive" disabled={preview} onClick={() => setConfirmOpen(true)}>
            <Undo2 aria-hidden="true" />{en ? "Withdraw application" : "سحب الطلب"}
          </DropdownMenuItem>}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>

    {!preview && <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <AlertDialogContent dir={en ? "ltr" : "rtl"}>
        <AlertDialogHeader>
          <AlertDialogTitle>{en ? "Withdraw this application?" : "تأكيد سحب الطلب"}</AlertDialogTitle>
          <AlertDialogDescription>
            {en
              ? `Your application to ${organization} will be withdrawn. You can apply again while registration is open.`
              : `سيتم سحب طلبك إلى ${organization}. تقدر تقدم مرة أخرى ما دام التسجيل مفتوحًا.`}
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
