"use client";
import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { FormField } from "@/components/form-field";
import { FieldGroup } from "@/components/ui/field";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectValue,
  SelectItem,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useActionToast } from "@/components/action-toast";
import { actionFeedback } from "@/lib/action-feedback";
import { mutateOrganization } from "./actions";
import { organizationStatuses, type MutationState } from "./validation";
import { LeaderEmailSearch } from "./leader-email-search";
import type { AdminOrganizationIdentity } from "./management-repository";
import type { Locale } from "@/lib/preferences";
export function AdminOrganizationDecision({
  organization,
  kind,
  locale,
  onClose,
}: {
  organization: AdminOrganizationIdentity;
  kind: "leader" | "status";
  locale: Locale;
  onClose: () => void;
}) {
  const en = locale === "en",
    c = (ar: string, english: string) => (en ? english : ar),
    router = useRouter();
  const [status, setStatus] = useState(organization.statusCode);
  const [state, action, pending] = useActionState<MutationState, FormData>(
    async (previous, form) => {
      const result = await mutateOrganization(previous, form);
      if (result.success) {
        onClose();
        router.refresh();
      }
      return result;
    },
    {},
  );
  useActionToast(state, locale);
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <AlertDialogContent dir={en ? "ltr" : "rtl"}>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {kind === "leader"
              ? c(
                  `تعيين قائد ${organization.nameAr}؟`,
                  `Appoint a leader for ${organization.nameAr}?`,
                )
              : c(
                  `تغيير حالة ${organization.nameAr}؟`,
                  `Change ${organization.nameAr} status?`,
                )}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {kind === "leader"
              ? c(
                  "سيُعيّن الحساب المحدد قائدًا، مع حفظ تاريخ القائد السابق والعضويات.",
                  "Appoint the selected account and retain the previous leader and membership history.",
                )
              : c(
                  "ستُطبق الحالة المختارة على الجهة. إيقافها أو أرشفتها يوقف إجراءاتها.",
                  "Apply the selected status. Inactive or archived organizations cannot run operations.",
                )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={action} className="flex flex-col gap-5">
          <input
            type="hidden"
            name="operation"
            value={kind === "leader" ? "appoint-leader" : "org-status"}
          />
          <input type="hidden" name="organizationId" value={organization.id} />
          <input type="hidden" name="confirmed" value="on" />
          <fieldset disabled={pending}>
            <FieldGroup>
              {kind === "leader" ? (
                <LeaderEmailSearch locale={locale} required />
              ) : (
                <FormField label={c("الحالة", "Status")}>
                  <Select
                    name="status"
                    value={status}
                    onValueChange={(value) => {
                      if (value) setStatus(value);
                    }}
                    items={
                      en
                        ? {
                            Active: "Active",
                            Inactive: "Inactive",
                            Archived: "Archived",
                          }
                        : organizationStatuses
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(organizationStatuses).map(
                        ([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {en ? value : label}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </FormField>
              )}
            </FieldGroup>
          </fieldset>
          {state.error && (
            <Alert variant="destructive">
              <AlertDescription>
                {actionFeedback(state.error, locale)}
              </AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogAction type="submit" disabled={pending}>
              {pending
                ? c("جاري الحفظ…", "Saving…")
                : kind === "leader"
                  ? c("تأكيد تعيين القائد", "Confirm appointment")
                  : c("تأكيد تغيير الحالة", "Confirm status change")}
            </AlertDialogAction>
            <AlertDialogCancel disabled={pending}>
              {c("إلغاء", "Cancel")}
            </AlertDialogCancel>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
