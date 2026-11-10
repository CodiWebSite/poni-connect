import { describe, it, expect } from 'vitest';
import { needsResume, stepFromPhase, etaMs } from './payslipBatchProgress';

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
