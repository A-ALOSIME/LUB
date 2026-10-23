export type ChartBranch = { id: string; children: ChartBranch[] };
export const committeeNodeSize = { width: 256, height: 128 };
const horizontalGap = 40;
const levelGap = 72;

/** Give each subtree its own span and center its parent above it. */
export function layoutCommitteeChart(root: ChartBranch, rtl: boolean, collapsed: ReadonlySet<string> = new Set()) {
  const positions = new Map<string, { x: number; y: number }>();
  const connections: Array<{ source: string; target: string }> = [];
  const widths = new Map<string, number>();
  const childrenOf = (node: ChartBranch) => collapsed.has(node.id) ? [] : rtl ? [...node.children].reverse() : node.children;
  function measure(node: ChartBranch): number {
    const children = childrenOf(node);
    const width = Math.max(committeeNodeSize.width, children.reduce((total, child) => total + measure(child), 0) + Math.max(0, children.length - 1) * horizontalGap);
    widths.set(node.id, width);
    return width;
  }
  function place(node: ChartBranch, left: number, depth: number) {
    positions.set(node.id, { x: left + (widths.get(node.id)! - committeeNodeSize.width) / 2, y: depth * (committeeNodeSize.height + levelGap) });
    let nextLeft = left;
    for (const child of childrenOf(node)) {
      connections.push({ source: node.id, target: child.id });
      place(child, nextLeft, depth + 1);
      nextLeft += widths.get(child.id)! + horizontalGap;
    }
  }
  const width = measure(root);
  place(root, 0, 0);
  const height = Math.max(...[...positions.values()].map(position => position.y)) + committeeNodeSize.height;
  return { positions, connections, width, height };
}
