"use client";
import {t as translateUi} from "@/lib/i18n";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import type { Locale } from "@/lib/preferences";
export function ProfileCompletionNotice({ locale }: { locale: Locale }) {
  const router = useRouter();
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    // A JSON response avoids rendering the current page again for a notice flag.
    void fetch("/api/account/completion-notice",{method:"POST",credentials:"same-origin",signal:controller.signal})
      .then(async response=>response.ok && (await response.json()).show === true)
      .catch(()=>false).then((show) => {
      if (active && show)
        toast.add({
          title:
            translateUi((locale === "en") ? "en" : "ar", "أكمل الهوية والتخصص من بيانات الحساب متى ما ناسبك.", "Complete your ID and major in account details."),
          timeout: 8000,
          actionProps: {
            children: translateUi((locale === "en") ? "en" : "ar", "بيانات الحساب", "Account details"),
            onClick: () => router.push("/account"),
          },
        });
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [locale, router]);
  return null;
}
