"use client";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { organizationSlugAvailability } from "./admin-organization-actions";
import type { Locale } from "@/lib/preferences";
export function OrganizationSlugField({
  value,
  onChange,
  organizationId,
  locale,
}: {
  value: string;
  onChange: (value: string) => void;
  organizationId?: string;
  locale: Locale;
}) {
  const en = locale === "en",
    [state, setState] = useState<
      "empty" | "checking" | "available" | "unavailable" | "error"
    >("empty");
  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      if (!value) {
        setState("empty");
        return;
      }
      setState("checking");
      organizationSlugAvailability(value, organizationId)
        .then((result) => {
          if (current) setState(result.available ? "available" : "unavailable");
        })
        .catch(() => {
          if (current) setState("error");
        });
    }, 300);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [value, organizationId]);
  return (
    <FormField
      label={en ? "URL name" : "اسم الرابط"}
      required
      hint={
        <span className="flex flex-col gap-1">
          <span>
            {en
              ? "Used in the public page address."
              : "يظهر في رابط الصفحة العامة."}
          </span>
          <bdi dir="ltr" className="break-all">
            https://lub.community/organizations/{value || "…"}
          </bdi>
          <span role="status" className="inline-flex items-center gap-1">
            {state === "checking" ? (
              <>
                <Spinner className="size-3" />
                {en ? "Checking…" : "جاري التحقق…"}
              </>
            ) : state === "available" ? (
              <>
                <Check className="size-3" />
                {en ? "Available" : "متاح"}
              </>
            ) : state === "unavailable" ? (
              en ? (
                "Unavailable or invalid URL name"
              ) : (
                "اسم الرابط غير متاح أو صيغته غير صالحة"
              )
            ) : state === "error" ? (
              en ? (
                "Could not check availability."
              ) : (
                "تعذّر التحقق من التوفر."
              )
            ) : (
              " "
            )}
          </span>
        </span>
      }
      error={
        state === "unavailable"
          ? en
            ? "Choose another valid URL name."
            : "اختر اسم رابط آخر بصيغة صحيحة."
          : undefined
      }
    >
      <Input
        name="slug"
        dir="ltr"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={80}
        pattern="[a-z0-9]+(-[a-z0-9]+)*"
        required
      />
    </FormField>
  );
}
