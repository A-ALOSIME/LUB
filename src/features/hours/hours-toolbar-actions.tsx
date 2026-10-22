"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { FileSpreadsheet, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { HoursExportScope } from "./repository";
import type { Locale } from "@/lib/preferences";

export function HoursToolbarActions({ org, committee, term, exportScopes, locale, settingsAction, hasRecords, canAddHours }: {
  org: string;
  committee: string | null;
  term: string | null;
  exportScopes: HoursExportScope[];
  locale: Locale;
  settingsAction?: ReactNode;
  hasRecords: boolean;
  canAddHours: boolean;
}) {
  const en = locale === "en";
  const c = (ar: string, english: string) => en ? english : ar;
  const canExportSelectedScope = exportScopes.some(scope => scope.id === committee);
  const exportQuery = new URLSearchParams();
  if (committee) exportQuery.set("committee", committee);
  if (term) exportQuery.set("term", term);
  const exportQueryString = exportQuery.toString();
  const exportHref = `/manage/organizations/${org}/hours/export${exportQueryString ? `?${exportQueryString}` : ""}`;

  return <div className="hours-toolbar-actions flex min-w-0 flex-wrap items-center gap-2">
    {hasRecords && canAddHours && <Link href={`/manage/organizations/${org}/members`} className={buttonVariants({ size: "sm" })}><Plus data-icon="inline-start" aria-hidden="true" />{c("إضافة ساعات", "Add hours")}</Link>}
    {hasRecords && canExportSelectedScope && <Link href={exportHref} className={buttonVariants({ variant: "outline", size: "sm" })}><FileSpreadsheet data-icon="inline-start" aria-hidden="true" />{c("تصدير CSV", "Export CSV")}</Link>}
    {settingsAction}
  </div>;
}
