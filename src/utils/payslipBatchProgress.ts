// Pure helpers for the resumable payslip batch pipeline (UI side).

export type PipelineStep = 'upload' | 'detect' | 'match' | 'split' | 'done';

export const PIPELINE_STEPS: { key: PipelineStep; label: string }[] = [
  { key: 'upload', label: 'Urcare PDF' },
  { key: 'detect', label: 'Detectare' },
  { key: 'match', label: 'Potrivire' },
  { key: 'split', label: 'Împărțire' },
  { key: 'done', label: 'Gata' },
];

/** Map the server `phase` column to the visible pipeline step. */
export function stepFromPhase(phase: string | null | undefined, status?: string | null): PipelineStep {
  if (status === 'ready' || status === 'distributed' || phase === 'done') return 'done';
  switch (phase) {
    case 'matching': return 'match';
    case 'splitting': case 'paused': case 'resuming': return 'split';
    case 'queued': case 'detecting': return 'detect';
    default: return 'detect';
  }
}

export interface ResumableBatch {
  status: string;
  phase?: string | null;
  original_file_path?: string | null;
  last_heartbeat?: string | null;
}

/** Legacy batches without a stored source cannot run or lock a new upload. */
export function isRunnableBatch(b: ResumableBatch): boolean {
  return b.status === 'processing' && !!b.original_file_path && b.phase !== 'failed' && b.phase !== 'cancelled';
}

/** Only resumable processing batches may be retried automatically. */
export function needsResume(
  b: ResumableBatch,
  nowMs: number,
  staleMs = 120_000,
): boolean {
  if (!isRunnableBatch(b)) return false;
  if (b.phase === 'paused') return true;
  if (!b.last_heartbeat) return true;
  return nowMs - new Date(b.last_heartbeat).getTime() > staleMs;
}

/** Remaining time estimate from processed rate; null when unknown. */
export function etaMs(processed: number, total: number, elapsedMs: number): number | null {
  if (processed <= 0 || total <= 0 || processed >= total) return null;
  return Math.round((elapsedMs / processed) * (total - processed));
}

// ---- Global "long job running" flag, read by the connectivity overlay ----
let activeJobs = 0;
export const backgroundJob = {
  start() { activeJobs++; },
  end() { activeJobs = Math.max(0, activeJobs - 1); },
  isActive() { return activeJobs > 0; },
};
