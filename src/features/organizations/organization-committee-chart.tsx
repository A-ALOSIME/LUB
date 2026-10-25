"use client";

import { useEffect, useMemo, useState } from "react";
import { Handle, Panel, Position, ReactFlow, useReactFlow, useStore, type Node, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Building2, ChevronDown, ChevronUp, Maximize, Minus, Pencil, Plus, Trash2, UsersRound } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { RowAction } from "@/components/row-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
        </div>
        {meta.length > 0 && <p className="committee-flow-meta">{meta.join(" · ")}</p>}
        {committee && !readOnly && (committee.canEdit || canManage) && <div className="committee-flow-actions" role="group" aria-label={c(`إجراءات ${name}`, `Actions for ${name}`)}>
          {([
            ...(committee.canEdit ? [{ kind: "edit" as const, icon: Pencil, label: c("تعديل اللجنة", "Edit committee") }] : []),
            ...(canManage ? [{ kind: "child" as const, icon: Plus, label: c("إضافة لجنة فرعية", "Add subcommittee") }, { kind: "delete" as const, icon: Trash2, label: c("حذف اللجنة", "Delete committee") }] : []),
          ]).map(({ kind, icon: Icon, label }) => <Tooltip key={kind}>
            <TooltipTrigger render={<Button type="button" variant="ghost" size="icon-sm" className={kind==="delete"?"row-action--danger":undefined} aria-label={`${label}: ${name}`} onClick={() => onAction(kind)} />}><Icon aria-hidden="true" /></TooltipTrigger>
            <TooltipContent dir={en ? "ltr" : "rtl"}>{label}</TooltipContent>
          </Tooltip>)}
        </div>}
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
  // A chart mounted in a hidden tab must fit again when its real canvas size is known.
  useEffect(() => {
    if (width > 0 && height > 0) void fitView({ padding: .15, minZoom: .55, maxZoom: 1 });
  }, [fitView, width, height]);
  return <Panel position="bottom-left" className="committee-flow-controls"><div role="group" aria-label={en ? "Chart controls" : "التحكم بالمخطط"}>
    <Button type="button" variant="outline" size="icon-sm" aria-label={en ? "Zoom in" : "تكبير المخطط"} onClick={() => void zoomIn()}><Plus aria-hidden="true" /></Button>
    <Button type="button" variant="outline" size="icon-sm" aria-label={en ? "Zoom out" : "تصغير المخطط"} onClick={() => void zoomOut()}><Minus aria-hidden="true" /></Button>
    <Button type="button" variant="outline" size="icon-sm" aria-label={en ? "Fit chart" : "عرض المخطط كاملًا"} onClick={() => void fitView({ padding: .15, maxZoom: 1 })}><Maximize aria-hidden="true" /></Button>
  </div></Panel>;
}

export function OrganizationCommitteeChart({ organizationId, organizationName, rootDetails = [], committees, canManage, locale, parentOptions, emptyMessage, readOnly = false }: {
  organizationId: string; organizationName: string; rootDetails?: readonly string[]; committees: CommitteeTreeNode<Committee>[]; canManage: boolean; locale: Locale; parentOptions: Array<{ id: string; name: string }>; emptyMessage: string; readOnly?: boolean;
}) {
  const mobile=useIsMobile();
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [action, setAction] = useState<Action | null>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    // React Flow positions use pixels; follow the site's rem scale as well.
    const measure = () => setScale((parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) / 16);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
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
      nodes.push({ id: branch.id, type: "committee", position: { x: position.x * scale, y: position.y * scale }, width: committeeNodeSize.width * scale, height: committeeNodeSize.height * scale, style: { pointerEvents: "all", width: committeeNodeSize.width * scale, height: committeeNodeSize.height * scale }, data: {
        name: branch.name, committee: branch.committee, locale, rootDetails: branch.committee ? [] : rootDetails,
        readOnly, canManage, hasChildren: branch.children.length > 0, expanded: !collapsed.has(branch.id),
        onToggle: () => setCollapsed(current => { const next = new Set(current); if (next.has(branch.id)) next.delete(branch.id); else next.add(branch.id); return next; }),
        onAction: kind => { if (branch.committee && (kind === "details" || !readOnly)) setAction({ kind, committee: branch.committee, descendants: descendantIds(branch) }); },
      } });
      branch.children.forEach(visit);
    }
    visit(root);
    return { nodes, edges: layout.connections.map(edge => ({ ...edge, id: `${edge.source}-${edge.target}`, type: "step" })), height: layout.height };
  }, [organizationId, organizationName, committees, en, collapsed, locale, rootDetails, readOnly, canManage, scale]);

  const childIds=(node:CommitteeTreeNode<Committee>):string[]=>node.children.flatMap(child=>[child.id,...childIds(child)]);
  const mobileTree=(nodes:CommitteeTreeNode<Committee>[],depth=0):React.ReactNode=><ul className="flex flex-col gap-3" style={{marginInlineStart:depth?".75rem":0,borderInlineStart:depth?"1px solid var(--border)":undefined,paddingInlineStart:depth?".5rem":0}}>{nodes.map(node=><li key={node.id}><Card><CardContent className="flex flex-col gap-3"><div className="flex items-center justify-between gap-2"><button type="button" className="min-w-0 font-semibold text-start" onClick={()=>setAction({kind:"details",committee:node,descendants:childIds(node)})}>{node.name}</button>{node.children.length>0&&<Button type="button" variant="ghost" size="icon" aria-label={c(`فتح أو طي ${node.name}`,`Expand or collapse ${node.name}`)} aria-expanded={!collapsed.has(node.id)} onClick={()=>setCollapsed(current=>{const next=new Set(current);if(next.has(node.id))next.delete(node.id);else next.add(node.id);return next;})}>{collapsed.has(node.id)?<ChevronDown/>:<ChevronUp/>}</Button>}</div>{node.leaderName&&<p className="text-sm text-muted-foreground">{node.leaderName}</p>}{node.memberCount!==null&&node.memberCount>0&&<p className="text-sm text-muted-foreground">{node.memberCount} {c("أعضاء","members")}</p>}{!readOnly&&<div className="flex flex-wrap gap-1 border-t border-border pt-2"><RowAction label={c("تعديل اللجنة","Edit committee")} disabled={!node.canEdit} onClick={()=>setAction({kind:"edit",committee:node,descendants:childIds(node)})}><Pencil/></RowAction><RowAction label={c("إضافة لجنة فرعية","Add subcommittee")} disabled={!canManage} onClick={()=>setAction({kind:"child",committee:node,descendants:childIds(node)})}><Plus/></RowAction><RowAction danger label={c("حذف اللجنة","Delete committee")} disabled={!canManage} onClick={()=>setAction({kind:"delete",committee:node,descendants:childIds(node)})}><Trash2/></RowAction></div>}</CardContent></Card>{node.children.length>0&&!collapsed.has(node.id)&&<div className="pt-3">{mobileTree(node.children,depth+1)}</div>}</li>)}</ul>;
  return <TooltipProvider><div className="committee-flow" dir={en ? "ltr" : "rtl"}>
    {mobile?<div className="committee-flow-mobile"><Card><CardContent><p className="font-semibold text-center">{organizationName}</p>{rootDetails.length>0&&<p className="mt-2 text-sm text-center text-muted-foreground">{rootDetails.join(" · ")}</p>}</CardContent></Card><div className="pt-3">{mobileTree(committees)}</div></div>:<div className="committee-flow-canvas" style={{ height: Math.min(720, Math.max(360, graph.height + 80)) * scale }}>
      <ReactFlow<ChartNode> key={`${scale}|${graph.nodes.map(node => node.id).join("|")}`} nodes={graph.nodes} edges={graph.edges} nodeTypes={nodeTypes}
        fitView fitViewOptions={{ padding: .15, minZoom: .55, maxZoom: 1 }} minZoom={.15} maxZoom={1.5} proOptions={{ hideAttribution: true }}
        nodesDraggable={false} nodesConnectable={false} nodesFocusable={false} edgesFocusable={false} elementsSelectable={false}
        deleteKeyCode={null} zoomOnDoubleClick={false} zoomOnScroll={false} preventScrolling={false}
        role="group" aria-label={c("الهيكل التنظيمي للجان", "Committee organization chart")}>
        <ChartControls en={en} />
      </ReactFlow>
    </div>}
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
        <AlertDialogHeader><AlertDialogTitle>{c(`حذف لجنة ${action?.committee.name??""}؟`, `Delete committee ${action?.committee.name??""}?`)}</AlertDialogTitle><AlertDialogDescription>{c("ستُزال اللجنة من القائمة النشطة مع حفظ سجلها السابق. لا تُحذف لجانها الفرعية.", "The committee will leave the active list and its history will be retained. Its subcommittees are kept.")}</AlertDialogDescription></AlertDialogHeader>
        {action?.kind === "delete" && !readOnly && <ManagementActionProvider locale={locale} close={() => setAction(null)}><MutationForm operation="committee-status" fields={{ organizationId, committeeId: action.committee.id, status: "Archived", confirmed: "on" }} submitLabel={c("حذف اللجنة", "Delete committee")} buttonClassName="button button-danger" locale={locale} inlineFooter onSuccess={() => setAction(null)} /></ManagementActionProvider>}
      </AlertDialogContent>
    </AlertDialog>
  </div></TooltipProvider>;
}
