"use client";

import { Tooltip,TooltipTrigger,TooltipContent } from "@/components/ui/tooltip";
import Link from "next/link";
import type { ReactNode } from "react";
import { FileSpreadsheet, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { HoursExportScope } from "./repository";
import type { Locale } from "@/lib/preferences";

export function HoursToolbarActions({ org, committee, term, exportScopes, locale, settingsAction, filtersAction, hasRecords, canAddHours,status,search }: {
  status?:string|null;
  search?:string;
  org: string;
  committee: string | null;
  term: string | null;
  exportScopes: HoursExportScope[];
  locale: Locale;
  settingsAction?: ReactNode;
  filtersAction?: ReactNode;
  hasRecords: boolean;
  canAddHours: boolean;
}) {
  const en = locale === "en";
  const c = (ar: string, english: string) => en ? english : ar;
  const canExportSelectedScope = exportScopes.some(scope => scope.id === committee);
  const exportQuery = new URLSearchParams();
  if (committee) exportQuery.set("committee", committee);
  if (term) exportQuery.set("term", term);
  if(status)exportQuery.set("status",status);
  if(search)exportQuery.set("q",search);
  const exportQueryString = exportQuery.toString();
  const exportHref = `/manage/organizations/${org}/hours/export${exportQueryString ? `?${exportQueryString}` : ""}`;

  return <div className="hours-toolbar-actions flex min-w-0 flex-wrap items-center gap-2">
    {hasRecords && canAddHours && <Link href={`/manage/organizations/${org}/members`} className={buttonVariants({ size: "sm" })}><Plus data-icon="inline-start" aria-hidden="true" />{c("إضافة ساعات", "Add hours")}</Link>}
    {hasRecords && canExportSelectedScope && <Tooltip><TooltipTrigger render={<Link href={exportHref} className={buttonVariants({ variant: "outline", size: "sm" })}/>}><FileSpreadsheet data-icon="inline-start" aria-hidden="true" />{c("تصدير CSV", "Export CSV")}</TooltipTrigger><TooltipContent>{c("تصدير النتائج بحسب الفلاتر الحالية","Export the currently filtered results")}</TooltipContent></Tooltip>}
    {filtersAction}
    {settingsAction}
  </div>;
}
