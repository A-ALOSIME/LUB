"use client";

import Link from "next/link";
import { useState } from "react";
import { Files, MoreHorizontal, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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

  return <li className="flex min-w-0 items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
    <div className="min-w-0">
      <Link dir="auto" href={editHref} className="break-words font-medium text-foreground hover:text-primary hover:underline">{template.name}</Link>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <OrganizationStatusBadge status={state === "Published" ? "published" : "draft"}>{en ? state : state === "Published" ? "منشور" : "مسودة"}</OrganizationStatusBadge>
        <span>{formatVersionCount(template.version_count ?? template.versions.length, locale)}</span>
      </div>
    </div>
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon-sm" aria-label={c(`إجراءات ${template.name}`, `Actions for ${template.name}`)}><MoreHorizontal aria-hidden="true" /></Button>} />
      <DropdownMenuContent align={en ? "end" : "start"}>
        <DropdownMenuItem render={<Link href={editHref} />}><Pencil aria-hidden="true" />{c("فتح النموذج", "Open form")}</DropdownMenuItem>
        {latest?.status_code === "Published" && <DropdownMenuItem onClick={() => setDraftOpen(true)}><Files aria-hidden="true" />{c("بدء مسودة نسخة جديدة", "Start a new draft version")}</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
    {latest?.status_code === "Published" && <ManagementActionSheet label="" title={c("بدء مسودة نسخة جديدة", "Start a new draft version")} locale={locale} open={draftOpen} onOpenChange={setDraftOpen} hideTrigger>
      <WorkflowForm operation="draft-form" fields={{ template: template.id }} label={c("بدء مسودة نسخة جديدة", "Start a new draft version")} locale={locale} />
    </ManagementActionSheet>}
  </li>;
}
