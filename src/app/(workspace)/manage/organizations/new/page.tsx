import {t as translateUi} from "@/lib/i18n";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { localizedMetadata } from "@/lib/localized-metadata";
import { getPreferences } from "@/lib/preferences";
import { requireVerifiedProxyIdentity } from "@/features/auth/session";
import { isSuperAdminUser } from "@/features/auth/authorization";
import { CreateOrganizationForm } from "@/features/organizations/create-organization-form";
export async function generateMetadata() {
  return localizedMetadata("إضافة جهة", "Add organization");
}
export default async function NewOrganizationPage() {
  const [user, { locale }] = await Promise.all([
    requireVerifiedProxyIdentity(),
    getPreferences(),
  ]);
  if (!(await isSuperAdminUser(user.id))) notFound();
  const en = locale === "en";
  return (
    <main id="main" className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Button
        variant="ghost"
        className="self-start"
        nativeButton={false}
        render={<Link href="/manage/organizations" />}
      >
        {translateUi((en) ? "en" : "ar", "رجوع للجهات", "Back to organizations")}
      </Button>
      <header className="workspace-page-header">
        <h1>{translateUi((en) ? "en" : "ar", "إضافة جهة", "Add organization")}</h1>
      </header>
      <Card>
        <CardContent>
          <CreateOrganizationForm locale={locale} />
        </CardContent>
      </Card>
    </main>
  );
}
