import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PayslipUploadStudio from './PayslipUploadStudio';

const mocks = vi.hoisted(() => ({ row: null as Record<string, unknown> | null, invoke: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => {
      const query: Record<string, unknown> = {};
      for (const method of ['select', 'eq', 'order', 'limit']) query[method] = () => query;
      query.maybeSingle = async () => ({ data: mocks.row, error: null });
      return query;
    },
    functions: { invoke: mocks.invoke },
  },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const processing = {
  id: 'batch-test', status: 'processing', phase: 'splitting', processed_count: 0,
  total_slips: 8, error: null, last_heartbeat: new Date().toISOString(),
  original_file_path: 'sources/user/test.pdf', original_filename: 'test.pdf',
  created_at: new Date().toISOString(), month: 10, year: 2026,
};

async function openStudio() {
  await act(async () => { render(<PayslipUploadStudio month="10" year="2026" onFinished={vi.fn()} />); });
  fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
    target: { files: [new File(['pdf'], 'new.pdf', { type: 'application/pdf' })] },
  });
}

beforeEach(() => { mocks.invoke.mockReset(); vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('payslip upload recovery', () => {
  it('allows a new upload when a legacy processing batch has no source PDF', async () => {
    mocks.row = { ...processing, original_file_path: null, last_heartbeat: null, phase: null };
    await openStudio();
    expect(screen.getByRole('button', { name: 'Procesează lotul' })).toBeEnabled();
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('unlocks the upload after the active batch is deleted', async () => {
    mocks.row = processing;
    await openStudio();
    expect(screen.getByRole('button', { name: 'Procesează lotul' })).toBeDisabled();
    mocks.row = null;
    await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
    expect(screen.getByRole('button', { name: 'Procesează lotul' })).toBeEnabled();
  });

  it('unlocks after a permanent failure and does not auto-retry it', async () => {
    mocks.row = processing;
    await openStudio();
    mocks.row = { ...processing, status: 'failed', phase: 'failed', error: 'PDF invalid' };
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
    expect(screen.getByRole('button', { name: 'Procesează lotul' })).toBeEnabled();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('stops automatic resumes after three attempts without progress', async () => {
    mocks.row = { ...processing, phase: 'paused', last_heartbeat: null };
    mocks.invoke.mockResolvedValue({ data: { ok: true }, error: null });
    await openStudio();
    for (let attempt = 0; attempt < 8; attempt++) {
      await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    }
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
    expect(mocks.invoke).toHaveBeenCalledTimes(3);
    expect(screen.getByRole('button', { name: 'Procesează lotul' })).toBeEnabled();
  });

  it('allows an operator to stop processing without deleting saved slips', async () => {
    mocks.row = processing;
    mocks.invoke.mockImplementation(async () => {
      mocks.row = { ...processing, status: 'failed', phase: 'cancelled' };
      return { data: { ok: true }, error: null };
    });
    await openStudio();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Oprește procesarea' })); });
    expect(mocks.invoke).toHaveBeenCalledWith('process-payslip-batch', { body: { action: 'cancel', batch_id: 'batch-test' } });
    expect(screen.getByRole('button', { name: 'Procesează lotul' })).toBeEnabled();
  });
});