import { useEffect, useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import MobileNav from '@/components/layout/MobileNav';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, LogOut, History, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { RequireReasonDialog } from '@/components/shared/RequireReasonDialog';

export default function AccountSecurity() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [mfaLevel, setMfaLevel] = useState<string>('—');
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [signOutDialog, setSignOutDialog] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

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
      setLoading(false);
    })();
  }, [user]);

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
    </div>
  );
}
