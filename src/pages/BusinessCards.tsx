import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { QRCodeCanvas } from 'qrcode.react';
import { CreditCard, Download, Search, Loader2 } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  department: string | null;
  position: string | null;
  email: string;
}

const CARD_W = 85;
const CARD_H = 55;

const BusinessCards = () => {
  const { user } = useAuth();
  const { canManageHR, loading: roleLoading } = useUserRole();
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [phone, setPhone] = useState('');
  const [generating, setGenerating] = useState(false);
  const frontCardRef = useRef<HTMLDivElement>(null);
  const backCardRef = useRef<HTMLDivElement>(null);

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

  if (!roleLoading && !canManageHR) return <Navigate to="/" replace />;

  const departments = [...new Set(employees.map(e => e.department).filter(Boolean))] as string[];
  const filtered = employees.filter(e => {
    const matchSearch = `${e.last_name} ${e.first_name} ${e.email}`.toLowerCase().includes(search.toLowerCase());
    const matchDept = selectedDept === 'all' || e.department === selectedDept;
    return matchSearch && matchDept;
  });

  const profileUrl = (epdId: string) => {
    const base = window.location.origin;
    return `${base}/profil/${epdId}`;
  };

  const generatePDF = async (emp: Employee) => {
    if (!frontCardRef.current || !backCardRef.current) return;
    setGenerating(true);
    try {
      const scale = 4;

      const frontCanvas = await html2canvas(frontCardRef.current, {
        scale,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const backCanvas = await html2canvas(backCardRef.current, {
        scale,
        useCORS: true,
        backgroundColor: '#2B4C7E',
        logging: false,
      });

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [CARD_W, CARD_H] });

      // Front side
      const frontImg = frontCanvas.toDataURL('image/png');
      doc.addImage(frontImg, 'PNG', 0, 0, CARD_W, CARD_H);

      // Back side
      doc.addPage([CARD_W, CARD_H], 'landscape');
      const backImg = backCanvas.toDataURL('image/png');
      doc.addImage(backImg, 'PNG', 0, 0, CARD_W, CARD_H);

      doc.save(`carte-vizita-${emp.last_name}-${emp.first_name}.pdf`);
      toast({ title: 'PDF generat!', description: 'Cartea de vizită a fost descărcată.' });
    } catch (err) {
      console.error('PDF generation error:', err);
      toast({ title: 'Eroare', description: 'Nu s-a putut genera PDF-ul.', variant: 'destructive' });
    }
    setGenerating(false);
  };

  return (
    <MainLayout title="Cărți de Vizită">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-primary" />
            Generator Cărți de Vizită
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Selectează un angajat pentru a genera cartea de vizită cu QR personalizat.
          </p>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Caută angajat..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={selectedDept} onValueChange={setSelectedDept}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Departament" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toate departamentele</SelectItem>
              {departments.map(d => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Employee List */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Angajați ({filtered.length})</CardTitle>
            </CardHeader>
            <CardContent className="max-h-[500px] overflow-y-auto space-y-1">
              {filtered.map(emp => (
                <button
                  key={emp.id}
                  onClick={() => { setSelectedEmployee(emp); setPhone(''); }}
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

          {/* Preview */}
          <div className="space-y-4">
            {selectedEmployee ? (
              <>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Preview — Față</CardTitle>
                    <CardDescription>Partea frontală a cărții de vizită</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div
                      ref={frontCardRef}
                      className="border rounded-xl overflow-hidden shadow-lg"
                      style={{ aspectRatio: `${CARD_W}/${CARD_H}`, background: '#ffffff' }}
                    >
                      <div style={{ padding: '16px 20px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontFamily: 'Arial, Helvetica, sans-serif' }}>
                        {/* Header: logo + institute name */}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                            <img src="/logo-icmpp.png" alt="ICMPP" style={{ height: '40px', width: 'auto' }} crossOrigin="anonymous" />
                            <div>
                              <p style={{ fontSize: '11px', color: '#2B4C7E', fontWeight: 'bold', lineHeight: '1.3', margin: 0 }}>Institutul de Chimie</p>
                              <p style={{ fontSize: '11px', color: '#2B4C7E', fontWeight: 'bold', lineHeight: '1.3', margin: 0 }}>Macromoleculară "Petru Poni" Iași</p>
                            </div>
                          </div>

                          {/* Blue separator */}
                          <div style={{ height: '2px', background: '#2B4C7E', marginBottom: '2px' }} />
                          <div style={{ height: '1px', background: 'rgba(43,76,126,0.2)', marginBottom: '12px' }} />

                          {/* Name centered */}
                          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#2B4C7E', textAlign: 'center', letterSpacing: '0.5px', margin: '0 0 4px 0' }}>
                            {selectedEmployee.last_name.toUpperCase()} {selectedEmployee.first_name.toUpperCase()}
                          </h2>

                          {/* Position - italic, olive */}
                          {selectedEmployee.position && (
                            <p style={{ fontSize: '11px', color: '#787850', fontStyle: 'italic', textAlign: 'center', margin: '0 0 2px 0' }}>
                              {selectedEmployee.position}
                            </p>
                          )}

                          {/* Department */}
                          {selectedEmployee.department && (
                            <p style={{ fontSize: '10px', color: '#505050', textAlign: 'center', margin: 0 }}>
                              {selectedEmployee.department}
                            </p>
                          )}
                        </div>

                        {/* Bottom: contact left, QR right */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                          <div>
                            {phone && (
                              <p style={{ fontSize: '10px', color: '#282828', margin: '0 0 2px 0' }}>Tel: {phone}</p>
                            )}
                            <p style={{ fontSize: '10px', color: '#282828', margin: 0 }}>{selectedEmployee.email}</p>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <QRCodeCanvas value="https://www.icmpp.ro" size={52} level="M" />
                            <p style={{ fontSize: '7px', color: '#787878', marginTop: '2px' }}>icmpp.ro</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Preview — Verso</CardTitle>
                    <CardDescription>QR către profilul profesional</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div
                      ref={backCardRef}
                      className="border rounded-xl overflow-hidden shadow-lg"
                      style={{ aspectRatio: `${CARD_W}/${CARD_H}`, background: '#2B4C7E' }}
                    >
                      <div style={{ padding: '12px 16px', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial, Helvetica, sans-serif' }}>
                        {/* QR code - white on blue */}
                        <div style={{ marginTop: '-4px' }}>
                          <QRCodeCanvas
                            value={profileUrl(selectedEmployee.id)}
                            size={90}
                            level="M"
                            bgColor="transparent"
                            fgColor="#ffffff"
                          />
                        </div>

                        {/* Profil profesional */}
                        <p style={{ fontWeight: 'bold', fontSize: '13px', color: '#ffffff', marginTop: '8px', marginBottom: '6px' }}>
                          Profil profesional
                        </p>

                        {/* White separator */}
                        <div style={{ width: '70%', height: '1px', background: 'rgba(255,255,255,0.5)', marginBottom: '8px' }} />

                        {/* Name */}
                        <p style={{ fontWeight: 'bold', fontSize: '12px', color: '#ffffff', letterSpacing: '1px', margin: '0 0 4px 0' }}>
                          {selectedEmployee.last_name.toUpperCase()} {selectedEmployee.first_name.toUpperCase()}
                        </p>

                        {/* Scan instruction */}
                        <p style={{ fontSize: '8px', color: 'rgba(180,200,230,0.8)', margin: 0 }}>
                          Scanează pentru contact și profil
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Phone input + Download */}
                <div className="flex gap-3">
                  <Input
                    placeholder="Telefon (opțional)"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={() => generatePDF(selectedEmployee)} disabled={generating}>
                    {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                    Descarcă PDF
                  </Button>
                </div>
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
      </div>
    </MainLayout>
  );
};

export default BusinessCards;
