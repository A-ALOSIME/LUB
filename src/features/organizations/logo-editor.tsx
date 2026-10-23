"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { Camera, LoaderCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/preferences";
import { useActionToast } from "@/components/action-toast";

const logoBucketUrl = "/storage/v1/object/public/lub-organization-logos/organizations/";

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
  const customLogo = logoUrl.includes(logoBucketUrl);

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
      setSuccess(en ? "Logo updated." : "تم تحديث الشعار.");
      router.refresh();
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "invalid-file";
      setError(code === "unauthorized" ? en ? "Sign in again to upload a logo." : "سجّل الدخول من جديد لرفع الشعار."
        : code === "forbidden" ? en ? "You do not have permission to change this logo." : "ما عندك صلاحية لتغيير الشعار."
          : code === "too-large" ? en ? "The logo must be 2 MB or smaller." : "حجم الشعار لازم يكون 2 ميجابايت أو أقل."
            : code === "invalid-file" ? en ? "Use a valid PNG or SVG logo (up to 2 MB)." : "استخدم شعار PNG أو SVG صالحًا، بحجم 2 ميجابايت أو أقل."
              : en ? "The logo could not be saved. Try again." : "تعذّر حفظ الشعار. حاول مرة ثانية.");
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
      setSuccess(en ? "Default organization logo restored." : "تمت استعادة الشعار الافتراضي للجهة.");
      router.refresh();
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "failed";
      setError(code === "unauthorized" ? en ? "Sign in again to change the logo." : "سجّل الدخول من جديد لتغيير الشعار."
        : code === "forbidden" ? en ? "You do not have permission to change this logo." : "ما عندك صلاحية لتغيير الشعار."
          : en ? "The logo could not be reset." : "تعذّر استعادة الشعار الافتراضي.");
    } finally { setPending(false); }
  }

  return <div className="organization-logo-editor">
    <div className={`organization-logo-preview${error ? " has-error" : ""}`}>
      <button type="button" className="organization-settings-logo" aria-label={en ? "Change organization logo" : "تغيير شعار الجهة"} disabled={pending} onClick={() => inputRef.current?.click()}>
        {currentLogo ? <Image src={currentLogo} alt="" width={88} height={88} unoptimized className="h-full w-full object-contain" /> : <span aria-hidden="true">{organizationName.trim().slice(0, 1) || "ج"}</span>}
        <Camera aria-hidden="true" className="organization-logo-change-icon" />
      </button>
      <input ref={inputRef} id={`organization-logo-${organizationId}`} type="file" accept="image/png,image/svg+xml,.png,.svg" disabled={pending} className="sr-only" aria-label={en ? "Choose an organization logo" : "اختيار شعار الجهة"} onChange={upload} />
      <p className="organization-logo-hint">{en ? "PNG or SVG · up to 2 MB" : "PNG أو SVG · بحد أقصى 2 ميجابايت"}</p>
    </div>
    <div className="organization-logo-controls">
      {pending && <p role="status" className="organization-logo-status"><LoaderCircle aria-hidden="true" className="size-4 animate-spin" />{en ? "Saving logo…" : "جارٍ حفظ الشعار…"}</p>}
      {error && <p role="alert" className="organization-logo-error">{error}</p>}
      {success && <p role="status" className="organization-logo-status">{success}</p>}
      {customLogo && <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={resetLogo} className="w-fit gap-1.5">
        <RotateCcw aria-hidden="true" />{en ? "Restore default logo" : "استعادة الشعار الافتراضي"}
      </Button>}
    </div>
  </div>;
}
