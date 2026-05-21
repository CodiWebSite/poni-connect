import { useEffect, useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import MobileNav from '@/components/layout/MobileNav';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ShieldCheck, LogOut, History, AlertTriangle, Loader2, KeyRound,
  Smartphone, Trash2, Copy, RefreshCw, Download,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { RequireReasonDialog } from '@/components/shared/RequireReasonDialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const TRUSTED_TOKEN_KEY = 'icmpp_trusted_device_token';

interface TrustedDevice {
  id: string;
  friendly_name: string | null;
  user_agent_summary: string | null;
  created_at: string;
  last_used_at: string | null;
  expires_at: string;
  last_ip: string | null;
}

export default function AccountSecurity() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [mfaLevel, setMfaLevel] = useState<string>('—');
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [signOutDialog, setSignOutDialog] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Trusted devices
  const [devices, setDevices] = useState<TrustedDevice[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [revokeAllOpen, setRevokeAllOpen] = useState(false);

  // Recovery codes
  const [codesGenerating, setCodesGenerating] = useState(false);
  const [generatedCodes, setGeneratedCodes] = useState<string[] | null>(null);
  const [codesStatus, setCodesStatus] = useState<{ unused: number; total: number } | null>(null);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      setMfaLevel(aal?.currentLevel ?? '—');
      const { data: ev } = await supabase
        .from('security_events')
        .select('id, event_type, severity, created_at, details')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(15);
      setEvents(ev ?? []);
      await Promise.all([loadDevices(), loadCodesStatus()]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadDevices = async () => {
    if (!user) return;
    setDevicesLoading(true);
    const { data } = await supabase
      .from('trusted_auth_devices')
      .select('id, friendly_name, user_agent_summary, created_at, last_used_at, expires_at, last_ip')
      .eq('user_id', user.id)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('last_used_at', { ascending: false, nullsFirst: false });
    setDevices((data as TrustedDevice[]) ?? []);
    setDevicesLoading(false);
  };

  const loadCodesStatus = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('mfa_recovery_codes')
      .select('id, used_at')
      .eq('user_id', user.id);
    if (!data) return;
    setCodesStatus({
      total: data.length,
      unused: data.filter((d: any) => !d.used_at).length,
    });
  };

  const doGlobalSignOut = async () => {
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) throw error;
      toast({ title: 'Sesiuni închise', description: 'Toate sesiunile au fost deconectate.' });
      window.location.href = '/auth';
    } catch (e: any) {
      toast({ title: 'Eroare', description: e?.message, variant: 'destructive' });
    } finally { setSigningOut(false); }
  };

  const revokeDevice = async (id: string) => {
    try {
      const { error } = await supabase.functions.invoke('mfa-trusted-revoke', { body: { id } });
      if (error) throw error;
      toast({ title: 'Dispozitiv revocat' });
      await loadDevices();
    } catch (e: any) {
      toast({ title: 'Eroare', description: e?.message, variant: 'destructive' });
    }
  };

  const revokeAllDevices = async () => {
    try {
      const { error } = await supabase.functions.invoke('mfa-trusted-revoke', { body: { all: true } });
      if (error) throw error;
      localStorage.removeItem(TRUSTED_TOKEN_KEY);
      toast({ title: 'Toate dispozitivele au fost revocate' });
      await loadDevices();
    } catch (e: any) {
      toast({ title: 'Eroare', description: e?.message, variant: 'destructive' });
    } finally { setRevokeAllOpen(false); }
  };

  const generateRecoveryCodes = async () => {
    setCodesGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('mfa-recovery-generate', { body: {} });
      if (error || !data?.codes) throw new Error(data?.error || 'Eroare la generare');
      setGeneratedCodes(data.codes as string[]);
      await loadCodesStatus();
      toast({
        title: 'Coduri generate',
        description: 'Salvează-le într-un loc sigur — nu vor mai fi afișate din nou.',
      });
    } catch (e: any) {
      toast({ title: 'Eroare', description: e?.message, variant: 'destructive' });
    } finally {
      setCodesGenerating(false);
      setConfirmRegenerate(false);
    }
  };

  const downloadCodes = () => {
    if (!generatedCodes) return;
    const txt = [
      'ICMPP Intranet — Coduri de recuperare 2FA',
      `Cont: ${user?.email}`,
      `Generate: ${new Date().toLocaleString('ro-RO')}`,
      '',
      'Fiecare cod poate fi folosit O SINGURĂ DATĂ.',
      'După utilizarea unui cod, 2FA va trebui reconfigurat.',
      '',
      ...generatedCodes,
    ].join('\n');
    const blob = new Blob([txt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `icmpp-recovery-codes-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyCodes = async () => {
    if (!generatedCodes) return;
    await navigator.clipboard.writeText(generatedCodes.join('\n'));
    toast({ title: 'Coduri copiate în clipboard' });
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <MobileNav />
      <main className="lg:ml-64 px-4 lg:px-8 py-8 max-w-4xl mx-auto space-y-6">
        <header>
          <h1 className="text-3xl font-display font-bold flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-primary" /> Securitatea contului meu
          </h1>
          <p className="text-muted-foreground mt-2">Starea autentificării, alertele și sesiunile tale.</p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Autentificare în doi pași (2FA)</CardTitle>
            <CardDescription>Nivelul curent de asigurare a autentificării.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant={mfaLevel === 'aal2' ? 'default' : 'secondary'}>
                {mfaLevel === 'aal2' ? 'AAL2 — 2FA activ' : `Nivel: ${mfaLevel}`}
              </Badge>
            </div>
            <Button variant="outline" onClick={() => window.location.assign('/settings')}>Gestionează 2FA</Button>
          </CardContent>
        </Card>

        {/* Recovery codes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5" /> Coduri de recuperare 2FA
            </CardTitle>
            <CardDescription>
              Folosește-le dacă pierzi accesul la aplicația de autentificare. Fiecare cod este de unică folosință
              și resetează complet 2FA la utilizare.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {codesStatus && !generatedCodes && (
              <div className="text-sm text-muted-foreground">
                Stare actuală:{' '}
                <strong className="text-foreground">{codesStatus.unused}</strong> /{' '}
                {codesStatus.total} coduri neutilizate
                {codesStatus.unused === 0 && codesStatus.total > 0 && (
                  <span className="ml-2 text-warning">— niciun cod activ, regenerează acum.</span>
                )}
                {codesStatus.total === 0 && (
                  <span className="ml-2 text-warning">— nu ai generat încă coduri.</span>
                )}
              </div>
            )}

            {generatedCodes ? (
              <div className="space-y-3">
                <div className="rounded-md bg-warning/10 border border-warning/30 px-3 py-2 text-xs flex gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                  <span>Aceste coduri <strong>NU vor mai fi afișate</strong>. Salvează-le acum într-un loc sigur.</span>
                </div>
                <div className="grid grid-cols-2 gap-2 font-mono text-sm bg-muted/40 border rounded-md p-3">
                  {generatedCodes.map((c, i) => (
                    <div key={i} className="px-2 py-1.5 bg-background rounded text-center tracking-wider">
                      {c}
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={copyCodes}>
                    <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiază
                  </Button>
                  <Button variant="outline" size="sm" onClick={downloadCodes}>
                    <Download className="w-3.5 h-3.5 mr-1.5" /> Descarcă .txt
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setGeneratedCodes(null)}>
                    Am salvat codurile
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant={codesStatus && codesStatus.unused > 0 ? 'outline' : 'default'}
                onClick={() => (codesStatus && codesStatus.total > 0 ? setConfirmRegenerate(true) : generateRecoveryCodes())}
                disabled={codesGenerating || mfaLevel !== 'aal2'}
              >
                {codesGenerating
                  ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  : <RefreshCw className="w-4 h-4 mr-2" />}
                {codesStatus && codesStatus.total > 0 ? 'Regenerează coduri' : 'Generează coduri de recuperare'}
              </Button>
            )}
            {mfaLevel !== 'aal2' && (
              <p className="text-xs text-muted-foreground">Activează 2FA pentru a genera coduri de recuperare.</p>
            )}
          </CardContent>
        </Card>

        {/* Trusted devices */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5" /> Dispozitive de încredere
            </CardTitle>
            <CardDescription>
              Browserele marcate ca „de încredere" nu vor cere codul 2FA timp de 30 de zile.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {devicesLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : devices.length === 0 ? (
              <p className="text-sm text-muted-foreground">Niciun dispozitiv de încredere înregistrat.</p>
            ) : (
              <ul className="divide-y">
                {devices.map(d => (
                  <li key={d.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="text-sm min-w-0">
                      <div className="font-medium truncate">{d.friendly_name || 'Dispozitiv'}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {d.user_agent_summary || '—'}
                      </div>
                      <div className="text-[11px] text-muted-foreground/80 mt-0.5">
                        Ultimă folosire: {d.last_used_at ? new Date(d.last_used_at).toLocaleString('ro-RO') : 'niciodată'}
                        {' · '}Expiră: {new Date(d.expires_at).toLocaleDateString('ro-RO')}
                        {d.last_ip ? ` · IP ${d.last_ip}` : ''}
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => revokeDevice(d.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {devices.length > 0 && (
              <Button variant="destructive" size="sm" onClick={() => setRevokeAllOpen(true)}>
                Revocă toate dispozitivele
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><History className="w-5 h-5" /> Ultimele evenimente de securitate</CardTitle>
            <CardDescription>Schimbări de rol, autentificări nereușite, resetări 2FA etc.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> :
              events.length === 0 ? <p className="text-sm text-muted-foreground">Niciun eveniment înregistrat.</p> : (
              <ul className="divide-y">
                {events.map(e => (
                  <li key={e.id} className="py-2.5 flex items-center justify-between text-sm">
                    <div>
                      <div className="font-medium">{e.event_type}</div>
                      <div className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString('ro-RO')}</div>
                    </div>
                    <Badge variant={e.severity === 'critical' ? 'destructive' : e.severity === 'warning' ? 'secondary' : 'outline'}>
                      {e.severity}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><LogOut className="w-5 h-5" /> Sesiuni active</CardTitle>
            <CardDescription>Deconectează-te de pe toate dispozitivele dacă suspectezi compromiterea contului.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={() => setSignOutDialog(true)} disabled={signingOut}>
              {signingOut && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Deconectează toate sesiunile
            </Button>
          </CardContent>
        </Card>

        <Card className="border-warning/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-warning" /> Suspectezi un incident?</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>Raportează imediat la <a className="underline" href="/raporteaza-incident">/raporteaza-incident</a>.</p>
            <p className="text-muted-foreground">Echipa de securitate este notificată automat.</p>
          </CardContent>
        </Card>
      </main>

      <RequireReasonDialog
        open={signOutDialog} onOpenChange={setSignOutDialog}
        title="Deconectare globală"
        description="Vei fi deconectat de pe TOATE dispozitivele. Te rugăm să confirmi parola și motivul."
        action="global_sign_out"
        entityType="auth.session"
        onConfirm={doGlobalSignOut}
      />

      <AlertDialog open={revokeAllOpen} onOpenChange={setRevokeAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revocă toate dispozitivele?</AlertDialogTitle>
            <AlertDialogDescription>
              Toate browserele de încredere vor trebui să introducă din nou codul 2FA
              la următoarea autentificare.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction onClick={revokeAllDevices}>Revocă tot</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmRegenerate} onOpenChange={setConfirmRegenerate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerează coduri de recuperare?</AlertDialogTitle>
            <AlertDialogDescription>
              Toate codurile vechi vor fi invalidate. Asigură-te că salvezi noile coduri într-un loc sigur.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction onClick={generateRecoveryCodes}>Regenerează</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
