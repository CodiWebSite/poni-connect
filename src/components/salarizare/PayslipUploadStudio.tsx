import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Loader2, CheckCircle2, RotateCw, CloudUpload, X, Sparkles, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PIPELINE_STEPS, PipelineStep, stepFromPhase, needsResume, isRunnableBatch, etaMs, backgroundJob } from '@/utils/payslipBatchProgress';

interface Props {
  month: string;
  year: string;
  onFinished: (batchId: string) => void;
}

interface LiveBatch {
  id: string;
  status: string;
  phase: string | null;
  processed_count: number;
  total_slips: number;
  last_heartbeat: string | null;
  error: string | null;
  created_at: string;
  original_filename: string;
  original_file_path: string | null;
  month: number;
  year: number;
}

const fmt = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return s >= 60 ? `${Math.floor(s / 60)} min ${s % 60}s` : `${s}s`;
};

/** Upload a file to private storage with real progress and automatic retries. */
async function uploadWithProgress(path: string, file: File, onProgress: (pct: number) => void) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sesiunea a expirat — autentificați-vă din nou.');
  const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/payslips/${path}`;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url);
        xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
        xhr.setRequestHeader('apikey', import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
        xhr.setRequestHeader('x-upsert', 'true');
        xhr.setRequestHeader('Content-Type', 'application/pdf');
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Încărcare refuzată (${xhr.status})`)));
        xhr.onerror = () => reject(new Error('Conexiune întreruptă'));
        xhr.timeout = 10 * 60_000;
        xhr.ontimeout = () => reject(new Error('Încărcarea a durat prea mult'));
        xhr.send(file);
      });
      return;
    } catch (e) {
      lastErr = e;
      if (attempt < 4) await new Promise(r => setTimeout(r, attempt * 3000));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Încărcare eșuată');
}

export default function PayslipUploadStudio({ month, year, onFinished }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [batch, setBatch] = useState<LiveBatch | null>(null);
  const [now, setNow] = useState(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);
  const resumingRef = useRef(false);
  const finishedRef = useRef<string | null>(null);
  const retryRef = useRef({ id: '', progress: -1, attempts: 0 });
  const [retryLimitReached, setRetryLimitReached] = useState(false);
  const [stopping, setStopping] = useState(false);

  const runnable = batch ? isRunnableBatch(batch) : false;
  const busy = uploadPct !== null || (runnable && !retryLimitReached);

  // Keep the connectivity overlay quiet while a long job runs.
  useEffect(() => {
    if (!busy) return;
    backgroundJob.start();
    return () => backgroundJob.end();
  }, [busy]);

  const fetchBatch = useCallback(async (id: string) => {
    const { data, error } = await supabase.from('payslip_batches')
      .select('id,status,phase,processed_count,total_slips,last_heartbeat,error,created_at,original_filename,original_file_path,month,year')
      .eq('id', id).maybeSingle();
    if (error) throw error; // A network error is not a deleted batch.
    setBatch(current => !current || current.id === id ? data as LiveBatch | null : current);
    return data as LiveBatch | null;
  }, []);

  // On open: pick up any batch still processing (e.g. page was closed mid-way).
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('payslip_batches')
        .select('id,status,phase,processed_count,total_slips,last_heartbeat,error,created_at,original_filename,original_file_path,month,year')
        .eq('status', 'processing').order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (data) setBatch(data as LiveBatch);
    })();
  }, []);

  const resume = useCallback(async (id: string, manual = false) => {
    if (resumingRef.current) return;
    resumingRef.current = true;
    try {
      const { error } = await supabase.functions.invoke('process-payslip-batch', { body: { action: 'resume', batch_id: id } });
      if (error) throw error;
      await fetchBatch(id);
      if (manual) {
        retryRef.current.attempts = 0;
        setRetryLimitReached(false);
      }
      if (manual) toast.success('Procesarea continuă de unde a rămas.');
    } catch {
      if (manual) toast.error('Nu am putut relua acum. Încercați din nou peste un minut.');
    } finally {
      setTimeout(() => { resumingRef.current = false; }, 15_000);
    }
  }, [fetchBatch]);

  // Poll the live batch; auto-resume if the server went silent.
  useEffect(() => {
    if (!batch || batch.status !== 'processing') return;
    const t = window.setInterval(async () => {
      setNow(Date.now());
      try {
        const b = await fetchBatch(batch.id);
        if (!b) return;
        if (retryRef.current.id !== b.id || retryRef.current.progress !== b.processed_count) {
          retryRef.current = { id: b.id, progress: b.processed_count, attempts: 0 };
          setRetryLimitReached(false);
        }
        if (needsResume(b, Date.now()) && !resumingRef.current) {
          if (retryRef.current.attempts >= 3) {
            setRetryLimitReached(true);
          } else {
            retryRef.current.attempts++;
            resume(b.id);
          }
        }
      } catch { /* network blip — next tick retries */ }
    }, 2500);
    return () => window.clearInterval(t);
  }, [batch?.id, batch?.status, fetchBatch, resume]);

  const stop = async () => {
    if (!batch || stopping) return;
    setStopping(true);
    try {
      const { error } = await supabase.functions.invoke('process-payslip-batch', {
        body: { action: 'cancel', batch_id: batch.id },
      });
      if (error) throw error;
      await fetchBatch(batch.id);
      toast.success('Procesare oprită. Fluturașii deja salvați rămân în istoric.');
    } catch {
      toast.error('Nu am putut opri procesarea. Încercați din nou.');
    } finally {
      setStopping(false);
    }
  };

  // Finished → notify parent once.
  useEffect(() => {
    if (batch && batch.status === 'ready' && finishedRef.current !== batch.id) {
      finishedRef.current = batch.id;
      toast.success(`Lot procesat: ${batch.total_slips} fluturași`);
      onFinished(batch.id);
      if (document.visibilityState !== 'visible' && 'Notification' in window && Notification.permission === 'granted') {
        try { new Notification('Fluturași procesați', { body: `${batch.total_slips} fluturași sunt gata de verificat.` }); } catch { /* ignore */ }
      }
    }
  }, [batch, onFinished]);

  const pick = (f: File | null | undefined) => {
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) { toast.error('Alegeți un fișier PDF'); return; }
    setFile(f);
  };

  const start = async () => {
    if (!file) return;
    try {
      if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error('Sesiunea a expirat.');
      const path = `sources/${u.user.id}/${year}-${month.padStart(2, '0')}-${Date.now()}.pdf`;
      setUploadPct(0);
      await uploadWithProgress(path, file, setUploadPct);
      const { data, error } = await supabase.functions.invoke('process-payslip-batch', {
        body: { action: 'start', source_path: path, month: Number(month), year: Number(year), filename: file.name },
      });
      if (error || !data?.batch_id) throw new Error(data?.error || 'Nu am putut porni procesarea');
      setUploadPct(null);
      setFile(null);
      finishedRef.current = null;
      retryRef.current = { id: '', progress: -1, attempts: 0 };
      setRetryLimitReached(false);
      setBatch(null);
      await fetchBatch(data.batch_id);
      toast.success('PDF urcat. Procesarea continuă pe server — puteți lucra în altă parte.');
    } catch (e) {
      setUploadPct(null);
      toast.error((e as Error).message || 'Eroare la încărcare');
    }
  };

  const step: PipelineStep = uploadPct !== null ? 'upload' : stepFromPhase(batch?.phase, batch?.status);
  const stepIdx = PIPELINE_STEPS.findIndex(s => s.key === step);
  const processed = batch?.processed_count ?? 0;
  const total = batch?.total_slips ?? 0;
  const pct = uploadPct !== null ? uploadPct
    : batch?.status === 'ready' ? 100
    : total > 0 ? Math.round((processed / total) * 100) : 0;
  const elapsed = batch ? now - new Date(batch.created_at).getTime() : 0;
  const eta = etaMs(processed, total, elapsed);
  const stale = batch ? needsResume(batch, now) : false;
  const showPipeline = uploadPct !== null || (batch && (runnable || finishedRef.current === batch.id));
  const blocked = batch && (batch.status === 'failed' || (batch.status === 'processing' && !runnable) || retryLimitReached);

  const R = 34, C = 2 * Math.PI * R;

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Alegeți PDF-ul centralizator"
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !busy) inputRef.current?.click(); }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!busy) pick(e.dataTransfer.files?.[0]); }}
        className={cn(
          'relative overflow-hidden rounded-2xl border-2 border-dashed p-6 sm:p-8 text-center transition-all cursor-pointer',
          'bg-gradient-to-br from-primary/5 via-background to-accent/10 backdrop-blur',
          dragOver ? 'border-primary scale-[1.01] shadow-lg' : 'border-primary/25 hover:border-primary/60',
          busy && 'opacity-60 cursor-not-allowed',
        )}
      >
        <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        {file ? (
          <div className="flex items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center"><FileText className="w-6 h-6 text-primary" /></div>
            <div className="text-left min-w-0">
              <div className="font-medium truncate max-w-[240px] sm:max-w-md">{file.name}</div>
              <div className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB · gata de procesare</div>
            </div>
            {!busy && (
              <Button size="icon" variant="ghost" aria-label="Elimină fișierul" onClick={(e) => { e.stopPropagation(); setFile(null); }}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
              <CloudUpload className="w-7 h-7 text-primary" />
            </div>
            <div className="font-medium">Trageți aici PDF-ul centralizator</div>
            <div className="text-xs text-muted-foreground mt-1">sau apăsați pentru a-l alege · procesarea continuă chiar dacă închideți pagina</div>
          </>
        )}
      </div>

      <Button onClick={start} disabled={busy || !file} size="lg" className="w-full sm:w-auto">
        {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
        Procesează lotul
      </Button>

      {blocked && uploadPct === null && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-2">
          <div className="flex items-start gap-2 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
            <div className="min-w-0">
              <p className="font-medium break-words">{batch.original_filename}</p>
              <p className="text-muted-foreground break-words">{!batch.original_file_path
                ? 'Lotul vechi nu are PDF-ul sursă. Încărcați din nou centralizatorul.'
                : retryLimitReached ? 'Reluarea automată s-a oprit după trei încercări fără progres.'
                : batch.error || 'Procesarea s-a oprit. Puteți încărca un PDF nou.'}</p>
            </div>
          </div>
          {batch.original_file_path && batch.phase !== 'cancelled' && (
            <Button size="sm" variant="outline" onClick={() => resume(batch.id, true)}>
              <RotateCw className="w-3.5 h-3.5 mr-1.5" /> Reîncearcă procesarea
            </Button>
          )}
        </div>
      )}

      {/* Live pipeline */}
      {showPipeline && (
        <div className="rounded-2xl border bg-card/70 backdrop-blur p-4 sm:p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-5 sm:items-center">
            <div className="relative w-24 h-24 shrink-0 mx-auto sm:mx-0">
              <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
                <circle cx="40" cy="40" r={R} className="stroke-muted fill-none" strokeWidth="7" />
                <circle cx="40" cy="40" r={R} className="stroke-primary fill-none transition-all duration-700" strokeWidth="7"
                  strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C - (C * pct) / 100} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold tabular-nums">{pct}%</span>
              </div>
            </div>

            <div className="flex-1 min-w-0 space-y-3">
              <ol className="flex items-center gap-1 sm:gap-2">
                {PIPELINE_STEPS.map((s, i) => {
                  const done = i < stepIdx || (s.key === 'done' && step === 'done');
                  const active = i === stepIdx && step !== 'done';
                  return (
                    <li key={s.key} className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
                      <div className={cn(
                        'w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 border transition-colors',
                        done && 'bg-primary text-primary-foreground border-primary',
                        active && 'border-primary text-primary bg-primary/10',
                        !done && !active && 'border-border text-muted-foreground',
                      )}>
                        {done ? <CheckCircle2 className="w-4 h-4" /> : active ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : i + 1}
                      </div>
                      <span className={cn('text-[11px] sm:text-xs truncate hidden sm:inline', active ? 'text-foreground font-medium' : 'text-muted-foreground')}>{s.label}</span>
                      {i < PIPELINE_STEPS.length - 1 && <div className={cn('h-px flex-1 min-w-2', i < stepIdx ? 'bg-primary' : 'bg-border')} />}
                    </li>
                  );
                })}
              </ol>

              <div className="text-sm">
                {uploadPct !== null && <>Se urcă PDF-ul în siguranță… <span className="text-muted-foreground">{uploadPct}%</span></>}
                {uploadPct === null && batch?.status === 'processing' && (
                  total > 0
                    ? <>Fluturașul <b className="tabular-nums">{processed}</b> din <b className="tabular-nums">{total}</b>{eta !== null && <span className="text-muted-foreground"> · ~{fmt(eta)} rămas</span>}</>
                    : <>Se citește PDF-ul și se detectează fluturașii…</>
                )}
                {batch?.status === 'ready' && uploadPct === null && (
                  <span className="inline-flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-primary" /> Gata — {total} fluturași, verificați lotul mai jos.</span>
                )}
              </div>

              {uploadPct === null && batch?.status === 'processing' && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>Puteți închide pagina — serverul continuă singur.</span>
                  {(stale || batch.error) && !blocked && (
                    <Button size="sm" variant="outline" onClick={() => resume(batch.id, true)}>
                      <RotateCw className="w-3.5 h-3.5 mr-1.5" /> Continuă procesarea
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" disabled={stopping} onClick={stop}>
                    <X className="w-3.5 h-3.5 mr-1.5" /> Oprește procesarea
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
