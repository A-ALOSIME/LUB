"use client";
import {t as translateUi} from "@/lib/i18n";
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
      label={translateUi((en) ? "en" : "ar", "اسم الرابط", "URL name")}
      required
      hint={
        <span className="flex flex-col gap-1">
          <span>
            {translateUi((en) ? "en" : "ar", "يظهر في رابط الصفحة العامة.", "Used in the public page address.")}
          </span>
          <bdi dir="ltr" className="break-all">
            https://lub.community/organizations/{value || "…"}
          </bdi>
          <span role="status" className="inline-flex items-center gap-1">
            {state === "checking" ? (
              <>
                <Spinner className="size-3" />
                {translateUi((en) ? "en" : "ar", "جاري التحقق…", "Checking…")}
              </>
            ) : state === "available" ? (
              <>
                <Check className="size-3" />
                {translateUi((en) ? "en" : "ar", "متاح", "Available")}
              </>
            ) : state === "unavailable" ? (
              translateUi((en) ? "en" : "ar", (
                "اسم الرابط غير متاح أو صيغته غير صالحة"
              ), (
                "Unavailable or invalid URL name"
              ))
            ) : state === "error" ? (
              translateUi((en) ? "en" : "ar", (
                "تعذّر التحقق من التوفر."
              ), (
                "Could not check availability."
              ))
            ) : (
              " "
            )}
          </span>
        </span>
      }
      error={
        state === "unavailable"
          ? translateUi((en) ? "en" : "ar", "اختر اسم رابط آخر بصيغة صحيحة.", "Choose another valid URL name.")
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
