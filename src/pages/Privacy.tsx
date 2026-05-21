import { useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import MobileNav from '@/components/layout/MobileNav';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FileLock2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

const RIGHTS = [
  { code: 'access',         label: 'Dreptul de acces',         desc: 'Obține o copie a datelor tale.' },
  { code: 'rectification',  label: 'Rectificare',              desc: 'Corectează date incorecte sau incomplete.' },
  { code: 'restriction',    label: 'Restricționare',           desc: 'Limitează prelucrarea în anumite condiții.' },
  { code: 'deletion',       label: 'Ștergere („dreptul de a fi uitat")', desc: 'Cere ștergerea datelor (acolo unde nu există obligație legală).' },
  { code: 'portability',    label: 'Portabilitate',            desc: 'Primește datele într-un format structurat.' },
  { code: 'complaint',      label: 'Plângere',                 desc: 'Înregistrează o plângere internă; ANSPDCP rămâne disponibil extern.' },
];

const DATA_CATEGORIES = [
  { cat: 'Identificare', items: 'nume, prenume, email instituțional, CNP (HR), telefon', basis: 'Contract muncă / obligație legală' },
  { cat: 'Profesionale', items: 'funcție, departament, dată angajare, tip contract, concedii', basis: 'Contract muncă' },
  { cat: 'Medicale (medicina muncii)', items: 'fișa medicală, aptitudine, expirări', basis: 'Obligație legală (HG 355/2007)' },
  { cat: 'Autentificare', items: 'jurnal login, evenimente securitate, 2FA', basis: 'Interes legitim (securitate)' },
  { cat: 'Conținut platformă', items: 'mesaje chat, fișiere, anunțuri', basis: 'Interes legitim / consimțământ' },
];

export default function Privacy() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { enabled: gdprEnabled } = useFeatureFlag('gdpr_requests_enabled', true);
  const [type, setType] = useState('access');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!user) return;
    if (desc.trim().length < 10) { toast({ title: 'Descriere prea scurtă', variant: 'destructive' }); return; }
    setBusy(true);
    try {
      const { error } = await supabase.from('gdpr_requests').insert({
        user_id: user.id, request_type: type, description: desc.trim(),
      });
      if (error) throw error;
      toast({ title: 'Cerere înregistrată', description: 'Vei fi contactat în maxim 30 de zile (Art. 12 GDPR).' });
      setDesc('');
    } catch (e: any) {
      toast({ title: 'Eroare', description: e?.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <MobileNav />
      <main className="lg:ml-64 px-4 lg:px-8 py-8 max-w-4xl mx-auto space-y-6">
        <header>
          <h1 className="text-3xl font-display font-bold flex items-center gap-3">
            <FileLock2 className="w-8 h-8 text-primary" /> Confidențialitate & GDPR
          </h1>
          <p className="text-muted-foreground mt-2">
            Cum prelucrăm datele tale, ce drepturi ai și cum le poți exercita.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Operatorul de date</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p><strong>Institutul de Chimie Macromoleculară „Petru Poni"</strong>, Iași, Aleea Grigore Ghica Vodă 41-A.</p>
            <p>Platforma intranet este folosită exclusiv intern pentru gestiunea HR, comunicare și administrare academică.</p>
            <p>Contact protecția datelor: <a className="underline" href="mailto:dpo@icmpp.ro">dpo@icmpp.ro</a></p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Categorii de date prelucrate</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted-foreground"><th className="py-2">Categorie</th><th>Date</th><th>Temei</th></tr></thead>
                <tbody className="divide-y">
                  {DATA_CATEGORIES.map(r => (
                    <tr key={r.cat}><td className="py-2 pr-3 font-medium">{r.cat}</td><td className="pr-3">{r.items}</td><td className="text-muted-foreground">{r.basis}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Datele sensibile (CNP, medicale) sunt vizibile doar pentru SRUS/HR/medic conform RLS și sunt mascate în restul platformei.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Drepturile tale (GDPR Art. 15–22)</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {RIGHTS.map(r => (
                <li key={r.code} className="text-sm flex items-start gap-3">
                  <Badge variant="outline" className="mt-0.5">{r.label}</Badge>
                  <span className="text-muted-foreground">{r.desc}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card id="informare-auth">
          <CardHeader>
            <CardTitle>Informare privind prelucrarea datelor la autentificare</CardTitle>
            <CardDescription>
              Operator: Institutul de Chimie Macromoleculară „Petru Poni" Iași. DPO: dpo@icmpp.ro.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              La autentificarea pe Intranetul ICMPP prelucrăm: <strong>adresa de email instituțională</strong>,
              <strong> data și ora autentificării</strong>, <strong>adresa IP</strong>, un sumar tehnic al browserului
              (user-agent) și, dacă activezi 2FA, identificatorul factorului TOTP și — opțional — un
              <em> token criptat de dispozitiv de încredere</em> stocat pe browserul tău.
            </p>
            <p>
              <strong>Scop:</strong> autentificare, prevenirea accesului neautorizat, audit de securitate,
              respectarea obligațiilor legale. <strong>Temei:</strong> interes legitim al operatorului și
              executarea raportului de muncă (art. 6(1)(b) și (f) RGPD).
            </p>
            <p>
              <strong>Durata stocării:</strong> evenimente de autentificare 12 luni; jurnale CAPTCHA 30 zile;
              dispozitive de încredere 30 zile sau până la revocare; coduri de recuperare până la consum sau
              regenerare. Datele nu se transferă în afara SEE.
            </p>
            <p>
              <strong>Drepturile tale:</strong> acces, rectificare, ștergere, restricționare, opoziție și
              portabilitate. Le poți exercita din secțiunea de mai jos sau scriind la dpo@icmpp.ro.
            </p>
          </CardContent>
        </Card>

        <Card id="solicita">

          <CardHeader>
            <CardTitle>Solicită un drept GDPR</CardTitle>
            <CardDescription>Cererile sunt înregistrate, auditate și soluționate în max. 30 de zile.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!gdprEnabled && <p className="text-sm text-muted-foreground">Modulul de cereri este temporar dezactivat. Contactează DPO la dpo@icmpp.ro.</p>}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Tip cerere</Label>
                <Select value={type} onValueChange={setType} disabled={!gdprEnabled}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RIGHTS.map(r => <SelectItem key={r.code} value={r.code}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Detalii</Label>
              <Textarea rows={4} value={desc} onChange={e => setDesc(e.target.value)} disabled={!gdprEnabled}
                placeholder="Descrie ce date te interesează / ce vrei să rectifici..." />
            </div>
            <Button onClick={submit} disabled={!gdprEnabled || busy}>
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Trimite cererea
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
