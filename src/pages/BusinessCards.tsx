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
import { QRCodeSVG } from 'qrcode.react';
import { CreditCard, Download, Search, Loader2 } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import { loadRobotoFonts, applyRobotoFont } from '@/utils/pdfFontLoader';

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  department: string | null;
  position: string | null;
  email: string;
}

const CARD_W = 85; // mm
const CARD_H = 55; // mm

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
  const frontQrRef = useRef<HTMLDivElement>(null);
  const backQrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('employee_personal_data')
        .select('id, first_name, last_name, department, position, email')
        .eq('is_archived', false)
        .order('last_name');
      if (data) setEmployees(data);
    };
    fetch();
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
    setGenerating(true);
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [CARD_W, CARD_H] });
      await loadPdfFonts(doc);

      // === FRONT SIDE ===
      // White background
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, CARD_W, CARD_H, 'F');

      // Top accent line
      doc.setDrawColor(0, 51, 102);
      doc.setLineWidth(0.8);
      doc.line(5, 14, CARD_W - 5, 14);

      // Logo + Institute name (small)
      doc.setFont('Roboto-Bold', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(0, 51, 102);
      doc.text('Institutul de Chimie Macromoleculară "Petru Poni" Iași', 5, 11);

      // Employee name
      const fullName = `${emp.last_name} ${emp.first_name}`.toUpperCase();
      doc.setFont('Roboto-Bold', 'normal');
      doc.setFontSize(12);
      doc.setTextColor(0, 51, 102);
      doc.text(fullName, 5, 22);

      // Position & Department
      doc.setFont('Roboto-Regular', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(80, 80, 80);
      if (emp.position) doc.text(emp.position, 5, 27);
      if (emp.department) doc.text(emp.department, 5, 31);

      // Contact info
      doc.setFontSize(6.5);
      doc.setTextColor(60, 60, 60);
      let yContact = 38;
      if (phone) { doc.text(`Tel: ${phone}`, 5, yContact); yContact += 3.5; }
      doc.text(emp.email, 5, yContact);

      // QR for icmpp.ro on front (small, bottom-right)
      const frontQrCanvas = frontQrRef.current?.querySelector('canvas');
      if (frontQrCanvas) {
        const qrImg = frontQrCanvas.toDataURL('image/png');
        doc.addImage(qrImg, 'PNG', CARD_W - 20, CARD_H - 20, 15, 15);
        doc.setFontSize(4.5);
        doc.setTextColor(100, 100, 100);
        doc.text('icmpp.ro', CARD_W - 12.5, CARD_H - 4, { align: 'center' });
      }

      // === BACK SIDE ===
      doc.addPage([CARD_W, CARD_H], 'landscape');

      // Dark blue background
      doc.setFillColor(0, 51, 102);
      doc.rect(0, 0, CARD_W, CARD_H, 'F');

      // QR for profile (centered, larger)
      const backQrCanvas = backQrRef.current?.querySelector('canvas');
      if (backQrCanvas) {
        // White background circle/rect for QR
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(CARD_W / 2 - 13, 6, 26, 26, 2, 2, 'F');
        const qrImg = backQrCanvas.toDataURL('image/png');
        doc.addImage(qrImg, 'PNG', CARD_W / 2 - 11, 8, 22, 22);
      }

      // "Profil profesional" label
      doc.setFont('Roboto-Bold', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text('Profil profesional', CARD_W / 2, 37, { align: 'center' });

      // Separator line
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.3);
      doc.line(CARD_W / 2 - 15, 40, CARD_W / 2 + 15, 40);

      // Employee name
      doc.setFont('Roboto-Bold', 'normal');
      doc.setFontSize(7);
      doc.text(fullName, CARD_W / 2, 45, { align: 'center' });

      // Scan instruction
      doc.setFont('Roboto-Regular', 'normal');
      doc.setFontSize(5);
      doc.setTextColor(180, 200, 220);
      doc.text('Scanează pentru contact și profil', CARD_W / 2, 49, { align: 'center' });

      doc.save(`carte-vizita-${emp.last_name}-${emp.first_name}.pdf`);
      toast({ title: 'PDF generat!', description: 'Cartea de vizită a fost descărcată.' });
    } catch (err) {
      toast({ title: 'Eroare', description: 'Nu s-a putut genera PDF-ul.', variant: 'destructive' });
    }
    setGenerating(false);
  };

  return (
    <MainLayout>
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
                    <div className="border rounded-xl overflow-hidden shadow-lg" style={{ aspectRatio: `${CARD_W}/${CARD_H}` }}>
                      <div className="bg-white p-4 h-full flex flex-col justify-between relative">
                        {/* Header */}
                        <div>
                          <p className="text-[10px] text-[#003366] font-bold">
                            Institutul de Chimie Macromoleculară "Petru Poni" Iași
                          </p>
                          <div className="h-[2px] bg-[#003366] mt-1.5 mb-3" />
                          <h2 className="text-lg font-bold text-[#003366] tracking-wide">
                            {selectedEmployee.last_name.toUpperCase()} {selectedEmployee.first_name.toUpperCase()}
                          </h2>
                          {selectedEmployee.position && (
                            <p className="text-xs text-gray-500 italic">{selectedEmployee.position}</p>
                          )}
                          {selectedEmployee.department && (
                            <p className="text-xs text-gray-500">{selectedEmployee.department}</p>
                          )}
                        </div>
                        {/* Contact + QR */}
                        <div className="flex justify-between items-end">
                          <div className="space-y-0.5">
                            {phone && <p className="text-[10px] text-gray-600">Tel: {phone}</p>}
                            <p className="text-[10px] text-gray-600">{selectedEmployee.email}</p>
                          </div>
                          <div className="text-center">
                            <div ref={frontQrRef}>
                              <QRCodeSVG value="https://www.icmpp.ro" size={48} level="M" renderAs="canvas" />
                            </div>
                            <p className="text-[7px] text-gray-400 mt-0.5">icmpp.ro</p>
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
                    <div className="border rounded-xl overflow-hidden shadow-lg" style={{ aspectRatio: `${CARD_W}/${CARD_H}` }}>
                      <div className="bg-[#003366] p-4 h-full flex flex-col items-center justify-center text-white relative">
                        <div className="bg-white rounded-lg p-2" ref={backQrRef}>
                          <QRCodeSVG value={profileUrl(selectedEmployee.id)} size={80} level="M" renderAs="canvas" />
                        </div>
                        <p className="font-bold text-sm mt-3">Profil profesional</p>
                        <div className="w-12 h-[1px] bg-white/40 my-1.5" />
                        <p className="font-bold text-xs tracking-wider">
                          {selectedEmployee.last_name.toUpperCase()} {selectedEmployee.first_name.toUpperCase()}
                        </p>
                        <p className="text-[9px] text-blue-200/70 mt-1">Scanează pentru contact și profil</p>
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

        {/* Hidden QR canvases for PDF generation */}
        <div className="hidden">
          <div id="front-qr-hidden">
            <QRCodeSVG value="https://www.icmpp.ro" size={200} level="M" renderAs="canvas" />
          </div>
          {selectedEmployee && (
            <div id="back-qr-hidden">
              <QRCodeSVG value={profileUrl(selectedEmployee.id)} size={200} level="M" renderAs="canvas" />
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default BusinessCards;
