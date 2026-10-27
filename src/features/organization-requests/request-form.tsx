"use client";
import { actionFeedback } from "@/lib/action-feedback";
import { useActionState, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FieldGroup } from "@/components/ui/field";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { OrganizationInterestEditor } from "@/features/organizations/organization-interest-editor";
import { prepareAvatar } from "@/features/profile/avatar-picker";
import { useActionToast } from "@/components/action-toast";
import { mutateOpeningRequest, type OpeningRequestState } from "./actions";
import type { OpeningRequest } from "./repository";
import type { Locale } from "@/lib/preferences";
export function OpeningRequestForm({
  locale,
  initial,
}: {
  locale: Locale;
  initial?: OpeningRequest;
}) {
  const en = locale === "en",
    c = (ar: string, english: string) => (en ? english : ar),
    router = useRouter();
  const [removeLogo, setRemoveLogo] = useState(false);
  const [logo, setLogo] = useState<File | null>(null),
    [preview, setPreview] = useState(""),
    [busy, setBusy] = useState(false),
    [imageError, setImageError] = useState("");
  const [state, action, pending] = useActionState<
    OpeningRequestState,
    FormData
  >(async (previous, form) => {
    if (logo) form.set("logo", logo);
    if (removeLogo) form.set("removeLogo", "on");
    const result = await mutateOpeningRequest(previous, form);
    if (result.redirectTo) router.push(result.redirectTo);
    return result;
  }, {});
  const fieldError = (key: string) => {
    const message = state.fieldErrors?.[key]?.[0];
    return message ? actionFeedback(message, locale) : undefined;
  };
  useActionToast(state, locale);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  async function choose(file?: File) {
    if (!file) return;
    setBusy(true);
    setImageError("");
    try {
      const prepared = await prepareAvatar(file, "contain");
      setLogo(prepared);
      setRemoveLogo(false);
      setPreview(URL.createObjectURL(prepared));
    } catch {
      setImageError(
        c(
          "اختر صورة PNG أو JPEG بحجم حتى 2MB.",
          "Choose a PNG or JPEG up to 2 MB.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      action={action}
      className="organization-opening-form flex flex-col gap-6"
      dir={en ? "ltr" : "rtl"}
    >
      <input type="hidden" name="operation" value="submit" />
      {initial && <input type="hidden" name="source" value={initial.id} />}
      <fieldset disabled={pending || busy} className="min-w-0">
        <FieldGroup>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              label={c("اسم الجهة", "Organization name")}
              error={fieldError("name")}
            >
              <Input
                name="name"
                defaultValue={initial?.name_ar}
                minLength={2}
                maxLength={120}
                required
                autoFocus
              />
            </FormField>
            <FormField
              label={c("النوع", "Type")}
              required
              error={fieldError("type")}
            >
              <Select
                name="type"
                defaultValue={initial?.type_code ?? "Club"}
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
          </div>
          <FormField
            label={c("نبذة مختصرة", "Short description")}
            error={fieldError("summary")}
          >
            <Textarea
              name="summary"
              defaultValue={initial?.summary}
              required
              maxLength={1000}
              rows={3}
            />
          </FormField>
          <FormField
            label={c("رسالة الجهة وأهدافها", "Mission and goals")}
            error={fieldError("mission")}
          >
            <Textarea
              name="mission"
              defaultValue={initial?.mission}
              required
              maxLength={3000}
              rows={4}
            />
          </FormField>
          <FormField
            label={c("مجالات الاهتمام", "Interests")}
            error={fieldError("interests")}
          >
            <OrganizationInterestEditor
              initialInterests={initial?.interests ?? []}
              locale={locale}
            />
          </FormField>
          <FormField
            label={c("الشعار (اختياري)", "Logo (optional)")}
            hint={c(
              "PNG أو JPEG · حتى 2MB. يُحفظ بحجم صغير دون قص الشعار.",
              "PNG or JPEG · up to 2 MB. Stored at a small size without cropping.",
            )}
            error={imageError}
          >
            <Input
              type="file"
              accept="image/png,image/jpeg"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                void choose(file);
              }}
            />
            {(preview || (!removeLogo && initial?.has_logo)) && (
              <Image
                src={preview || `/organization-requests/${initial?.id}/logo`}
                alt={c("معاينة الشعار", "Logo preview")}
                width={96}
                height={96}
                unoptimized
                className="size-24 rounded-lg object-contain"
              />
            )}
            {(logo || (!removeLogo && initial?.has_logo) || imageError) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setLogo(null);
                  setPreview("");
                  setRemoveLogo(true);
                  setImageError("");
                }}
              >
                {c("إزالة الصورة", "Remove image")}
              </Button>
            )}
          </FormField>
          {state.error && (
            <Alert variant="destructive">
              <AlertDescription>
                {actionFeedback(state.error, locale)}
              </AlertDescription>
            </Alert>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" disabled={pending || busy || !!imageError}>
              {(pending || busy) && <Spinner />}
              {pending
                ? c("جاري الإرسال…", "Sending…")
                : c("إرسال الطلب", "Submit request")}
            </Button>
            <Button
              variant="ghost"
              render={<Link href="/applications?tab=organizations" />}
            >
              {c("إلغاء", "Cancel")}
            </Button>
          </div>
        </FieldGroup>
      </fieldset>
    </form>
  );
}
