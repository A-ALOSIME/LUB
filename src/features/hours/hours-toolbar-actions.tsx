"use client";

import {createTranslator} from "@/lib/i18n";
import {ExportButton} from "@/components/export-button";
import type { HoursExportScope } from "./repository";
import type { Locale } from "@/lib/preferences";

export function HoursToolbarActions({ org, committee, term, exportScopes, locale, hasRecords, canAddHours,status,search }: {
  status?:string|null;
  search?:string;
  org: string;
  committee: string | null;
  term: string | null;
  exportScopes: HoursExportScope[];
  locale: Locale;
  hasRecords: boolean;
  canAddHours: boolean;
}) {
  void canAddHours; const c = createTranslator(locale);
  const canExportSelectedScope = exportScopes.some(scope => scope.id === committee);
  const exportQuery = new URLSearchParams();
  if (committee) exportQuery.set("committee", committee);
  if (term) exportQuery.set("term", term);
  if(status)exportQuery.set("status",status);
  if(search)exportQuery.set("q",search);
  const exportQueryString = exportQuery.toString();
  const exportHref = `/manage/organizations/${org}/hours/export${exportQueryString ? `?${exportQueryString}` : ""}`;

  return <div className="hours-toolbar-actions flex min-w-0 flex-wrap items-center gap-2">
    {hasRecords&&canExportSelectedScope&&<ExportButton href={exportHref} hint={c("تصدير النتائج حسب الفلاتر الحالية","Export the current filtered results")}/>}

  </div>;
}
