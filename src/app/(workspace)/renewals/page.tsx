import { redirect } from "next/navigation";
import { legacyRenewalsHref } from "@/features/forms/my-requests-navigation";
import { localizedMetadata } from "@/lib/localized-metadata";

export async function generateMetadata() {
  return localizedMetadata("طلباتي", "My requests");
}

export default async function RenewalsPage({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const { page } = await searchParams;
  redirect(legacyRenewalsHref(page));
}
