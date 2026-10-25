"use client";

import Link from "next/link";
import { useState } from "react";
import { Files, Eye, Pencil } from "lucide-react";
import { RowAction } from "@/components/row-action";
import { relativeDate } from "@/lib/relative-date";
import { ManagementActionSheet } from "@/components/management-action-sheet";
import { WorkflowForm } from "@/features/forms/mutation-form";
import { OrganizationStatusBadge } from "@/features/organizations/organization-status-badge";
import type { Locale } from "@/lib/preferences";
import type { Template } from "./repository";

function formatVersionCount(value: number, locale: Locale) {
  if (locale === "en") return `${value} ${value === 1 ? "version" : "versions"}`;
  if (value === 1) return "نسخة واحدة";
  if (value === 2) return "نسختان";
  if (value >= 3 && value <= 10) return `${value} نسخ`;
  return `${value} نسخة`;
}

export function RegistrationTemplateRow({ template, organization, locale }: { template: Template; organization: string; locale: Locale }) {
  const [draftOpen, setDraftOpen] = useState(false);
  const en = locale === "en";
  const c = (ar: string, english: string) => en ? english : ar;
  const base = `/manage/organizations/${organization}/renewals`;
  const editHref = `${base}?section=forms&template=${template.id}`;
  const latest = template.versions[0];
  const hasPublishedVersion = template.versions.some(version => version.status_code === "Published");
  const state = latest?.status_code === "Draft" ? "Draft" : hasPublishedVersion ? "Published" : "Draft";

  return <li className="registration-template-row flex min-w-0 flex-col items-stretch gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
    <div className="min-w-0">
      <Link dir="auto" href={editHref} className="break-words font-medium text-foreground hover:text-primary hover:underline">{template.name}</Link>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <OrganizationStatusBadge status={state === "Published" ? "published" : "draft"}>{en ? state : state === "Published" ? "منشور" : "مسودة"}</OrganizationStatusBadge>
        <span>{formatVersionCount(template.version_count ?? template.versions.length, locale)}</span><span>{c("آخر تحديث","Updated")}: {template.updated_at?relativeDate(template.updated_at,locale):c("غير متاح","Unavailable")}</span><span>{template.round_count??0} {c("جولات تستخدمه","rounds using this form")}</span>
      </div>
    </div>
    <div className="flex shrink-0 flex-wrap items-center gap-1"><RowAction href={editHref} label={state==="Draft"?c("تعديل المسودة","Edit draft"):c("عرض النموذج","View form")}>{state==="Draft"?<Pencil/>:<Eye/>}</RowAction>{latest?.status_code==="Published"?<RowAction label={c("بدء مسودة نسخة جديدة","Start a new draft version")} onClick={()=>setDraftOpen(true)}><Files/></RowAction>:<span className="row-action-space"/>}</div>
    {latest?.status_code === "Published" && <ManagementActionSheet label="" title={c("بدء مسودة نسخة جديدة", "Start a new draft version")} locale={locale} open={draftOpen} onOpenChange={setDraftOpen} hideTrigger>
      <WorkflowForm operation="draft-form" fields={{ template: template.id }} label={c("بدء مسودة نسخة جديدة", "Start a new draft version")} locale={locale} />
    </ManagementActionSheet>}
  </li>;
}
