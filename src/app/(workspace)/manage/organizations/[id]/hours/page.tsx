import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/features/auth/session";
import { hoursExportWorkspace, hoursWorkspace } from "@/features/hours/repository";
import { checkReadiness } from "@/features/hours/view";
import { HoursExportOnlyView } from "@/features/hours/hours-export-only-view";
import { getPreferences } from "@/lib/preferences";
import { localizedMetadata } from "@/lib/localized-metadata";

export async function generateMetadata() { return localizedMetadata("المهام والساعات", "Tasks and hours"); }

export default async function LegacyManageHoursPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; term?: string; committee?: string; memberPage?: string; rulePage?: string }>;
}) {
  const [{ id }, query, user, { locale }] = await Promise.all([params, searchParams, requireUser(), getPreferences()]);
  if (!z.uuid().safeParse(id).success) notFound();
  const number = (value?: string) => z.coerce.number().int().min(0).max(10000).catch(0).parse(value ?? "0");
  const uuid = (value?: string) => z.uuid().nullable().catch(null).parse(value ?? null);
  const term = uuid(query.term);
  const committee = uuid(query.committee);
  const workspace = await hoursWorkspace(user.id, id, {
    page: number(query.page),
    memberPage: number(query.memberPage),
    rulePage: number(query.rulePage),
    term,
    committee,
  });

  if (workspace) {
    checkReadiness(workspace.account);
    const target = new URLSearchParams({ section: "hours" });
    if (query.page) target.set("hoursPage", query.page);
    if (query.memberPage) target.set("memberPage", query.memberPage);
    if (query.rulePage) target.set("rulePage", query.rulePage);
    if (term) target.set("term", term);
    if (committee) target.set("committee", committee);
    redirect(`/manage/organizations/${id}/tasks?${target}`);
  }

  const exportData = await hoursExportWorkspace(user.id, id);
  if (!exportData) notFound();
  checkReadiness(exportData.account);
  return <HoursExportOnlyView data={exportData} org={id} term={term} committee={committee} locale={locale} />;
}