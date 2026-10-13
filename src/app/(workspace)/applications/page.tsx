import { localizedMetadata } from "@/lib/localized-metadata";
import Link from "next/link";
import { requireStudentUser as requireUser } from "@/features/auth/authorization";
import { listApplications } from "@/features/forms/repository";
import { ApplicationList } from "@/features/forms/application-list";
import { previewApplications } from "@/features/forms/application-preview";
import { getPreferences } from "@/lib/preferences";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

export async function generateMetadata() {
  return localizedMetadata("طلباتي", "My applications");
}

export default async function Applications({ searchParams }: { searchParams: Promise<{ page?: string; preview?: string }> }) {
  const [user, { locale }] = await Promise.all([requireUser(), getPreferences()]);
  const en = locale === "en";
  const { page: input, preview: previewInput } = await searchParams;
  const preview = previewInput === "1";
  const page = Math.min(1000, Math.max(1, Math.floor(Number(input) || 1)));
  const rows = preview ? previewApplications : await listApplications(user.id, undefined, { page, q: "", status: "", committee: "", major: "", level: "", from: "", to: "", lookup: "" });
  const visibleRows = rows.slice(0, 25);
  const followUpCount = visibleRows.filter(application => ["Submitted", "Interview"].includes(application.status_code)).length;
  const reapplyCount = visibleRows.filter(application => application.status_code === "Withdrawn" && application.round_open && !application.has_active_application && !application.has_newer_application).length;

  return <main id="main" dir={en ? "ltr" : "rtl"} className="min-w-0 space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{en ? "My applications" : "طلبات الانضمام"}</h1>
        <p className="text-sm text-muted-foreground">{en ? "Track each application, withdraw when the round allows it, and reapply after withdrawal while registration is open." : "تابع طلباتك، واسحبها إذا كان السحب متاحًا، وأعد التقديم بعد السحب ما دام التسجيل مفتوحًا."}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {preview
          ? <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/applications">{en ? "Back to my applications" : "العودة إلى طلباتي"}</Link>
          : <>
            <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/applications?preview=1">{en ? "Preview sample" : "معاينة شكل القائمة"}</Link>
            <Link className={buttonVariants({ size: "sm" })} href="/organizations">{en ? "Explore organizations" : "استكشف الجهات"}</Link>
          </>}
      </div>
    </header>

    <div className="flex flex-wrap gap-2" aria-label={en ? "Application summary" : "ملخص الطلبات"}>
      <Badge variant="outline" className="h-7 px-2.5">{en ? `${visibleRows.length} on this page` : `${visibleRows.length} طلبات في الصفحة`}</Badge>
      <Badge variant="secondary" className="h-7 px-2.5">{en ? `${followUpCount} in progress` : `${followUpCount} قيد المتابعة`}</Badge>
      <Badge variant="outline" className="h-7 px-2.5">{en ? `${reapplyCount} can reapply` : `${reapplyCount} يمكن إعادة تقديمها`}</Badge>
    </div>

    <ApplicationList rows={visibleRows} locale={locale} preview={preview} />

    {!preview && <nav aria-label={en ? "Application pages" : "صفحات الطلبات"} className="flex gap-2">
      {page > 1 && <Link href={`?page=${page - 1}`} className={buttonVariants({ variant: "outline", size: "sm" })}>{en ? "Previous" : "السابق"}</Link>}
      {rows.length > 25 && <Link href={`?page=${page + 1}`} className={buttonVariants({ variant: "outline", size: "sm" })}>{en ? "Next" : "التالي"}</Link>}
    </nav>}
  </main>;
}
