import Link from "next/link";
import { notFound } from "next/navigation";
import { localizedMetadata } from "@/lib/localized-metadata";
import { requireVerifiedProxyIdentity } from "@/features/auth/session";
import { isSuperAdminUser } from "@/features/auth/authorization";
import { MutationForm } from "@/features/organizations/mutation-form";
import { OrganizationTextFields } from "@/features/organizations/form-fields";
import { getPreferences } from "@/lib/preferences";

export async function generateMetadata() { return localizedMetadata("إضافة جهة", "Add organization"); }

export default async function NewOrganizationPage() {
  const [user, { locale }] = await Promise.all([requireVerifiedProxyIdentity(), getPreferences()]);
  if (!await isSuperAdminUser(user.id)) notFound();
  const en = locale === "en";

  return <div className="workspace-content">
    <header className="workspace-page-header">
      <div>
      <Link href="/manage/organizations" className="text-link text-sm">{en ? "Back to organizations" : "العودة إلى الجهات"}</Link>
      <p className="mt-5 workspace-eyebrow">{en ? "SYSTEM ADMINISTRATION" : "إدارة النظام"}</p>
      <h1 className="mt-2 text-3xl font-bold">{en ? "Add organization" : "إضافة جهة"}</h1>
      <p className="mt-3 leading-8 text-muted">{en ? "Create a club or student council. Its URL name stays fixed to preserve its history." : "أنشئ ناديًا أو مجلسًا طلابيًا. يبقى اسم الرابط ثابتًا لحفظ تاريخ الجهة."}</p>
      </div>
    </header>
    <section className="panel p-5 sm:p-8" aria-label={en ? "New organization details" : "بيانات الجهة الجديدة"}>
      <MutationForm operation="create-org" submitLabel={en ? "Create organization" : "إنشاء الجهة"} locale={locale}>
        <OrganizationTextFields prefix="create" locale={locale} />
        <div className="grid gap-5 sm:grid-cols-2">
          <div><label htmlFor="create-type">{en ? "Organization type" : "نوع الجهة"}</label><select id="create-type" name="typeCode"><option value="Club">{en ? "Club" : "نادي"}</option><option value="Council">{en ? "Council" : "مجلس"}</option></select></div>
          <div><label htmlFor="create-slug">{en ? "URL name" : "اسم الرابط"}</label><input id="create-slug" name="slug" dir="ltr" required maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*" aria-describedby="slug-help" /><p id="slug-help" className="mt-2 text-sm leading-7 text-muted">{en ? "Lowercase English letters and digits, such as tech-club." : "حروف إنجليزية صغيرة وأرقام، مثل tech-club."}</p></div>
        </div>
      </MutationForm>
    </section>
  </div>;
}
