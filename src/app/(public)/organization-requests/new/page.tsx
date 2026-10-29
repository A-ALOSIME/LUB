import {t as translateUi} from "@/lib/i18n";
import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getVerifiedUser } from "@/features/auth/session";
import { isSuperAdminUser } from "@/features/auth/authorization";
import { getPreferences } from "@/lib/preferences";
import { localizedMetadata } from "@/lib/localized-metadata";
import {
  openingRequests,
  ownOpeningRequest,
} from "@/features/organization-requests/repository";
import { OpeningRequestForm } from "@/features/organization-requests/request-form";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
export async function generateMetadata() {
  return localizedMetadata("طلب فتح نادي أو مجلس", "Request a club or council");
}
export default async function NewOrganizationRequest({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const [{ locale }, user, query] = await Promise.all([
    getPreferences(),
    getVerifiedUser(),
    searchParams,
  ]);
  if (!user) redirect("/login?next=%2Forganization-requests%2Fnew");
  if (await isSuperAdminUser(user.id)) redirect("/manage");
  const data = await openingRequests(user.id, true, "Pending"),
    source = z.uuid().safeParse(query.from),
    initial = source.success
      ? await ownOpeningRequest(user.id, source.data)
      : undefined;
  const en = locale === "en";
  return (
    <main
      id="main"
      dir={en ? "ltr" : "rtl"}
      className="mx-auto w-full max-w-3xl flex flex-col gap-6 px-5 py-10"
    >
      <Button variant="ghost" render={<Link href="/organizations" />}>
        {translateUi((en) ? "en" : "ar", "رجوع للأندية والمجالس", "Back to organizations")}
      </Button>
      <header>
        <h1 className="text-3xl">
          {translateUi((en) ? "en" : "ar", "طلب فتح نادي أو مجلس", "Request a club or council")}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {translateUi((en) ? "en" : "ar", "قدّم بيانات الجهة الأساسية للمراجعة، وتابع القرار في طلباتك.", "Submit the essentials for administrator review. Track the decision in My requests.")}
        </p>
      </header>
      {data.items.length ? (
        <Alert>
          <AlertDescription>
            {translateUi((en) ? "en" : "ar", "لديك طلب قيد المراجعة بالفعل.", "You already have a request under review.")}{" "}
            <Link href="/applications?tab=organizations">
              {translateUi((en) ? "en" : "ar", "متابعة الطلب", "View request")}
            </Link>
          </AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardContent>
            <OpeningRequestForm
              locale={locale}
              initial={
                initial &&
                ["Rejected", "Withdrawn"].includes(initial.status_code)
                  ? initial
                  : undefined
              }
            />
          </CardContent>
        </Card>
      )}
    </main>
  );
}
