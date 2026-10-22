export type CommitteeTreeNode<T extends { id: string; name: string; parentCommitteeId: string | null }> = T & { children: CommitteeTreeNode<T>[] };

const leadershipPositionPattern = /^(?:قيادة\s+(?:الجهة|النادي|المجلس|المجتمع)|(?:القائد|القائدة|الرئيس|الرئيسة|رئيس|رئيسة)(?:\s|$)|(?:نائب|نائبة)\s+(?:الرئيس|الرئيسة|رئيس|رئيسة|القائد|القائدة)|(?:أمين|أمينة)\s+(?:النادي|المجلس|المجتمع)|(?:community|club|organization)\s+(?:deputy\s+)?president|(?:deputy\s+)?president|leadership)/i;

export function separateLeadershipPositions<T extends { name: string }>(items: readonly T[]) {
  const committees: T[] = [];
  const leadershipPositions: T[] = [];

  for (const item of items) {
    (leadershipPositionPattern.test(item.name.trim()) ? leadershipPositions : committees).push(item);
  }

  return { committees, leadershipPositions };
}

export function buildCommitteeTree<T extends { id: string; name: string; parentCommitteeId: string | null }>(committees: readonly T[], options: { sortSiblings?: boolean } = {}): CommitteeTreeNode<T>[] {
  const byId = new Map(committees.map(committee => [committee.id, committee]));
  const parentById = new Map<string, string | null>();

  for (const committee of committees) {
    const requestedParentId = committee.parentCommitteeId;
    let ancestorId = requestedParentId;
    const visited = new Set<string>([committee.id]);
    let hasCycle = false;
    while (ancestorId && byId.has(ancestorId)) {
      if (visited.has(ancestorId)) {
        hasCycle = true;
        break;
      }
      visited.add(ancestorId);
      ancestorId = byId.get(ancestorId)!.parentCommitteeId;
    }
    parentById.set(committee.id, !hasCycle && requestedParentId && byId.has(requestedParentId) ? requestedParentId : null);
  }

  const nodes = new Map(committees.map(committee => [committee.id, { ...committee, children: [] as CommitteeTreeNode<T>[] }]));
  const roots: CommitteeTreeNode<T>[] = [];
  for (const committee of committees) {
    const node = nodes.get(committee.id)!;
    const parentId = parentById.get(committee.id);
    const parent = parentId ? nodes.get(parentId) : undefined;
    if (parent && parent.id !== node.id) parent.children.push(node);
    else roots.push(node);
  }

  const sort = (siblings: CommitteeTreeNode<T>[]) => {
    if (options.sortSiblings !== false) siblings.sort((a, b) => a.name.localeCompare(b.name, "ar"));
    siblings.forEach(node => sort(node.children));
  };
  sort(roots);
  return roots;
}
