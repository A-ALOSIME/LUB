import { expect, it } from 'vitest';
import { committeeNodeSize, layoutCommitteeChart } from './committee-chart-layout';
const leaf = (id: string) => ({ id, children: [] });
it('centers parents above disjoint subtrees and preserves every parent-child edge', () => {
  const graph = layoutCommitteeChart({ id: 'root', children: [{ id: 'a', children: [leaf('a1'), leaf('a2')] }, leaf('b')] }, false);
  expect(graph.positions.size).toBe(5);
  expect(graph.connections).toEqual([{ source: 'root', target: 'a' }, { source: 'a', target: 'a1' }, { source: 'a', target: 'a2' }, { source: 'root', target: 'b' }]);
  const p = (id: string) => graph.positions.get(id)!;
  expect(p('a').x).toBe((p('a1').x + p('a2').x) / 2);
  expect(p('a').y).toBe(p('b').y);
  expect(p('a1').y).toBeGreaterThan(p('a').y + committeeNodeSize.height);
  expect(p('b').x).toBeGreaterThan(p('a2').x + committeeNodeSize.width);
});
it('mirrors sibling order in RTL without changing hierarchy levels', () => {
  const root = { id: 'root', children: [leaf('a'), leaf('b'), leaf('c')] };
  const ltr = layoutCommitteeChart(root, false);
  const rtl = layoutCommitteeChart(root, true);
  expect(ltr.positions.get('a')!.x).toBe(rtl.positions.get('c')!.x);
  expect(rtl.positions.get('a')!.x).toBeGreaterThan(rtl.positions.get('b')!.x);
  expect(rtl.positions.get('a')!.y).toBe(ltr.positions.get('a')!.y);
});
it('reflows collapsed branches and keeps sibling-only trees on one level regardless of count', () => {
  const root = { id: 'root', children: [{ id: 'a', children: [leaf('a1')] }, ...Array.from({ length: 12 }, (_, i) => leaf(String(i)))] };
  const graph = layoutCommitteeChart(root, true, new Set(['a']));
  expect(graph.positions.has('a1')).toBe(false);
  expect(graph.positions.size).toBe(14);
  expect(new Set([...graph.positions.entries()].filter(([id]) => id !== 'root').map(([, p]) => p.y)).size).toBe(1);
  expect(graph.connections).toHaveLength(13);
});
