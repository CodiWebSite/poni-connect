import { describe, it, expect } from 'vitest';
import { needsResume as checkResume, isRunnableBatch, stepFromPhase, etaMs, type ResumableBatch } from './payslipBatchProgress';

const needsResume = (batch: ResumableBatch, nowMs: number) => checkResume({ original_file_path: 'sources/user/month.pdf', ...batch }, nowMs);

const now = Date.parse('2026-11-10T10:00:00Z');

describe('payslip batch resume rules', () => {
  it('resumes a processing batch silent for more than 2 minutes', () => {
    expect(needsResume({ status: 'processing', phase: 'splitting', last_heartbeat: '2026-11-10T09:57:00Z' }, now)).toBe(true);
  });
  it('does not resume a batch that reported 30 seconds ago', () => {
    expect(needsResume({ status: 'processing', phase: 'splitting', last_heartbeat: '2026-11-10T09:59:30Z' }, now)).toBe(false);
  });
  it('resumes a paused batch immediately', () => {
    expect(needsResume({ status: 'processing', phase: 'paused', last_heartbeat: '2026-11-10T09:59:59Z' }, now)).toBe(true);
  });
  it('never resumes a finished batch', () => {
    expect(needsResume({ status: 'ready', phase: 'done', last_heartbeat: null }, now)).toBe(false);
  });
  it('never retries a legacy batch with no source file', () => {
    expect(needsResume({ status: 'processing', phase: 'paused', original_file_path: null, last_heartbeat: null }, now)).toBe(false);
    expect(isRunnableBatch({ status: 'processing', original_file_path: null })).toBe(false);
  });
  it('never retries a failed or cancelled batch automatically', () => {
    expect(needsResume({ status: 'failed', phase: 'failed', last_heartbeat: null }, now)).toBe(false);
    expect(needsResume({ status: 'processing', phase: 'cancelled', last_heartbeat: null }, now)).toBe(false);
  });
  it('maps phases to steps', () => {
    expect(stepFromPhase('matching')).toBe('match');
    expect(stepFromPhase('splitting')).toBe('split');
    expect(stepFromPhase(null, 'ready')).toBe('done');
  });
  it('estimates remaining time', () => {
    expect(etaMs(100, 260, 50_000)).toBe(80_000);
    expect(etaMs(0, 260, 1000)).toBeNull();
  });
});
