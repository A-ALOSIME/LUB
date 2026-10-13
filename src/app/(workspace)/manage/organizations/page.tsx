import Link from "next/link";
import { notFound } from "next/navigation";
import { localizedMetadata } from "@/lib/localized-metadata";
import { getAdminOrganizations } from "@/features/organizations/management-repository";
import { MutationForm } from "@/features/organizations/mutation-form";
import { organizationStatuses, organizationTypes } from "@/features/organizations/validation";
import { requireVerifiedProxyIdentity } from "@/features/auth/session";
import { getPreferences } from "@/lib/preferences";

export async function generateMetadata() { return localizedMetadata("إدارة الجهات", "Organizations"); }

export default async function AdminOrganizationsPage() {
  const [user, { locale }] = await Promise.all([requireVerifiedProxyIdentity(), getPreferences()]);
  const en = locale === "en";
  const access = await getAdminOrganizations(user.id);
  if (!access.allowed) notFound();
  const organizations = access.organizations;
  const activeCount = organizations.filter(organization => organization.statusCode === "Active").length;
  const archivedCount = organizations.filter(organization => organization.statusCode === "Archived").length;

  return <div className="workspace-content">
    <header className="workspace-page-header">
      <div>
        <p className="workspace-eyebrow">{en ? "SYSTEM ADMINISTRATION" : "إدارة النظام"}</p>
        <h1 className="mt-2 text-3xl font-bold">{en ? "Organizations" : "الجهات"}</h1>
        <p className="mt-3 leading-8 text-muted">{en ? `${activeCount} active · ${archivedCount} archived` : `${activeCount} نشطة · ${archivedCount} مؤرشفة`}</p>
      </div>
      <Link href="/manage/organizations/new" prefetch={false} className="button">{en ? "Add organization" : "إضافة جهة"}</Link>
    </header>

    {organizations.length ? <ul className="grid gap-4 xl:grid-cols-2">{organizations.map(organization => <li key={organization.id} className="panel min-w-0 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 dir="auto" className="text-lg font-semibold leading-8">{organization.nameAr}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>{en ? organization.typeCode : organizationTypes[organization.typeCode as keyof typeof organizationTypes]}</span>
            <span aria-hidden="true">·</span>
            <span>{en ? organization.statusCode : organizationStatuses[organization.statusCode as keyof typeof organizationStatuses]}</span>
          </div>
        </div>
        <Link href={`/organizations/${organization.slug}`} prefetch={false} className="text-link shrink-0 text-sm">{en ? "Public page" : "الصفحة العامة"}</Link>
      </div>

      {organization.statusCode === "Active" && <details className="mt-5 rounded-lg border border-line p-4">
        <summary className="cursor-pointer font-medium">{en ? "Appoint or replace the primary leader" : "تعيين أو استبدال القائد الأساسي"}</summary>
        <div className="mt-5">
          <p className="mb-4 text-sm leading-7 text-muted">{en ? "The account must be verified and onboarded. Replacing a leader ends the previous role while preserving its history and membership." : "يجب أن يكون الحساب متحققًا ومكتمل البيانات. الاستبدال ينهي الدور السابق ويحفظ تاريخه وعضويته."}</p>
          <MutationForm operation="appoint-leader" fields={{ organizationId: organization.id }} submitLabel={en ? "Appoint leader" : "تعيين القائد"} confirmLabel={en ? "I confirm appointing this account as primary leader" : "أؤكد تعيين هذا الحساب قائدًا أساسيًا"} locale={locale}>
            <div><label htmlFor={`leader-${organization.id}`}>{en ? "Leader email" : "بريد القائد"}</label><input id={`leader-${organization.id}`} name="email" type="email" dir="ltr" required maxLength={254} autoComplete="off" /></div>
          </MutationForm>
        </div>
      </details>}

      <details className="mt-3 rounded-lg border border-line p-4">
        <summary className="cursor-pointer font-medium">{en ? "Change organization status" : "تغيير حالة الجهة"}</summary>
        <div className="mt-5">
          <p className="mb-4 text-sm leading-7 text-muted">{en ? "Archiving stops operations while preserving the public page and historical records." : "الأرشفة توقف العمليات وتحتفظ بالصفحة العامة والسجلات التاريخية."}</p>
          <MutationForm operation="org-status" fields={{ organizationId: organization.id }} submitLabel={en ? "Update status" : "تحديث الحالة"} confirmLabel={en ? "I confirm changing this organization's status" : "أؤكد تغيير حالة الجهة"} locale={locale}>
            <div><label htmlFor={`status-${organization.id}`}>{en ? "Status" : "الحالة"}</label><select id={`status-${organization.id}`} name="status" defaultValue={organization.statusCode}>{Object.entries(organizationStatuses).map(([code, label]) => <option key={code} value={code}>{en ? code : label}</option>)}</select></div>
          </MutationForm>
        </div>
      </details>
    </li>)}</ul> : <div className="panel p-8 text-center">
      <h2 className="text-lg font-semibold">{en ? "No organizations yet" : "لا توجد جهات بعد"}</h2>
      <p className="mt-2 leading-7 text-muted">{en ? "Create the first club or council to get started." : "أنشئ أول نادٍ أو مجلس لبدء العمل."}</p>
      <Link href="/manage/organizations/new" prefetch={false} className="button mt-5">{en ? "Add organization" : "إضافة جهة"}</Link>
    </div>}
  </div>;
}
