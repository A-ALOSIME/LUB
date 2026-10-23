import type { ComponentType, ReactNode } from 'react';
import type { Node } from '@xyflow/react';
/** Component tests isolate the viewport engine; real browser checks cover its measured rendering. */
export function ReactFlow({ nodes, edges, nodeTypes, children }: { nodes: Node[]; edges: { id: string; source: string; target: string }[]; nodeTypes: Record<string, ComponentType<{ data: Node['data'] }>>; children: ReactNode }) {
  return <div role="group" aria-label="الهيكل التنظيمي للجان">{nodes.map(node => { const Component = nodeTypes[node.type!]; return <div key={node.id} data-node-id={node.id} data-x={node.position.x} data-y={node.position.y} data-pointer-events={node.style?.pointerEvents}><Component data={node.data} /></div>; })}{edges.map(edge => <span key={edge.id} data-edge={edge.source + ':' + edge.target} />)}{children}</div>;
}
export const Handle = () => null;
export const Panel = ({ children }: { children: ReactNode }) => children;
export const Position = { Top: 'top', Bottom: 'bottom' };
export const useReactFlow = () => ({ zoomIn: () => {}, zoomOut: () => {}, fitView: () => {} });
