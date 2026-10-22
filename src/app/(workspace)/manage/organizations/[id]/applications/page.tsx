import { redirect } from "next/navigation";
import { z } from "zod";
import { localizedMetadata } from "@/lib/localized-metadata";

export async function generateMetadata() {
  return localizedMetadata("الأعضاء", "Members");
}

export default async function LegacyApplicationsPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(id).success) redirect("/manage/organizations");

  const query = new URLSearchParams({ section: "applications" });
  for (const key of ["q", "status", "committee", "major", "level", "from", "to", "activity", "page", "application"]) {
    const raw = search[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value === "string" && value.length <= 120 && value) query.set(key, value);
  }
  redirect(`/manage/organizations/${id}/members?${query}`);
}
