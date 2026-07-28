import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  BookOpen,
  Upload,
  Eye,
  CheckCircle2,
  Send,
  RefreshCw,
  AlertCircle,
  FileText,
  ShieldCheck,
  MessageSquareWarning,
} from 'lucide-react';

const steps = [
  {
    icon: Upload,
    title: '1. Încarcă centralizatorul PDF',
    body: (
      <>
        <p>
          În cardul <strong>„Încărcare fluturași"</strong>, alege <strong>luna</strong> și <strong>anul</strong>{' '}
          pentru care faci distribuția, apoi apasă <em>„Selectează PDF"</em> și încarcă documentul unic cu toți
          fluturașii (formatul standard exportat din aplicația de salarizare).
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Platforma va sparge automat PDF-ul în fluturași individuali, va extrage numele și marca angajatului
          din fiecare pagină și va încerca să îi asocieze cu angajații din platformă.
        </p>
      </>
    ),
  },
  {
    icon: FileText,
    title: '2. Așteaptă procesarea lotului',
    body: (
      <>
        <p>
          După upload, lotul apare în lista de mai jos cu status <Badge variant="outline">În procesare</Badge>.
          Procesarea durează de obicei 1–3 minute pentru un lot standard (~250 angajați).
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Dă refresh dacă statusul nu se schimbă automat. Când e gata, vei vedea contoare pentru{' '}
          <strong>Asociați</strong>, <strong>De confirmat</strong> și <strong>Neasociați</strong>.
        </p>
      </>
    ),
  },
  {
    icon: Eye,
    title: '3. Previzualizează și verifică asocierile',
    body: (
      <>
        <p>
          Apasă <em>„Detalii"</em> pe lot pentru a vedea lista completă de fluturași. Poți da{' '}
          <em>„Previzualizare"</em> pe fiecare rând pentru a deschide PDF-ul <strong>necriptat</strong> și a
          confirma vizual că fluturașul corespunde persoanei asociate.
        </p>
        <Alert className="mt-3">
          <ShieldCheck className="w-4 h-4" />
          <AlertDescription className="text-xs">
            Previzualizarea e disponibilă doar pentru rolurile <strong>Salarizare</strong> și{' '}
            <strong>Super Admin</strong>. Fișierul rămâne necriptat până la distribuție.
          </AlertDescription>
        </Alert>
      </>
    ),
  },
  {
    icon: CheckCircle2,
    title: '4. Rezolvă rândurile "De confirmat" și "Neasociat"',
    body: (
      <>
        <p>
          Rândurile marcate <Badge variant="outline">Confirmă</Badge> au potriviri probabile pe bază de marcă
          sau nume — deschide-le, alege angajatul corect din dropdown și apasă <em>„Salvează"</em>.
        </p>
        <p className="mt-2">
          Rândurile <Badge variant="outline">Neasociat</Badge> necesită alegere manuală. Folosește căutarea
          după marcă (cel mai sigur) pentru colegii cu variații de diacritice.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          <strong>Nu distribui lotul</strong> câtă vreme mai există rânduri roșii sau portocalii nerezolvate.
        </p>
      </>
    ),
  },
  {
    icon: Send,
    title: '5. Distribuie lotul',
    body: (
      <>
        <p>
          Când toate rândurile sunt <Badge variant="outline">Asociat</Badge>, apasă butonul{' '}
          <strong>„Distribuie lot"</strong>. Platforma va:
        </p>
        <ul className="mt-2 ml-4 list-disc space-y-1 text-sm text-muted-foreground">
          <li>cripta fiecare fluturaș cu ultimele 6 cifre din CNP;</li>
          <li>marca fiecare fluturaș ca <em>distribuit</em>;</li>
          <li>face fluturașul vizibil în „Profilul meu → Fluturașii mei" pentru fiecare angajat;</li>
          <li>trimite notificare internă.</li>
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          Distribuția rulează în bucăți mici (~12 fluturași) pentru a evita timeout-urile. Poți urmări
          progresul în bara verde.
        </p>
      </>
    ),
  },
  {
    icon: RefreshCw,
    title: '6. Re-procesare (opțional)',
    body: (
      <>
        <p>
          Dacă din diverse motive un fluturaș nu s-a generat corect (fișier lipsă, eroare la split), folosește{' '}
          <em>„Re-procesează lot"</em>. Va regenera <strong>doar</strong> fluturașii care au probleme, fără să
          afecteze restul.
        </p>
        <p className="mt-2">
          <em>„Restagează preview"</em> regenerează versiunile necriptate ale unor loturi vechi (utile pentru
          audit).
        </p>
      </>
    ),
  },
  {
    icon: MessageSquareWarning,
    title: '7. Gestionează sesizările angajaților',
    body: (
      <>
        <p>
          Dacă un angajat marchează un fluturaș ca greșit prin butonul <em>„Semnalează"</em> din profilul lui,
          sesizarea apare în cardul <strong>„Sesizări fluturași"</strong> de mai sus.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Deschide sesizarea, verifică descrierea, corectează asocierea sau înlocuiește fluturașul, apoi
          marchează sesizarea ca rezolvată.
        </p>
      </>
    ),
  },
];

const rules = [
  'Nu încărca de două ori același lot pentru aceeași lună — dacă e nevoie, șterge lotul vechi întâi.',
  'Parola pentru angajați = ultimele 6 cifre din CNP. Nu comunica altă parolă.',
  'Nu distribui lotul dacă mai există rânduri „Neasociat" — angajații respectivi nu ar primi fluturașul.',
  'Fișierul original (necriptat) rămâne accesibil doar Salarizării/Super Adminului pentru audit.',
  'Toate acțiunile (upload, previzualizare, distribuție, descărcare) sunt înregistrate în audit log.',
];

interface PayslipGuideProps {
  variant?: 'card' | 'button';
}

export default function PayslipGuide({ variant = 'card' }: PayslipGuideProps) {
  const [open, setOpen] = useState(false);

  const trigger = variant === 'button' ? (
    <Button onClick={() => setOpen(true)} variant="outline" className="shrink-0">
      <BookOpen className="w-4 h-4 mr-2" />
      Ghid pas cu pas
    </Button>
  ) : (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Ghid distribuție fluturași
          </CardTitle>
          <CardDescription>
            Pași pas cu pas pentru rolurile <strong>Salarizare</strong> și <strong>Super Admin</strong>.
          </CardDescription>
        </div>
        <Button onClick={() => setOpen(true)} variant="default">
          Deschide ghidul
        </Button>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        De la <em>upload PDF centralizator</em> până la <em>distribuție criptată</em> și gestionarea
        sesizărilor — parcurge ghidul înainte de prima distribuție.
      </CardContent>
    </Card>
  );

  return (
    <>
      {trigger}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              Ghid: Distribuția fluturașilor de salariu
            </DialogTitle>
            <DialogDescription>
              Doar rolurile <strong>Salarizare</strong> și <strong>Super Admin</strong> pot rula acest flux.
              Parcurge pașii în ordine.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div
                  key={i}
                  className="rounded-lg border bg-card p-4 flex gap-4"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm mb-1">{step.title}</h3>
                    <div className="text-sm text-foreground/80 space-y-1">{step.body}</div>
                  </div>
                </div>
              );
            })}

            <Alert variant="destructive" className="mt-6">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>
                <strong className="block mb-2">Reguli critice</strong>
                <ul className="ml-4 list-disc space-y-1 text-sm">
                  {rules.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
