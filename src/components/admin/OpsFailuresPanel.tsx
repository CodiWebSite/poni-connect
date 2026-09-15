import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';
import { ro } from 'date-fns/locale';
import {
  AlertTriangle, CheckCircle2, Loader2, RefreshCw, Mail, Bell, RotateCcw, Check,
} from 'lucide-react';

interface OpsFailure {
  id: string;
  source: string;
  kind: string;
  subject: string | null;
  target: string | null;
  error: string | null;
  retry_function: string | null;
  status: string;
  retry_count: number;
  last_retry_at: string | null;
  created_at: string;
}

const kindMeta: Record<string, { icon: any; label: string }> = {
  email: { icon: Mail, label: 'E-mail' },
  push: { icon: Bell, label: 'Notificare' },
  sync: { icon: RefreshCw, label: 'Sincronizare' },
  job: { icon: RefreshCw, label: 'Job programat' },
};

/** Centru de sănătate: ce a eșuat în ultimele 24 de ore și reîncercare cu un clic. */
export function OpsFailuresPanel() {
  const [rows, setRows] = useState<OpsFailure[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('ops_failures')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) toast.error('Nu am putut încărca lista de erori');
    setRows((data || []) as OpsFailure[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const retry = async (row: OpsFailure) => {
    setBusyId(row.id);
    try {
      const { data, error } = await supabase.functions.invoke('retry-ops-failure', {
        body: { failure_id: row.id },
      });
      if (error) throw error;
      if ((data as any)?.ok) toast.success('Reîncercare reușită');
      else toast.error(`Reîncercarea a eșuat: ${(data as any)?.detail || 'motiv necunoscut'}`);
    } catch (e: any) {
      toast.error(e?.message || 'Reîncercarea a eșuat');
    } finally {
      setBusyId(null);
      load();
    }
  };

  const markResolved = async (row: OpsFailure) => {
    setBusyId(row.id);
    const { error } = await supabase
      .from('ops_failures')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('id', row.id);
    if (error) toast.error('Nu am putut marca înregistrarea');
    else toast.success('Marcat ca rezolvat');
    setBusyId(null);
    load();
  };

  const visible = rows.filter(r => showResolved || r.status !== 'resolved');
  const openCount = rows.filter(r => r.status !== 'resolved').length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 flex-wrap">
        <div>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning" />
            Ce a eșuat în ultimele 24 de ore
          </CardTitle>
          <CardDescription>
            E-mailuri, notificări și sincronizări nereușite, cu reîncercare dintr-un clic.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={openCount ? 'destructive' : 'secondary'}>
            {openCount} nerezolvate
          </Badge>
          <Button size="sm" variant="outline" onClick={() => setShowResolved(v => !v)}>
            {showResolved ? 'Ascunde rezolvate' : 'Arată rezolvate'}
          </Button>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && rows.length === 0 ? (
          <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : visible.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground flex flex-col items-center gap-2">
            <CheckCircle2 className="w-8 h-8 text-success" />
            Nimic nu a eșuat în ultimele 24 de ore.
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map(row => {
              const meta = kindMeta[row.kind] || kindMeta.job;
              const Icon = meta.icon;
              const resolved = row.status === 'resolved';
              return (
                <div
                  key={row.id}
                  className="p-3 rounded-lg border border-border bg-card/60 flex flex-wrap items-start gap-3"
                >
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-[220px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{row.subject || row.source}</p>
                      <Badge variant="outline" className="text-[10px]">{meta.label}</Badge>
                      {resolved && <Badge variant="secondary" className="text-[10px]">Rezolvat</Badge>}
                      {row.retry_count > 0 && (
                        <Badge variant="outline" className="text-[10px]">
                          {row.retry_count} reîncercări
                        </Badge>
                      )}
                    </div>
                    {row.target && (
                      <p className="text-xs text-muted-foreground">Către: {row.target}</p>
                    )}
                    {row.error && (
                      <p className="text-xs text-destructive/90 break-words">{row.error}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground/70 mt-1">
                      {row.source} • {format(new Date(row.created_at), 'dd.MM.yyyy HH:mm')} (
                      {formatDistanceToNow(new Date(row.created_at), { addSuffix: true, locale: ro })})
                    </p>
                  </div>
                  {!resolved && (
                    <div className="flex items-center gap-2">
                      {row.retry_function && (
                        <Button size="sm" variant="secondary" disabled={busyId === row.id} onClick={() => retry(row)}>
                          {busyId === row.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <RotateCcw className="w-4 h-4 mr-1" />}
                          Reîncearcă
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" disabled={busyId === row.id} onClick={() => markResolved(row)}>
                        <Check className="w-4 h-4 mr-1" /> Rezolvat
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default OpsFailuresPanel;
