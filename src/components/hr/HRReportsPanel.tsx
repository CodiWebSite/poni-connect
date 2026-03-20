import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Download, Users, Clock, TrendingDown, Building2, FileSpreadsheet, FileText } from 'lucide-react';
import { format, differenceInYears, parseISO } from 'date-fns';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

interface Employee {
  id: string;
  full_name: string;
  department: string | null;
  position: string | null;
  grade: string | null;
  employment_date: string;
  contract_type: string | null;
  total_leave_days: number;
  used_leave_days: number;
  hasAccount: boolean;
  is_archived?: boolean;
  archived_at?: string;
}

interface HRReportsPanelProps {
  employees: Employee[];
  archivedEmployees: Employee[];
}

const CHART_COLORS = [
  'hsl(215, 70%, 55%)', 'hsl(150, 60%, 45%)', 'hsl(35, 85%, 55%)',
  'hsl(340, 65%, 55%)', 'hsl(270, 55%, 55%)', 'hsl(185, 60%, 45%)',
  'hsl(15, 75%, 55%)', 'hsl(100, 50%, 45%)', 'hsl(50, 80%, 50%)',
  'hsl(310, 55%, 50%)', 'hsl(200, 60%, 50%)', 'hsl(0, 65%, 55%)',
];

const HRReportsPanel = ({ employees, archivedEmployees }: HRReportsPanelProps) => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const currentYear = parseInt(selectedYear);

  // Department distribution
  const departmentData = useMemo(() => {
    const map: Record<string, number> = {};
    employees.forEach(e => {
      const dept = e.department || 'Nealocat';
      map[dept] = (map[dept] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [employees]);

  // Seniority distribution
  const seniorityData = useMemo(() => {
    const buckets: Record<string, number> = {
      '< 1 an': 0, '1-3 ani': 0, '3-5 ani': 0,
      '5-10 ani': 0, '10-20 ani': 0, '20+ ani': 0,
    };
    const now = new Date();
    employees.forEach(e => {
      if (!e.employment_date) return;
      const years = differenceInYears(now, parseISO(e.employment_date));
      if (years < 1) buckets['< 1 an']++;
      else if (years < 3) buckets['1-3 ani']++;
      else if (years < 5) buckets['3-5 ani']++;
      else if (years < 10) buckets['5-10 ani']++;
      else if (years < 20) buckets['10-20 ani']++;
      else buckets['20+ ani']++;
    });
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [employees]);

  // Contract type distribution
  const contractData = useMemo(() => {
    const map: Record<string, number> = {};
    employees.forEach(e => {
      const ct = e.contract_type === 'determinat' ? 'Determinat' : 'Nedeterminat';
      map[ct] = (map[ct] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [employees]);

  // Turnover (archived in selected year)
  const turnoverStats = useMemo(() => {
    const departed = archivedEmployees.filter(e =>
      e.archived_at && parseISO(e.archived_at).getFullYear() === currentYear
    ).length;
    const avgHeadcount = employees.length + departed / 2;
    const rate = avgHeadcount > 0 ? ((departed / avgHeadcount) * 100).toFixed(1) : '0';
    return { departed, rate, total: employees.length };
  }, [employees, archivedEmployees, currentYear]);

  // Average seniority
  const avgSeniority = useMemo(() => {
    const now = new Date();
    const years = employees
      .filter(e => e.employment_date)
      .map(e => differenceInYears(now, parseISO(e.employment_date)));
    if (years.length === 0) return 0;
    return (years.reduce((a, b) => a + b, 0) / years.length).toFixed(1);
  }, [employees]);

  // Accounts activation rate
  const activationRate = useMemo(() => {
    if (employees.length === 0) return '0';
    return ((employees.filter(e => e.hasAccount).length / employees.length) * 100).toFixed(0);
  }, [employees]);

  // Leave utilization
  const leaveUtilization = useMemo(() => {
    const total = employees.reduce((s, e) => s + e.total_leave_days, 0);
    const used = employees.reduce((s, e) => s + e.used_leave_days, 0);
    return { total, used, rate: total > 0 ? ((used / total) * 100).toFixed(1) : '0' };
  }, [employees]);

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summaryRows = [
      ['Raport HR — ' + currentYear],
      [],
      ['Indicator', 'Valoare'],
      ['Total angajați activi', employees.length],
      ['Plecări în ' + currentYear, turnoverStats.departed],
      ['Rată fluctuație', turnoverStats.rate + '%'],
      ['Vechime medie (ani)', avgSeniority],
      ['Rată activare conturi', activationRate + '%'],
      ['Zile CO utilizate / total', `${leaveUtilization.used} / ${leaveUtilization.total}`],
      ['Rată utilizare CO', leaveUtilization.rate + '%'],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    wsSummary['!cols'] = [{ wch: 30 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Sumar');

    // Department sheet
    const deptRows = [['Departament', 'Nr. Angajați'], ...departmentData.map(d => [d.name, d.value])];
    const wsDept = XLSX.utils.aoa_to_sheet(deptRows);
    wsDept['!cols'] = [{ wch: 40 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, wsDept, 'Departamente');

    // Seniority sheet
    const senRows = [['Interval Vechime', 'Nr. Angajați'], ...seniorityData.map(d => [d.name, d.value])];
    const wsSen = XLSX.utils.aoa_to_sheet(senRows);
    XLSX.utils.book_append_sheet(wb, wsSen, 'Vechime');

    // Employees detail
    const empRows = [
      ['Nume', 'Departament', 'Funcție', 'Grad', 'Data Angajare', 'Tip Contract', 'Zile CO Total', 'Zile CO Utilizate', 'Cont Activ'],
      ...employees.map(e => [
        e.full_name, e.department || '', e.position || '', e.grade || '',
        e.employment_date, e.contract_type || 'nedeterminat',
        e.total_leave_days, e.used_leave_days, e.hasAccount ? 'Da' : 'Nu'
      ])
    ];
    const wsEmp = XLSX.utils.aoa_to_sheet(empRows);
    wsEmp['!cols'] = [{ wch: 30 }, { wch: 30 }, { wch: 25 }, { wch: 15 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsEmp, 'Angajați');

    XLSX.writeFile(wb, `Raport_HR_${currentYear}.xlsx`);
  };

  const exportPDF = async () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageW = doc.internal.pageSize.getWidth();
    let y = 20;

    doc.setFontSize(18);
    doc.text(`Raport HR — ${currentYear}`, pageW / 2, y, { align: 'center' });
    y += 12;
    doc.setFontSize(10);
    doc.text(`Generat: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, pageW / 2, y, { align: 'center' });
    y += 14;

    doc.setFontSize(14);
    doc.text('Indicatori generali', 14, y);
    y += 8;
    doc.setFontSize(11);
    const stats = [
      [`Total angajati activi: ${employees.length}`],
      [`Plecari in ${currentYear}: ${turnoverStats.departed}`],
      [`Rata fluctuatie: ${turnoverStats.rate}%`],
      [`Vechime medie: ${avgSeniority} ani`],
      [`Rata activare conturi: ${activationRate}%`],
      [`Utilizare CO: ${leaveUtilization.rate}% (${leaveUtilization.used}/${leaveUtilization.total} zile)`],
    ];
    stats.forEach(([text]) => {
      doc.text(text, 18, y);
      y += 6;
    });
    y += 6;

    doc.setFontSize(14);
    doc.text('Distributie pe departamente', 14, y);
    y += 8;
    doc.setFontSize(10);
    departmentData.forEach(d => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(`${d.name}: ${d.value} angajati`, 18, y);
      y += 5;
    });
    y += 6;

    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(14);
    doc.text('Distributie vechime', 14, y);
    y += 8;
    doc.setFontSize(10);
    seniorityData.forEach(d => {
      doc.text(`${d.name}: ${d.value} angajati`, 18, y);
      y += 5;
    });

    doc.save(`Raport_HR_${currentYear}.pdf`);
  };

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" size="sm" onClick={exportExcel}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
          <Button variant="outline" size="sm" onClick={exportPDF}>
            <FileText className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Angajați</span>
            </div>
            <p className="text-2xl font-bold">{employees.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-4 h-4 text-destructive" />
              <span className="text-xs text-muted-foreground">Fluctuație</span>
            </div>
            <p className="text-2xl font-bold">{turnoverStats.rate}%</p>
            <p className="text-xs text-muted-foreground">{turnoverStats.departed} plecări</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Vechime medie</span>
            </div>
            <p className="text-2xl font-bold">{avgSeniority}</p>
            <p className="text-xs text-muted-foreground">ani</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-4 h-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Departamente</span>
            </div>
            <p className="text-2xl font-bold">{departmentData.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Conturi active</span>
            </div>
            <p className="text-2xl font-bold">{activationRate}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Download className="w-4 h-4 text-violet-500" />
              <span className="text-xs text-muted-foreground">Utilizare CO</span>
            </div>
            <p className="text-2xl font-bold">{leaveUtilization.rate}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Distribuție pe departamente</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={departmentData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, value }) => `${value}`}>
                  {departmentData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Seniority distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Distribuție vechime</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={seniorityData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" name="Angajați" fill="hsl(215, 70%, 55%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Contract type */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tip contract</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={contractData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {contractData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top departments by headcount */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top departamente</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={departmentData.slice(0, 8)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" name="Angajați" fill="hsl(150, 60%, 45%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default HRReportsPanel;
