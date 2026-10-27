"use client";
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
      controller.abort();
    };
  }, [locale, router]);
  return null;
}
