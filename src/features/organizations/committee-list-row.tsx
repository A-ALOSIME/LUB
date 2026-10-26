"use client";

import {formatCount} from "@/lib/display";
import { useState, type ReactNode } from "react";
import { Archive, Copy, Pencil, RotateCcw } from "lucide-react";
import { RowAction } from "@/components/row-action";
import { ManagementActionSheet } from "@/components/management-action-sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MutationForm } from "@/features/organizations/mutation-form";
import { CommitteeDialog } from "@/features/organizations/committee-dialog";
import { CommitteeStatusDialog } from "@/features/organizations/committee-status-dialog";
import { OrganizationStatusBadge } from "@/features/organizations/organization-status-badge";
import type { Locale } from "@/lib/preferences";

type Committee = {
  id: string;
  name: string;
  description: string;
  isPublic: boolean;
  statusCode: string;
  canEdit: boolean;
  memberCount: number | null;
  leaderName: string | null;
  parentCommitteeId?: string | null;
};

export function CommitteeListRow({ organizationId, committee, canManage, locale, parentOptions = [], descendantIds = [], children, readOnly = false, className }: { organizationId: string; committee: Committee; canManage: boolean; locale: Locale; parentOptions?: Array<{ id: string; name: string }>; descendantIds?: string[]; children?: ReactNode; readOnly?: boolean; className?: string }) {
  const [action, setAction] = useState<"edit" | "copy" | "archive" | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const en = locale === "en";
  const c = (ar: string, english: string) => en ? english : ar;
  const archived = committee.statusCode === "Archived";
  const count = committee.memberCount === null
    ? c("عدد الأعضاء غير متاح", "Member count unavailable")
    : formatCount(committee.memberCount,"members",locale);
  const summary = committee.leaderName
    ? <span className="organization-committee-leader"><bdi>{committee.leaderName}</bdi></span>
    : <span>{c("بدون قائد", "No leader")}</span>;
  const status = archived ? c("مؤرشفة", "Archived") : committee.isPublic ? c("عامة", "Public") : c("مخفية", "Hidden");
  const rowContent = <>
    <span className="organization-committee-copy">
      <span className="organization-committee-name-row">
        <span className="organization-committee-name" dir="auto">{committee.name}</span>
        {!readOnly && <OrganizationStatusBadge status={archived ? "archived" : committee.isPublic ? "public" : "hidden"}>{status}</OrganizationStatusBadge>}
      </span>
      {!readOnly && <span className="organization-committee-meta">{summary}<span aria-hidden="true">·</span><span>{count}</span></span>}
    </span>
  </>;
  const canEdit = !readOnly && committee.canEdit && !archived;
  const hasActions = !readOnly && (canEdit || canManage);

  return <li className={`organization-committee-row${className ? ` ${className}` : ""}`}>
    <div className="organization-committee-node organization-committee-node--chart">
      <div className="organization-committee-node-header">
        {readOnly
          ? <button
              type="button"
              className="organization-committee-row-main organization-committee-row-main--details"
              onClick={() => setDetailsOpen(true)}
              aria-label={c(`عرض تفاصيل ${committee.name}`, `View details for ${committee.name}`)}
              aria-haspopup="dialog"
            >{rowContent}</button>
          : canEdit
          ? <button type="button" className="organization-committee-row-main" onClick={() => setAction("edit")} aria-label={c(`تعديل ${committee.name}`, `Edit ${committee.name}`)}>{rowContent}</button>
          : <div className="organization-committee-row-main">{rowContent}</div>}
        {hasActions && <div className="organization-committee-actions">
          <RowAction label={c("تعديل اللجنة","Edit committee")} disabled={!canEdit} onClick={()=>setAction("edit")}><Pencil/></RowAction><RowAction label={c("نسخ اللجنة","Copy committee")} disabled={!canManage} onClick={()=>setAction("copy")}><Copy/></RowAction><RowAction danger={!archived} label={archived?c("استعادة اللجنة","Restore committee"):c("أرشفة اللجنة","Archive committee")} disabled={!canManage} onClick={()=>setAction("archive")}>{archived?<RotateCcw/>:<Archive/>}</RowAction>
        </div>}
      </div>
    </div>
    {children}
    {readOnly && <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
      <DialogContent dir={en ? "ltr" : "rtl"} className="organization-committee-details-dialog">
        <DialogHeader>
          <DialogTitle dir="auto">{committee.name}</DialogTitle>
          <DialogDescription dir="auto" className="organization-committee-details-description">
            {committee.description.trim() || c("لا توجد تفاصيل إضافية متاحة.", "No additional details are available.")}
          </DialogDescription>
        </DialogHeader>
        {(committee.leaderName || committee.memberCount !== null) && <div className="organization-committee-details-meta">
          {committee.leaderName && <div><span>{c("القائد", "Leader")}</span><bdi>{committee.leaderName}</bdi></div>}
          {committee.memberCount !== null && <div><span>{c("الأعضاء", "Members")}</span><bdi>{count}</bdi></div>}
        </div>}
      </DialogContent>
    </Dialog>}
    {canEdit && <CommitteeDialog organizationId={organizationId} locale={locale} committee={committee} parentOptions={parentOptions.filter(option => !descendantIds.includes(option.id))} open={action === "edit"} onOpenChange={open => { if (!open) setAction(null); }} hideTrigger />}
    {canManage && <ManagementActionSheet label="" title={c("نسخ اللجنة", "Copy committee")} locale={locale} open={action === "copy"} onOpenChange={open => { if (!open) setAction(null); }} hideTrigger>
      <p className="mb-3 text-sm leading-6 text-muted">{c("سيُنشأ سجل لجنة جديد ببيانات هذه اللجنة.", "A new committee will be created from this committee's details.")}</p>
      <MutationForm operation="copy-committee" fields={{ organizationId, committeeId: committee.id }} submitLabel={c("نسخ اللجنة", "Copy committee")} locale={locale} onSuccess={() => setAction(null)} />
    </ManagementActionSheet>}
    {canManage && <CommitteeStatusDialog organizationId={organizationId} committeeId={committee.id} archived={archived} committeeName={committee.name} locale={locale} open={action === "archive"} onOpenChange={open => { if (!open) setAction(null); }} hideTrigger />}
  </li>;
}
