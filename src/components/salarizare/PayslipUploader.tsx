import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Upload, Loader2, Users, CheckCircle2, AlertCircle, Trash2, FileText, Send, Info, Clock, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

const MONTH_NAMES_RO = [
  'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
  'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie',
];

interface Batch {
  id: string;
  month: number;
  year: number;
  original_filename: string;
  total_slips: number;
  matched_count: number;
  unmatched_count: number;
  status: string;
  distributed_at: string | null;
  created_at: string;
}

interface Slip {
  id: string;
  name_detected: string;
  marca_detected: string | null;
  match_status: string;
  match_notes: string | null;
  employee_epd_id: string | null;
  file_path: string | null;
  net_amount: number | null;
}

const statusMeta: Record<string, { label: string; color: string; icon: any }> = {
  matched: { label: 'Asociat', color: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30', icon: CheckCircle2 },
  needs_confirm: { label: 'Confirmă', color: 'bg-amber-500/15 text-amber-700 border-amber-500/30', icon: AlertCircle },
  unmatched: { label: 'Neasociat', color: 'bg-red-500/15 text-red-700 border-red-500/30', icon: AlertCircle },
  duplicate_name: { label: 'Omonim', color: 'bg-orange-500/15 text-orange-700 border-orange-500/30', icon: Users },
  distributed: { label: 'Distribuit', color: 'bg-blue-500/15 text-blue-700 border-blue-500/30', icon: CheckCircle2 },
};

const batchStatusMeta: Record<string, { label: string; color: string; icon: any }> = {
  processing: { label: 'În procesare', color: 'bg-amber-500/15 text-amber-700 border-amber-500/30', icon: Loader2 },
  ready: { label: 'Procesat', color: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30', icon: CheckCircle2 },
  distributed: { label: 'Distribuit', color: 'bg-blue-500/15 text-blue-700 border-blue-500/30', icon: Send },
  failed: { label: 'Eșuat', color: 'bg-red-500/15 text-red-700 border-red-500/30', icon: XCircle },
  pending: { label: 'În așteptare', color: 'bg-muted text-muted-foreground border-border', icon: Clock },
};

const formatElapsed = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
};

const getFunctionErrorMessage = async (error: unknown, fallback: string) => {
  const maybeError = error as { message?: string; context?: Response };

  if (maybeError.context instanceof Response) {
    const response = maybeError.context.clone();
    try {
      const body = await response.json();
      if (typeof body?.error === 'string') {
        return typeof body.detail === 'string' ? `${body.error}: ${body.detail}` : body.error;
      }
    } catch {
      try {
        const text = await maybeError.context.clone().text();
        if (text.trim()) return text.trim();
      } catch {
        // keep fallback below
      }
    }
  }

  return maybeError.message || fallback;
};

export default function PayslipUploader() {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() === 0 ? 12 : now.getMonth()));
  const [year, setYear] = useState(String(now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()));
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [openBatch, setOpenBatch] = useState<string | null>(null);
  const [slips, setSlips] = useState<Slip[]>([]);
  const [employees, setEmployees] = useState<Array<{ id: string; first_name: string; last_name: string }>>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    phase: 'idle' | 'uploading' | 'detecting' | 'processing' | 'done' | 'failed';
    processed: number;
    total: number;
    startedAt: number;
    elapsedMs: number;
    message: string;
  } | null>(null);
  const pollRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);

  const loadBatches = async () => {
    const { data } = await supabase
      .from('payslip_batches')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(24);
    if (data) setBatches(data as Batch[]);
  };

  const loadSlips = async (batchId: string) => {
    const { data } = await supabase
      .from('payslips')
      .select('id, name_detected, marca_detected, match_status, match_notes, employee_epd_id, file_path, net_amount')
      .eq('batch_id', batchId)
      .order('name_detected');
    if (data) setSlips(data as Slip[]);
  };

  useEffect(() => {
    loadBatches();
    (async () => {
      const { data } = await supabase
        .from('employee_personal_data')
        .select('id, first_name, last_name')
        .eq('is_archived', false)
        .order('last_name');
      if (data) setEmployees(data);
    })();
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, []);

  const stopPolling = () => {
    if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
    if (tickRef.current) { window.clearInterval(tickRef.current); tickRef.current = null; }
  };

  const upload = async () => {
    if (!file) { toast.error('Selectați un fișier PDF'); return; }
    setUploading(true);
    const startedAt = Date.now();
    setProgress({ phase: 'uploading', processed: 0, total: 0, startedAt, elapsedMs: 0, message: 'Se încarcă fișierul către server…' });

    // Elapsed timer
    tickRef.current = window.setInterval(() => {
      setProgress(p => p ? { ...p, elapsedMs: Date.now() - p.startedAt } : p);
    }, 500);

    // Poll for the newly created batch and its progress
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    let trackedBatchId: string | null = null;

    pollRef.current = window.setInterval(async () => {
      try {
        if (!trackedBatchId && uid) {
          const { data: b } = await supabase
            .from('payslip_batches')
            .select('id, total_slips, status, created_at')
            .eq('uploaded_by', uid)
            .gte('created_at', new Date(startedAt - 5000).toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (b?.id) {
            trackedBatchId = b.id;
            setProgress(p => p ? { ...p, phase: 'processing', total: (b as any).total_slips ?? 0, message: 'Se împarte și se criptează fluturașii…' } : p);
          } else {
            setProgress(p => p ? { ...p, phase: 'detecting', message: 'Se detectează fluturașii în PDF…' } : p);
          }
        } else if (trackedBatchId) {
          const [{ count }, { data: b }] = await Promise.all([
            supabase.from('payslips').select('*', { count: 'exact', head: true }).eq('batch_id', trackedBatchId),
            supabase.from('payslip_batches').select('total_slips, status').eq('id', trackedBatchId).maybeSingle(),
          ]);
          setProgress(p => p ? {
            ...p,
            processed: count ?? p.processed,
            total: (b as any)?.total_slips ?? p.total,
            phase: (b as any)?.status === 'ready' ? 'done' : (b as any)?.status === 'failed' ? 'failed' : 'processing',
          } : p);
        }
      } catch { /* ignore polling errors */ }
    }, 1500);

    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('month', month);
      fd.append('year', year);
      const { data, error } = await supabase.functions.invoke('process-payslip-batch', {
        body: fd,
      });
      if (error) throw new Error(await getFunctionErrorMessage(error, 'Eroare la procesarea lotului'));
      if (data?.error) throw new Error(data.error);
      setProgress(p => p ? { ...p, phase: 'done', processed: (data.matched ?? 0) + (data.unmatched ?? 0), total: (data.matched ?? 0) + (data.unmatched ?? 0), message: 'Finalizat.' } : p);
      toast.success(`Procesat: ${data.matched} asociați / ${data.unmatched} de revizuit`);
      setFile(null);
      await loadBatches();
      if (data.batch_id) {
        setOpenBatch(data.batch_id);
        await loadSlips(data.batch_id);
      }
      window.setTimeout(() => setProgress(null), 3000);
    } catch (e) {
      setProgress(p => p ? { ...p, phase: 'failed', message: (e as Error).message || 'Eroare' } : p);
      toast.error((e as Error).message || 'Eroare la procesare');
    } finally {
      stopPolling();
      setUploading(false);
    }
  };

  const openBatchView = async (id: string) => {
    setOpenBatch(id);
    await loadSlips(id);
  };

  const assign = async (slipId: string, epdId: string) => {
    setBusy(slipId);
    try {
      const { error } = await supabase.functions.invoke('payslip-batch-action', {
        body: { action: 'assign', payslip_id: slipId, employee_epd_id: epdId },
      });
      if (error) throw new Error(await getFunctionErrorMessage(error, 'Eroare la asociere'));
      toast.success('Asociat. Re-procesați lotul pentru a cripta PDF-ul acestui angajat.');
      if (openBatch) await loadSlips(openBatch);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const distribute = async (batchId: string) => {
    setBusy(batchId);
    try {
      const { data, error } = await supabase.functions.invoke('payslip-batch-action', {
        body: { action: 'distribute_batch', batch_id: batchId },
      });
      if (error) throw new Error(await getFunctionErrorMessage(error, 'Eroare la distribuție'));
      if (data?.error) throw new Error(data.error);
      toast.success(`Distribuit către ${data.distributed} angajați (doar cei din whitelist pilot).`);
      await loadBatches();
      await loadSlips(batchId);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const deleteBatch = async (batchId: string) => {
    if (!confirm('Ștergeți lotul complet? Această acțiune elimină și fișierele criptate.')) return;
    setBusy(batchId);
    try {
      const { error } = await supabase.functions.invoke('payslip-batch-action', {
        body: { action: 'delete_batch', batch_id: batchId },
      });
      if (error) throw new Error(await getFunctionErrorMessage(error, 'Eroare la ștergere'));
      toast.success('Lot șters');
      setOpenBatch(null);
      setSlips([]);
      await loadBatches();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const currentBatch = batches.find(b => b.id === openBatch);
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Încărcare fluturași lunari
          </CardTitle>
          <CardDescription>
            Încărcați PDF-ul centralizator. Sistemul îl împarte per angajat, criptează cu ultimele 6 cifre din CNP și afișează raportul de asociere.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-amber-500/40 bg-amber-500/5">
            <Info className="w-4 h-4" />
            <AlertDescription className="text-xs">
              <strong>Fază pilot închisă.</strong> Fluturașii distribuiți sunt vizibili doar pentru angajații din whitelist-ul de test. Pentru restul angajaților, fișierele rămân criptate în sistem, dar tab-ul „Fluturașii mei" nu apare în profilul lor.
            </AlertDescription>
          </Alert>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-xs font-medium mb-1 block">Luna</label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES_RO.map((n, i) => (
                    <SelectItem key={i} value={String(i + 1)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">An</label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Fișier PDF</label>
              <Input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>

          <Button onClick={upload} disabled={uploading || !file} className="w-full sm:w-auto">
            {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            Procesează lotul
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Loturi procesate
          </CardTitle>
          <CardDescription>Ultimele loturi lunare. Faceți clic pe un lot pentru detalii.</CardDescription>
        </CardHeader>
        <CardContent>
          {batches.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">Niciun lot încărcat încă.</div>
          ) : (
            <div className="space-y-2">
              {batches.map(b => (
                <div key={b.id} className={`p-3 rounded-lg border transition-colors ${openBatch === b.id ? 'bg-accent/10 border-primary/40' : 'hover:bg-accent/5'}`}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <button className="text-left flex-1 min-w-0" onClick={() => openBatchView(b.id)}>
                      <div className="font-medium text-sm">
                        {MONTH_NAMES_RO[b.month - 1]} {b.year} — {b.total_slips} fluturași
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {b.original_filename} • {format(new Date(b.created_at), 'd MMM HH:mm', { locale: ro })} •{' '}
                        <span className="text-emerald-600">{b.matched_count} ok</span> /{' '}
                        <span className="text-amber-600">{b.unmatched_count} de revizuit</span>
                      </div>
                    </button>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{b.status}</Badge>
                      {b.status !== 'distributed' && (
                        <Button size="sm" variant="secondary" disabled={busy === b.id} onClick={() => distribute(b.id)}>
                          <Send className="w-3.5 h-3.5 mr-1" /> Distribuie
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" disabled={busy === b.id} onClick={() => deleteBatch(b.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {currentBatch && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Detalii: {MONTH_NAMES_RO[currentBatch.month - 1]} {currentBatch.year}
            </CardTitle>
            <CardDescription>{slips.length} fluturași detectați</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left p-2">Nume detectat</th>
                    <th className="text-left p-2">Marcă</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Asociere</th>
                  </tr>
                </thead>
                <tbody>
                  {slips.map(s => {
                    const meta = statusMeta[s.match_status] ?? statusMeta.unmatched;
                    const Icon = meta.icon;
                    return (
                      <tr key={s.id} className="border-b hover:bg-accent/5">
                        <td className="p-2 font-medium">{s.name_detected}</td>
                        <td className="p-2 text-muted-foreground">{s.marca_detected ?? '—'}</td>
                        <td className="p-2">
                          <Badge className={`${meta.color} border text-[10px]`}>
                            <Icon className="w-3 h-3 mr-1" /> {meta.label}
                          </Badge>
                          {s.match_notes && <div className="text-[10px] text-muted-foreground mt-1">{s.match_notes}</div>}
                        </td>
                        <td className="p-2">
                          {s.match_status === 'distributed' ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <Select
                              value={s.employee_epd_id ?? ''}
                              onValueChange={(v) => assign(s.id, v)}
                              disabled={busy === s.id}
                            >
                              <SelectTrigger className="h-8 text-xs w-56">
                                <SelectValue placeholder="Alege angajat…" />
                              </SelectTrigger>
                              <SelectContent>
                                {employees.map(e => (
                                  <SelectItem key={e.id} value={e.id}>
                                    {e.last_name} {e.first_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
