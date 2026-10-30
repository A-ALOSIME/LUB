"use client";

import {t as translateUi} from "@/lib/i18n";
import {OrganizationLogo} from "@/components/organization-logo";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { Camera, LoaderCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/preferences";
import { useActionToast } from "@/components/action-toast";

export function OrganizationLogoEditor({ organizationId, organizationName, logoUrl, fallbackLogoUrl, locale }: {
  organizationId: string;
  organizationName: string;
  logoUrl: string;
  fallbackLogoUrl?: string;
  locale: Locale;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  useActionToast(useMemo(() => ({ error, success }), [error, success]), locale);
  const inputRef = useRef<HTMLInputElement>(null);
  const en = locale === "en";
  const currentLogo = logoUrl || fallbackLogoUrl;
  const customLogo = Boolean(logoUrl);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setSuccess("");
    setPending(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch(`/api/organizations/${organizationId}/logo`, { method: "POST", body: form, credentials: "same-origin", cache: "no-store" });
      if (!response.ok) {
        const result = await response.json().catch(() => undefined) as { error?: string } | undefined;
        throw new Error(result?.error ?? (response.status === 401 ? "unauthorized" : response.status === 403 ? "forbidden" : response.status === 413 ? "too-large" : "invalid-file"));
      }
      setSuccess(translateUi((en) ? "en" : "ar", "تم تحديث الشعار.", "Logo updated."));
      router.refresh();
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "invalid-file";
      setError(code === "unauthorized" ? translateUi((en) ? "en" : "ar", "سجّل الدخول من جديد لرفع الشعار.", "Sign in again to upload a logo.")
        : code === "forbidden" ? translateUi((en) ? "en" : "ar", "ما عندك صلاحية لتغيير الشعار.", "You do not have permission to change this logo.")
          : code === "too-large" ? translateUi((en) ? "en" : "ar", "حجم الشعار لازم يكون 2 ميجابايت أو أقل.", "The logo must be 2 MB or smaller.")
            : code === "invalid-file" ? translateUi((en) ? "en" : "ar", "استخدم شعار PNG أو SVG صالحًا، بحجم 2 ميجابايت أو أقل.", "Use a valid PNG or SVG logo (up to 2 MB).")
              : translateUi((en) ? "en" : "ar", "تعذّر حفظ الشعار. حاول مرة ثانية.", "The logo could not be saved. Try again."));
    } finally {
      setPending(false);
      event.target.value = "";
    }
  }

  async function resetLogo() {
    setPending(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`/api/organizations/${organizationId}/logo`, { method: "DELETE", credentials: "same-origin", cache: "no-store" });
      if (!response.ok) {
        const result = await response.json().catch(() => undefined) as { error?: string } | undefined;
        throw new Error(result?.error ?? (response.status === 401 ? "unauthorized" : response.status === 403 ? "forbidden" : "failed"));
      }
      setSuccess(translateUi((en) ? "en" : "ar", "تمت استعادة الشعار الافتراضي للجهة.", "Default organization logo restored."));
      router.refresh();
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "failed";
      setError(code === "unauthorized" ? translateUi((en) ? "en" : "ar", "سجّل الدخول من جديد لتغيير الشعار.", "Sign in again to change the logo.")
        : code === "forbidden" ? translateUi((en) ? "en" : "ar", "ما عندك صلاحية لتغيير الشعار.", "You do not have permission to change this logo.")
          : translateUi((en) ? "en" : "ar", "تعذّر استعادة الشعار الافتراضي.", "The logo could not be reset."));
    } finally { setPending(false); }
  }

  return <div className="organization-logo-editor">
    <div className={`organization-logo-preview${error ? " has-error" : ""}`}>
      <button type="button" className="organization-settings-logo" aria-label={translateUi((en) ? "en" : "ar", "تغيير شعار الجهة", "Change organization logo")} disabled={pending} onClick={() => inputRef.current?.click()}>
        <OrganizationLogo name={organizationName} src={currentLogo} className="size-full"/>
        <Camera aria-hidden="true" className="organization-logo-change-icon" />
      </button>
      <input ref={inputRef} id={`organization-logo-${organizationId}`} type="file" accept="image/png,image/svg+xml,.png,.svg" disabled={pending} className="sr-only" aria-label={translateUi((en) ? "en" : "ar", "اختيار شعار الجهة", "Choose an organization logo")} onChange={upload} />
      <p className="organization-logo-hint">{translateUi((en) ? "en" : "ar", "PNG أو SVG · بحد أقصى 2 ميجابايت", "PNG or SVG · up to 2 MB")}</p>
    </div>
    <div className="organization-logo-controls">
      {pending && <p role="status" className="organization-logo-status"><LoaderCircle aria-hidden="true" className="size-4 animate-spin" />{translateUi((en) ? "en" : "ar", "جارٍ حفظ الشعار…", "Saving logo…")}</p>}
      {error && <p role="alert" className="organization-logo-error">{error}</p>}
      {success && <p role="status" className="organization-logo-status">{success}</p>}
      {customLogo && <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={resetLogo} className="w-fit gap-1.5">
        <RotateCcw aria-hidden="true" />{translateUi((en) ? "en" : "ar", "استعادة الشعار الافتراضي", "Restore default logo")}
      </Button>}
    </div>
  </div>;
}
