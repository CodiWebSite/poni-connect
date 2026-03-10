import { Link } from 'react-router-dom';
import { Shield, Lock, Eye, FileText, Trash2, AlertTriangle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

const sections = [
  {
    icon: Shield,
    title: '1. Operatorul de date',
    content: `Institutul de Chimie Macromoleculară "Petru Poni" (ICMPP) Iași, cu sediul în Aleea Grigore Ghica Vodă nr. 41A, Iași, România, este operatorul datelor personale colectate prin această platformă internă (Intranet ICMPP).`,
  },
  {
    icon: FileText,
    title: '2. Categorii de date prelucrate',
    content: `Platforma prelucrează următoarele categorii de date personale ale angajaților:
• Date de identificare: Nume, prenume, CNP, seria și numărul CI, data expirării CI
• Date de contact: Adresă de email instituțional, adresa de domiciliu
• Date profesionale: Departament, funcție, data angajării, tip contract, grad profesional
• Date privind concediile: Zile de concediu (total, utilizate, rest), cereri de concediu
• Date medicale: Fișa medicală de medicina muncii, consultații, aptitudine
• Date de autentificare: Email, IP, User Agent (pentru securitate)
• Avatar/Fotografie de profil (opțional, încărcat de utilizator)`,
  },
  {
    icon: Lock,
    title: '3. Măsuri de securitate implementate',
    content: `Toate datele sunt protejate prin următoarele măsuri tehnice și organizatorice:

🔒 Criptare în tranzit — Toate comunicațiile sunt protejate prin HTTPS/TLS
🔒 Criptare la repaus — Baza de date utilizează criptare AES-256
🔐 Control al accesului (RLS) — Politici de securitate la nivel de rând care restricționează accesul la date sensibile
🔐 Autentificare securizată — Parole hashuite, sesiuni cu token, protecție anti-bot (Turnstile)
📋 Jurnal de audit — Toate acțiunile administrative sunt înregistrate și auditabile
🗂️ Stocare privată — Documentele medicale și ale angajaților sunt în bucket-uri private
👥 Segregarea accesului — Datele medicale sunt accesibile doar medicului de medicina muncii și HR`,
  },
  {
    icon: Eye,
    title: '4. Scopul prelucrării datelor',
    content: `Datele personale sunt prelucrate exclusiv în scopuri legate de raportul de muncă:
• Gestionarea resurselor umane (evidență angajați, concedii, documente)
• Medicina muncii (programări, aptitudine medicală, consultații)
• Comunicare internă (anunțuri, chat instituțional, notificări)
• Administrare (evidență echipamente, rezervări săli, bibliotecă)
• Securitate (autentificare, detectarea accesului neautorizat)`,
  },
  {
    icon: FileText,
    title: '5. Temeiul legal',
    content: `Prelucrarea datelor se bazează pe:
• Art. 6 alin. (1) lit. (b) GDPR — executarea contractului individual de muncă
• Art. 6 alin. (1) lit. (c) GDPR — obligații legale (Codul Muncii, legislația sănătății și securității în muncă)
• Art. 6 alin. (1) lit. (f) GDPR — interesul legitim al angajatorului (securitate IT, comunicare internă)`,
  },
  {
    icon: Trash2,
    title: '6. Drepturile angajaților',
    content: `Conform GDPR, aveți următoarele drepturi:
• Dreptul de acces — Puteți vizualiza datele dvs. personale din secțiunea "Profilul meu"
• Dreptul la rectificare — Puteți solicita corectarea datelor prin formularul de corecție date
• Dreptul la ștergere — În limita obligațiilor legale de păstrare a documentelor
• Dreptul la restricționarea prelucrării
• Dreptul la portabilitatea datelor
• Dreptul de a depune plângere la ANSPDCP (Autoritatea Națională de Supraveghere)

Pentru exercitarea drepturilor, contactați: admin@icmpp.ro`,
  },
  {
    icon: AlertTriangle,
    title: '7. Perioada de stocare',
    content: `Datele personale sunt păstrate pe durata raportului de muncă și ulterior conform termenelor legale de arhivare:
• Documente de personal: 75 ani (conform legislației muncii)
• Date medicale: 40 ani (conform legislației SSM)
• Jurnale de audit: 2 ani
• Sesiuni de autentificare: 90 zile
• Date din chat-ul intern: pe durata raportului de muncă`,
  },
];

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" size="sm" asChild className="mb-4">
            <Link to="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Înapoi
            </Link>
          </Button>
          
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Shield className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                Politica de Confidențialitate
              </h1>
              <p className="text-muted-foreground text-sm">
                Conform Regulamentului (UE) 2016/679 (GDPR)
              </p>
            </div>
          </div>
          
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="py-3 px-4">
              <p className="text-sm text-foreground/80">
                <Lock className="w-4 h-4 inline mr-1.5 text-primary" />
                Toate datele personale prelucrate prin platforma Intranet ICMPP sunt protejate conform GDPR 
                prin <strong>criptare AES-256</strong>, <strong>control al accesului la nivel de rând (RLS)</strong> și 
                <strong> politici stricte de securitate</strong>.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Sections */}
        <div className="space-y-6">
          {sections.map((section, i) => (
            <Card key={i}>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start gap-3 mb-3">
                  <section.icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <h2 className="text-lg font-semibold text-foreground">{section.title}</h2>
                </div>
                <div className="pl-8 text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                  {section.content}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Separator className="my-8" />

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground space-y-1">
          <p>Ultima actualizare: Martie 2026</p>
          <p>
            Contact DPO: <a href="mailto:admin@icmpp.ro" className="text-primary hover:underline">admin@icmpp.ro</a>
          </p>
          <p>
            ANSPDCP — <a href="https://www.dataprotection.ro" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">www.dataprotection.ro</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
