import { Component, type ReactNode } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DashboardBulletinBoard from './DashboardBulletinBoard';

const state = vi.hoisted(() => ({ bulletins: [] as Array<{
  id: string; title: string; pages: string[]; enabled: boolean;
  expires_at: null; created_at: string;
}> }));
vi.mock('@/hooks/useAppSettings', () => ({
  useAppSettings: () => ({ settings: { kiosk_bulletins: state.bulletins }, loading: false }),
}));

class CaptureErrors extends Component<{ children: ReactNode; onError: (error: Error) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { this.props.onError(error); }
  render() { return this.state.failed ? null : this.props.children; }
}

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('bulletin withdrawal during playback', () => {
  it('does not crash when the current later poster is removed and another remains', () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    state.bulletins = ['first', 'second'].map(id => ({
      id, title: id, pages: [`https://example.test/${id}.jpg`], enabled: true,
      expires_at: null, created_at: '2026-10-06T08:16:00Z',
    }));
    const onError = vi.fn();
    const tree = () => <CaptureErrors onError={onError}><DashboardBulletinBoard /></CaptureErrors>;
    const { rerender } = render(tree());
    act(() => { vi.advanceTimersByTime(10000); });
    state.bulletins = state.bulletins.slice(0, 1);
    rerender(tree());
    expect(onError).not.toHaveBeenCalled();
  });
});