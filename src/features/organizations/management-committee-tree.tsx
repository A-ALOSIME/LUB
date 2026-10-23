"use client";

import { useState, type CSSProperties } from "react";
import { hierarchy, type HierarchyNode } from "d3-hierarchy";
import { Building2, ChevronDown, ChevronLeft, ChevronRight, MoreHorizontal, Pencil, Plus, Trash2, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { WorkspaceEmptyState } from "@/components/workspace-empty-state";
import { ManagementActionProvider } from "@/components/management-action-sheet";
import { CommitteeDialog } from "./committee-dialog";
import { MutationForm } from "./mutation-form";
import type { CommitteeTreeNode } from "./committee-tree";
import type { Locale } from "@/lib/preferences";

type Committee = { id: string; name: string; description: string; isPublic: boolean; statusCode: string; parentCommitteeId: string | null; canEdit: boolean; memberCount: number | null; leaderName: string | null };
type TreeItem = { id: string; name: string; committee?: Committee; children: TreeItem[] };
const toItems = (nodes: CommitteeTreeNode<Committee>[]): TreeItem[] => nodes.map(node => ({ id: node.id, name: node.name, committee: node, children: toItems(node.children) }));

export function ManagementCommitteeTree({ organizationId, organizationName, rootDetails = [], committees, canManage, locale, parentOptions, emptyMessage }: {
  organizationId: string; organizationName: string; rootDetails?: readonly string[]; committees: CommitteeTreeNode<Committee>[]; canManage: boolean; locale: Locale; parentOptions: Array<{ id: string; name: string }>; emptyMessage: string;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [action, setAction] = useState<{ kind: "edit" | "child" | "delete"; committee: Committee; descendants: string[] } | null>(null);
  const en = locale === "en";
  const c = (ar: string, english: string) => en ? english : ar;
  const root = hierarchy<TreeItem>({ id: organizationId, name: organizationName, children: toItems(committees) });
  const nodes: HierarchyNode<TreeItem>[] = [];
  root.eachBefore(node => { nodes.push(node); });
  const visible = nodes.filter(node => !node.ancestors().slice(1).some(parent => collapsed.has(parent.data.id)));
  return <div className="management-committee-tree" dir={en ? "ltr" : "rtl"} style={{ "--committee-max-depth": root.height } as CSSProperties}>
    <ul className="management-committee-list" aria-label={c("هيكل اللجان", "Committee structure")}>
      {visible.map(node => {
        const committee = node.data.committee;
        const hasChildren = Boolean(node.children?.length);
        const isLast = !node.parent || node.parent.children?.at(-1) === node;
        const ancestors = node.ancestors().slice(1, -1);
        const expanded = !collapsed.has(node.data.id);
        return <li key={node.data.id} id={`committee-row-${node.data.id}`} className="management-committee-item" style={{ "--committee-depth": node.depth } as CSSProperties}>
          {hasChildren && expanded && <span className="committee-descend-line" aria-hidden="true" />}
          {ancestors.map(ancestor => ancestor.parent?.children?.at(-1) !== ancestor && <span aria-hidden="true" key={ancestor.data.id} className="committee-ancestor-line" style={{ "--line-depth": ancestor.depth } as CSSProperties} />)}
          {node.depth > 0 && <span aria-hidden="true" className={`committee-branch-line${isLast ? " committee-branch-line--last" : ""}`} />}
          <div className={`management-committee-row${committee ? "" : " management-committee-row--organization"}`}>
            {hasChildren ? <Button type="button" variant="ghost" size="icon-sm" aria-expanded={expanded} aria-label={c(`${expanded ? "طي" : "فتح"} ${node.data.name}`, `${expanded ? "Collapse" : "Expand"} ${node.data.name}`)} onClick={() => setCollapsed(current => { const next = new Set(current); if (expanded) next.add(node.data.id); else next.delete(node.data.id); return next; })}>
                {expanded ? <ChevronDown aria-hidden="true" /> : en ? <ChevronRight aria-hidden="true" /> : <ChevronLeft aria-hidden="true" />}
            </Button> : <span className="committee-toggle-space">{!committee && <Building2 aria-hidden="true" />}</span>}
            <span className="management-committee-title"><span className="management-committee-name" title={node.data.name} dir="auto">{node.data.name}</span>{committee && <Badge variant="secondary">{committee.isPublic ? c("عامة", "Public") : c("مخفية", "Hidden")}</Badge>}</span>
            {!committee && rootDetails.length > 0 && <span className="management-committee-root-details">{rootDetails.join(" · ")}</span>}
            {committee && <>
              <span className="management-committee-meta"><bdi>{committee.leaderName ?? c("بدون قائد", "No leader")}</bdi><span aria-hidden="true">·</span><span>{committee.memberCount === null ? c("عدد الأعضاء غير متاح", "Members unavailable") : c(`${committee.memberCount} أعضاء`, `${committee.memberCount} members`)}</span></span>
              {(committee.canEdit || canManage) && <DropdownMenu>
                <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon-sm" className="management-committee-menu" aria-label={c(`إجراءات ${committee.name}`, `Actions for ${committee.name}`)} />}><MoreHorizontal aria-hidden="true" /></DropdownMenuTrigger>
                <DropdownMenuContent align="end" dir={en ? "ltr" : "rtl"}><DropdownMenuGroup>
                  {committee.canEdit && <DropdownMenuItem onClick={() => setAction({ kind: "edit", committee, descendants: node.descendants().slice(1).map(item => item.data.id) })}><Pencil aria-hidden="true" />{c("تعديل", "Edit")}</DropdownMenuItem>}
                  {canManage && <DropdownMenuItem onClick={() => setAction({ kind: "child", committee, descendants: [] })}><Plus aria-hidden="true" />{c("إضافة لجنة فرعية", "Add subcommittee")}</DropdownMenuItem>}
                </DropdownMenuGroup>{canManage && <><DropdownMenuSeparator /><DropdownMenuGroup><DropdownMenuItem variant="destructive" onClick={() => setAction({ kind: "delete", committee, descendants: [] })}><Trash2 aria-hidden="true" />{c("حذف", "Delete")}</DropdownMenuItem></DropdownMenuGroup></>}</DropdownMenuContent>
              </DropdownMenu>}
            </>}
          </div>
        </li>;
      })}
    </ul>
    {!committees.length && <WorkspaceEmptyState icon={UsersRound} title={c("لا توجد لجان بعد", "No committees yet")} description={emptyMessage} />}
    {action && action.kind !== "delete" && <CommitteeDialog key={`${action.kind}-${action.committee.id}`} organizationId={organizationId} locale={locale} committee={action.kind === "edit" ? action.committee : undefined} parentCommitteeId={action.kind === "child" ? action.committee.id : undefined} parentOptions={parentOptions.filter(option => !action.descendants.includes(option.id))} open onOpenChange={open => { if (!open) setAction(null); }} hideTrigger />}
    <AlertDialog open={action?.kind === "delete"} onOpenChange={open => { if (!open) setAction(null); }}>
      <AlertDialogContent dir={en ? "ltr" : "rtl"}>
        <AlertDialogHeader><AlertDialogTitle>{c("حذف اللجنة؟", "Delete committee?")}</AlertDialogTitle><AlertDialogDescription>{c("ستُزال اللجنة من القائمة النشطة مع حفظ سجلها السابق. لا تُحذف لجانها الفرعية.", "The committee will leave the active list and its history will be retained. Its subcommittees are kept.")}</AlertDialogDescription></AlertDialogHeader>
        {action?.kind === "delete" && <ManagementActionProvider locale={locale} close={() => setAction(null)}><MutationForm operation="committee-status" fields={{ organizationId, committeeId: action.committee.id, status: "Archived", confirmed: "on" }} submitLabel={c("حذف اللجنة", "Delete committee")} buttonClassName="button button-danger" locale={locale} inlineFooter onSuccess={() => setAction(null)} /></ManagementActionProvider>}
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
