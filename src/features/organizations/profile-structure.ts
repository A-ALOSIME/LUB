import type { OrganizationProfileSection } from "./local-content";

export type ProfileStructureCommittee = {
  id: string;
  name: string;
  description: string;
  isPublic: true;
  statusCode: "Active";
  copiedFromCommitteeId: null;
  parentCommitteeId: string | null;
  canEdit: false;
  memberCount: null;
  leaderName: null;
};

/** Preserve profile sections as department roots and their items as children. */
export function profileSectionsToCommitteeRoots(
  entries: readonly { index: number; section: OrganizationProfileSection }[],
  prefix = "profile",
): ProfileStructureCommittee[] {
  const records: ProfileStructureCommittee[] = [];
  for (const { index, section } of entries) {
    const rootId = `${prefix}-section-${index}`;
    const root: ProfileStructureCommittee = {
      id: rootId,
      name: section.title,
      description: section.body?.trim() ?? "",
      isPublic: true,
      statusCode: "Active",
      copiedFromCommitteeId: null,
      parentCommitteeId: null,
      canEdit: false,
      memberCount: null,
      leaderName: null,
    };
    records.push(root);
    section.items?.forEach((item, itemIndex) => records.push({
      id: `${prefix}-section-${index}-item-${itemIndex}`,
      name: item.title,
      description: item.body?.trim() ?? "",
      isPublic: true,
      statusCode: "Active",
      copiedFromCommitteeId: null,
      parentCommitteeId: rootId,
      canEdit: false,
      memberCount: null,
      leaderName: null,
    }));
  }
  return records;
}
