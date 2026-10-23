"use client";

import { useEffect, useMemo, useState } from "react";
import { Handle, Panel, Position, ReactFlow, useNodesInitialized, useReactFlow, useStore, type Node, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Building2, ChevronDown, ChevronUp, Maximize, Minus, MoreHorizontal, Pencil, Plus, Trash2, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WorkspaceEmptyState } from "@/components/workspace-empty-state";
import { ManagementActionProvider } from "@/components/management-action-sheet";
import { CommitteeDialog } from "./committee-dialog";
import { MutationForm } from "./mutation-form";
import { committeeNodeSize, layoutCommitteeChart } from "./committee-chart-layout";
import type { CommitteeTreeNode } from "./committee-tree";
import type { Locale } from "@/lib/preferences";

type Committee = { id: string; name: string; description: string; isPublic: boolean; statusCode: string; parentCommitteeId: string | null; canEdit: boolean; memberCount: number | null; leaderName: string | null };
type Branch = { id: string; name: string; committee?: Committee; children: Branch[] };
type Action = { kind: "edit" | "child" | "delete" | "details"; committee: Committee; descendants: string[] };
type ChartNode = Node<{
  name: string; committee?: Committee; rootDetails: readonly string[]; locale: Locale;
  readOnly: boolean; canManage: boolean; hasChildren: boolean; expanded: boolean;
  onToggle: () => void; onAction: (kind: Action["kind"]) => void;
}, "committee">;

function CommitteeNode({ data }: NodeProps<ChartNode>) {
  const { committee, name, locale, readOnly, canManage, hasChildren, expanded, onToggle, onAction, rootDetails } = data;
  const en = locale === "en";
  const c = (ar: string, english: string) => en ? english : ar;
  const meta = committee ? [committee.leaderName?.trim(), committee.memberCount !== null && committee.memberCount > 0 ? c(`${committee.memberCount} أعضاء`, `${committee.memberCount} members`) : undefined].filter(Boolean) : rootDetails;
  return <>
    {committee && <Handle type="target" position={Position.Top} isConnectable={false} />}
    <Card className="committee-flow-card nodrag nopan" dir={en ? "ltr" : "rtl"}>
      <CardContent className="committee-flow-card-content">
        <div className="committee-flow-node-heading">
          {!committee && <Building2 aria-hidden="true" />}
          {committee ? <button type="button" className="committee-flow-name" onClick={() => onAction("details")} aria-haspopup="dialog" aria-label={c(`عرض تفاصيل ${name}`, `View details for ${name}`)}><bdi>{name}</bdi></button> : <strong className="committee-flow-name" dir="auto">{name}</strong>}
          {committee && !readOnly && <Badge variant="secondary">{committee.isPublic ? c("عامة", "Public") : c("مخفية", "Hidden")}</Badge>}
          {committee && !readOnly && (committee.canEdit || canManage) && <DropdownMenu>
            <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon-sm" aria-label={c(`إجراءات ${name}`, `Actions for ${name}`)} />}><MoreHorizontal aria-hidden="true" /></DropdownMenuTrigger>
            <DropdownMenuContent align="end" dir={en ? "ltr" : "rtl"}>
              <DropdownMenuGroup>
                {committee.canEdit && <DropdownMenuItem onClick={() => onAction("edit")}><Pencil aria-hidden="true" />{c("تعديل", "Edit")}</DropdownMenuItem>}
                {canManage && <DropdownMenuItem onClick={() => onAction("child")}><Plus aria-hidden="true" />{c("إضافة لجنة فرعية", "Add subcommittee")}</DropdownMenuItem>}
              </DropdownMenuGroup>
              {canManage && <><DropdownMenuSeparator /><DropdownMenuGroup><DropdownMenuItem variant="destructive" onClick={() => onAction("delete")}><Trash2 aria-hidden="true" />{c("حذف", "Delete")}</DropdownMenuItem></DropdownMenuGroup></>}
            </DropdownMenuContent>
          </DropdownMenu>}
        </div>
        {meta.length > 0 && <p className="committee-flow-meta">{meta.join(" · ")}</p>}
        {hasChildren && <Button type="button" variant="ghost" size="icon-sm" className="committee-flow-collapse" aria-expanded={expanded} aria-label={c(`${expanded ? "طي" : "فتح"} ${name}`, `${expanded ? "Collapse" : "Expand"} ${name}`)} onClick={onToggle}>{expanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}</Button>}
      </CardContent>
    </Card>
    {hasChildren && expanded && <Handle type="source" position={Position.Bottom} isConnectable={false} />}
  </>;
}
const nodeTypes = { committee: CommitteeNode };

function ChartControls({ en }: { en: boolean }) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const width = useStore(state => state.width);
  const height = useStore(state => state.height);
  const initialized = useNodesInitialized();
  // A chart mounted in a hidden tab must fit again when its real canvas size is known.
  useEffect(() => {
    if (initialized && width > 0 && height > 0) void fitView({ padding: .15, minZoom: .55, maxZoom: 1 });
  }, [fitView, width, height, initialized]);
  return <Panel position="bottom-left" className="committee-flow-controls"><div role="group" aria-label={en ? "Chart controls" : "التحكم بالمخطط"}>
    <Button type="button" variant="outline" size="icon-sm" aria-label={en ? "Zoom in" : "تكبير المخطط"} onClick={() => void zoomIn()}><Plus aria-hidden="true" /></Button>
    <Button type="button" variant="outline" size="icon-sm" aria-label={en ? "Zoom out" : "تصغير المخطط"} onClick={() => void zoomOut()}><Minus aria-hidden="true" /></Button>
    <Button type="button" variant="outline" size="icon-sm" aria-label={en ? "Fit chart" : "عرض المخطط كاملًا"} onClick={() => void fitView({ padding: .15, maxZoom: 1 })}><Maximize aria-hidden="true" /></Button>
  </div></Panel>;
}

export function OrganizationCommitteeChart({ organizationId, organizationName, rootDetails = [], committees, canManage, locale, parentOptions, emptyMessage, readOnly = false }: {
  organizationId: string; organizationName: string; rootDetails?: readonly string[]; committees: CommitteeTreeNode<Committee>[]; canManage: boolean; locale: Locale; parentOptions: Array<{ id: string; name: string }>; emptyMessage: string; readOnly?: boolean;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [action, setAction] = useState<Action | null>(null);
  const en = locale === "en";
  const c = (ar: string, english: string) => en ? english : ar;
  const graph = useMemo(() => {
    const toBranch = (items: CommitteeTreeNode<Committee>[]): Branch[] => items.map(committee => ({ id: committee.id, name: committee.name, committee, children: toBranch(committee.children) }));
    const root: Branch = { id: `organization-${organizationId}`, name: organizationName, children: toBranch(committees) };
    const layout = layoutCommitteeChart(root, !en, collapsed);
    const nodes: ChartNode[] = [];
    function visit(branch: Branch) {
      const position = layout.positions.get(branch.id);
      if (!position) return;
      const descendantIds = (item: Branch): string[] => item.children.flatMap(child => [child.id, ...descendantIds(child)]);
      nodes.push({ id: branch.id, type: "committee", position, ...committeeNodeSize, style: { pointerEvents: "all" }, data: {
        name: branch.name, committee: branch.committee, locale, rootDetails: branch.committee ? [] : rootDetails,
        readOnly, canManage, hasChildren: branch.children.length > 0, expanded: !collapsed.has(branch.id),
        onToggle: () => setCollapsed(current => { const next = new Set(current); if (next.has(branch.id)) next.delete(branch.id); else next.add(branch.id); return next; }),
        onAction: kind => { if (branch.committee && (kind === "details" || !readOnly)) setAction({ kind, committee: branch.committee, descendants: descendantIds(branch) }); },
      } });
      branch.children.forEach(visit);
    }
    visit(root);
    return { nodes, edges: layout.connections.map(edge => ({ ...edge, id: `${edge.source}-${edge.target}`, type: "step" })), height: layout.height };
  }, [organizationId, organizationName, committees, en, collapsed, locale, rootDetails, readOnly, canManage]);

  return <div className="committee-flow" dir={en ? "ltr" : "rtl"}>
    <div className="committee-flow-canvas" style={{ height: Math.min(720, Math.max(360, graph.height + 80)) }}>
      <ReactFlow<ChartNode> key={graph.nodes.map(node => node.id).join("|")} nodes={graph.nodes} edges={graph.edges} nodeTypes={nodeTypes}
        fitView fitViewOptions={{ padding: .15, minZoom: .55, maxZoom: 1 }} minZoom={.15} maxZoom={1.5}
        nodesDraggable={false} nodesConnectable={false} nodesFocusable={false} edgesFocusable={false} elementsSelectable={false}
        deleteKeyCode={null} zoomOnDoubleClick={false} zoomOnScroll={false} preventScrolling={false}
        role="group" aria-label={c("الهيكل التنظيمي للجان", "Committee organization chart")}>
        <ChartControls en={en} />
      </ReactFlow>
    </div>
    {!committees.length && <WorkspaceEmptyState icon={UsersRound} title={c("لا توجد لجان بعد", "No committees yet")} description={emptyMessage} />}
    {action && (action.kind === "edit" || action.kind === "child") && !readOnly && <CommitteeDialog key={`${action.kind}-${action.committee.id}`} organizationId={organizationId} locale={locale} committee={action.kind === "edit" ? action.committee : undefined} parentCommitteeId={action.kind === "child" ? action.committee.id : undefined} parentOptions={parentOptions.filter(option => !action.descendants.includes(option.id))} open onOpenChange={open => { if (!open) setAction(null); }} hideTrigger />}
    <Dialog open={action?.kind === "details"} onOpenChange={open => { if (!open) setAction(null); }}>
      <DialogContent dir={en ? "ltr" : "rtl"}><DialogHeader><DialogTitle>{action?.committee.name}</DialogTitle><DialogDescription className="whitespace-pre-line">{action?.committee.description.trim() || c("لا توجد تفاصيل إضافية متاحة.", "No additional details are available.")}</DialogDescription></DialogHeader>
        {action?.committee.leaderName?.trim() && <p>{c("القائد", "Leader")}: <bdi>{action.committee.leaderName}</bdi></p>}
        {action?.committee.memberCount != null && action.committee.memberCount > 0 && <p>{c("الأعضاء", "Members")}: {action.committee.memberCount}</p>}
      </DialogContent>
    </Dialog>
    <AlertDialog open={action?.kind === "delete" && !readOnly} onOpenChange={open => { if (!open) setAction(null); }}>
      <AlertDialogContent dir={en ? "ltr" : "rtl"}>
        <AlertDialogHeader><AlertDialogTitle>{c("حذف اللجنة؟", "Delete committee?")}</AlertDialogTitle><AlertDialogDescription>{c("ستُزال اللجنة من القائمة النشطة مع حفظ سجلها السابق. لا تُحذف لجانها الفرعية.", "The committee will leave the active list and its history will be retained. Its subcommittees are kept.")}</AlertDialogDescription></AlertDialogHeader>
        {action?.kind === "delete" && !readOnly && <ManagementActionProvider locale={locale} close={() => setAction(null)}><MutationForm operation="committee-status" fields={{ organizationId, committeeId: action.committee.id, status: "Archived", confirmed: "on" }} submitLabel={c("حذف اللجنة", "Delete committee")} buttonClassName="button button-danger" locale={locale} inlineFooter onSuccess={() => setAction(null)} /></ManagementActionProvider>}
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
