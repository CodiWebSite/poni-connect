import { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Printer, UserCircle, FileText, Calendar, FolderDown, Settings, CheckSquare,
  ClipboardList, Shield, Users, BookOpen, Bell, Home, Search, Moon,
  Eye, Download, History, UserCheck, AlertTriangle, HelpCircle, MessageCircle,
  DoorOpen, PartyPopper, ExternalLink, Mail, Smartphone, CloudSun,
  Sparkles, Archive, Activity, Package, Banknote, Newspaper,
} from 'lucide-react';
import {
  SidebarMockup, HeaderMockup, DashboardMockup, ProfileMockup,
  LeaveRequestMockup, LeaveCalendarMockup, FormsMockup, ApprovalMockup, ChatMockup,
} from '@/components/guide/PageMockups';

const GuideSection = ({ icon: Icon, title, children, badge }: { icon: any; title: string; children: React.ReactNode; badge?: string }) => (
  <AccordionItem value={title} className="border rounded-lg px-4 mb-3">
    <AccordionTrigger className="hover:no-underline py-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <span className="font-semibold text-sm text-left">{title}</span>
        {badge && <Badge variant="secondary" className="text-[10px]">{badge}</Badge>}
      </div>
    </AccordionTrigger>
    <AccordionContent className="pb-4">
      <div className="pl-11 space-y-3 text-sm text-muted-foreground leading-relaxed">
        {children}
      </div>
    </AccordionContent>
  </AccordionItem>
);

const StepList = ({ steps }: { steps: string[] }) => (
  <ol className="list-decimal list-inside space-y-1.5">
    {steps.map((step, i) => (
      <li key={i}>{step}</li>
    ))}
  </ol>
);

const InfoBox = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
    <p className="font-medium text-foreground text-xs">{title}</p>
    <div className="text-xs text-muted-foreground">{children}</div>
  </div>
);

const PlatformGuide = () => {
  const { isSuperAdmin, canManageHR, isSef, isSefSRUS } = useUserRole();
  const { user } = useAuth();
  const [isDesignatedApprover, setIsDesignatedApprover] = useState(false);

  useEffect(() => {
    if (!user) return;
    const checkApprover = async () => {
      // Check if user is a designated approver (individual or department-level)
      const [{ count: indivCount }, { count: deptCount }] = await Promise.all([
        supabase.from('leave_approvers').select('id', { count: 'exact', head: true }).eq('approver_user_id', user.id),
        supabase.from('leave_department_approvers').select('id', { count: 'exact', head: true }).eq('approver_user_id', user.id),
      ]);
      setIsDesignatedApprover((indivCount || 0) > 0 || (deptCount || 0) > 0);
    };
    checkApprover();
  }, [user]);

  const isDeptHead = isSef || isSefSRUS || isSuperAdmin || isDesignatedApprover;

  return (
    <MainLayout title="Ghid Platformă" description="Instrucțiuni detaliate pentru utilizarea platformei ICMPP Intranet">
      <div className="max-w-4xl mx-auto space-y-6 print:space-y-4">
        
        {/* Print button */}
        <div className="flex justify-end print:hidden">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
            <Printer className="w-4 h-4" />
            Printează ghidul
          </Button>
        </div>

        {/* ═══════════════════════════════════════════════════ */}
        {/* SECȚIUNEA ANGAJAȚI */}
        {/* ═══════════════════════════════════════════════════ */}
        <Card className="print:shadow-none print:border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              Ghid complet pentru angajați
            </CardTitle>
            <CardDescription>Tot ce trebuie să știți despre funcționalitățile platformei</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">

              {/* ─── NAVIGARE GENERALĂ ─── */}
              <GuideSection icon={Home} title="Navigarea pe platformă – Meniul principal (Sidebar)">
                <p className="mb-2">În partea stângă a ecranului se află meniul principal cu toate secțiunile platformei:</p>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Home className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <div><strong>Dashboard</strong> – pagina principală cu statistici rapide, acțiuni rapide, calendar personal, meteo și utilizatori online.</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Bell className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <div><strong>Anunțuri</strong> – anunțurile oficiale ale instituției, cu posibilitate de fixare și prioritizare.</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <UserCircle className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <div><strong>Profilul Meu</strong> – datele dvs. personale, soldul de concediu, documente și istoric.</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Calendar className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <div><strong>Calendar Concedii</strong> – vizualizarea concediilor colegilor din departament.</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <FolderDown className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <div><strong>Formulare</strong> – modele oficiale de formulare descărcabile.</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <FileText className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <div><strong>Cerere Concediu</strong> – depunerea și urmărirea cererilor de concediu de odihnă.</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <DoorOpen className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <div><strong>Programări Săli</strong> – rezervarea sălilor de ședință și laboratoarelor comune.</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <PartyPopper className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <div><strong>Activități Recreative</strong> – evenimente sociale, sportive și culturale organizate de institut.</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <MessageCircle className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <div><strong>Mesagerie</strong> – chat intern între colegi cu suport pentru fișiere, reacții, căutare și status online în timp real.</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Users className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <div><strong>Echipa Mea</strong> – vizualizarea membrilor echipei (disponibil pentru șefii de departament, HR și administratori).</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <BookOpen className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <div><strong>Bibliotecă</strong> – catalogul de cărți și reviste al institutului (vizibil pentru bibliotecari).</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <ExternalLink className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <div><strong>Adeverințe</strong> – link extern către sistemul de adeverințe ICMPP (se deschide în tab nou).</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Mail className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <div><strong>Mail ICMPP</strong> – link extern către webmail-ul instituțional (se deschide în tab nou).</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Settings className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <div><strong>Setări</strong> – actualizarea numelui, telefonului, temei vizuale și schimbarea parolei.</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <HelpCircle className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <div><strong>Ghid Platformă</strong> – această pagină cu instrucțiuni detaliate, adaptată rolului dvs.</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Download className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <div><strong>Instalează App</strong> – instrucțiuni pas cu pas pentru instalarea platformei ca aplicație pe telefon sau desktop.</div>
                  </div>
                </div>

                <InfoBox title="💡 Sfat: Colapsarea meniului">
                  <p>Apăsați săgeata din colțul din dreapta-sus al sidebar-ului pentru a-l restrânge (va afișa doar iconițele). Apăsați din nou pentru a-l extinde.</p>
                </InfoBox>
                <InfoBox title="💡 Contact IT">
                  <p>În partea de jos a meniului găsiți butonul „Contact IT" – apăsați pentru a trimite un tichet HelpDesk direct echipei de suport.</p>
                </InfoBox>

                <SidebarMockup />
              </GuideSection>

              {/* ─── HEADER ─── */}
              <GuideSection icon={Search} title="Bara de sus – Căutare, Notificări și Temă">
                <p className="mb-2">În bara de sus a ecranului găsiți:</p>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Search className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <div><strong>Căutare globală</strong> – apăsați iconița lupă sau tastați <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono border">Ctrl+K</kbd> pentru a căuta rapid secțiuni din platformă.</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Bell className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <div><strong>Notificări</strong> – clopoțelul arată notificările primite (aprobare cerere, mesaje de la admin etc.). Cifra roșie indică notificări necitite.</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Moon className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <div><strong>Schimbă tema</strong> – butonul soare/lună comută între tema luminoasă și cea întunecată.</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <UserCircle className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <div><strong>Avatar</strong> – în dreapta sus, apăsați pe avatar pentru a accesa rapid profilul.</div>
                  </div>
                </div>

                <HeaderMockup />
              </GuideSection>
              <GuideSection icon={Home} title="Dashboard – Pagina principală">
                <p className="mb-2">Dashboard-ul afișează informații utile la prima vedere:</p>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Download className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <div><strong>Banner instalare aplicație</strong> – în partea de sus, un banner vă invită să instalați platforma ca aplicație pe telefon sau desktop. Se poate închide și nu mai apare în sesiunea curentă.</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Eye className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <div><strong>Acțiuni rapide</strong> – 3 carduri: Profilul Meu, Calendar Concedii, Formulare. Apăsați pe oricare pentru acces direct.</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Calendar className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <div><strong>Sold concediu</strong> – un inel de progres vizual arată câte zile ați utilizat, cu cifre animate.</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Calendar className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <div><strong>Calendarul personal</strong> – vedeți evenimentele lunii curente și zilele dvs. de concediu.</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CloudSun className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <div><strong>Widget meteo</strong> – afișează vremea curentă în Iași (temperatură, condiții, vânt).</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Users className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <div><strong>Utilizatori online</strong> – vedeți câți colegi sunt activi pe platformă în acest moment.</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Bell className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <div><strong>Anunțuri recente</strong> – ultimele 3 anunțuri ale instituției, direct pe dashboard.</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <History className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <div><strong>Istoricul activității</strong> – ultimele acțiuni ale dvs. pe platformă (cereri, logări etc.).</div>
                  </div>
                </div>

                <InfoBox title="💡 Sfat: Mesajul de pe Dashboard">
                  <p>Dacă administratorul a setat un mesaj special (anunț important), acesta apare într-o bandă albastră în partea de sus a paginii.</p>
                </InfoBox>

                <DashboardMockup />
              </GuideSection>
              <GuideSection icon={UserCircle} title="Profilul Meu – Toate detaliile pas cu pas">
                <p className="mb-3 font-medium text-foreground">Pagina de profil conține mai multe secțiuni:</p>
                
                <Separator className="my-3" />
                <p className="font-medium text-foreground text-xs uppercase tracking-wider">🖼️ Zona de antet (Header)</p>
                <div className="space-y-1.5 mt-2">
                  <p>• Vedeți <strong>numele complet</strong>, <strong>funcția</strong>, <strong>departamentul</strong> și <strong>rolul</strong> dvs. pe platformă.</p>
                  <p>• <strong>Email-ul</strong> și <strong>telefonul</strong> sunt afișate în partea dreaptă (pe desktop) sau sub antet (pe mobil).</p>
                  <p>• <strong>Schimbarea avatarului</strong>: treceți mouse-ul peste poza de profil → apare o suprapunere cu iconița camerei → apăsați → selectați o imagine (max 2MB, format JPG/PNG).</p>
                  <p>• Punctul verde de lângă avatar indică faptul că contul este activ.</p>
                </div>

                <Separator className="my-3" />
                <p className="font-medium text-foreground text-xs uppercase tracking-wider">📊 Sold Concediu</p>
                <div className="space-y-1.5 mt-2">
                  <p>• <strong>Disponibil {new Date().getFullYear()}</strong> – zilele rămase de concediu pentru anul curent (dreptul curent minus zilele utilizate).</p>
                  <p>• <strong>Utilizat</strong> – câte zile ați folosit deja în acest an.</p>
                  <p>• <strong>Total curent</strong> – dreptul total de zile pentru anul curent.</p>
                  <p>• <strong>Report din anul anterior</strong> – dacă aveți zile reportate, apar separat cu sold propriu.</p>
                  <p>• <strong>Zile bonus</strong> – zilele suplimentare acordate (ex: vechime, condiții speciale) apar cu bază legală.</p>
                  <p>• Bara de progres verde/roșie arată vizual ce procent din concediu ați consumat.</p>
                </div>

                <Separator className="my-3" />
                <p className="font-medium text-foreground text-xs uppercase tracking-wider">🪪 Date de Identitate</p>
                <div className="space-y-1.5 mt-2">
                  <p>• CNP, Serie/Număr CI, autoritate emitentă, dată eliberare, dată expirare.</p>
                  <p>• Adresa completă (stradă, număr, bloc, etaj, apartament, oraș, județ).</p>
                  <p>• Aceste date sunt completate de HR. Dvs. le puteți <strong>doar vizualiza</strong>.</p>
                </div>

                <Separator className="my-3" />
                <p className="font-medium text-foreground text-xs uppercase tracking-wider">💼 Informații Profesionale</p>
                <div className="space-y-1.5 mt-2">
                  <p>• Departament, Funcție, Grad/Treaptă profesională, Email instituțional.</p>
                  <p>• Data angajării și tipul contractului.</p>
                </div>

                <Separator className="my-3" />
                <p className="font-medium text-foreground text-xs uppercase tracking-wider">👤 Aprobator Concediu</p>
                <div className="space-y-1.5 mt-2">
                  <p>• Un card informativ arată cine vă aprobă cererile de concediu.</p>
                  <p>• Poate fi un aprobator <strong>individual</strong> (desemnat special pentru dvs.) sau <strong>la nivel de departament</strong>.</p>
                  <p>• Dacă nu vedeți niciun aprobator, contactați HR.</p>
                </div>

                <Separator className="my-3" />
                <p className="font-medium text-foreground text-xs uppercase tracking-wider">📄 Documente</p>
                <div className="space-y-1.5 mt-2">
                  <p>• Lista documentelor instituționale asociate (contracte, adeverințe, certificate etc.).</p>
                  <p>• Apăsați butonul <strong>descărcare</strong> (săgeata în jos) pentru a salva un document.</p>
                </div>

                <Separator className="my-3" />
                <p className="font-medium text-foreground text-xs uppercase tracking-wider">📝 Istoric Concedii</p>
                <div className="space-y-1.5 mt-2">
                  <p>• Toate cererile de concediu din trecut, cu statusul fiecăreia:</p>
                  <p>  – <Badge variant="default" className="text-[10px]">Aprobat</Badge> = cererea a fost acceptată complet.</p>
                  <p>  – <Badge variant="secondary" className="text-[10px]">În așteptare</Badge> = cererea este în curs de aprobare.</p>
                  <p>  – <Badge variant="destructive" className="text-[10px]">Respins</Badge> = cererea a fost refuzată (vedeți motivul).</p>
                </div>

                <Separator className="my-3" />
                <p className="font-medium text-foreground text-xs uppercase tracking-wider">✏️ Solicită corectare date</p>
                <div className="space-y-1.5 mt-2">
                  <p>• Dacă observați o greșeală în datele dvs., apăsați butonul <strong>„Solicită corectare"</strong>.</p>
                  <p>• Completați câmpul care trebuie corectat, valoarea corectă și un motiv.</p>
                  <p>• Cererea ajunge la HR care o va analiza și aplica.</p>
                </div>

                <ProfileMockup />
              </GuideSection>
              <GuideSection icon={FileText} title="Cerere de Concediu – Ghid detaliat">
                <p className="mb-3 font-medium text-foreground">Pagina are mai multe tab-uri (file) în partea de sus:</p>

                <Separator className="my-3" />
                <p className="font-medium text-foreground text-xs uppercase tracking-wider">📤 Tab „Cerere Nouă"</p>
                <StepList steps={[
                  'Selectați data de început și data de sfârșit folosind calendarul.',
                  'Sistemul calculează automat zilele lucrătoare (exclude weekend-urile și sărbătorile legale/personalizate).',
                  'Completați numele și funcția persoanei care vă înlocuiește.',
                  'Sistemul verifică dacă aveți suficiente zile disponibile – dacă nu, primiți un avertisment.',
                  'Desenați semnătura dvs. electronică în câmpul dedicat (cu mouse-ul sau pe touch screen).',
                  'Apăsați „Trimite cererea" – cererea primește un număr unic (ex: CO-2026-0001).',
                  'Cererea ajunge la aprobatorul dvs. (șeful de departament sau persoana desemnată).',
                ]} />

                <InfoBox title="⚠️ Important: Flux de aprobare">
                  <p>Cererea parcurge 2 etape obligatorii:</p>
                  <p>1. <strong>Șef compartiment</strong> – aprobă/respinge cererea și semnează electronic.</p>
                  <p>2. <strong>Ofițer SRUS (HR)</strong> – validarea finală. Abia după această etapă, cererea devine „Aprobată" și zilele sunt deduse automat din sold.</p>
                  <p>Primiți notificări la fiecare schimbare de status.</p>
                </InfoBox>

                <Separator className="my-3" />
                <p className="font-medium text-foreground text-xs uppercase tracking-wider">📋 Tab „Cererile Mele"</p>
                <div className="space-y-1.5 mt-2">
                  <p>• Lista tuturor cererilor dvs. cu statusul curent.</p>
                  <p>• Puteți <strong>vizualiza detaliile</strong> fiecărei cereri.</p>
                  <p>• Cererile în status <strong>„Ciornă"</strong> pot fi editate sau șterse.</p>
                  <p>• Cererile aprobate pot fi <strong>descărcate ca document Word (.docx)</strong> cu toate semnăturile.</p>
                </div>

                <InfoBox title="💡 Sfat: Descărcare cerere aprobată">
                  <p>După aprobarea completă, butonul „Descarcă DOCX" generează un document oficial cu datele cererii, semnătura dvs., a șefului și a directorului.</p>
                </InfoBox>

                <LeaveRequestMockup />
              </GuideSection>

              {/* ─── CALENDAR CONCEDII DETALIAT ─── */}
              <GuideSection icon={Calendar} title="Calendar Concedii – Ghid detaliat">
                <p className="mb-2">Calendarul afișează concediile tuturor colegilor din departamentul dvs.:</p>

                <Separator className="my-3" />
                <p className="font-medium text-foreground text-xs uppercase tracking-wider">📅 Pe Desktop</p>
                <div className="space-y-1.5 mt-2">
                  <p>• <strong>Tabel lunar</strong>: fiecare rând = un angajat, fiecare coloană = o zi din lună.</p>
                  <p>• Zilele cu concediu sunt colorate conform tipului.</p>
                  <p>• <strong>Weekend-urile</strong> = coloane gri. <strong>Sărbătorile legale</strong> = coloane roșii deschise.</p>
                  <p>• <strong>Ziua de azi</strong> = coloana evidențiată cu un chenar albastru.</p>
                  <p>• Treceți mouse-ul peste o zi pentru a vedea numele complet al zilei și eventualele sărbători.</p>
                </div>

                <Separator className="my-3" />
                <p className="font-medium text-foreground text-xs uppercase tracking-wider">📱 Pe Mobil</p>
                <div className="space-y-1.5 mt-2">
                  <p>• <strong>Carduri per angajat</strong>: fiecare coleg cu perioadele de concediu listate.</p>
                  <p>• Perioadele sunt afișate cu data de început și sfârșit.</p>
                </div>

                <Separator className="my-3" />
                <p className="font-medium text-foreground text-xs uppercase tracking-wider">🎨 Legenda abrevierilor și culorilor</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-sky-500/20 text-sky-700 text-[10px]">CO</Badge>
                    <span>Concediu de odihnă</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-rose-500/20 text-rose-700 text-[10px]">CM</Badge>
                    <span>Concediu medical</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-500/20 text-emerald-700 text-[10px]">EV</Badge>
                    <span>Eveniment deosebit</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-teal-500/20 text-teal-700 text-[10px]">MD</Badge>
                    <span>Muncă la domiciliu</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-orange-500/20 text-orange-700 text-[10px]">I</Badge>
                    <span>Învoiri / fără salariu</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-red-500/20 text-red-700 text-[10px]">PRB</Badge>
                    <span>Program redus boală</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-cyan-500/20 text-cyan-700 text-[10px]">L</Badge>
                    <span>Zile libere plătite</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-indigo-500/20 text-indigo-700 text-[10px]">N</Badge>
                    <span>Ore de noapte</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-pink-500/20 text-pink-700 text-[10px]">M</Badge>
                    <span>Maternitate</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-slate-500/20 text-slate-700 text-[10px]">CS</Badge>
                    <span>Contract suspendat</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-lime-500/20 text-lime-700 text-[10px]">D</Badge>
                    <span>Ore deplasare</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-yellow-500/20 text-yellow-700 text-[10px]">CD</Badge>
                    <span>Condiții muncă</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-red-600/20 text-red-800 text-[10px]">Nm</Badge>
                    <span>Absențe nemotivate</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-fuchsia-500/20 text-fuchsia-700 text-[10px]">PRM</Badge>
                    <span>Program redus maternitate</span>
                  </div>
                </div>

                <InfoBox title="💡 Vizibilitate">
                  <p>Angajații văd doar concediile colegilor din <strong>același departament</strong>. HR-ul și administratorii văd toate departamentele. Doar zilele lucrătoare sunt marcate (weekend-urile și sărbătorile sunt excluse automat).</p>
                </InfoBox>

                <Separator className="my-3" />
                <p className="font-medium text-foreground text-xs uppercase tracking-wider">🧭 Navigare</p>
                <div className="space-y-1.5 mt-2">
                  <p>• <strong>{'Săgețile ← →'}</strong> din header navighează între luni.</p>
                  <p>• Butonul <strong>„Azi"</strong> vă duce înapoi la luna curentă.</p>
                  <p>• În partea de sus, un card albastru arată <strong>cine este în concediu azi</strong>.</p>
                </div>

                <LeaveCalendarMockup />
              </GuideSection>
              <GuideSection icon={FolderDown} title="Formulare și Modele – Ce conține fiecare categorie">
                <p className="mb-2">Formularele sunt organizate pe categorii:</p>
                <div className="space-y-3">
                  <div>
                    <p className="font-medium text-foreground">📁 Resurse Umane</p>
                    <p>• Model cerere de concediu, Declarația persoanelor întreținute</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">📁 Declarații</p>
                    <p>• Declarația contribuabilului, Declarație de avere, Declarație de interese</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">📁 Deplasări</p>
                    <p>• Documente deplasări interne/externe, Decont cheltuieli deplasări externe</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">📁 Laborator</p>
                    <p>• Fișe de solicitare analize (Digestor, DSC, AAS, TOC, Sistem echipamente)</p>
                    <p>• Fișe SPM, WAXD, Zeta Master/SurPASS</p>
                    <p>• Curs de RMN și reguli analize RMN</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">📁 Achiziții</p>
                    <p>• Model referat produse</p>
                  </div>
                </div>

                <InfoBox title="💡 Sfat">
                  <p>Apăsați pe orice formular din listă pentru a-l descărca automat. Formatele disponibile: .doc, .docx, .xlsx, .pdf.</p>
                </InfoBox>

                <FormsMockup />
              </GuideSection>

              {/* ─── SETĂRI DETALIAT ─── */}
              <GuideSection icon={Settings} title="Setări – Ce puteți modifica">
                <p className="mb-2">Pagina de Setări are trei secțiuni:</p>

                <Separator className="my-3" />
                <p className="font-medium text-foreground text-xs uppercase tracking-wider">👤 Profilul meu</p>
                <div className="space-y-1.5 mt-2">
                  <p>• <strong>Nume complet</strong> – puteți modifica.</p>
                  <p>• <strong>Telefon</strong> – puteți adăuga/modifica.</p>
                  <p>• <strong>Departament</strong> și <strong>Funcție</strong> – sunt gestionate de HR (nu pot fi modificate).</p>
                  <p>• Apăsați <strong>„Salvează modificările"</strong> pentru a salva.</p>
                </div>

                <Separator className="my-3" />
                <p className="font-medium text-foreground text-xs uppercase tracking-wider">🎨 Aspect (Temă)</p>
                <div className="space-y-1.5 mt-2">
                  <p>• <strong>Luminos</strong> – temă albă, ideală pentru lucru în lumina naturală.</p>
                  <p>• <strong>Întunecat</strong> – temă neagră, reduce oboseala ochilor seara.</p>
                  <p>• <strong>Sistem</strong> – urmează automat setarea din Windows/macOS.</p>
                  <p>• Fiecare opțiune are o previzualizare miniaturală – apăsați pentru a o selecta.</p>
                </div>

                <Separator className="my-3" />
                <p className="font-medium text-foreground text-xs uppercase tracking-wider">🔐 Schimbare parolă</p>
                <div className="space-y-1.5 mt-2">
                  <p>• Puteți schimba parola curentă din secțiunea dedicată.</p>
                  <p>• Introduceți <strong>parola actuală</strong>, apoi <strong>noua parolă</strong> (minim 6 caractere).</p>
                  <p>• Apăsați iconița <strong>👁 (ochi)</strong> pentru a vizualiza/ascunde parola introdusă.</p>
                  <p>• Apăsați <strong>„Schimbă parola"</strong> pentru a salva.</p>
                </div>

                <InfoBox title="💡 Ați uitat parola?">
                  <p>Din pagina de autentificare, apăsați <strong>„Am uitat parola"</strong>. Veți primi un e-mail cu un link de resetare. Link-ul este valabil pentru o singură utilizare.</p>
                </InfoBox>

                <Separator className="my-3" />
                <p className="font-medium text-foreground text-xs uppercase tracking-wider">🔄 Ajutor – Tour de prezentare</p>
                <div className="space-y-1.5 mt-2">
                  <p>• Butonul <strong>„Reia tour-ul de prezentare"</strong> repornește ghidul interactiv pas cu pas.</p>
                  <p>• Util dacă doriți să revedeți funcționalitățile principale.</p>
                </div>
              </GuideSection>

              {/* ─── ANUNȚURI ─── */}
              <GuideSection icon={Bell} title="Anunțuri – Comunicări oficiale">
                <div className="space-y-1.5">
                  <p>• Pagina <strong>Anunțuri</strong> centralizează comunicările oficiale ale instituției.</p>
                  <p>• Anunțurile pot fi <strong>fixate</strong> (pinned) – acestea apar mereu primele.</p>
                  <p>• Fiecare anunț poate conține <strong>atașamente</strong> și <strong>link-uri</strong> utile.</p>
                  <p>• Prioritizarea vizuală: anunțurile urgente sunt evidențiate cu culori distincte.</p>
                  <p>• Personalul cu roluri administrative poate crea, edita și șterge anunțuri.</p>
                </div>
              </GuideSection>

              {/* ─── MESAGERIE (CHAT) ─── */}
              <GuideSection icon={MessageCircle} title="Mesagerie – Chat intern între colegi" badge="Beta">
                <p className="mb-2">Platforma include un sistem de mesagerie internă pentru comunicare rapidă între colegi:</p>

                <Separator className="my-3" />
                <p className="font-medium text-foreground text-xs uppercase tracking-wider">💬 Conversații</p>
                <div className="space-y-1.5 mt-2">
                  <p>• <strong>Conversații directe</strong> – trimiteți mesaje private oricărui coleg din institut.</p>
                  <p>• <strong>Director de contacte</strong> – organizat pe departamente/laboratoare cu secțiuni expandabile.</p>
                  <p>• <strong>Conversație nouă</strong> – apăsați butonul „+" din lista de conversații pentru a iniția o discuție nouă.</p>
                  <p>• Lista de conversații arată <strong>ultimul mesaj</strong> și un <strong>badge cu numărul mesajelor necitite</strong>.</p>
                  <p>• Badge global de mesaje necitite vizibil în <strong>sidebar</strong> (meniul din stânga).</p>
                </div>

                <Separator className="my-3" />
                <p className="font-medium text-foreground text-xs uppercase tracking-wider">📎 Fișiere și media</p>
                <div className="space-y-1.5 mt-2">
                  <p>• Trimiteți <strong>imagini</strong> (se afișează inline cu previzualizare) și <strong>video</strong>.</p>
                  <p>• Trimiteți <strong>documente</strong> (PDF, Word, Excel, PowerPoint) – fiecare cu iconița corespunzătoare tipului de fișier.</p>
                  <p>• Limita maximă per fișier: <strong>400 MB</strong>.</p>
                  <p>• Panoul <strong>„Media partajate"</strong> (iconița din header-ul chat-ului) afișează toate fișierele schimbate, organizate pe: Imagini, Video și Documente.</p>
                  <p>• La descărcare, fișierele păstrează <strong>numele original</strong>.</p>
                </div>

                <Separator className="my-3" />
                <p className="font-medium text-foreground text-xs uppercase tracking-wider">✓ Status mesaje</p>
                <div className="space-y-1.5 mt-2">
                  <p>• <strong>✓</strong> – mesajul a fost trimis.</p>
                  <p>• <strong>✓✓</strong> – mesajul a fost livrat.</p>
                  <p>• <strong>✓✓ albastru</strong> – mesajul a fost citit de destinatar.</p>
                </div>

                <Separator className="my-3" />
                <p className="font-medium text-foreground text-xs uppercase tracking-wider">😊 Reacții și Emoji</p>
                <div className="space-y-1.5 mt-2">
                  <p>• <strong>Reacții</strong> – treceți mouse-ul peste un mesaj și apăsați iconița 😊 pentru a adăuga o reacție rapidă.</p>
                  <p>• <strong>Emoji picker</strong> – apăsați iconița zâmbitoare din bara de introducere text pentru a alege dintr-o gamă largă de emoji-uri.</p>
                </div>

                <Separator className="my-3" />
                <p className="font-medium text-foreground text-xs uppercase tracking-wider">🔍 Căutare și funcții avansate</p>
                <div className="space-y-1.5 mt-2">
                  <p>• <strong>Căutare în conversație</strong> – apăsați iconița lupă din header-ul chat-ului pentru a căuta în mesaje. Rezultatele sunt evidențiate (highlighted).</p>
                  <p>• <strong>Ștergere mesaje (Unsend)</strong> – puteți șterge mesajele proprii. Fișierele atașate sunt șterse automat și din stocare.</p>
                </div>

                <Separator className="my-3" />
                <p className="font-medium text-foreground text-xs uppercase tracking-wider">🟢 Status online/offline</p>
                <div className="space-y-1.5 mt-2">
                  <p>• Un <strong>punct verde</strong> lângă avatarul unui coleg indică faptul că este online.</p>
                  <p>• Statusul se actualizează <strong>în timp real</strong> – vedeți instant când cineva intră sau iese.</p>
                  <p>• În header-ul conversației, sub numele colegului, apare „Online" sau „Ultima activitate acum X minute".</p>
                  <p>• Indicatorul online este vizibil atât în <strong>lista de conversații</strong> cât și în <strong>fereastra de chat</strong>.</p>
                </div>

                <Separator className="my-3" />
                <p className="font-medium text-foreground text-xs uppercase tracking-wider">🔔 Notificări chat</p>
                <div className="space-y-1.5 mt-2">
                  <p>• La primirea unui mesaj nou, se aude un <strong>sunet de notificare</strong> (beep).</p>
                  <p>• Badge-ul de mesaje necitite se actualizează în timp real în meniu.</p>
                </div>

                <InfoBox title="💡 Sfat: Mesagerie pe mobil">
                  <p>Pe telefon, conversația se deschide pe ecran complet. Apăsați săgeata din stânga-sus pentru a reveni la lista de conversații. Inputul de text este optimizat pentru a preveni auto-zoom-ul pe iOS.</p>
                </InfoBox>

                <ChatMockup />
              </GuideSection>

              {/* ─── PROGRAMĂRI SĂLI ─── */}
              <GuideSection icon={DoorOpen} title="Programări Săli – Rezervare spații comune">
                <p className="mb-2">Modulul de programări permite rezervarea sălilor de ședință și a spațiilor comune:</p>
                <div className="space-y-1.5">
                  <p>• <strong>Vizualizare calendar</strong> – vedeți toate rezervările existente într-un calendar săptămânal sau lunar.</p>
                  <p>• <strong>Rezervare nouă</strong> – selectați sala, data, ora de început și de sfârșit, titlul și o descriere opțională.</p>
                  <p>• <strong>Verificare disponibilitate</strong> – sistemul previne suprapunerile de rezervări.</p>
                  <p>• <strong>Anulare</strong> – puteți anula propriile rezervări.</p>
                  <p>• Administratorii pot gestiona toate rezervările.</p>
                </div>
                <InfoBox title="💡 Sfat">
                  <p>Planificați din timp și rezervați sălile cu cel puțin o zi înainte pentru a evita conflictele de programare.</p>
                </InfoBox>
              </GuideSection>

              {/* ─── ACTIVITĂȚI RECREATIVE ─── */}
              <GuideSection icon={PartyPopper} title="Activități Recreative – Evenimente sociale">
                <p className="mb-2">Secțiunea pentru activități sociale, sportive și culturale organizate de institut:</p>
                <div className="space-y-1.5">
                  <p>• <strong>Lista activităților</strong> – vedeți toate evenimentele planificate cu data, locația și descrierea.</p>
                  <p>• <strong>Categorii</strong> – activitățile sunt organizate pe categorii (sport, cultură, social etc.).</p>
                  <p>• <strong>Participare</strong> – puteți confirma sau refuza participarea la fiecare activitate.</p>
                  <p>• <strong>Limită participanți</strong> – unele activități au un număr maxim de locuri.</p>
                  <p>• Organizatorii pot crea, edita și gestiona activitățile.</p>
                </div>
              </GuideSection>

              {/* ─── INSTALARE APP ─── */}
              <GuideSection icon={Smartphone} title="Instalează Aplicația – ICMPP ca app pe telefon/desktop">
                <p className="mb-2">Platforma poate fi instalată ca aplicație nativă pe orice dispozitiv:</p>

                <Separator className="my-3" />
                <p className="font-medium text-foreground text-xs uppercase tracking-wider">📱 Android (Chrome)</p>
                <StepList steps={[
                  'Deschideți platforma în Chrome pe telefon.',
                  'Apăsați pe meniul ⋮ (cele 3 puncte) din colțul din dreapta-sus.',
                  'Selectați „Adaugă pe ecranul de pornire" sau „Instalează aplicația".',
                  'Confirmați cu „Instalează". Iconița apare pe ecranul principal!',
                ]} />

                <Separator className="my-3" />
                <p className="font-medium text-foreground text-xs uppercase tracking-wider">🍎 iPhone / iPad (Safari)</p>
                <StepList steps={[
                  'Deschideți platforma în Safari (nu funcționează din Chrome pe iOS).',
                  'Apăsați pe butonul Share (săgeata în sus din bara de jos).',
                  'Derulați și apăsați „Adaugă pe ecranul principal".',
                  'Confirmați cu „Adaugă". Aplicația apare pe ecranul de pornire!',
                ]} />

                <Separator className="my-3" />
                <p className="font-medium text-foreground text-xs uppercase tracking-wider">🖥️ Windows / Linux (Chrome / Edge)</p>
                <StepList steps={[
                  'Căutați iconița de instalare în bara de adrese (dreapta).',
                  'Apăsați pe ea și confirmați cu „Instalează".',
                  'Aplicația se deschide într-o fereastră separată, fără bara browserului.',
                ]} />

                <Separator className="my-3" />
                <p className="font-medium text-foreground text-xs uppercase tracking-wider">💻 MacBook / macOS</p>
                <p className="text-xs text-muted-foreground italic mb-1">Varianta 1 — Chrome (recomandat):</p>
                <StepList steps={[
                  'Deschideți platforma în Google Chrome.',
                  'Căutați iconița de instalare în bara de adrese (dreapta) și apăsați pe ea.',
                  'Confirmați cu „Instalează". Aplicația apare în Launchpad și Dock.',
                ]} />
                <p className="text-xs text-muted-foreground italic mb-1 mt-2">Varianta 2 — Safari (macOS Sonoma 14+ / Safari 17+):</p>
                <StepList steps={[
                  'Deschideți platforma în Safari.',
                  'Din meniul Safari, alegeți File → Add to Dock.',
                  'Aplicația apare în Dock și se deschide fără bara Safari.',
                ]} />
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">⚠️ Versiunile mai vechi de macOS (sub Sonoma 14) nu suportă instalarea din Safari — folosiți Chrome.</p>

                <InfoBox title="💡 De ce să instalezi?">
                  <p>Aplicația se deschide mai repede, fără bara browserului, arată și funcționează ca o aplicație reală și se actualizează automat. Accesați <strong>pagina „Instalează App"</strong> din meniu pentru instrucțiuni detaliate și butonul de instalare directă.</p>
                </InfoBox>
              </GuideSection>

              {/* ─── IRIS – ASISTENT AI ─── */}
              <GuideSection icon={Sparkles} title="IRIS – Asistentul AI al platformei">
                <p className="mb-2">IRIS este asistentul inteligent integrat în platformă, accesibil prin butonul plutitor din colțul din dreapta-jos:</p>

                <Separator className="my-3" />
                <p className="font-medium text-foreground text-xs uppercase tracking-wider">💬 Ce poate face IRIS</p>
                <div className="space-y-1.5 mt-2">
                  <p>• <strong>Răspunde la întrebări</strong> despre funcționalitățile platformei și proceduri interne.</p>
                  <p>• <strong>Verifică soldul de concediu</strong> – întrebați „Câte zile de concediu mai am?" și primiți răspunsul instant.</p>
                  <p>• <strong>Informează despre statusul cererilor</strong> – „Ce cereri am în așteptare?"</p>
                  <p>• <strong>Ghidează prin procese</strong> – cum se depune o cerere, cum se rezervă o sală etc.</p>
                  <p>• <strong>Sugestii contextuale</strong> – IRIS oferă sugestii rapide bazate pe pagina curentă.</p>
                </div>

                <Separator className="my-3" />
                <p className="font-medium text-foreground text-xs uppercase tracking-wider">⭐ Feedback</p>
                <div className="space-y-1.5 mt-2">
                  <p>• La închiderea conversației, vi se solicită un <strong>rating cu stele</strong> (1-5) și un comentariu opțional.</p>
                  <p>• Feedback-ul ajută la îmbunătățirea continuă a asistentului.</p>
                  <p>• Conversația completă este salvată automat pentru context.</p>
                </div>

                <InfoBox title="💡 Sfat">
                  <p>IRIS este în dezvoltare continuă. Folosiți <strong>acțiunile rapide</strong> (butoanele de sub bara de input) pentru a accesa cele mai comune funcționalități fără a scrie textul complet.</p>
                </InfoBox>
              </GuideSection>

              {/* ─── BIBLIOTECĂ ─── */}
              <GuideSection icon={BookOpen} title="Bibliotecă – Catalogul institutului">
                <p className="mb-2">Modulul Bibliotecă permite accesul la catalogul de cărți și reviste al institutului:</p>
                <div className="space-y-1.5">
                  <p>• <strong>Cărți</strong> – căutați după titlu, autor sau cotă. Vedeți statusul (disponibilă / împrumutată).</p>
                  <p>• <strong>Reviste</strong> – catalog organizat pe ani, volume și numere.</p>
                  <p>• <strong>Împrumut</strong> – bibliotecarii pot înregistra împrumuturi și returnări.</p>
                  <p>• <strong>Istoric</strong> – fiecare carte/revistă are un istoric complet al împrumuturilor.</p>
                </div>
                <InfoBox title="💡 Acces">
                  <p>Catalogul este vizibil angajaților cu rolul de <strong>bibliotecar</strong>. Contactați administratorul dacă aveți nevoie de acces.</p>
                </InfoBox>
              </GuideSection>

              {/* ─── ARHIVĂ ONLINE ─── */}
              <GuideSection icon={Archive} title="Arhivă Online – Documente instituționale">
                <p className="mb-2">Arhiva Online centralizează documentele instituționale conform nomenclatorului de arhivare:</p>
                <div className="space-y-1.5">
                  <p>• <strong>Categorii</strong> – documentele sunt organizate pe categorii de nomenclator cu termen de retenție.</p>
                  <p>• <strong>Departamente</strong> – fiecare document este asociat unui departament.</p>
                  <p>• <strong>Număr de înregistrare</strong> – identificator unic pentru fiecare document.</p>
                  <p>• <strong>Fișiere atașate</strong> – documentele pot avea fișiere digitale asociate (PDF, scanări).</p>
                  <p>• <strong>Jurnal de acces</strong> – fiecare vizualizare sau descărcare este înregistrată pentru audit.</p>
                </div>
              </GuideSection>

              {/* ─── NOTIFICĂRI ─── */}
              <GuideSection icon={Bell} title="Notificări – Cum funcționează">
                <div className="space-y-1.5">
                  <p>• Platforma trimite notificări automate pentru:</p>
                  <p>  – Cereri de concediu aprobate sau respinse.</p>
                  <p>  – Mesaje de la administrator.</p>
                  <p>  – Alerte de expirare carte de identitate.</p>
                  <p>  – Anunțuri noi și cereri de aprobare.</p>
                  <p>  – Mesaje noi în chat (cu sunet de notificare).</p>
                  <p>• Notificările apar ca un <strong>badge roșu pe clopoțel</strong> (bara de sus).</p>
                  <p>• Apăsați pe clopoțel pentru a vedea lista. Apăsați pe o notificare pentru detalii.</p>
                  <p>• Puteți marca notificările ca citite individual sau pe toate deodată.</p>
                </div>
              </GuideSection>

            </Accordion>
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════════════════════ */}
        {/* SECȚIUNEA ȘEFI DE DEPARTAMENT */}
        {/* ═══════════════════════════════════════════════════ */}
        {isDeptHead && (
          <Card className="print:shadow-none print:border">
            <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-primary" />
              Ghid detaliat pentru aprobatori de concediu
            </CardTitle>
            <CardDescription>Aprobarea cererilor, delegarea și monitorizarea echipei – pentru șefi de departament și aprobatori desemnați</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                
                <GuideSection icon={CheckSquare} title="Aprobarea cererilor de concediu – Pas cu pas">
                  <p className="mb-2">Ca șef de departament, vedeți un <strong>badge roșu</strong> pe meniu care indică numărul cererilor în așteptare.</p>
                  
                  <StepList steps={[
                    'Din meniu, accesați „Cerere Concediu" – se deschide automat tab-ul „De Aprobat".',
                    'Vedeți o listă cu toate cererile din departamentul dvs. cu status „Așteptare Șef".',
                    'Pentru fiecare cerere, vedeți: numele angajatului, perioada solicitată, numărul de zile, înlocuitorul desemnat.',
                    'Apăsați „Detalii" pentru a vedea cererea completă (inclusiv semnătura angajatului).',
                    'Pentru aprobare: apăsați „Aprobă", adăugați opțional un comentariu, și semnați electronic.',
                    'Pentru respingere: apăsați „Respinge" și completați obligatoriu motivul respingerii.',
                    'După aprobarea dvs., cererea merge automat la etapa următoare (validare SRUS/HR).',
                    'Angajatul primește o notificare cu decizia dvs.',
                  ]} />

                  <InfoBox title="⚠️ Important">
                    <p>Semnătura electronică este <strong>obligatorie</strong> pentru aprobare. Desenați semnătura cu mouse-ul sau pe ecranul tactil. Butonul „Șterge" permite reluarea semnăturii.</p>
                  </InfoBox>

                  <ApprovalMockup />
                </GuideSection>

                <GuideSection icon={History} title={'Tab „Centralizator" – Istoricul aprobărilor'}>
                  <div className="space-y-1.5">
                    <p>• Afișează <strong>toate cererile</strong> procesate de dvs. (aprobate și respinse).</p>
                    <p>• Filtrare după: status (aprobat/respins), perioadă, angajat.</p>
                    <p>• Fiecare înregistrare arată: angajatul, perioada, zilele, data aprobării și semnătura dvs.</p>
                    <p>• Puteți descărca documentul Word al cererii aprobate.</p>
                  </div>
                </GuideSection>

                <GuideSection icon={UserCheck} title={'Tab „Înlocuitor" – Delegarea aprobării'}>
                  <p className="mb-2">Când sunteți în concediu sau indisponibil, puteți delega dreptul de aprobare:</p>
                  <StepList steps={[
                    'Accesați tab-ul „Înlocuitor" din pagina Cerere Concediu.',
                    'Selectați un coleg din lista angajaților (de regulă alt șef sau un responsabil).',
                    'Setați data de început și data de sfârșit a delegării.',
                    'Opțional, adăugați un motiv (ex: „Concediu de odihnă").',
                    'Apăsați „Activează delegarea".',
                  ]} />
                  <InfoBox title="💡 Ce se întâmplă cu delegarea">
                    <p>Delegatul va vedea cererile departamentului dvs. în tab-ul „De Aprobat" pe durata setată. După expirarea perioadei, delegarea se dezactivează automat. Puteți anula delegarea manual oricând.</p>
                  </InfoBox>
                </GuideSection>

                <GuideSection icon={Users} title="Echipa Mea – Vizualizare membrii echipei">
                  <div className="space-y-1.5">
                    <p>• Pagina <strong>„Echipa Mea"</strong> apare în meniu doar pentru șefii de departament, HR și administratori.</p>
                    <p>• Vedeți toți membrii departamentului dvs. cu: nume, funcție, email, departament.</p>
                    <p>• Informații de contact rapide pentru fiecare membru al echipei.</p>
                    <p>• Util pentru a avea o imagine de ansamblu asupra echipei și a coordona mai eficient.</p>
                  </div>
                </GuideSection>

                <GuideSection icon={Eye} title="Ce vede un șef de departament în plus față de un angajat">
                  <div className="space-y-1.5">
                    <p>• <strong>Badge pe meniu</strong> – numărul cererilor în așteptare, vizibil pe „Cerere Concediu" în sidebar.</p>
                    <p>• <strong>Tab „De Aprobat"</strong> – disponibil doar pentru șefi și aprobatori desemnați.</p>
                    <p>• <strong>Tab „Centralizator"</strong> – istoric complet al deciziilor.</p>
                    <p>• <strong>Tab „Înlocuitor"</strong> – delegarea temporară a aprobării.</p>
                    <p>• <strong>Echipa Mea</strong> – vizualizarea completă a membrilor echipei.</p>
                    <p>• <strong>Dashboard</strong> – poate afișa alerte suplimentare despre cererile în așteptare.</p>
                  </div>
                </GuideSection>

              </Accordion>
            </CardContent>
          </Card>
        )}

        {/* ═══════════════════════════════════════════════════ */}
        {/* SECȚIUNEA HR */}
        {/* ═══════════════════════════════════════════════════ */}
        {canManageHR && (
          <Card className="print:shadow-none print:border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-primary" />
                Ghid detaliat pentru HR (SRUS)
              </CardTitle>
              <CardDescription>Gestionarea completă a angajaților, concediilor și rapoartelor</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                <GuideSection icon={Users} title="Gestiune HR – Angajați și date personale">
                  <p className="mb-2">Pagina „Gestiune HR" conține multiple tab-uri:</p>
                  <StepList steps={[
                    '„Angajați" – tabelul principal cu toți angajații activi. Puteți edita orice câmp.',
                    '„Import" – încărcarea în lot a datelor din fișiere Excel.',
                    '„Aprobatori" – configurarea aprobatorilor de concediu per angajat sau per departament.',
                    '„Concedii" – înregistrarea manuală a concediilor și gestionarea soldurilor.',
                    '„Zile bonus" – acordarea de zile suplimentare pe bază legală.',
                    '„Report" – gestionarea zilelor reportate din anul anterior.',
                    '„Corectări" – vizualizarea și rezolvarea cererilor de corectare de la angajați.',
                    '„CI Expirare" – import și monitorizare date cărți de identitate.',
                  ]} />
                </GuideSection>

                <GuideSection icon={FileText} title="Import și Export date">
                  <p className="font-medium text-foreground mb-2">Import:</p>
                  <StepList steps={[
                    'Descărcați modelul Excel din tab-ul „Import".',
                    'Completați: nume, prenume, CNP, email, departament, funcție, data angajării, zile concediu.',
                    'Încărcați fișierul – sistemul validează automat.',
                    'Angajații existenți (după email) sunt actualizați, cei noi sunt adăugați.',
                  ]} />
                  <p className="font-medium text-foreground mt-3 mb-2">Export:</p>
                  <StepList steps={[
                    'Apăsați butonul „Export" din tabelul angajaților.',
                    'Se descarcă un fișier Excel cu toate datele vizibile.',
                  ]} />
                </GuideSection>

                <GuideSection icon={ClipboardList} title="Centralizare HR – Toate cererile de concediu">
                  <div className="space-y-1.5">
                    <p>• Tab-ul „Centralizare HR" din pagina Cerere Concediu arată <strong>toate cererile din institut</strong>.</p>
                    <p>• Filtrare după status, departament, perioadă.</p>
                    <p>• HR poate <strong>edita, anula sau șterge</strong> orice cerere.</p>
                    <p>• Export centralizator în Excel.</p>
                  </div>
                </GuideSection>

                <GuideSection icon={Activity} title="Medicină Muncii – Fișe medicale și consultații">
                  <p className="mb-2">Modulul de Medicină a Muncii permite gestionarea dosarelor medicale ale angajaților:</p>
                  <div className="space-y-1.5">
                    <p>• <strong>Fișe medicale</strong> – fiecare angajat are un dosar medical cu aptitudinea, restricțiile și condițiile cronice.</p>
                    <p>• <strong>Consultații</strong> – înregistrarea consultațiilor periodice, de angajare și de control.</p>
                    <p>• <strong>Programări examene</strong> – planificarea și urmărirea examenelor medicale obligatorii.</p>
                    <p>• <strong>Valabilitate fișe</strong> – alertă automată când fișele de aptitudine expiră.</p>
                    <p>• <strong>Documente</strong> – atașare de fișe de aptitudine, analize și alte documente medicale.</p>
                    <p>• <strong>Dosar medical complet</strong> – antecedente, condiții de lucru, traseu profesional.</p>
                  </div>
                  <InfoBox title="💡 Acces">
                    <p>Modulul este accesibil rolurilor <strong>medic_medicina_muncii</strong>, <strong>hr</strong>, <strong>sef_srus</strong> și <strong>super_admin</strong>.</p>
                  </InfoBox>
                </GuideSection>

              </Accordion>
            </CardContent>
          </Card>
        )}

        {/* ═══════════════════════════════════════════════════ */}
        {/* SECȚIUNEA ADMIN */}
        {/* ═══════════════════════════════════════════════════ */}
        {isSuperAdmin && (
          <Card className="print:shadow-none print:border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Ghid detaliat pentru administratori
              </CardTitle>
              <CardDescription>Control complet al platformei, conturilor și setărilor</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                <GuideSection icon={Settings} title="Setări platformă (Administrare)">
                  <p className="mb-2">Pagina „Administrare" din meniu conține:</p>
                  <StepList steps={[
                    '„Setări Aplicație" – activare/dezactivare mentenanță, mesaj homepage, modul beta concedii.',
                    '„Conturi" – cereri de creare cont, aprobare/respingere cu note.',
                    '„Invitații" – trimiterea invitațiilor pe email pentru conturi noi.',
                    '„Creare Manuală" – crearea directă a conturilor pentru angajați.',
                    '„Pre-atribuire Roluri" – setarea rolului pentru un email înainte ca persoana să-și creeze contul.',
                    '„HelpDesk" – vizualizarea și rezolvarea tichetelor de suport trimise de angajați.',
                    '„Jurnal Audit" – log-ul complet al acțiunilor din sistem.',
                    '„Autentificări" – log-ul tuturor conectărilor (cu IP, device, status).',
                    '„Echipamente" – registrul echipamentelor IT asignate angajaților.',
                  ]} />
                </GuideSection>

                <GuideSection icon={Eye} title="Stare Sistem – Monitorizare platformă">
                  <div className="space-y-1.5">
                    <p>• Pagina <strong>„Stare Sistem"</strong> este accesibilă doar administratorilor.</p>
                    <p>• Afișează starea curentă a serviciilor platformei (bază de date, autentificare, stocare).</p>
                    <p>• Incidente active și istoricul incidentelor rezolvate.</p>
                    <p>• Puteți crea, actualiza și rezolva incidente pentru a informa utilizatorii.</p>
                  </div>
                </GuideSection>

                <GuideSection icon={Users} title="Gestionare conturi și roluri">
                  <p className="mb-2 font-medium text-foreground">Rolurile disponibile în sistem:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="flex items-center gap-2 p-2 rounded border bg-muted/30">
                      <Badge variant="secondary" className="text-[10px]">user</Badge>
                      <span className="text-xs">Angajat – acces de bază</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded border bg-muted/30">
                      <Badge variant="secondary" className="text-[10px]">sef</Badge>
                      <span className="text-xs">Șef departament – aprobă concedii</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded border bg-muted/30">
                      <Badge variant="secondary" className="text-[10px]">sef_srus</Badge>
                      <span className="text-xs">Șef SRUS – HR + aprobări</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded border bg-muted/30">
                      <Badge variant="secondary" className="text-[10px]">hr</Badge>
                      <span className="text-xs">HR (SRUS) – gestionare angajați</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded border bg-muted/30">
                      <Badge variant="secondary" className="text-[10px]">director_institut</Badge>
                      <span className="text-xs">Director Institut – conducere</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded border bg-muted/30">
                      <Badge variant="secondary" className="text-[10px]">director_adjunct</Badge>
                      <span className="text-xs">Director Adjunct – conducere</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded border bg-muted/30">
                      <Badge variant="secondary" className="text-[10px]">secretar_stiintific</Badge>
                      <span className="text-xs">Secretar Științific – conducere</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded border bg-muted/30">
                      <Badge variant="secondary" className="text-[10px]">super_admin</Badge>
                      <span className="text-xs">Super Admin – control total</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded border bg-muted/30">
                      <Badge variant="secondary" className="text-[10px]">bibliotecar</Badge>
                      <span className="text-xs">Bibliotecar – gestionare bibliotecă</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded border bg-muted/30">
                      <Badge variant="secondary" className="text-[10px]">salarizare</Badge>
                      <span className="text-xs">Salarizare – acces date salariale</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded border bg-muted/30">
                      <Badge variant="secondary" className="text-[10px]">secretariat</Badge>
                      <span className="text-xs">Secretariat – documente și corespondență</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded border bg-muted/30">
                      <Badge variant="secondary" className="text-[10px]">achizitii</Badge>
                      <span className="text-xs">Achiziții – gestionare achiziții</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded border bg-muted/30">
                      <Badge variant="secondary" className="text-[10px]">contabilitate</Badge>
                      <span className="text-xs">Contabilitate – operațiuni financiare</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded border bg-muted/30">
                      <Badge variant="secondary" className="text-[10px]">oficiu_juridic</Badge>
                      <span className="text-xs">Oficiu Juridic – consiliere juridică</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded border bg-muted/30">
                      <Badge variant="secondary" className="text-[10px]">compartiment_comunicare</Badge>
                      <span className="text-xs">Comunicare – relații publice</span>
                    </div>
                  </div>
                  <InfoBox title="💡 Pre-atribuire roluri">
                    <p>Puteți seta rolul unui angajat <strong>înainte</strong> ca acesta să-și creeze contul. Mergeți la Administrare → Pre-atribuire Roluri → adăugați email-ul și rolul dorit. La înregistrare, rolul se aplică automat.</p>
                  </InfoBox>
                </GuideSection>

                <GuideSection icon={AlertTriangle} title="Modul de mentenanță">
                  <div className="space-y-1.5">
                    <p>• Când este activ, utilizatorii obișnuiți văd doar o pagină de mentenanță.</p>
                    <p>• Administratorii, HR și șefii SRUS pot accesa platforma normal.</p>
                    <p>• Utilizatorii se pot abona pentru a primi un email când platforma revine online.</p>
                    <p>• Activare: Administrare → Setări Aplicație → „Mod Mentenanță" → ON.</p>
                  </div>
                </GuideSection>

                <GuideSection icon={Package} title="Inventar IT – Registrul echipamentelor">
                  <div className="space-y-1.5">
                    <p>• <strong>Catalogul echipamentelor</strong> – toate echipamentele IT (calculatoare, monitoare, imprimante etc.) cu număr de inventar, serie, model.</p>
                    <p>• <strong>Asignare</strong> – fiecare echipament poate fi asignat unui angajat cu dată de asignare.</p>
                    <p>• <strong>Locație</strong> – clădire, etaj, cameră pentru fiecare echipament.</p>
                    <p>• <strong>Software</strong> – evidența sistemelor de operare, licențelor și aplicațiilor instalate.</p>
                    <p>• <strong>Cod QR</strong> – generare cod QR pentru identificare rapidă a echipamentelor.</p>
                    <p>• <strong>Istoric</strong> – fiecare echipament are un jurnal complet al transferurilor și modificărilor.</p>
                    <p>• <strong>Import</strong> – import în lot din fișiere Excel.</p>
                  </div>
                </GuideSection>

                <GuideSection icon={Banknote} title="Salarizare – Date salariale">
                  <div className="space-y-1.5">
                    <p>• Modulul de Salarizare este accesibil rolului <strong>salarizare</strong> și <strong>super_admin</strong>.</p>
                    <p>• Centralizează informațiile salariale ale angajaților.</p>
                    <p>• Datele sunt protejate și vizibile doar utilizatorilor autorizați.</p>
                  </div>
                </GuideSection>

                <GuideSection icon={Sparkles} title="IRIS Feedback – Monitorizare asistent AI">
                  <div className="space-y-1.5">
                    <p>• Tab-ul <strong>„IRIS Feedback"</strong> din Centrul de Control afișează toate evaluările primite de IRIS.</p>
                    <p>• <strong>Statistici</strong> – rating mediu, distribuția pe stele (1-5) și numărul total de evaluări.</p>
                    <p>• <strong>Lista feedback-urilor</strong> – fiecare evaluare cu rating, comentariu și data.</p>
                    <p>• <strong>Conversații complete</strong> – puteți vizualiza conversația integrală asociată fiecărei evaluări.</p>
                    <p>• Util pentru a identifica ce funcționalități trebuie îmbunătățite la IRIS.</p>
                  </div>
                </GuideSection>

                <GuideSection icon={Newspaper} title="Changelog – Istoricul actualizărilor">
                  <div className="space-y-1.5">
                    <p>• Pagina <strong>Changelog</strong> documentează cronologic toate actualizările platformei.</p>
                    <p>• <strong>Versiuni</strong> – organizat pe versiuni majore (1.x, 2.x, 3.x etc.).</p>
                    <p>• <strong>Categorii</strong> – Major, Minor, Fix – cu culori distincte pentru fiecare tip.</p>
                    <p>• <strong>Filtre</strong> – căutare în timp real, filtrare pe module.</p>
                    <p>• <strong>Export</strong> – exportul istoricului în format Excel, colorat semantic.</p>
                  </div>
                </GuideSection>

              </Accordion>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
};

export default PlatformGuide;
