import { describe, it, expect } from 'vitest';
import { defaultLayout, resolveLayout } from './dashboardWidgets';

describe('personal dashboard layout', () => {
  it('shows every card by default, in standard order', () => {
    const l = defaultLayout([]);
    expect(l[0]).toEqual({ id: 'bulletin', visible: true });
    expect(l.every(i => i.visible)).toBe(true);
    expect(l).toHaveLength(7);
  });
  it('keeps the saved order and hidden cards', () => {
    const l = resolveLayout([{ id: 'leave', visible: true }, { id: 'rooms', visible: false }], []);
    expect(l[0].id).toBe('leave');
    expect(l[1]).toEqual({ id: 'rooms', visible: false });
  });
  it('drops unknown cards and adds new ones at the end', () => {
    const l = resolveLayout([{ id: 'ghost', visible: true }, { id: 'leave', visible: true }], []);
    expect(l.some(i => (i.id as string) === 'ghost')).toBe(false);
    expect(l).toHaveLength(7);
  });
});
