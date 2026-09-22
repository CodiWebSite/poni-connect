import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { FileDown, CalendarRange, Users, ClipboardList, ShoppingCart, ShieldAlert, Headset, Lightbulb, CalendarClock, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import { loadRobotoFonts, applyRobotoFont } from '@/utils/pdfFontLoader';

interface Section {
  key: string;
  label: string;
  icon: React.ElementType;
  rows: { label: string; value: string | number }[];
}

const QUARTERS = [
  { value: '1', label: 'Trimestrul I (ian – mar)' },
  { value: '2', label: 'Trimestrul II (apr – iun)' },
  { value: '3', label: 'Trimestrul III (iul – sep)' },
  { value: '4', label: 'Trimestrul IV (oct – dec)' },
];

const quarterRange = (year: number, quarter: number) => {
  const startMonth = (quarter - 1) * 3;
  const from = new Date(year, startMonth, 1);
  const to = new Date(year, startMonth + 3, 1);
  return { from, to };
};

const count = (rows: { status?: string | null }[] | null | undefined, status: string) =>
  (rows || []).filter((r) => (r.status || '') === status).length;

const countPrefix = (rows: { status?: string | null }[] | null | undefined, prefix: string) =>
  (rows || []).filter((r) => (r.status || '').startsWith(prefix)).length;

const QuarterlyReport = () => {
  const { isInstituteLeadership, canManageHR, loading: roleLoading } = useUserRole();
  const allowed = isInstituteLeadership || canManageHR;

  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [quarter, setQuarter] = useState(String(Math.floor(now.getMonth() / 3) + 1));
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [sections, setSections] = useState<Section[]>([]);
  const [headline, setHeadline] = useState<{ label: string; value: string | number }[]>([]);

  const { from, to } = useMemo(() => quarterRange(Number(year), Number(quarter)), [year, quarter]);

  const load = useCallback(async () => {
    setLoading(true);
    const fromIso = from.toISOString();
    const toIso = to.toISOString();
    const fromDate = from.toISOString().slice(0, 10);
    const toDate = to.toISOString().slice(0, 10);

    const [leave, hr, proc, incidents, tickets, suggestions, meetings, employees, bookings] = await Promise.all([
      supabase.from('leave_requests').select('status, working_days, start_date').gte('start_date', fromDate).lt('start_date', toDate),
      supabase.from('hr_requests').select('status, request_type, created_at').gte('created_at', fromIso).lt('created_at', toIso),
      supabase.from('procurement_requests').select('status, estimated_value, created_at').gte('created_at', fromIso).lt('created_at', toIso),
      supabase.from('security_incidents').select('status, severity, created_at').gte('created_at', fromIso).lt('created_at', toIso),
      supabase.from('helpdesk_tickets').select('status, created_at').gte('created_at', fromIso).lt('created_at', toIso),
      supabase.from('suggestions').select('status, created_at').gte('created_at', fromIso).lt('created_at', toIso),
      supabase.from('meetings').select('status, start_at').gte('start_at', fromIso).lt('start_at', toIso),
      supabase.from('employee_personal_data').select('id, is_archived, employment_date'),
      supabase.from('room_bookings').select('id, status, start_time').gte('start_time', fromIso).lt('start_time', toIso),
    ]);

    const leaveRows = leave.data || [];
    const approvedLeave = leaveRows.filter((r) => (r.status || '') === 'approved');
    const leaveDays = approvedLeave.reduce((s, r) => s + (r.working_days || 0), 0);
    const activeEmployees = (employees.data || []).filter((e) => !e.is_archived).length;
    const newHires = (employees.data || []).filter(
      (e) => e.employment_date && e.employment_date >= fromDate && e.employment_date < toDate,
    ).length;
    const procValue = (proc.data || []).reduce((s, r) => s + (Number(r.estimated_value) || 0), 0);

    setHeadline([
      { label: 'Angajați activi', value: activeEmployees },
      { label: 'Cereri de concediu', value: leaveRows.length },
      { label: 'Zile de concediu aprobate', value: leaveDays },
      { label: 'Angajări noi', value: newHires },
    ]);

    setSections([
      {
        key: 'leave',
        label: 'Concedii',
        icon: CalendarRange,
        rows: [
          { label: 'Total cereri', value: leaveRows.length },
          { label: 'Aprobate', value: approvedLeave.length },
          { label: 'Respinse', value: count(leaveRows, 'rejected') },
          { label: 'În așteptare', value: countPrefix(leaveRows, 'pending') },
          { label: 'Zile lucrătoare aprobate', value: leaveDays },
        ],
      },
      {
        key: 'hr',
        label: 'Activitate resurse umane',
        icon: ClipboardList,
        rows: [
          { label: 'Solicitări HR', value: (hr.data || []).length },
          { label: 'Aprobate', value: count(hr.data, 'approved') + count(hr.data, 'completed') },
          { label: 'Respinse', value: count(hr.data, 'rejected') },
          { label: 'În așteptare', value: countPrefix(hr.data, 'pending') + count(hr.data, 'in_progress') },
          { label: 'Angajări noi în trimestru', value: newHires },
        ],
      },
      {
        key: 'proc',
        label: 'Achiziții',
        icon: ShoppingCart,
        rows: [
          { label: 'Referate de necesitate', value: (proc.data || []).length },
          { label: 'Aprobate', value: count(proc.data, 'approved') + count(proc.data, 'completed') },
          { label: 'Respinse', value: count(proc.data, 'rejected') },
          { label: 'Valoare estimată totală', value: `${procValue.toLocaleString('ro-RO')} lei` },
        ],
      },
      {
        key: 'sec',
        label: 'Incidente și securitate',
        icon: ShieldAlert,
        rows: [
          { label: 'Incidente raportate', value: (incidents.data || []).length },
          { label: 'Rezolvate', value: count(incidents.data, 'resolved') },
          { label: 'Deschise', value: (incidents.data || []).length - count(incidents.data, 'resolved') },
          { label: 'Severitate ridicată', value: (incidents.data || []).filter((i) => i.severity === 'high' || i.severity === 'critical').length },
        ],
      },
      {
        key: 'helpdesk',
        label: 'HelpDesk IT',
        icon: Headset,
        rows: [
          { label: 'Tichete deschise în trimestru', value: (tickets.data || []).length },
          { label: 'Rezolvate', value: count(tickets.data, 'resolved') },
          { label: 'În lucru', value: (tickets.data || []).length - count(tickets.data, 'resolved') },
        ],
      },
      {
        key: 'meetings',
        label: 'Ședințe și săli',
        icon: CalendarClock,
        rows: [
          { label: 'Ședințe programate', value: (meetings.data || []).length },
          { label: 'Rezervări de săli', value: (bookings.data || []).length },
        ],
      },
      {
        key: 'suggestions',
        label: 'Sugestii de la colegi',
        icon: Lightbulb,
        rows: [
          { label: 'Sugestii primite', value: (suggestions.data || []).length },
          { label: 'Implementate', value: count(suggestions.data, 'implemented') },
          { label: 'În analiză', value: count(suggestions.data, 'under_review') + count(suggestions.data, 'new') },
        ],
      },
    ]);
    setLoading(false);
  }, [from, to]);

  useEffect(() => {
    if (allowed) load();
  }, [allowed, load]);

  const exportPdf = async () => {
    setExporting(true);
    try {
      await loadRobotoFonts();
      const doc = new jsPDF();
      applyRobotoFont(doc);

      const quarterLabel = QUARTERS.find((q) => q.value === quarter)?.label || '';
      let y = 20;

      doc.setFont('Roboto', 'bold');
      doc.setFontSize(16);
      doc.text('Raport trimestrial de activitate', 14, y);
      y += 8;
      doc.setFont('Roboto', 'normal');
      doc.setFontSize(11);
      doc.text(`Institutul de Chimie Macromoleculară „Petru Poni” — ${quarterLabel} ${year}`, 14, y);
      y += 6;
      doc.setFontSize(9);
      doc.text(`Generat: ${new Date().toLocaleString('ro-RO')}`, 14, y);
      y += 10;

      doc.setFont('Roboto', 'bold');
      doc.setFontSize(12);
      doc.text('Sinteză', 14, y);
      y += 7;
      doc.setFont('Roboto', 'normal');
      doc.setFontSize(10);
      headline.forEach((h) => {
        doc.text(`${h.label}: ${h.value}`, 18, y);
        y += 6;
      });
      y += 4;

      sections.forEach((section) => {
        if (y > 260) {
          doc.addPage();
          applyRobotoFont(doc);
          y = 20;
        }
        doc.setFont('Roboto', 'bold');
        doc.setFontSize(12);
        doc.text(section.label, 14, y);
        y += 7;
        doc.setFont('Roboto', 'normal');
        doc.setFontSize(10);
        section.rows.forEach((row) => {
          if (y > 275) {
            doc.addPage();
            applyRobotoFont(doc);
            y = 20;
          }
          doc.text(`${row.label}: ${row.value}`, 18, y);
          y += 6;
        });
        y += 4;
      });

      doc.save(`Raport_trimestrial_T${quarter}_${year}.pdf`);
      toast.success('Raportul a fost descărcat.');
    } catch {
      toast.error('Raportul nu a putut fi generat.');
    } finally {
      setExporting(false);
    }
  };

  if (roleLoading) return null;
  if (!allowed) return <Navigate to="/" replace />;

  return (
    <MainLayout title="Raport trimestrial">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarRange className="h-5 w-5 text-primary" />
              Raport trimestrial de activitate
            </CardTitle>
            <CardDescription>
              Sinteza activității institutului pe trimestru: concedii, resurse umane, achiziții, incidente, HelpDesk și ședințe.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Trimestru</p>
              <Select value={quarter} onValueChange={setQuarter}>
                <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {QUARTERS.map((q) => <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">An</p>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 6 }, (_, i) => now.getFullYear() - i).map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={exportPdf} disabled={loading || exporting} className="gap-2">
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              Descarcă PDF
            </Button>
          </CardContent>
        </Card>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {headline.map((h) => (
                <Card key={h.label}>
                  <CardContent className="pt-6">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{h.label}</p>
                    <p className="mt-1 text-3xl font-semibold text-foreground">{h.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <Card key={section.key}>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Icon className="h-4 w-4 text-primary" />
                        {section.label}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {section.rows.map((row) => (
                        <div key={row.label} className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-muted-foreground">{row.label}</span>
                          <Badge variant="secondary" className="font-medium">{row.value}</Badge>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              Datele sunt calculate în timp real din platformă pentru perioada selectată.
            </p>
          </>
        )}
      </div>
    </MainLayout>
  );
};

export default QuarterlyReport;
