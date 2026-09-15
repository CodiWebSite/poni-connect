import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, CheckCircle2, XCircle, Clock, ShieldCheck } from 'lucide-react';

interface Summary {
  request_number: string;
  employee_name: string | null;
  department: string | null;
  start_date: string;
  end_date: string;
  working_days: number | null;
  status: string;
}

const fmt = (d: string) => d?.split('-').reverse().join('.');

/** Pagină publică de aprobare rapidă a concediului dintr-un link primit pe e-mail. */
export default function ApprovalLink() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<string>('loading');
  const [request, setRequest] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const call = async (action: 'info' | 'approve' | 'reject') => {
    const { data, error: fnError } = await supabase.functions.invoke('leave-approval-link', {
      body: { token, action, reason: action === 'reject' ? reason : undefined },
    });
    if (fnError) throw fnError;
    const res = data as any;
    if (res?.error) { setError(res.error); setState('error'); return; }
    setState(res.state);
    if (res.request) setRequest(res.request);
  };

  useEffect(() => {
    (async () => {
      try { await call('info'); } catch { setError('Link invalid sau expirat'); setState('error'); }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const act = async (action: 'approve' | 'reject') => {
    setBusy(true);
    try { await call(action); } catch { setError('Acțiunea nu a putut fi finalizată'); setState('error'); }
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Aprobare cerere de concediu
          </CardTitle>
          <CardDescription>Intranet ICMPP — aprobare rapidă din e-mail</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : state === 'error' ? (
            <div className="text-center py-6 space-y-2">
              <XCircle className="w-10 h-10 text-destructive mx-auto" />
              <p className="font-medium">{error || 'Link invalid'}</p>
              <p className="text-sm text-muted-foreground">Deschideți platforma pentru a procesa cererea.</p>
            </div>
          ) : state === 'expired' || state === 'used' ? (
            <div className="text-center py-6 space-y-2">
              <Clock className="w-10 h-10 text-muted-foreground mx-auto" />
              <p className="font-medium">
                {state === 'expired' ? 'Linkul a expirat' : 'Linkul a fost deja folosit'}
              </p>
              <p className="text-sm text-muted-foreground">Continuați direct din platformă.</p>
            </div>
          ) : (
            <>
              {request && (
                <div className="rounded-lg border border-border divide-y divide-border text-sm">
                  <Row label="Nr. cerere" value={request.request_number} />
                  <Row label="Angajat" value={request.employee_name || '—'} />
                  <Row label="Compartiment" value={request.department || '—'} />
                  <Row label="Perioada" value={`${fmt(request.start_date)} — ${fmt(request.end_date)}`} />
                  <Row label="Zile lucrătoare" value={String(request.working_days ?? '—')} />
                </div>
              )}

              {state === 'done' ? (
                <div className="text-center py-4 space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-primary mx-auto" />
                  <p className="font-medium">Acțiune înregistrată. Vă mulțumim!</p>
                  <p className="text-sm text-muted-foreground">
                    Semnătura digitală a fost aplicată automat (nume, dată și adresă IP).
                  </p>
                </div>
              ) : state === 'already_processed' ? (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Cererea a fost deja procesată în platformă.
                </p>
              ) : (
                <>
                  {rejecting && (
                    <Textarea
                      placeholder="Motivul respingerii"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={3}
                    />
                  )}
                  <div className="flex flex-col sm:flex-row gap-2">
                    {!rejecting ? (
                      <>
                        <Button className="flex-1" disabled={busy} onClick={() => act('approve')}>
                          {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                          Aprob cererea
                        </Button>
                        <Button variant="outline" className="flex-1" disabled={busy} onClick={() => setRejecting(true)}>
                          Resping
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="destructive"
                          className="flex-1"
                          disabled={busy || reason.trim().length < 3}
                          onClick={() => act('reject')}
                        >
                          {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          Confirm respingerea
                        </Button>
                        <Button variant="ghost" className="flex-1" onClick={() => setRejecting(false)}>
                          Renunț
                        </Button>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Prin apăsarea butonului semnați digital cererea, ca în platformă.
                  </p>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
