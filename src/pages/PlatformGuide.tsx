import MainLayout from '@/components/layout/MainLayout';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Printer, UserCircle, FileText, Calendar, FolderDown, Settings, CheckSquare, ClipboardList, Shield, Users, BookOpen } from 'lucide-react';

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
      <div className="pl-11 space-y-2 text-sm text-muted-foreground leading-relaxed">
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

const PlatformGuide = () => {
  const { isSuperAdmin, canManageHR, isSef, isSefSRUS } = useUserRole();
  const isDeptHead = isSef || isSefSRUS || isSuperAdmin;

  return (
    <MainLayout title="Ghid Platformă" description="Instrucțiuni pas cu pas pentru utilizarea platformei ICMPP Intranet">
      <div className="max-w-4xl mx-auto space-y-6 print:space-y-4">
        
        {/* Print button */}
        <div className="flex justify-end print:hidden">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
            <Printer className="w-4 h-4" />
            Printează ghidul
          </Button>
        </div>

        {/* For all employees */}
        <Card className="print:shadow-none print:border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              Ghid pentru toți angajații
            </CardTitle>
            <CardDescription>Funcționalitățile de bază ale platformei</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              <GuideSection icon={UserCircle} title="Cum îmi completez profilul">
                <StepList steps={[
                  'Din meniu, accesați „Profilul Meu".',
                  'Verificați datele personale: nume, departament, funcție.',
                  'Pentru a schimba fotografia de profil, treceți cursorul peste avatar și apăsați pe iconița camerei.',
                  'Selectați o imagine de pe calculator (max. 2MB).',
                  'Dacă observați date incorecte, apăsați butonul „Solicită corectare" pentru a trimite o cerere către HR.',
                ]} />
              </GuideSection>

              <GuideSection icon={FileText} title="Cum fac cerere de concediu">
                <p className="mb-2 font-medium text-foreground">Fluxul de aprobare:</p>
                <p className="mb-3">Cererea parcurge 2 etape: <strong>Șef departament</strong> → <strong>Director</strong>. Veți primi notificări la fiecare etapă.</p>
                <StepList steps={[
                  'Din meniu, accesați „Cerere Concediu".',
                  'Se deschide tab-ul „Cerere Nouă" – completați perioada dorită.',
                  'Sistemul calculează automat zilele lucrătoare (fără weekend, fără sărbători legale).',
                  'Specificați numele și funcția înlocuitorului.',
                  'Semnați cererea electronic (desenați semnătura în câmpul dedicat).',
                  'Apăsați „Trimite cererea" – aceasta va ajunge la șeful de departament.',
                  'După aprobarea șefului, cererea merge automat la director.',
                  'Urmăriți statusul cererii în tab-ul „Cererile Mele".',
                ]} />
              </GuideSection>

              <GuideSection icon={FolderDown} title="Cum descarc formulare">
                <StepList steps={[
                  'Din meniu, accesați „Formulare".',
                  'Formulare sunt organizate pe categorii: Resurse Umane, Declarații, Deplasări, Laborator, Achiziții.',
                  'Apăsați pe formular pentru a-l descărca.',
                  'Completați formularul și depuneți-l conform procedurii interne.',
                ]} />
              </GuideSection>

              <GuideSection icon={Calendar} title="Cum văd calendarul de concedii">
                <StepList steps={[
                  'Din meniu, accesați „Calendar Concedii".',
                  'Vedeți un tabel lunar cu colegii din departamentul dvs.',
                  'Zilele de concediu sunt marcate cu culori: albastru (CO), roșu (medical), mov (creștere copil), etc.',
                  'Navigați între luni cu săgețile din header.',
                  'Apăsați „Azi" pentru a reveni la luna curentă.',
                  'În partea de sus vedeți colegii aflați în concediu astăzi.',
                ]} />
              </GuideSection>

              <GuideSection icon={Settings} title="Cum schimb tema (dark/light)">
                <StepList steps={[
                  'Din meniu, accesați „Setări".',
                  'În secțiunea „Aspect", alegeți între: Luminos, Întunecat sau Sistem.',
                  'Tema se aplică instantaneu pe toată platforma.',
                  'Opțiunea „Sistem" urmărește preferința din sistemul de operare.',
                ]} />
              </GuideSection>
            </Accordion>
          </CardContent>
        </Card>

        {/* For dept heads */}
        {isDeptHead && (
          <Card className="print:shadow-none print:border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-primary" />
                Ghid pentru șefi de departament
              </CardTitle>
              <CardDescription>Aprobarea și gestionarea cererilor de concediu</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                <GuideSection icon={CheckSquare} title="Cum aprob/resping concedii">
                  <StepList steps={[
                    'Din meniu, accesați „Cerere Concediu" – se deschide automat tab-ul „De Aprobat".',
                    'Vedeți lista cererilor în așteptare din departamentul dvs.',
                    'Examinați detaliile cererii: perioadă, zile, înlocuitor.',
                    'Apăsați „Aprobă" sau „Respinge" și adăugați opțional un motiv.',
                    'Semnați electronic aprobarea.',
                    'Cererea aprobată merge automat la director.',
                    'Puteți vedea istoricul aprobărilor în tab-ul „Centralizator".',
                  ]} />
                </GuideSection>

                <GuideSection icon={Users} title="Cum desemnez un înlocuitor pentru aprobare">
                  <StepList steps={[
                    'În secțiunea „Cerere Concediu", accesați tab-ul „Înlocuitor".',
                    'Selectați un coleg care va putea aproba cereri în locul dvs.',
                    'Setați perioada de delegare (data de început și sfârșit).',
                    'Delegatul va vedea cererile în tab-ul „De Aprobat".',
                  ]} />
                </GuideSection>
              </Accordion>
            </CardContent>
          </Card>
        )}

        {/* For HR */}
        {canManageHR && (
          <Card className="print:shadow-none print:border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-primary" />
                Ghid pentru HR
              </CardTitle>
              <CardDescription>Gestionarea angajaților și rapoartelor</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                <GuideSection icon={Users} title="Gestiune angajați">
                  <StepList steps={[
                    'Din meniu, accesați „Gestiune HR".',
                    'Vedeți lista completă a angajaților cu date personale, contract și sold concediu.',
                    'Puteți edita datele direct din tabel (dublu-click pe celulă).',
                    'Folosiți funcția de căutare pentru a găsi rapid un angajat.',
                    'Filtrați după departament sau status (activ/arhivat).',
                  ]} />
                </GuideSection>

                <GuideSection icon={FileText} title="Import date angajați">
                  <StepList steps={[
                    'În secțiunea „Gestiune HR", accesați tab-ul „Import".',
                    'Descărcați modelul de fișier Excel (.xlsx) cu structura necesară.',
                    'Completați datele angajaților în fișier.',
                    'Încărcați fișierul – sistemul validează datele automat.',
                    'Confirmați importul – angajații noi vor fi adăugați.',
                  ]} />
                </GuideSection>

                <GuideSection icon={ClipboardList} title="Export rapoarte">
                  <StepList steps={[
                    'În secțiunea „Gestiune HR", apăsați butonul „Export".',
                    'Selectați tipul de raport: angajați activi, sold concedii, etc.',
                    'Fișierul Excel se descarcă automat.',
                  ]} />
                </GuideSection>
              </Accordion>
            </CardContent>
          </Card>
        )}

        {/* For admins */}
        {isSuperAdmin && (
          <Card className="print:shadow-none print:border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Ghid pentru administratori
              </CardTitle>
              <CardDescription>Setări platformă și gestionare conturi</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                <GuideSection icon={Settings} title="Setări platformă">
                  <StepList steps={[
                    'Din meniu, accesați „Administrare".',
                    'Puteți activa/dezactiva modul de mentenanță.',
                    'Setați mesajul afișat pe pagina principală.',
                    'Configurați modulul de cereri concediu (beta on/off).',
                    'Gestionați sărbătorile legale personalizate.',
                  ]} />
                </GuideSection>

                <GuideSection icon={Users} title="Gestionare conturi și roluri">
                  <StepList steps={[
                    'În „Administrare", accesați tab-ul „Conturi".',
                    'Vedeți cererile de creare cont în așteptare.',
                    'Aprobați sau respingeți cererile cu note explicative.',
                    'Pre-atribuiți roluri pentru adrese de email (rolul se aplică automat la înregistrare).',
                    'Roluri disponibile: Angajat, Șef, HR, Director, Super Admin, Bibliotecar.',
                  ]} />
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
