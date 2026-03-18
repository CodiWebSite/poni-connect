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
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
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
      await loadRobotoFonts();
      applyRobotoFont(doc);

      // Load logo image
      const logoImg = await new Promise<string>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          canvas.getContext('2d')!.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve('');
        img.src = '/logo-icmpp.png';
      });

      const fullName = `${emp.last_name} ${emp.first_name}`.toUpperCase();

      // === FRONT SIDE ===
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, CARD_W, CARD_H, 'F');

      // Logo top-left
      if (logoImg) {
        doc.addImage(logoImg, 'PNG', 5, 3, 10, 10);
      }

      // Institute name next to logo
      doc.setFont('Roboto-Bold', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(43, 76, 126); // #2B4C7E
      doc.text('Institutul de Chimie', 17, 7);
      doc.text('Macromoleculară "Petru Poni" Iași', 17, 11);

      // Blue separator line
      doc.setDrawColor(43, 76, 126);
      doc.setLineWidth(0.6);
      doc.line(5, 15, CARD_W - 5, 15);

      // Thin gray line below
      doc.setDrawColor(200, 210, 220);
      doc.setLineWidth(0.2);
      doc.line(5, 15.8, CARD_W - 5, 15.8);

      // Employee name — large, bold, blue
      doc.setFont('Roboto-Bold', 'normal');
      doc.setFontSize(13);
      doc.setTextColor(43, 76, 126);
      doc.text(fullName, 10, 24);

      // Position — italic style (regular, smaller, olive/muted)
      doc.setFont('Roboto-Regular', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 80); // olive-ish
      if (emp.position) doc.text(emp.position, 10, 29);

      // Department — regular gray
      doc.setFontSize(7.5);
      doc.setTextColor(80, 80, 80);
      if (emp.department) doc.text(emp.department, 10, 33);

      // Contact info — bottom-left
      doc.setFont('Roboto-Regular', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(40, 40, 40);
      let yContact = 42;
      if (phone) {
        doc.text(`Tel: ${phone}`, 5, yContact);
        yContact += 3.5;
      }
      doc.text(emp.email, 5, yContact);

      // QR for icmpp.ro — bottom-right
      const frontQrCanvas = frontQrRef.current?.querySelector('canvas');
      if (frontQrCanvas) {
        const qrImg = frontQrCanvas.toDataURL('image/png');
        doc.addImage(qrImg, 'PNG', CARD_W - 22, CARD_H - 22, 17, 17);
        doc.setFontSize(5);
        doc.setTextColor(120, 120, 120);
        doc.text('icmpp.ro', CARD_W - 13.5, CARD_H - 4, { align: 'center' });
      }

      // === BACK SIDE ===
      doc.addPage([CARD_W, CARD_H], 'landscape');

      // Dark blue background — #2B4C7E
      doc.setFillColor(43, 76, 126);
      doc.rect(0, 0, CARD_W, CARD_H, 'F');

      // Large white QR centered
      const backQrCanvas = backQrRef.current?.querySelector('canvas');
      const qrSize = 24;
      const qrX = CARD_W / 2 - qrSize / 2;
      if (backQrCanvas) {
        const qrImg = backQrCanvas.toDataURL('image/png');
        doc.addImage(qrImg, 'PNG', qrX, 5, qrSize, qrSize);
      }

      // "Profil profesional" — bold white
      doc.setFont('Roboto-Bold', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text('Profil profesional', CARD_W / 2, 35, { align: 'center' });

      // White separator line — wide
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.4);
      doc.line(10, 38, CARD_W - 10, 38);

      // Employee name — bold white
      doc.setFont('Roboto-Bold', 'normal');
      doc.setFontSize(9);
      doc.text(fullName, CARD_W / 2, 44, { align: 'center' });

      // Scan instruction — lighter
      doc.setFont('Roboto-Regular', 'normal');
      doc.setFontSize(5.5);
      doc.setTextColor(180, 200, 230);
      doc.text('Scanează pentru contact și profil', CARD_W / 2, 48.5, { align: 'center' });

      doc.save(`carte-vizita-${emp.last_name}-${emp.first_name}.pdf`);
      toast({ title: 'PDF generat!', description: 'Cartea de vizită a fost descărcată.' });
    } catch (err) {
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
                              <QRCodeCanvas value="https://www.icmpp.ro" size={48} level="M" />
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
                          <QRCodeCanvas value={profileUrl(selectedEmployee.id)} size={80} level="M" />
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
            <QRCodeCanvas value="https://www.icmpp.ro" size={200} level="M" />
          </div>
          {selectedEmployee && (
            <div id="back-qr-hidden">
              <QRCodeCanvas value={profileUrl(selectedEmployee.id)} size={200} level="M" />
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default BusinessCards;
