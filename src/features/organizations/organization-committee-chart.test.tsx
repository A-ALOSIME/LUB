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
it('shows icon actions directly, preselects a child parent, and confirms deletion', async () => {
  const ui = render(<OrganizationCommitteeChart {...props} committees={[committee('أ')]} />);
  const actions = screen.getByRole('group', { name: 'إجراءات أ' });
  expect([...actions.querySelectorAll('button')].map(button => button.getAttribute('aria-label'))).toEqual(['تعديل اللجنة: أ', 'إضافة لجنة فرعية: أ', 'حذف اللجنة: أ']);
  expect(actions.textContent).toBe('');
  expect(screen.queryByText('عامة')).toBeNull();
  expect(screen.queryByRole('menu')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'إضافة لجنة فرعية: أ' }));
  expect((await screen.findByRole('dialog')).textContent).toContain('أ');
  ui.unmount();
  render(<OrganizationCommitteeChart {...props} committees={[committee('أ')]} />);
  fireEvent.click(screen.getByRole('button', { name: 'حذف اللجنة: أ' }));
  expect((await screen.findByRole('alertdialog')).textContent).toContain('حذف لجنة أ؟');
});
it('opens the edit dialog directly from its icon', async () => {
  render(<OrganizationCommitteeChart {...props} committees={[committee('أ')]} />);
  fireEvent.click(screen.getByRole('button', { name: 'تعديل اللجنة: أ' }));
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
  expect(screen.queryByRole('group', { name: 'إجراءات أ' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'حذف اللجنة: أ' })).toBeNull();
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
  expect(dialog.textContent).toContain('١٢');
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

it('scales pixel node geometry with the central rem size and restores it on smaller screens', () => {
  const original = document.documentElement.style.fontSize;
  try {
    render(<OrganizationCommitteeChart {...props} committees={[committee('أ')]} />);
    document.documentElement.style.fontSize = '20px';
    fireEvent.resize(window);
    const node = document.querySelector('[data-node-id="أ"]')!;
    expect(node.getAttribute('data-width')).toBe('320');
    expect(node.getAttribute('data-height')).toBe('160');
    expect(node.getAttribute('data-y')).toBe('250');
    expect(document.querySelector<HTMLElement>('.committee-flow-canvas')!.style.height).toBe('510px');
    document.documentElement.style.fontSize = '16px';
    fireEvent.resize(window);
    const restored = document.querySelector('[data-node-id="أ"]')!;
    expect(restored.getAttribute('data-width')).toBe('256');
    expect(restored.getAttribute('data-height')).toBe('128');
    expect(restored.getAttribute('data-y')).toBe('200');
  } finally {
    document.documentElement.style.fontSize = original;
  }
});
