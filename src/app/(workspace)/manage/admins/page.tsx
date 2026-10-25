import { notFound } from "next/navigation";
import { localizedMetadata } from "@/lib/localized-metadata";
import { requireVerifiedProxyIdentity } from "@/features/auth/session";
import { getSuperAdmins } from "@/features/organizations/management-repository";
import { MutationForm } from "@/features/organizations/mutation-form";
import { getPreferences } from "@/lib/preferences";
import { FormField } from "@/components/form-field";

export async function generateMetadata() { return localizedMetadata("المشرفون العامون", "System administrators"); }

export default async function AdminsPage() {
  const [user, { locale }] = await Promise.all([requireVerifiedProxyIdentity(), getPreferences()]);
  const admins = await getSuperAdmins(user.id).catch(error => {
    if (error instanceof Error && error.message === "FORBIDDEN") notFound();
    throw error;
  });
  const en = locale === "en";

  return <div className="workspace-content">
    <header className="workspace-page-header">
      <div>
        <h1>{en ? "System administrators" : "المشرفون العامون"}</h1>
      </div>
    </header>

    <div className="grid items-start gap-5 xl:grid-cols-2">
      <section className="panel min-w-0 p-5 sm:p-6" aria-labelledby="admins-list-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="admins-list-title" className="text-xl font-semibold">{en ? "Current administrators" : "المشرفون الحاليون"}</h2>
          <span className="rounded-full border border-line px-3 py-1 text-sm text-muted">{admins.length}</span>
        </div>
        <ul className="mt-5 divide-y divide-line">{admins.map(admin => <li key={admin.userId} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
          <p className="min-w-0 font-medium"><bdi>{admin.fullName}</bdi>{admin.userId === user.id && <span className="ms-2 text-sm text-muted">{en ? "(you)" : "(أنت)"}</span>}</p>
          {admins.length > 1 && <details className="shrink-0">
            <summary className="cursor-pointer rounded-lg border border-line px-3 py-2 text-sm font-medium text-muted hover:bg-mist">{en ? "End permission" : "إنهاء الصلاحية"}</summary>
            <div className="mt-3 min-w-60 rounded-lg bg-mist p-4">
              <MutationForm operation="end-admin" fields={{ targetUserId: admin.userId }} submitLabel={en ? "End administrator permission" : "إنهاء صلاحية المشرف"} confirmLabel={en ? "I confirm ending this administrator's permission" : "أؤكد إنهاء صلاحية هذا المشرف العام"} locale={locale} />
            </div>
          </details>}
        </li>)}</ul>
      </section>

      <section className="panel min-w-0 p-5 sm:p-6" aria-labelledby="grant-admin-title">
        <h2 id="grant-admin-title" className="text-xl font-semibold">{en ? "Add system administrator" : "إضافة مشرف عام"}</h2>
        <MutationForm operation="grant-admin" submitLabel={en ? "Grant system administrator access" : "منح صلاحية المشرف العام"} confirmLabel={en ? "I confirm granting this account system management access" : "أؤكد منح هذا الحساب صلاحية إدارة النظام"} locale={locale}>
          <FormField  id="admin-email" label={<>{en ? "Verified, onboarded account email" : "بريد الحساب المتحقق والمكتمل"}</>}><input id="admin-email" name="email" type="email" dir="ltr" required maxLength={254} autoComplete="off" /></FormField>
        </MutationForm>
      </section>
    </div>
  </div>;
}
