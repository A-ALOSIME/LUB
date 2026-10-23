// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('@xyflow/react', () => import('../../../tests/helpers/react-flow'));
vi.mock('./committee-dialog', () => ({ CommitteeDialog: ({ open, parentCommitteeId }: { open: boolean; parentCommitteeId?: string }) => open ? <div role="dialog">تعديل اللجنة{parentCommitteeId}</div> : null }));
vi.mock('./mutation-form', () => ({ MutationForm: () => null }));
vi.mock('@/components/management-action-sheet', () => ({ ManagementActionProvider: ({ children }: { children: ReactNode }) => children }));
import { OrganizationCommitteeChart } from './organization-committee-chart';
import { fitChart, flowViewport } from '../../../tests/helpers/react-flow';
afterEach(() => { cleanup(); fitChart.mockClear(); flowViewport.width = 800; });
const committee = (id: string, children: ReturnTypeCommittee[] = []): ReturnTypeCommittee => ({ id, name: id, description: 'وصف اللجنة', isPublic: true, statusCode: 'Active', copiedFromCommitteeId: null, parentCommitteeId: null, canEdit: true, memberCount: 0, leaderName: null, children });
type ReturnTypeCommittee = { id: string; name: string; description: string; isPublic: boolean; statusCode: string; copiedFromCommitteeId: null; parentCommitteeId: string | null; canEdit: boolean; memberCount: number | null; leaderName: string | null; children: ReturnTypeCommittee[] };
const props = { organizationId: 'org', organizationName: 'الجهة', canManage: true, locale: 'ar' as const, parentOptions: [{ id: 'أ', name: 'أ' }], emptyMessage: 'لا توجد لجان' };
it('fits the diagram when a hidden tab gains a visible canvas width', () => {
  flowViewport.width = 0;
  const committees = [committee('أ')];
  const ui = render(<OrganizationCommitteeChart {...props} committees={committees} />);
  expect(fitChart).not.toHaveBeenCalled();
  flowViewport.width = 1200;
  ui.rerender(<OrganizationCommitteeChart {...props} committees={committees} />);
  expect(fitChart).toHaveBeenCalledWith({ padding: .15, minZoom: .55, maxZoom: 1 });
});
it('connects root, siblings, and deeper branches and supports collapsing and reopening', () => {
  render(<OrganizationCommitteeChart {...props} committees={[committee('أ', [committee('فرعية')]), committee('ب')]} />);
  expect(document.querySelectorAll('[data-node-id]')).toHaveLength(4);
  expect(document.querySelectorAll('[data-edge]')).toHaveLength(3);
  expect([...document.querySelectorAll('[data-pointer-events]')].every(node => node.getAttribute('data-pointer-events') === 'all')).toBe(true);
  expect(document.querySelector('[data-edge="أ:فرعية"]')).toBeTruthy();
  const a = document.querySelector('[data-node-id="أ"]')!;
  const b = document.querySelector('[data-node-id="ب"]')!;
  expect(a.getAttribute('data-y')).toBe(b.getAttribute('data-y'));
  expect(Number(a.getAttribute('data-x'))).toBeGreaterThan(Number(b.getAttribute('data-x')));
  fireEvent.click(screen.getByRole('button', { name: 'طي أ' }));
  expect(screen.queryByText('فرعية')).toBeNull();
  expect(document.querySelector('[data-edge="أ:فرعية"]')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'فتح أ' }));
  expect(screen.getByText('فرعية')).toBeTruthy();
});
it('offers edit, preselected child parent, and a destructive last delete with confirmation', async () => {
  const ui = render(<OrganizationCommitteeChart {...props} committees={[committee('أ')]} />);
  fireEvent.click(screen.getByRole('button', { name: 'إجراءات أ' }));
  const menu = await screen.findByRole('menu');
  const items = menu.querySelectorAll('[role="menuitem"]');
  expect([...items].map(item => item.textContent)).toEqual(['تعديل', 'إضافة لجنة فرعية', 'حذف']);
  expect(items[2].getAttribute('data-variant')).toBe('destructive');
  fireEvent.click(screen.getByRole('menuitem', { name: 'إضافة لجنة فرعية' }));
  expect((await screen.findByRole('dialog')).textContent).toContain('أ');
  ui.unmount();
  render(<OrganizationCommitteeChart {...props} committees={[committee('أ')]} />);
  fireEvent.click(screen.getByRole('button', { name: 'إجراءات أ' }));
  fireEvent.click(await screen.findByRole('menuitem', { name: 'حذف' }));
  expect((await screen.findByRole('alertdialog')).textContent).toContain('حذف اللجنة؟');
});
it('opens the edit dialog from the node menu', async () => {
  render(<OrganizationCommitteeChart {...props} committees={[committee('أ')]} />);
  fireEvent.click(screen.getByRole('button', { name: 'إجراءات أ' }));
  fireEvent.click(await screen.findByRole('menuitem', { name: 'تعديل' }));
  expect((await screen.findByRole('dialog')).textContent).toContain('تعديل اللجنة');
});
it('shows root and unified empty state with no committees', () => {
  render(<OrganizationCommitteeChart {...props} rootDetails={['القائد: أحمد']} committees={[]} />);
  expect(screen.getByText('الجهة')).toBeTruthy();
  expect(screen.getByText('القائد: أحمد')).toBeTruthy();
  expect(screen.getByRole('status').textContent).toContain('لا توجد لجان');
  expect(document.querySelectorAll('[data-edge]')).toHaveLength(0);
});
it('renders all twelve siblings at the same level with equal card structure', () => {
  render(<OrganizationCommitteeChart {...props} committees={Array.from({ length: 12 }, (_, i) => committee('لجنة ' + i))} />);
  const nodes = [...document.querySelectorAll('[data-node-id]')].slice(1);
  expect(nodes).toHaveLength(12);
  expect(new Set(nodes.map(node => node.getAttribute('data-y'))).size).toBe(1);
  expect(nodes.every(node => node.querySelectorAll('.committee-flow-card').length === 1)).toBe(true);
});
it('uses identical node positions and edges publicly and never exposes management actions', () => {
  const committees = [committee('أ', [committee('فرعية')]), committee('ب')];
  const ui = render(<OrganizationCommitteeChart {...props} committees={committees} />);
  const positions = () => [...document.querySelectorAll('[data-node-id]')].map(node => [node.getAttribute('data-node-id'), node.getAttribute('data-x'), node.getAttribute('data-y')]);
  const managed = positions();
  ui.rerender(<OrganizationCommitteeChart {...props} committees={committees} readOnly />);
  expect(positions()).toEqual(managed);
  expect(document.querySelectorAll('[data-edge]')).toHaveLength(3);
  expect(screen.queryByRole('button', { name: 'إجراءات أ' })).toBeNull();
  expect(screen.queryByText('عامة')).toBeNull();
  expect(screen.queryByText('بدون قائد')).toBeNull();
  expect(screen.queryByText('0 أعضاء')).toBeNull();
  expect(screen.queryByText('وصف اللجنة')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'عرض تفاصيل أ' }));
  expect(screen.getByRole('dialog').textContent).toContain('وصف اللجنة');
});
it('retains public description and populated leader and member details', () => {
  render(<OrganizationCommitteeChart {...props} committees={[{ ...committee('أ'), memberCount: 12, leaderName: 'أحمد العتيبي' }]} readOnly />);
  fireEvent.click(screen.getByRole('button', { name: 'عرض تفاصيل أ' }));
  const dialog = screen.getByRole('dialog');
  expect(dialog.textContent).toContain('أحمد العتيبي');
  expect(dialog.textContent).toContain('12');
});
it('keeps every one of six parent departments linked to its two children', () => {
  render(<OrganizationCommitteeChart {...props} committees={Array.from({ length: 6 }, (_, i) => committee('إدارة ' + i, [committee('أ ' + i), committee('ب ' + i)]))} readOnly />);
  expect(document.querySelectorAll('[data-node-id]')).toHaveLength(19);
  expect(document.querySelectorAll('[data-edge]')).toHaveLength(18);
  for (let i = 0; i < 6; i++) {
    expect(document.querySelector('[data-edge="إدارة ' + i + ':أ ' + i + '"]')).toBeTruthy();
    expect(document.querySelector('[data-edge="إدارة ' + i + ':ب ' + i + '"]')).toBeTruthy();
  }
});
