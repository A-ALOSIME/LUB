"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import type { Locale } from "@/lib/preferences";
import { claimProfileCompletionNotice } from "./completion-actions";
export function ProfileCompletionNotice({ locale }: { locale: Locale }) {
  const router = useRouter();
  useEffect(() => {
    let active = true;
    void claimProfileCompletionNotice().then((show) => {
      if (active && show)
        toast.add({
          title:
            locale === "en"
              ? "Complete your ID and major in account details."
              : "أكمل الهوية والتخصص من بيانات الحساب متى ما ناسبك.",
          timeout: 8000,
          actionProps: {
            children: locale === "en" ? "Account details" : "بيانات الحساب",
            onClick: () => router.push("/account"),
          },
        });
    });
    return () => {
      active = false;
    };
  }, [locale, router]);
  return null;
}
