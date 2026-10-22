import { hierarchy, type HierarchyNode } from "d3-hierarchy";
import { Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CommitteeListRow } from "@/features/organizations/committee-list-row";
import { chunkCommitteeChartNodes } from "@/features/organizations/committee-chart-layout";
import type { CommitteeTreeNode } from "@/features/organizations/committee-tree";
import type { Locale } from "@/lib/preferences";

type ManagedCommittee = {
  id: string;
  name: string;
  description: string;
  isPublic: boolean;
  statusCode: string;
  copiedFromCommitteeId: string | null;
  parentCommitteeId: string | null;
  canEdit: boolean;
  memberCount: number | null;
  leaderName: string | null;
};

type CommitteeChartItem = {
  id: string;
  name: string;
  details: string;
  description?: string;
  committee?: ManagedCommittee;
  children?: CommitteeChartItem[];
};

function toChartItems(nodes: CommitteeTreeNode<ManagedCommittee>[], en: boolean, readOnly: boolean): CommitteeChartItem[] {
  return nodes.map(node => {
    const count = node.memberCount === null
      ? en ? "Member count unavailable" : "عدد الأعضاء غير متاح"
      : en ? `${node.memberCount} ${node.memberCount === 1 ? "member" : "members"}` : `${node.memberCount} أعضاء`;
    const leader = node.leaderName ?? (en ? "No leader" : "بدون قائد");
    const details = readOnly ? "" : `${leader} · ${count}`;
    return {
      id: node.id,
      name: node.name,
      details,
      committee: node,
      ...(readOnly && node.description ? { description: node.description } : {}),
      children: toChartItems(node.children, en, readOnly),
    };
  });
}

function CommitteeRows({ nodes, organizationId, canManage, locale, parentOptions, readOnly }: {
  nodes: HierarchyNode<CommitteeChartItem>[];
  organizationId: string;
  canManage: boolean;
  locale: Locale;
  parentOptions: Array<{ id: string; name: string }>;
  readOnly: boolean;
}) {
  const rows = readOnly ? [nodes] : chunkCommitteeChartNodes(nodes);

  const branch = nodes[0]?.depth > 1;
  const directSiblings = readOnly && !branch && nodes.every(node => !node.children?.length);
  return rows.map((row, rowIndex) => <ul className={`organization-org-chart-row ${branch ? "organization-org-chart-row--branch" : "organization-org-chart-row--root"}${directSiblings ? " organization-org-chart-row--direct" : ""}`} key={`${row[0]?.data.id ?? "empty"}-${rowIndex}`}>
    {row.map(node => {
      const committee = node.data.committee;
      if (!committee) return null;
      const descendantIds = node.descendants().slice(1).map(descendant => descendant.data.id);

      return <CommitteeListRow
        key={committee.id}
        organizationId={organizationId}
        committee={committee}
        canManage={canManage}
        locale={locale}
        parentOptions={parentOptions}
        descendantIds={descendantIds}
        readOnly={readOnly}
        className={`${branch ? "organization-committee-row--branch" : "organization-committee-row--root"}${readOnly && node.depth === 1 ? node.children?.length ? " organization-committee-row--department" : " organization-committee-row--leaf" : ""}`}
      >
        {node.children && node.children.length > 0 && <div className="organization-org-chart-children organization-org-chart-children--branch">
          <CommitteeRows nodes={node.children} organizationId={organizationId} canManage={canManage} locale={locale} parentOptions={parentOptions} readOnly={readOnly} />
        </div>}
      </CommitteeListRow>;
    })}
  </ul>);
}

export function OrganizationCommitteeChart({ organizationId, organizationName, rootDetails = [], committees, canManage, locale, parentOptions, emptyMessage, readOnly = false }: {
  organizationId: string;
  organizationName: string;
  rootDetails?: readonly string[];
  committees: CommitteeTreeNode<ManagedCommittee>[];
  canManage: boolean;
  locale: Locale;
  parentOptions: Array<{ id: string; name: string }>;
  emptyMessage: string;
  readOnly?: boolean;
}) {
  const en = locale === "en";
  const c = (ar: string, english: string) => en ? english : ar;
  const treeRoot = hierarchy<CommitteeChartItem>({
    id: `organization-${organizationId}`,
    name: organizationName,
    details: rootDetails.join("\n"),
    children: toChartItems(committees, en, readOnly),
  }, node => node.children?.length ? node.children : undefined);
  const hasCommittees = Boolean(treeRoot.children?.length);

  return <div className={`organization-org-chart-viewport${readOnly ? " organization-org-chart-viewport--public" : ""}`}>
    <ul className="organization-org-chart-tree" aria-label={c("الهيكل التنظيمي للجان", "Committee organization chart")}>
      <li className="organization-org-chart-root-row">
        <Card className="organization-org-chart-root">
          <CardContent className="organization-org-chart-root-content">
            <Building2 aria-hidden="true" />
            <span className="organization-org-chart-root-copy">
              <span className="organization-org-chart-root-label">{c("الجهة", "Organization")}</span>
              <span className="organization-org-chart-root-name" dir="auto">{organizationName}</span>
              {rootDetails.length > 0 && <span className="organization-org-chart-root-details">
                {rootDetails.map((detail, index) => <span key={`${index}-${detail}`}>{detail}</span>)}
              </span>}
            </span>
          </CardContent>
        </Card>
        {hasCommittees
          ? <div className="organization-org-chart-children organization-org-chart-children--root">
              <CommitteeRows nodes={treeRoot.children!} organizationId={organizationId} canManage={canManage} locale={locale} parentOptions={parentOptions} readOnly={readOnly} />
            </div>
          : <div role="status" className="organization-compact-empty organization-org-chart-empty">
              <span>{emptyMessage}</span>
            </div>}
      </li>
    </ul>
  </div>;
}
