"use client";
import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { FieldGroup } from "@/components/ui/field";
import { FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useActionToast } from "@/components/action-toast";
import { actionFeedback } from "@/lib/action-feedback";
import { OrganizationSlugField } from "./organization-slug-field";
import { AdminOrganizationDecision } from "./admin-organization-decision";
import { saveOrganizationIdentity } from "./admin-organization-actions";
import type { AdminOrganizationIdentity } from "./management-repository";
import type { MutationState } from "./validation";
import type { Locale } from "@/lib/preferences";
export function AdminOrganizationControls({
  organization,
  locale,
}: {
  organization: AdminOrganizationIdentity;
  locale: Locale;
}) {
  const en = locale === "en",
    c = (ar: string, english: string) => (en ? english : ar),
    router = useRouter(),
    [slug, setSlug] = useState(organization.slug),
    [kind, setKind] = useState<"leader" | "status" | null>(null);
  const [state, action, pending] = useActionState<MutationState, FormData>(
    async (previous, form) => {
      const result = await saveOrganizationIdentity(previous, form);
      if (result.success) router.refresh();
      return result;
    },
    {},
  );
  useActionToast(state, locale);
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>
            {c("إدارة الجهة", "Organization administration")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <form action={action} className="flex flex-col gap-5">
            <input
              type="hidden"
              name="organizationId"
              value={organization.id}
            />
            <fieldset disabled={pending}>
              <FieldGroup>
                <FormField label={c("النوع", "Type")}>
                  <Select
                    name="typeCode"
                    defaultValue={organization.typeCode}
                    items={{
                      Club: c("نادي", "Club"),
                      Council: c("مجلس", "Council"),
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Club">{c("نادي", "Club")}</SelectItem>
                      <SelectItem value="Council">
                        {c("مجلس", "Council")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
                <OrganizationSlugField
                  locale={locale}
                  value={slug}
                  onChange={setSlug}
                  organizationId={organization.id}
                />
              </FieldGroup>
            </fieldset>
            {state.error && (
              <Alert variant="destructive">
                <AlertDescription>
                  {actionFeedback(state.error, locale)}
                </AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="self-start" disabled={pending}>
              {pending
                ? c("جاري الحفظ…", "Saving…")
                : c("حفظ إعدادات الجهة", "Save organization settings")}
            </Button>
          </form>
          <Separator />
          <div className="flex flex-wrap items-center gap-3">
            <p>
              {c("الحالة:", "Status:")}{" "}
              {c(
                organization.statusCode === "Active"
                  ? "نشطة"
                  : organization.statusCode === "Inactive"
                    ? "غير نشطة"
                    : "مؤرشفة",
                organization.statusCode,
              )}
            </p>
            <Button variant="outline" onClick={() => setKind("status")}>
              {c("تغيير الحالة", "Change status")}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <p>
              {c("القائد:", "Leader:")}{" "}
              {organization.leaderName ?? c("بدون قائد", "No leader")}
            </p>
            <Button variant="outline" onClick={() => setKind("leader")}>
              {c("تغيير القائد", "Change leader")}
            </Button>
          </div>
        </CardContent>
      </Card>
      {kind && (
        <AdminOrganizationDecision
          organization={organization}
          kind={kind}
          locale={locale}
          onClose={() => setKind(null)}
        />
      )}
    </>
  );
}
