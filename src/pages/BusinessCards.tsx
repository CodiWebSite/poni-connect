import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Navigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { CreditCard, Download, Search, Loader2, Pencil } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  CARD_W, CARD_H, VARIANTS,
  getFrontComponent, getBackComponent, getBackgroundColors,
  type CardData, type CardLang,
} from '@/components/business-cards/CardVariants';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  department: string | null;
  position: string | null;
  email: string;
}

/* ──────── Card Preview with variant selector ──────── */

function CardPreview({
  data,
  variant,
  onVariantChange,
  lang,
  onLangChange,
  frontRef,
  backRef,
}: {
  data: CardData;
  variant: string;
  onVariantChange: (v: string) => void;
  lang: CardLang;
  onLangChange: (v: CardLang) => void;
  frontRef: React.RefObject<HTMLDivElement>;
  backRef: React.RefObject<HTMLDivElement>;
}) {
  const FrontComp = getFrontComponent(variant as any);
  const BackComp = getBackComponent(variant as any);
  const bg = getBackgroundColors(variant as any);

  return (
    <>
      {/* Language picker */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Limba / Language</CardTitle>
          <CardDescription>Alege limba pentru cartea de vizită</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup value={lang} onValueChange={v => onLangChange(v as CardLang)} className="flex gap-4">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="ro" id="lang-ro" />
              <Label htmlFor="lang-ro" className="text-sm font-medium cursor-pointer">🇷🇴 Română</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="en" id="lang-en" />
              <Label htmlFor="lang-en" className="text-sm font-medium cursor-pointer">🇬🇧 English</Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Variant picker */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Stil carte de vizită</CardTitle>
          <CardDescription>Alege varianta care ți se potrivește</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {VARIANTS.map(v => (
              <button
                key={v.id}
                onClick={() => onVariantChange(v.id)}
                className={`rounded-lg border-2 p-3 text-left transition-all ${
                  variant === v.id
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-primary/40'
                }`}
              >
                <p className="font-semibold text-sm">{v.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{v.description}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Front */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Preview — Față</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            ref={frontRef}
            className="border rounded-xl overflow-hidden shadow-lg"
            style={{ aspectRatio: `${CARD_W}/${CARD_H}`, background: bg.front }}
          >
            <FrontComp data={data} />
          </div>
        </CardContent>
      </Card>

      {/* Back */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Preview — Verso</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            ref={backRef}
            className="border rounded-xl overflow-hidden shadow-lg"
            style={{ aspectRatio: `${CARD_W}/${CARD_H}`, background: bg.back }}
          >
            <BackComp data={data} />
          </div>
        </CardContent>
      </Card>
    </>
  );
}

/* ──────── Editable fields panel ──────── */

function EditableFields({
  displayName, setDisplayName,
  position, setPosition,
  department, setDepartment,
  phone, setPhone,
  originalName, originalPosition, originalDepartment,
}: {
  displayName: string; setDisplayName: (v: string) => void;
  position: string; setPosition: (v: string) => void;
  department: string; setDepartment: (v: string) => void;
  phone: string; setPhone: (v: string) => void;
  originalName: string; originalPosition: string; originalDepartment: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Pencil className="w-4 h-4" />
          Personalizare text
        </CardTitle>
        <CardDescription>Modifică textul afișat pe cartea de vizită</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="card-name" className="text-xs">Nume afișat</Label>
          <Input id="card-name" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder={originalName} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="card-position" className="text-xs">Funcție</Label>
            <Input id="card-position" value={position} onChange={e => setPosition(e.target.value)} placeholder={originalPosition || 'Funcție'} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="card-dept" className="text-xs">Departament</Label>
            <Input id="card-dept" value={department} onChange={e => setDepartment(e.target.value)} placeholder={originalDepartment || 'Departament'} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="card-phone" className="text-xs">Telefon (opțional)</Label>
          <Input id="card-phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+40 xxx xxx xxx" />
        </div>
      </CardContent>
    </Card>
  );
}

/* ──────── Download helper ──────── */

async function downloadPDF(
  frontRef: React.RefObject<HTMLDivElement>,
  backRef: React.RefObject<HTMLDivElement>,
  variant: string,
  fileName: string,
) {
  if (!frontRef.current || !backRef.current) throw new Error('Refs missing');
  const bg = getBackgroundColors(variant as any);
  const scale = 4;
  const [frontCanvas, backCanvas] = await Promise.all([
    html2canvas(frontRef.current, { scale, useCORS: true, backgroundColor: bg.front, logging: false }),
    html2canvas(backRef.current, { scale, useCORS: true, backgroundColor: bg.back, logging: false }),
  ]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [CARD_W, CARD_H] });
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
  const [variant, setVariant] = useState('classic');
  const [lang, setLang] = useState<CardLang>('ro');

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
    lang,
  };

  const handleDownload = async () => {
    setGenerating(true);
    try {
      await downloadPDF(frontRef, backRef, variant, `carte-vizita-${employee.last_name}-${employee.first_name}.pdf`);
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
      />
      <CardPreview data={cardData} variant={variant} onVariantChange={setVariant} lang={lang} onLangChange={setLang} frontRef={frontRef} backRef={backRef} />
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
  const [variant, setVariant] = useState('classic');
  const [lang, setLang] = useState<CardLang>('ro');

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
    lang,
  } : null;

  const handleDownload = async () => {
    if (!selectedEmployee) return;
    setGenerating(true);
    try {
      await downloadPDF(frontRef, backRef, variant, `carte-vizita-${selectedEmployee.last_name}-${selectedEmployee.first_name}.pdf`);
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

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Angajați ({filtered.length})</CardTitle></CardHeader>
          <CardContent className="max-h-[500px] overflow-y-auto space-y-1">
            {filtered.map(emp => (
              <button
                key={emp.id}
                onClick={() => selectEmployee(emp)}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                  selectedEmployee?.id === emp.id
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'hover:bg-muted'
                }`}
              >
                <p className="font-medium text-sm">{emp.last_name} {emp.first_name}</p>
                <p className="text-xs text-muted-foreground">{emp.position} • {emp.department}</p>
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
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
              />
              <CardPreview data={cardData} variant={variant} onVariantChange={setVariant} lang={lang} onLangChange={setLang} frontRef={frontRef} backRef={backRef} />
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
  const { user } = useAuth();
  const { canManageHR, isSuperAdmin, loading: roleLoading } = useUserRole();
  const isAdmin = canManageHR || isSuperAdmin;

  // Business cards are disabled for all employees
  if (!roleLoading) {
    return <Navigate to="/" replace />;
  }

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
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-primary" />
            {isAdmin ? 'Generator Cărți de Vizită' : 'Cartea mea de vizită'}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isAdmin
              ? 'Selectează un angajat pentru a genera cartea de vizită cu QR personalizat.'
              : 'Previzualizează și descarcă cartea ta de vizită profesională.'}
          </p>
        </div>
        {isAdmin ? <AdminView /> : <SelfServiceView />}
      </div>
    </MainLayout>
  );
};

export default BusinessCards;
