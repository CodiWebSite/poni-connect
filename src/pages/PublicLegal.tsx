import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileLock2, ArrowLeft, ShieldCheck, Globe, Home, ChevronRight } from 'lucide-react';
import MolecularPattern from '@/components/auth/MolecularPattern';

const RIGHTS = [
  { code: 'access', label: 'Acces', desc: 'Obține o copie a datelor tale.' },
  { code: 'rectification', label: 'Rectificare', desc: 'Corectează date incorecte sau incomplete.' },
  { code: 'restriction', label: 'Restricționare', desc: 'Limitează prelucrarea în anumite condiții.' },
  { code: 'deletion', label: 'Ștergere', desc: 'Cere ștergerea datelor (acolo unde nu există obligație legală).' },
  { code: 'portability', label: 'Portabilitate', desc: 'Primește datele într-un format structurat.' },
  { code: 'complaint', label: 'Plângere', desc: 'Înregistrează o plângere internă; ANSPDCP rămâne disponibil extern.' },
];

const DATA_CATEGORIES = [
  { cat: 'Identificare', items: 'nume, prenume, email instituțional, CNP (HR), telefon', basis: 'Contract muncă / obligație legală' },
  { cat: 'Profesionale', items: 'funcție, departament, dată angajare, tip contract, concedii', basis: 'Contract muncă' },
  { cat: 'Medicale', items: 'fișa medicală, aptitudine, expirări', basis: 'Obligație legală (HG 355/2007)' },
  { cat: 'Autentificare', items: 'jurnal login, evenimente securitate, 2FA', basis: 'Interes legitim (securitate)' },
  { cat: 'Conținut platformă', items: 'mesaje chat, fișiere, anunțuri', basis: 'Interes legitim / consimțământ' },
];

export default function PublicLegal() {
  const { hash, pathname } = useLocation();

  const isConfidentialitate = pathname.includes('confidentialitate') && !pathname.includes('informare');
  const isInformare = pathname.includes('informare-autentificare');

  const pageTitle = isInformare
    ? 'Informare privind prelucrarea datelor la autentificare'
    : 'Politica de confidențialitate';

  const pageSubtitle = isInformare
    ? 'Document public privind datele prelucrate la autentificare.'
    : 'Document public privind protecția datelor personale (RGPD).'

  useEffect(() => {
    if (pathname.includes('informare-autentificare')) {
      const el = document.getElementById('informare-auth');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (hash) {
      const el = document.getElementById(hash.replace('#', ''));
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname, hash]);

  return (
    <div className="min-h-screen bg-background relative">
      {/* Subtle molecular backdrop */}
      <div className="absolute inset-0 text-primary opacity-[0.04] pointer-events-none">
        <MolecularPattern className="w-full h-full" />
      </div>

      {/* Top bar */}
      <header className="relative z-10 border-b bg-background/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 lg:px-8 py-4 flex items-center justify-between gap-3">
          <Link to="/auth" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
            Înapoi la autentificare
          </Link>
          <div className="flex items-center gap-2">
            <img src="/logo-icmpp.png" alt="ICMPP" className="w-8 h-8 object-contain" />
            <span className="font-display font-semibold text-sm hidden sm:inline">ICMPP Intranet</span>
          </div>
        </div>
      </header>

      {/* Public document banner */}
      <div className="relative z-10 bg-primary/5 border-b border-primary/10">
        <div className="max-w-4xl mx-auto px-4 lg:px-8 py-3 flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-primary">Document public</span>
          <span className="text-sm text-muted-foreground">— disponibil fără autentificare</span>
        </div>
      </div>

      <main className="relative z-10 max-w-4xl mx-auto px-4 lg:px-8 py-10 space-y-6">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link to="/auth" className="flex items-center gap-1 hover:text-foreground transition-colors">
            <Home className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Autentificare</span>
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span>Documente publice</span>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-foreground font-medium">{pageTitle}</span>
        </nav>

        <div className="pt-2">
          <h1 className="text-3xl font-display font-bold flex items-center gap-3">
            <FileLock2 className="w-8 h-8 text-primary" /> {pageTitle}
          </h1>
          <p className="text-muted-foreground mt-2">
            {pageSubtitle}
          </p>
        </div>

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
                    <tr key={r.cat}>
                      <td className="py-2 pr-3 font-medium">{r.cat}</td>
                      <td className="pr-3">{r.items}</td>
                      <td className="text-muted-foreground">{r.basis}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Datele sensibile (CNP, medicale) sunt vizibile doar pentru SRUS/HR/medic și sunt mascate în restul platformei.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Drepturile tale (RGPD Art. 15–22)</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {RIGHTS.map(r => (
                <li key={r.code} className="text-sm flex items-start gap-3">
                  <Badge variant="outline" className="mt-0.5">{r.label}</Badge>
                  <span className="text-muted-foreground">{r.desc}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground mt-4">
              După autentificare, drepturile se exercită din secțiunea <em>Confidențialitate</em> a platformei sau scriind la dpo@icmpp.ro.
            </p>
          </CardContent>
        </Card>

        <Card id="informare-auth" className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Informare privind prelucrarea datelor la autentificare
            </CardTitle>
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
              portabilitate. Le poți exercita după autentificare sau scriind la dpo@icmpp.ro.
            </p>
          </CardContent>
        </Card>

        <footer className="text-center text-xs text-muted-foreground pt-4 pb-8">
          © {new Date().getFullYear()} Institutul de Chimie Macromoleculară „Petru Poni" Iași — Academia Română
        </footer>
      </main>
    </div>
  );
}
