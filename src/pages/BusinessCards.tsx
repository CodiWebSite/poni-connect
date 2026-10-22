import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EditableFields, EMPTY_CUSTOMIZATION, type CardCustomizationData } from '@/components/business-cards/CardCustomization';
import { CardFacePreview } from '@/components/business-cards/CardFacePreview';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { CreditCard, Download, Search, Loader2 } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  CARD_W, CARD_H, BusinessCardFace, type CardData,
} from '@/components/business-cards/CardVariants';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { INSTITUTE_CARD_URL } from '@/utils/businessCards';

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  department: string | null;
  position: string | null;
  email: string;
}

/* ──────── Bilingual minimalist preview ──────── */

function CardPreview({ data, frontRef, backRef }: {
  data: CardData;
  frontRef: React.RefObject<HTMLDivElement>;
  backRef: React.RefObject<HTMLDivElement>;
}) {
  return (
    <div className="space-y-4">
      {(['front', 'back'] as const).map(face => (
        <section key={face} className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">
            {face === 'front' ? 'Față · Română' : 'Verso · English'}
          </h2>
          <CardFacePreview faceRef={face === 'front' ? frontRef : backRef}>
            <BusinessCardFace data={data} face={face} />
          </CardFacePreview>
        </section>
      ))}
    </div>
  );
}

/* ──────── Download helper ──────── */

async function downloadPDF(
  frontRef: React.RefObject<HTMLDivElement>,
  backRef: React.RefObject<HTMLDivElement>,
  fileName: string,
) {
  if (!frontRef.current || !backRef.current) throw new Error('Refs missing');
  await document.fonts.ready;
  const faces = [frontRef.current, backRef.current];
  await Promise.all(faces.flatMap(face => Array.from(face.querySelectorAll('img')).map(image => image.decode())));
  const [frontCanvas, backCanvas] = await Promise.all(faces.map(face => html2canvas(face, {
    scale: 4, useCORS: true, backgroundColor: null, logging: false,
    onclone: (_document, element) => { element.style.transform = 'none'; },
  })));
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [CARD_W, CARD_H], compress: true });
  doc.addImage(frontCanvas.toDataURL('image/png'), 'PNG', 0, 0, CARD_W, CARD_H);
  doc.addPage([CARD_W, CARD_H], 'landscape');
  doc.addImage(backCanvas.toDataURL('image/png'), 'PNG', 0, 0, CARD_W, CARD_H);
  doc.save(fileName);
}

/* ──────── Self-service view ──────── */

function SelfServiceView() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [position, setPosition] = useState('');
  const [department, setDepartment] = useState('');
  const [phone, setPhone] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [customization, setCustomization] = useState<CardCustomizationData>({ ...EMPTY_CUSTOMIZATION });

  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchOwn = async () => {
      if (!user) return;
      const { data: rec } = await supabase
        .from('employee_records')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (rec) {
        const { data: epd } = await supabase
          .from('employee_personal_data')
          .select('id, first_name, last_name, department, position, email')
          .eq('employee_record_id', rec.id)
          .eq('is_archived', false)
          .maybeSingle();
        if (epd) {
          setEmployee(epd);
          setDisplayName(`${epd.last_name.toUpperCase()} ${epd.first_name.toUpperCase()}`);
          setPosition(epd.position || '');
          setDepartment(epd.department || '');
        }
      }

      const { data: prof } = await supabase
        .from('profiles')
        .select('phone')
        .eq('user_id', user.id)
        .maybeSingle();
      if (prof?.phone) setPhone(prof.phone);

      setLoading(false);
    };
    fetchOwn();
  }, [user]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!employee) {
    return (
      <Card className="flex items-center justify-center h-[300px]">
        <div className="text-center text-muted-foreground">
          <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Datele tale de angajat nu au fost găsite.</p>
          <p className="text-xs mt-1">Contactează departamentul HR.</p>
        </div>
      </Card>
    );
  }

  const cardData: CardData = {
    displayName,
    position,
    department,
    phone,
    email: employee.email,
    profileUrl: `${window.location.origin}/profil/${employee.id}`,
    qrUrl: qrUrl.trim(),
    ...customization,
    lang: 'ro-en',
  };

  const handleDownload = async () => {
    setGenerating(true);
    try {
      await downloadPDF(frontRef, backRef, `carte-vizita-${employee.last_name}-${employee.first_name}.pdf`);
      toast({ title: 'PDF generat!', description: 'Cartea de vizită a fost descărcată.' });
    } catch {
      toast({ title: 'Eroare', description: 'Nu s-a putut genera PDF-ul.', variant: 'destructive' });
    }
    setGenerating(false);
  };

  const origName = `${employee.last_name.toUpperCase()} ${employee.first_name.toUpperCase()}`;

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <EditableFields
        displayName={displayName} setDisplayName={setDisplayName}
        position={position} setPosition={setPosition}
        department={department} setDepartment={setDepartment}
        phone={phone} setPhone={setPhone}
        originalName={origName}
        originalPosition={employee.position || ''}
        originalDepartment={employee.department || ''}
        originalQrUrl={INSTITUTE_CARD_URL}
        qrUrl={qrUrl} setQrUrl={setQrUrl}
        customization={customization} setCustomization={setCustomization}
      />
      <CardPreview data={cardData} frontRef={frontRef} backRef={backRef} />
      <Button onClick={handleDownload} disabled={generating} variant="hero" className="w-full">
        {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
        Descarcă PDF
      </Button>
    </div>
  );
}

/* ──────── Admin view ──────── */

function AdminView() {
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [generating, setGenerating] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [position, setPosition] = useState('');
  const [department, setDepartment] = useState('');
  const [phone, setPhone] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [customization, setCustomization] = useState<CardCustomizationData>({ ...EMPTY_CUSTOMIZATION });

  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase
        .from('employee_personal_data')
        .select('id, first_name, last_name, department, position, email')
        .eq('is_archived', false)
        .order('last_name');
      if (data) setEmployees(data);
    };
    fetchData();
  }, []);

  const selectEmployee = (emp: Employee) => {
    setSelectedEmployee(emp);
    setDisplayName(`${emp.last_name.toUpperCase()} ${emp.first_name.toUpperCase()}`);
    setPosition(emp.position || '');
    setDepartment(emp.department || '');
    setPhone('');
    setQrUrl('');
    setCustomization({ ...EMPTY_CUSTOMIZATION });
  };

  const departments = [...new Set(employees.map(e => e.department).filter(Boolean))] as string[];
  const filtered = employees.filter(e => {
    const matchSearch = `${e.last_name} ${e.first_name} ${e.email}`.toLowerCase().includes(search.toLowerCase());
    const matchDept = selectedDept === 'all' || e.department === selectedDept;
    return matchSearch && matchDept;
  });

  const cardData: CardData | null = selectedEmployee ? {
    displayName,
    position,
    department,
    phone,
    email: selectedEmployee.email,
    profileUrl: `${window.location.origin}/profil/${selectedEmployee.id}`,
    qrUrl: qrUrl.trim(),
    ...customization,
    lang: 'ro-en',
  } : null;

  const handleDownload = async () => {
    if (!selectedEmployee) return;
    setGenerating(true);
    try {
      await downloadPDF(frontRef, backRef, `carte-vizita-${selectedEmployee.last_name}-${selectedEmployee.first_name}.pdf`);
      toast({ title: 'PDF generat!', description: 'Cartea de vizită a fost descărcată.' });
    } catch {
      toast({ title: 'Eroare', description: 'Nu s-a putut genera PDF-ul.', variant: 'destructive' });
    }
    setGenerating(false);
  };

  return (
    <>
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Caută angajat..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={selectedDept} onValueChange={setSelectedDept}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Departament" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toate departamentele</SelectItem>
            {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Angajați ({filtered.length})</CardTitle></CardHeader>
          <CardContent className="max-h-[500px] overflow-y-auto space-y-1">
            {filtered.map(emp => (
              <Button
                variant="ghost"
                key={emp.id}
                onClick={() => selectEmployee(emp)}
                className={`h-auto flex-col items-start whitespace-normal w-full text-left px-3 py-2.5 rounded-md transition-colors ${
                  selectedEmployee?.id === emp.id
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'hover:bg-muted'
                }`}
              >
                <p className="font-medium text-sm">{emp.last_name} {emp.first_name}</p>
                <p className="text-xs text-muted-foreground break-words max-w-full">{emp.position} • {emp.department}</p>
              </Button>
            ))}
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-4">
          {selectedEmployee && cardData ? (
            <>
              <EditableFields
                displayName={displayName} setDisplayName={setDisplayName}
                position={position} setPosition={setPosition}
                department={department} setDepartment={setDepartment}
                phone={phone} setPhone={setPhone}
                originalName={`${selectedEmployee.last_name.toUpperCase()} ${selectedEmployee.first_name.toUpperCase()}`}
                originalPosition={selectedEmployee.position || ''}
                originalDepartment={selectedEmployee.department || ''}
                originalQrUrl={INSTITUTE_CARD_URL}
                qrUrl={qrUrl} setQrUrl={setQrUrl}
                customization={customization} setCustomization={setCustomization}
              />
              <CardPreview data={cardData} frontRef={frontRef} backRef={backRef} />
              <Button onClick={handleDownload} disabled={generating} className="w-full">
                {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                Descarcă PDF
              </Button>
            </>
          ) : (
            <Card className="flex items-center justify-center h-[300px]">
              <div className="text-center text-muted-foreground">
                <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Selectează un angajat din listă</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

/* ──────── Main page ──────── */

const BusinessCards = () => {
  const { canManageHR, isSuperAdmin, loading: roleLoading } = useUserRole();
  const isAdmin = canManageHR || isSuperAdmin;


  if (roleLoading) {
    return (
      <MainLayout title="Carte de Vizită">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Carte de Vizită">
      <div className="max-w-5xl mx-auto space-y-6">
        <PageHeader
          eyebrow="Identitate"
          title={isAdmin ? 'Generator Cărți de Vizită' : 'Cartea mea de vizită'}
          description="Minimalist · Față română / Verso engleză · 85 × 55 mm"
          icon={CreditCard}
        />
        {isAdmin ? (
          <Tabs defaultValue="own">
            <TabsList className="mb-4">
              <TabsTrigger value="own">Cartea mea de vizită</TabsTrigger>
              <TabsTrigger value="employees">Angajați</TabsTrigger>
            </TabsList>
            <TabsContent value="own"><SelfServiceView /></TabsContent>
            <TabsContent value="employees"><AdminView /></TabsContent>
          </Tabs>
        ) : <SelfServiceView />}
      </div>
    </MainLayout>
  );
};

export default BusinessCards;
