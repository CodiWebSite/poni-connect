import MainLayout from '@/components/layout/MainLayout';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Printer, UserCircle, FileText, Calendar, FolderDown, Settings, CheckSquare,
  ClipboardList, Shield, Users, BookOpen, Bell, Home, Search, Moon,
  Eye, Download, History, UserCheck, AlertTriangle, HelpCircle,
} from 'lucide-react';
import {
  SidebarMockup, HeaderMockup, DashboardMockup, ProfileMockup,
  LeaveRequestMockup, LeaveCalendarMockup, FormsMockup, ApprovalMockup,
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
  const isDeptHead = isSef || isSefSRUS || isSuperAdmin;

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
                    <div><strong>Dashboard</strong> – pagina principală cu statistici rapide, acțiuni rapide și calendar personal.</div>
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
                    <Settings className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <div><strong>Setări</strong> – actualizarea numelui, telefonului și a temei vizuale.</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <HelpCircle className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <div><strong>Ghid Platformă</strong> – această pagină cu instrucțiuni detaliate.</div>
                  </div>
                </div>

                <InfoBox title="💡 Sfat: Colapsarea meniului">
                  <p>Apăsați săgeata din colțul din dreapta-sus al sidebar-ului pentru a-l restrânge (va afișa doar iconițele). Apăsați din nou pentru a-l extinde.</p>
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
                    <Eye className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <div><strong>Acțiuni rapide</strong> – 3 carduri în partea de sus: Profilul Meu, Calendar Concedii, Formulare. Apăsați pe oricare pentru acces direct.</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Calendar className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <div><strong>Calendarul personal</strong> – vedeți evenimentele lunii curente și zilele dvs. de concediu.</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Bell className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <div><strong>Soldul de concediu</strong> – pentru angajați, se afișează direct câte zile mai aveți disponibile.</div>
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
                  <p>1. <strong>Șef departament</strong> – aprobă/respinge cererea și semnează electronic.</p>
                  <p>2. <strong>Director</strong> – aprobarea finală. Abia după această etapă, cererea devine „Aprobată".</p>
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
                <p className="font-medium text-foreground text-xs uppercase tracking-wider">🎨 Legenda culorilor</p>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-sky-500/20 text-sky-700 text-[10px]">CO</Badge>
                    <span>Concediu de odihnă</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-rose-500/20 text-rose-700 text-[10px]">BO</Badge>
                    <span>Concediu medical</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-purple-500/20 text-purple-700 text-[10px]">CCC</Badge>
                    <span>Creștere copil</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-amber-500/20 text-amber-700 text-[10px]">CFP</Badge>
                    <span>Fără plată</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-500/20 text-emerald-700 text-[10px]">EV</Badge>
                    <span>Eveniment</span>
                  </div>
                </div>

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
                <p className="font-medium text-foreground text-xs uppercase tracking-wider">🔄 Ajutor – Tour de prezentare</p>
                <div className="space-y-1.5 mt-2">
                  <p>• Butonul <strong>„Reia tour-ul de prezentare"</strong> repornește ghidul interactiv pas cu pas.</p>
                  <p>• Util dacă doriți să revedeți funcționalitățile principale.</p>
                </div>
              </GuideSection>

              {/* ─── NOTIFICĂRI ─── */}
              <GuideSection icon={Bell} title="Notificări – Cum funcționează">
                <div className="space-y-1.5">
                  <p>• Platforma trimite notificări automate pentru:</p>
                  <p>  – Cereri de concediu aprobate sau respinse.</p>
                  <p>  – Mesaje de la administrator.</p>
                  <p>  – Alerte de expirare carte de identitate.</p>
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
                Ghid detaliat pentru șefi de departament
              </CardTitle>
              <CardDescription>Aprobarea cererilor, delegarea și monitorizarea echipei</CardDescription>
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
                    'După aprobarea dvs., cererea merge automat la etapa următoare (Director).',
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

                <GuideSection icon={Eye} title="Ce vede un șef de departament în plus față de un angajat">
                  <div className="space-y-1.5">
                    <p>• <strong>Badge pe meniu</strong> – numărul cererilor în așteptare, vizibil pe „Cerere Concediu" în sidebar.</p>
                    <p>• <strong>Tab „De Aprobat"</strong> – disponibil doar pentru șefi și aprobatori desemnați.</p>
                    <p>• <strong>Tab „Centralizator"</strong> – istoric complet al deciziilor.</p>
                    <p>• <strong>Tab „Înlocuitor"</strong> – delegarea temporară a aprobării.</p>
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
                    '„Pre-atribuire Roluri" – setarea rolului pentru un email înainte ca persoana să-și creeze contul.',
                    '„Jurnal Audit" – log-ul complet al acțiunilor din sistem.',
                    '„Autentificări" – log-ul tuturor conectărilor (cu IP, device, status).',
                    '„Echipamente" – registrul echipamentelor IT asignate angajaților.',
                  ]} />
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
                      <span className="text-xs">HR – gestionare angajați</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded border bg-muted/30">
                      <Badge variant="secondary" className="text-[10px]">director_institut</Badge>
                      <span className="text-xs">Director – aprobări finale</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded border bg-muted/30">
                      <Badge variant="secondary" className="text-[10px]">super_admin</Badge>
                      <span className="text-xs">Super Admin – control total</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded border bg-muted/30">
                      <Badge variant="secondary" className="text-[10px]">bibliotecar</Badge>
                      <span className="text-xs">Bibliotecar – gestionare bibliotecă</span>
                    </div>
                  </div>
                </GuideSection>

                <GuideSection icon={AlertTriangle} title="Modul de mentenanță">
                  <div className="space-y-1.5">
                    <p>• Când este activ, utilizatorii obișnuiți văd doar o pagină de mentenanță.</p>
                    <p>• Administratorii, HR și șefii SRUS pot accesa platforma normal.</p>
                    <p>• Utilizatorii se pot abona pentru a primi un email când platforma revine online.</p>
                    <p>• Activare: Administrare → Setări Aplicație → „Mod Mentenanță" → ON.</p>
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
