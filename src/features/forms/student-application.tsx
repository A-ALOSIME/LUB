"use client";
import {createTranslator} from "@/lib/i18n";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { ManagementActionSheet } from "@/components/management-action-sheet";
import { WorkflowForm } from "./mutation-form";
import { ApplicationDetail } from "./application-detail";
import type { Detail } from "./repository";
import type { Locale } from "@/lib/preferences";

export function StudentApplication({
  detail,
  form,
  canEdit,
  canWithdraw,
  name,
  locale,
}: {
  detail: Detail;
  form: ReactNode;
  canEdit: boolean;
  canWithdraw: boolean;
  name: string;
  locale: Locale;
}) {
  const [editing, setEditing] = useState(false),
    c = createTranslator((locale === "en") ? "en" : "ar");
  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-medium">{c("طلبك", "Your application")}</h2>
      </CardHeader>
      <CardContent>
        {editing ? (
          form
        ) : (
          <ApplicationDetail
            detail={{ ...detail, canReview: false, notes: [] }}
            locale={locale}
          />
        )}
      </CardContent>
      <CardFooter className="flex-wrap gap-3 border-border">
        {canEdit && (
          <Button variant="outline" onClick={() => setEditing(!editing)}>
            {editing
              ? c("إلغاء التعديل", "Cancel editing")
              : detail.status_code === "Withdrawn"
                ? c("تقديم مجددًا", "Apply again")
                : c("تعديل الطلب", "Edit application")}
          </Button>
        )}
        {canWithdraw && (
          <ManagementActionSheet
            label={c("سحب الطلب", "Withdraw application")}
            title={c(
              `سحب طلب الانضمام إلى «${name}»؟`,
              `Withdraw your application to “${name}”?`,
            )}
            locale={locale}
            variant="outline"
            mobileBottomSheet
          >
            <WorkflowForm
              operation="withdraw"
              fields={{ application: detail.id }}
              label={c("تأكيد السحب", "Confirm withdrawal")}
              locale={locale}
            >
              <p className="text-sm leading-relaxed text-muted-foreground">
                {c(
                  "ستتغير حالة طلبك إلى مسحوب ويتوقف مراجعته. تستطيع تقديم طلب جديد ما دامت الجولة مفتوحة.",
                  "Your request will become withdrawn and will no longer be reviewed. You can apply again while the round is open.",
                )}
              </p>
            </WorkflowForm>
          </ManagementActionSheet>
        )}
      </CardFooter>
    </Card>
  );
}
