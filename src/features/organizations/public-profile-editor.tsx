"use client";

import Image from "next/image";
import { useId, useMemo, useRef, useState, type ChangeEvent } from "react";
import { CalendarDays, ImagePlus, LoaderCircle, UsersRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ListEntryInput } from "@/components/list-entry-input";
import { useActionToast } from "@/components/action-toast";
import type { Locale } from "@/lib/preferences";
import { useProfileFormState } from "./profile-form-state";
import { normalizeOrganizationPublicProfileContent, type OrganizationPublicProfileContent } from "./organization-public-profile";

type FieldKey = Exclude<keyof OrganizationPublicProfileContent, "partnersImageUrl" | "annualEventCount" | "participatingStudentCount">;

const textFields: Array<{ key: FieldKey; label: string; rows: number; placeholder: { ar: string; en: string } }> = [
  { key: "vision", label: "رؤيتنا", rows: 2, placeholder: { ar: "مثال: مجتمع طلابي يصنع أثراً", en: "Example: A student community that makes an impact" } },
  { key: "values", label: "قيمنا", rows: 3, placeholder: { ar: "مثال: التعاون، الابتكار، المسؤولية", en: "Example: Collaboration, innovation, responsibility" } },
  { key: "offerings", label: "ماذا نقدم؟", rows: 3, placeholder: { ar: "مثال: ورش تدريبية وإرشاد مهني", en: "Example: Workshops and career guidance" } },
  { key: "goals", label: "أهداف النادي/المجلس", rows: 3, placeholder: { ar: "مثال: بناء مهارات الطلاب التقنية", en: "Example: Growing students' technical skills" } },
  { key: "fields", label: "المجالات", rows: 3, placeholder: { ar: "مثال: الأمن السيبراني، الذكاء الاصطناعي", en: "Example: Cybersecurity, artificial intelligence" } },
  { key: "programs", label: "البرامج", rows: 3, placeholder: { ar: "مثال: برنامج تأهيل القيادات", en: "Example: Leadership development program" } },
  { key: "achievements", label: "إنجازات النادي/المجلس", rows: 3, placeholder: { ar: "مثال: تنظيم هاكاثون جامعي", en: "Example: Hosted a university hackathon" } },
  { key: "partners", label: "الشركاء", rows: 3, placeholder: { ar: "مثال: عمادة شؤون الطلاب وشركات التقنية", en: "Example: Student affairs and technology companies" } },
];

function normalizeDigits(value: string) {
  return value.replace(/[^\d٠-٩]/g, "").replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x0660));
}

function readSerialized(value: string | undefined, fallback?: unknown) {
  if (value) {
    try { return normalizeOrganizationPublicProfileContent(JSON.parse(value) as unknown); }
    catch { /* use the last saved value */ }
  }
  return normalizeOrganizationPublicProfileContent(fallback);
}

export function OrganizationPublicProfileEditor({ organizationId, locale, initialValue }: { organizationId: string; locale: Locale; initialValue?: unknown }) {
  const { resetKey, resetValues } = useProfileFormState();
  const value = Object.hasOwn(resetValues, "publicProfileContent")
    ? readSerialized(resetValues.publicProfileContent, initialValue)
    : readSerialized(undefined, initialValue);
  return <OrganizationPublicProfileEditorState key={resetKey} organizationId={organizationId} locale={locale} initialValue={value} />;
}

function OrganizationPublicProfileEditorState({ organizationId, locale, initialValue }: { organizationId: string; locale: Locale; initialValue: OrganizationPublicProfileContent }) {
  const en = locale === "en";
  const { markChanged } = useProfileFormState();
  const [content, setContent] = useState(initialValue);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useActionToast(useMemo(() => ({ error }), [error]), locale);
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);

  function update(key: keyof OrganizationPublicProfileContent, value: string) {
    setContent(current => ({ ...current, [key]: value }));
    markChanged();
  }

  async function uploadPartnerImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setPending(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch(`/api/organizations/${organizationId}/partner-image`, { method: "POST", body, credentials: "same-origin", cache: "no-store" });
      const result = await response.json().catch(() => undefined) as { url?: string; error?: string } | undefined;
      if (!response.ok || !result?.url) throw new Error(result?.error ?? "upload-failed");
      update("partnersImageUrl", result.url);
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "upload-failed";
      setError(code === "too-large" ? (en ? "Image must be 2 MB or smaller." : "حجم الصورة لازم يكون 2 ميجابايت أو أقل.")
        : code === "invalid-file" ? (en ? "Use a valid PNG or SVG image." : "استخدم صورة PNG أو SVG صالحة.")
          : en ? "Image upload failed. Try again." : "تعذّر رفع الصورة. حاول مرة ثانية.");
    } finally {
      setPending(false);
      event.target.value = "";
    }
  }

  return <div className="organization-public-profile-editor full">
    <input type="hidden" name="publicProfileContent" value={JSON.stringify(content)} readOnly />
    <Card className="organization-settings-card organization-public-profile-vision-card" aria-labelledby={`${inputId}-vision-title`}>
      <CardHeader className="organization-settings-card-header">
        <h2 id={`${inputId}-vision-title`} className="organization-settings-section-title">{en ? "Vision and values" : "الرؤية والقيم"}</h2>
      </CardHeader>
      <CardContent className="organization-settings-card-content">
        <div className="organization-public-profile-fields">
          {textFields.slice(0, 2).map(field => <div className="organization-settings-field" key={field.key}>
            <FieldLabel htmlFor={`${inputId}-${field.key}`}>{en ? (field.key === "vision" ? "Our vision" : "Our values") : field.label}</FieldLabel>
            <Textarea id={`${inputId}-${field.key}`} dir={en ? "ltr" : "rtl"} rows={field.rows} maxLength={field.key === "values" ? 4000 : 3000} placeholder={field.placeholder[en ? "en" : "ar"]} value={content[field.key] ?? ""} onChange={event => update(field.key, event.target.value)} />
          </div>)}
        </div>
      </CardContent>
    </Card>
    <Card className="organization-settings-card" aria-labelledby={`${inputId}-stats-title`}>
      <CardHeader className="organization-settings-card-header">
        <h2 id={`${inputId}-stats-title`} className="organization-settings-section-title">{en ? "Organization statistics" : "إحصائيات الجهة"}</h2>
        <p className="text-sm text-muted-foreground">{en ? "Enter figures from your organization's annual records. These are displayed on the public profile and are not calculated by LUB." : "أدخل الأرقام من سجلات الجهة السنوية. تظهر في الملف العام، ولا يحسبها لُبّ تلقائيًا."}</p>
      </CardHeader>
      <CardContent className="organization-settings-card-content">
        <div className="organization-public-profile-stats">
          <div className="organization-public-profile-stat">
            <FieldLabel htmlFor={`${inputId}-annual-events`} className="organization-public-profile-stat-label">
              <CalendarDays aria-hidden="true" />{en ? "Events per year" : "فعالية سنوية"}
            </FieldLabel>
            <Input id={`${inputId}-annual-events`} dir={en ? "ltr" : "rtl"} inputMode="numeric" maxLength={5} placeholder="0" value={content.annualEventCount ?? ""} onChange={event => update("annualEventCount", normalizeDigits(event.target.value).slice(0, 5))} />
          </div>
          <div className="organization-public-profile-stat">
            <FieldLabel htmlFor={`${inputId}-participants`} className="organization-public-profile-stat-label">
              <UsersRound aria-hidden="true" />{en ? "Participating students" : "طالب مشارك"}
            </FieldLabel>
            <Input id={`${inputId}-participants`} dir={en ? "ltr" : "rtl"} inputMode="numeric" maxLength={6} placeholder="0" value={content.participatingStudentCount ?? ""} onChange={event => update("participatingStudentCount", normalizeDigits(event.target.value).slice(0, 6))} />
          </div>
        </div>
      </CardContent>
    </Card>
    <Card className="organization-settings-card" aria-labelledby={`${inputId}-programs-title`}>
      <CardHeader className="organization-settings-card-header">
        <h2 id={`${inputId}-programs-title`} className="organization-settings-section-title">{en ? "Programs, goals, and achievements" : "البرامج والأهداف والإنجازات"}</h2>
      </CardHeader>
      <CardContent className="organization-settings-card-content">
        <div className="organization-public-profile-fields">
          {textFields.slice(2).map(field => <div className="organization-settings-field" key={field.key}>
            <FieldLabel htmlFor={`${inputId}-${field.key}`}>{en ? ({ offerings: "What we offer", goals: "Goals", fields: "Fields", programs: "Programs", achievements: "Achievements", partners: "Partners" } as Record<string, string>)[field.key] : field.label}</FieldLabel>
            {field.key === "offerings" ? <Textarea id={`${inputId}-${field.key}`} dir={en ? "ltr" : "rtl"} rows={field.rows} maxLength={5000} placeholder={field.placeholder[en ? "en" : "ar"]} value={content[field.key] ?? ""} onChange={event => update(field.key, event.target.value)} />
              : <ListEntryInput id={`${inputId}-${field.key}`} label={en ? field.key : field.label} locale={locale} placeholder={field.placeholder[en ? "en" : "ar"]} value={content[field.key] ?? ""} onChange={value => update(field.key, value)} />}
          </div>)}
          <div className="organization-settings-field full organization-partner-image-field">
            <FieldLabel htmlFor={`${inputId}-partner-image`}>{en ? "Partners image" : "صورة الشركاء"}</FieldLabel>
            <input ref={fileRef} id={`${inputId}-partner-image`} type="file" accept="image/png,image/svg+xml,.png,.svg" className="sr-only" aria-label={en ? "Upload partners image" : "إرفاق صورة الشركاء"} onChange={uploadPartnerImage} />
            {content.partnersImageUrl ? <div className="organization-partner-image-preview">
              <Image src={content.partnersImageUrl} alt={en ? "Partners" : "الشركاء"} width={520} height={300} unoptimized className="h-full w-full rounded-lg object-cover" />
              <Button type="button" variant="secondary" size="icon-sm" aria-label={en ? "Remove partners image" : "إزالة صورة الشركاء"} onClick={() => update("partnersImageUrl", "")}><X aria-hidden="true" /></Button>
            </div> : <Button type="button" variant="outline" size="sm" className="w-fit" disabled={pending} onClick={() => fileRef.current?.click()}>
              {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <ImagePlus aria-hidden="true" />}
              {pending ? (en ? "Uploading…" : "جارٍ الرفع…") : (en ? "Attach image" : "إرفاق صورة")}
            </Button>}
            <p className="text-xs text-muted-foreground">{en ? "PNG or SVG · up to 2 MB" : "PNG أو SVG · بحد أقصى 2 ميجابايت"}</p>
            {error && <p role="alert" className="organization-contact-error">{error}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  </div>;
}
