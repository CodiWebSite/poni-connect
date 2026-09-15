import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  BookOpen, Building2, ExternalLink, FileText, GraduationCap, Landmark, Mail,
  Phone, ScrollText, Search, Sparkles, Users,
} from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { useDoctoralCoordinator } from '@/hooks/useDoctoralCoordinator';
import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const MANAGER_ROLES = ['super_admin', 'hr', 'sef_srus', 'director_institut', 'director_adjunct', 'secretar_stiintific'];

const SDSC = 'https://icmpp.ro/sdsc';

type Doc = { label: string; url: string };

const REGULAMENTE: Doc[] = [
  { label: 'Regulamentul Școlii Doctorale de Științe Chimice', url: `${SDSC}/files/Regulamentul%20Scolii%20Doctorale%20de%20Stiinte%20chimice.pdf` },
  { label: 'Regulament admitere SDSC 2026', url: `${SDSC}/files/REGULAMENT%20admitere%20SDSC_2026.pdf` },
  { label: 'Regulament admitere SDSC 2025–2026', url: `${SDSC}/files/REGULAMENT%20admitere%20SDSC_2025.pdf` },
  { label: 'Regulament alegeri CSD – SDSC', url: `${SDSC}/files/Regulament%20alegeri%20CSD_SDSC.pdf` },
  { label: 'Regulament afiliere / încetare afiliere SDSC', url: `${SDSC}/files/REGULAMENT%20afiliere.incetare_SDSC.pdf` },
  { label: 'Toate regulamentele (pagina SDSC)', url: `${SDSC}/regulamente.php` },
];

const METODOLOGII: Doc[] = [
  { label: 'Metodologie analiza și aprobarea tematicilor programelor de doctorat', url: 'https://icmpp.ro/files/metodologii/Metodologie%20pentru%20analiza%20si%20aprobarea%20tematicilor%20programelor%20de%20studii%20universitare%20de%20doctorat.pdf' },
  { label: 'Metodologie privind doctoratele în cotutelă', url: 'https://icmpp.ro/files/metodologii/Metodologie%20cotutela.zip' },
  { label: 'Metodologie privind mobilitatea academică a doctoranzilor', url: 'https://icmpp.ro/files/metodologii/Metodologie%20privind%20mobilitatea%20academic%C4%83%20a%20studen%C8%9Bilor-doctoranzi.zip' },
  { label: 'Metodologie privind schimbarea conducătorilor de doctorat', url: 'https://icmpp.ro/files/metodologii/Metodologie%20privind%20schimbarea%20conducatorilor%20de%20doctorat.pdf' },
  { label: 'Metodologie școlarizare români de pretutindeni și cetățeni străini', url: `${SDSC}/files/Metodologia%20privind%20conditile%20de%20scolarizare%20a%20romanilor%20de%20pretutindeni%20si%20a%20cetatenilor%20straini%20in%20cadrul%20AR.pdf` },
  { label: 'Toate metodologiile (pagina SDSC)', url: `${SDSC}/metodologii.php` },
];

const LEGISLATIE: Doc[] = [
  { label: 'Ordin 3020/2024 – Regulament-cadru studii universitare de doctorat', url: 'https://www.edu.ro/sites/default/files/fisiere%20articole/OM_3020-2024.pdf' },
  { label: 'Ordin 3693/2024 – Metodologie-cadru admitere învățământ superior', url: 'https://www.edu.ro/sites/default/files/fisiere%20articole/OM_3693_2024_1.pdf' },
  { label: 'Ordin 3692/2024 – Programe recunoscute pentru grad de similitudine', url: 'https://www.edu.ro/sites/default/files/fisiere%20articole/OM_3692-2024_1.pdf' },
  { label: 'Toată legislația (pagina SDSC)', url: `${SDSC}/legislatie.php` },
];

const PAGINI: { label: string; description: string; url: string; icon: any }[] = [
  { label: 'Admitere 2026', description: 'Acte necesare, bibliografie, locuri, calendar', url: `${SDSC}/admitere2026.php`, icon: ScrollText },
  { label: 'Plan de învățământ', description: 'Programul de pregătire avansată (PSUD)', url: `${SDSC}/plan_invatamant.php`, icon: BookOpen },
  { label: 'Conducători de doctorat', description: 'Lista completă și temele propuse', url: `${SDSC}/conducatori.php`, icon: Users },
  { label: 'Susțineri publice', description: 'Teze programate și istoricul susținerilor', url: `${SDSC}/sustineri_publice.php`, icon: GraduationCap },
  { label: 'Consiliul școlii doctorale', description: 'Componența CSD', url: `${SDSC}/consiliul.php`, icon: Landmark },
  { label: 'Erasmus & mobilități', description: 'Oportunități de mobilitate academică', url: `${SDSC}/erasmus.php`, icon: Sparkles },
  { label: 'Anunțuri SDSC', description: 'Noutăți oficiale ale școlii doctorale', url: `${SDSC}/anunturi.php`, icon: FileText },
  { label: 'SCOSAAR', description: 'Școala de Studii Avansate a Academiei Române', url: 'https://acad.ro/institutia/scosaar.html', icon: Building2 },
];

const INSTITUTE = [
  { name: 'Institutul de Chimie Macromoleculară „Petru Poni”, Iași', url: 'https://www.icmpp.ro/ro/' },
  { name: 'Institutul de Chimie Fizică „Ilie Murgulescu”, Bucureşti', url: 'http://www.icf.ro/' },
  { name: 'Institutul de Chimie Organică și Supramoleculară „Costin D. Nenițescu”', url: 'https://www.icoscdn.ro/index.php/ro/' },
  { name: 'Institutul de Chimie „Coriolan Drăgulescu”, Timișoara', url: 'https://acad-icht.tm.edu.ro/wp/' },
];

const CONDUCATORI_ICMPP = [
  'Dr. AFLORI Magdalena', 'Dr. BERCEA Maria', 'Dr. BREBU Mihai', 'Dr. CAZACU Maria',
  'Dr. COȘERI Sergiu', 'Dr. COȘUȚCHI Andreea-Irina', 'Dr. DĂMĂCEANU Maria-Dana',
  'Dr. DINU Maria-Valentina', 'Dr. FUNDUEANU-CONSTANTIN Gheorghe', 'Dr. HARABAGIU Valeria',
  'Dr. LAAKSONEN Atto', 'Dr. MARIN Luminița', 'Dr. MIHAI Marcela', 'Dr. NIȚA Loredana',
  'Dr. PINTEALĂ Mariana', 'Dr. POPESCU Carmen-Mihaela', 'Dr. POPESCU Maria-Cristina',
  'Dr. ROTARU Alexandru', 'Dr. SPIRIDON Iuliana',
];

const DocList = ({ items }: { items: Doc[] }) => (
  <div className="grid gap-2 sm:grid-cols-2">
    {items.map((doc) => (
      <a
        key={doc.url}
        href={doc.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-start gap-3 rounded-xl border border-border/60 bg-card/50 p-3 transition-colors hover:border-primary/50 hover:bg-accent/40"
      >
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span className="text-sm leading-snug text-foreground/90 group-hover:text-foreground">{doc.label}</span>
        <ExternalLink className="ml-auto mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </a>
    ))}
  </div>
);

const DoctoralSchool = () => {
  const { role, loading } = useUserRole();
  const { isCoordinator, loading: coordLoading } = useDoctoralCoordinator();
  const [search, setSearch] = useState('');

  const allowed = !!role && (role === 'doctorand' || role === 'doctorand_pending' || MANAGER_ROLES.includes(role) || isCoordinator);

  const filteredCoordinators = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return CONDUCATORI_ICMPP;
    return CONDUCATORI_ICMPP.filter((name) => name.toLowerCase().includes(query));
  }, [search]);

  if (loading || coordLoading) {
    return <MainLayout title="Școala Doctorală"><div className="p-6 text-sm text-muted-foreground">Se încarcă…</div></MainLayout>;
  }
  if (!allowed) return <Navigate to="/" replace />;

  return (
    <MainLayout title="Școala Doctorală">
      <PageHeader
        eyebrow="ICMPP · Școala Doctorală de Științe Chimice"
        title="Școala Doctorală (SDSC)"
        description="Misiune, program de pregătire, regulamente, metodologii și conducători de doctorat"
        icon={GraduationCap}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" /> Misiune și obiective</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              Domeniul de doctorat <strong className="text-foreground">Chimie</strong> este ancorat în cercetarea de tradiție a
              Academiei Române și se desfășoară în cadrul Școlii Doctorale de Științe Chimice (SDSC), parte a Școlii de Studii
              Avansate a Academiei Române (SCOSAAR).
            </p>
            <p>
              La ICMPP „Petru Poni”, studiile sunt orientate spre sinteza de noi compuși macromoleculari, caracterizarea lor
              aprofundată, obținerea de materiale, studiul proprietăților și aplicarea acestora în diverse domenii.
            </p>
            <p>
              Misiunea este formarea unei resurse umane înalt specializate prin cercetare, competentă în domeniul compușilor
              macromoleculari și al materialelor polimere, într-un cadru creativ și deontologic, cu deschidere spre colaborări
              științifice naționale și internaționale.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><BookOpen className="h-4 w-4 text-primary" /> Programul de pregătire</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Programul de studii universitare de doctorat combină formarea avansată cu cercetarea științifică, pe baza unui plan
              de învățământ flexibil, actualizat periodic.
            </p>
            <ul className="space-y-1.5">
              {['Metoda științifică și proiectarea cercetării', 'Etică și integritate academică', 'Proprietate intelectuală', 'Valorificarea rezultatelor: proiecte, publicare, comunicare'].map((item) => (
                <li key={item} className="flex gap-2"><span className="text-primary">•</span><span>{item}</span></li>
              ))}
            </ul>
            <Button asChild variant="outline" size="sm" className="w-full">
              <a href={`${SDSC}/plan_invatamant.php`} target="_blank" rel="noopener noreferrer">Vezi planul de învățământ <ExternalLink className="ml-1.5 h-3.5 w-3.5" /></a>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Scurtături utile</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PAGINI.map((page) => {
              const Icon = page.icon;
              return (
                <a
                  key={page.url}
                  href={page.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-xl border border-border/60 bg-card/50 p-4 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
                >
                  <Icon className="mb-2 h-5 w-5 text-primary" />
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">{page.label}<ExternalLink className="h-3 w-3 text-muted-foreground" /></p>
                  <p className="mt-1 text-xs text-muted-foreground">{page.description}</p>
                </a>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="regulamente" className="mt-4">
        <TabsList>
          <TabsTrigger value="regulamente">Regulamente</TabsTrigger>
          <TabsTrigger value="metodologii">Metodologii</TabsTrigger>
          <TabsTrigger value="legislatie">Legislație</TabsTrigger>
          <TabsTrigger value="conducatori">Conducători ICMPP</TabsTrigger>
        </TabsList>

        <TabsContent value="regulamente" className="mt-4"><Card><CardContent className="pt-6"><DocList items={REGULAMENTE} /></CardContent></Card></TabsContent>
        <TabsContent value="metodologii" className="mt-4"><Card><CardContent className="pt-6"><DocList items={METODOLOGII} /></CardContent></Card></TabsContent>
        <TabsContent value="legislatie" className="mt-4"><Card><CardContent className="pt-6"><DocList items={LEGISLATIE} /></CardContent></Card></TabsContent>

        <TabsContent value="conducatori" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex flex-wrap items-center gap-3 text-base">
                <span>Conducători de doctorat ICMPP</span>
                <Badge variant="outline">{CONDUCATORI_ICMPP.length}</Badge>
                <span className="text-xs font-normal text-muted-foreground">an universitar 2026</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Caută un conducător" className="pl-9" />
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {filteredCoordinators.map((name) => (
                  <div key={name} className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/50 px-3 py-2 text-sm">
                    <GraduationCap className="h-4 w-4 shrink-0 text-primary" />
                    <span>{name}</span>
                  </div>
                ))}
                {filteredCoordinators.length === 0 && <p className="text-sm text-muted-foreground">Niciun rezultat.</p>}
              </div>
              <p className="text-xs text-muted-foreground">
                Temele propuse și datele de contact ale fiecărui conducător sunt disponibile pe pagina oficială a școlii doctorale.
              </p>
              <Button asChild variant="outline" size="sm">
                <a href={`${SDSC}/conducatori.php`} target="_blank" rel="noopener noreferrer">Deschide lista completă cu teme <ExternalLink className="ml-1.5 h-3.5 w-3.5" /></a>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4 text-primary" /> Institute organizatoare</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {INSTITUTE.map((institut) => (
              <a key={institut.url} href={institut.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/50 px-3 py-2 text-sm transition-colors hover:border-primary/50 hover:bg-accent/40">
                <Landmark className="h-4 w-4 shrink-0 text-primary" />
                <span>{institut.name}</span>
                <ExternalLink className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </a>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Mail className="h-4 w-4 text-primary" /> Contact secretariat doctorat</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Institutul de Chimie Macromoleculară „Petru Poni”, Aleea Grigore Ghica Vodă 41A, 700487 Iași</p>
            <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-primary" /> +40 332 880 050</p>
            <Button asChild variant="outline" size="sm">
              <a href={`${SDSC}/contact.php`} target="_blank" rel="noopener noreferrer">Pagina de contact SDSC <ExternalLink className="ml-1.5 h-3.5 w-3.5" /></a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default DoctoralSchool;
