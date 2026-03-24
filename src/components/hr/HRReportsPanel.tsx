import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Download, Users, Clock, TrendingDown, Building2, FileSpreadsheet, FileText, Briefcase, UserCheck } from 'lucide-react';
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

const PALETTE = [
  'hsl(var(--primary))',
  'hsl(215, 65%, 58%)',
  'hsl(190, 55%, 48%)',
  'hsl(160, 50%, 45%)',
  'hsl(130, 45%, 48%)',
  'hsl(45, 75%, 52%)',
  'hsl(25, 70%, 55%)',
  'hsl(340, 55%, 52%)',
  'hsl(280, 45%, 55%)',
  'hsl(240, 50%, 58%)',
  'hsl(200, 50%, 52%)',
  'hsl(80, 45%, 48%)',
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg text-sm">
      <p className="font-medium text-foreground mb-0.5">{label || payload[0]?.name}</p>
      <p className="text-muted-foreground">{payload[0]?.value} angajați</p>
    </div>
  );
};

const PieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg text-sm">
      <p className="font-medium text-foreground">{payload[0]?.name}</p>
      <p className="text-muted-foreground">{payload[0]?.value} angajați</p>
    </div>
  );
};

const HRReportsPanel = ({ employees, archivedEmployees }: HRReportsPanelProps) => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const currentYear = parseInt(selectedYear);

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

  const contractData = useMemo(() => {
    const map: Record<string, number> = {};
    employees.forEach(e => {
      const ct = e.contract_type === 'determinat' ? 'Determinat' : 'Nedeterminat';
      map[ct] = (map[ct] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [employees]);

  const turnoverStats = useMemo(() => {
    const departed = archivedEmployees.filter(e =>
      e.archived_at && parseISO(e.archived_at).getFullYear() === currentYear
    ).length;
    const avgHeadcount = employees.length + departed / 2;
    const rate = avgHeadcount > 0 ? ((departed / avgHeadcount) * 100).toFixed(1) : '0';
    return { departed, rate, total: employees.length };
  }, [employees, archivedEmployees, currentYear]);

  const avgSeniority = useMemo(() => {
    const now = new Date();
    const years = employees
      .filter(e => e.employment_date)
      .map(e => differenceInYears(now, parseISO(e.employment_date)));
    if (years.length === 0) return 0;
    return (years.reduce((a, b) => a + b, 0) / years.length).toFixed(1);
  }, [employees]);

  const activationRate = useMemo(() => {
    if (employees.length === 0) return '0';
    return ((employees.filter(e => e.hasAccount).length / employees.length) * 100).toFixed(0);
  }, [employees]);

  const leaveUtilization = useMemo(() => {
    const total = employees.reduce((s, e) => s + e.total_leave_days, 0);
    const used = employees.reduce((s, e) => s + e.used_leave_days, 0);
    return { total, used, rate: total > 0 ? ((used / total) * 100).toFixed(1) : '0' };
  }, [employees]);

  // Shorten department names for chart labels
  const shortenDept = (name: string) => {
    if (name.length <= 25) return name;
    // Try to abbreviate common prefixes
    return name
      .replace('Laboratorul de ', 'Lab. ')
      .replace('Laborator ', 'Lab. ')
      .replace('Compartiment ', 'Comp. ')
      .replace('Serviciul ', 'Serv. ')
      .replace(' si ', ' și ')
      .substring(0, 30) + '…';
  };

  const topDepartments = useMemo(() => 
    departmentData.slice(0, 10).map(d => ({
      ...d,
      shortName: shortenDept(d.name),
    })),
  [departmentData]);

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const summaryRows = [
      ['Raport HR — ' + currentYear], [],
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

    const deptRows = [['Departament', 'Nr. Angajați'], ...departmentData.map(d => [d.name, d.value])];
    const wsDept = XLSX.utils.aoa_to_sheet(deptRows);
    wsDept['!cols'] = [{ wch: 40 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, wsDept, 'Departamente');

    const senRows = [['Interval Vechime', 'Nr. Angajați'], ...seniorityData.map(d => [d.name, d.value])];
    const wsSen = XLSX.utils.aoa_to_sheet(senRows);
    XLSX.utils.book_append_sheet(wb, wsSen, 'Vechime');

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
      `Total angajati activi: ${employees.length}`,
      `Plecari in ${currentYear}: ${turnoverStats.departed}`,
      `Rata fluctuatie: ${turnoverStats.rate}%`,
      `Vechime medie: ${avgSeniority} ani`,
      `Rata activare conturi: ${activationRate}%`,
      `Utilizare CO: ${leaveUtilization.rate}% (${leaveUtilization.used}/${leaveUtilization.total} zile)`,
    ];
    stats.forEach(text => { doc.text(text, 18, y); y += 6; });
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

  const kpiCards = [
    { icon: Users, label: 'Angajați activi', value: employees.length, sub: null, color: 'text-primary' },
    { icon: TrendingDown, label: 'Fluctuație', value: `${turnoverStats.rate}%`, sub: `${turnoverStats.departed} plecări`, color: 'text-destructive' },
    { icon: Clock, label: 'Vechime medie', value: `${avgSeniority} ani`, sub: null, color: 'text-primary' },
    { icon: Building2, label: 'Departamente', value: departmentData.length, sub: null, color: 'text-primary' },
    { icon: UserCheck, label: 'Conturi active', value: `${activationRate}%`, sub: `din ${employees.length}`, color: 'text-primary' },
    { icon: Briefcase, label: 'Utilizare CO', value: `${leaveUtilization.rate}%`, sub: `${leaveUtilization.used}/${leaveUtilization.total} zile`, color: 'text-primary' },
  ];

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" size="sm" onClick={exportExcel}>
            <FileSpreadsheet className="w-4 h-4 mr-1.5" />
            <span className="hidden sm:inline">Export</span> XLSX
          </Button>
          <Button variant="outline" size="sm" onClick={exportPDF}>
            <FileText className="w-4 h-4 mr-1.5" />
            <span className="hidden sm:inline">Export</span> PDF
          </Button>
        </div>
      </div>

      {/* KPI Cards - clean grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpiCards.map((kpi) => (
          <Card key={kpi.label} className="hover:shadow-sm transition-shadow">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <kpi.icon className={`w-3.5 h-3.5 ${kpi.color}`} />
                <span className="text-[11px] sm:text-xs text-muted-foreground font-medium truncate">{kpi.label}</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-foreground leading-none">{kpi.value}</p>
              {kpi.sub && <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">{kpi.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts - redesigned */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
        
        {/* Top departments - horizontal bar (cleaner than pie) */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-1 p-4">
            <CardTitle className="text-sm font-semibold">Distribuție pe departamente</CardTitle>
            <CardDescription className="text-xs">Top {topDepartments.length} departamente după numărul de angajați</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ResponsiveContainer width="100%" height={Math.max(250, topDepartments.length * 36)}>
              <BarChart data={topDepartments} layout="vertical" margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border/50" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis
                  dataKey="shortName"
                  type="category"
                  width={180}
                  tick={{ fontSize: 11 }}
                  className="fill-muted-foreground"
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.3)' }} />
                <Bar dataKey="value" name="Angajați" radius={[0, 6, 6, 0]} maxBarSize={28}>
                  {topDepartments.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Seniority distribution */}
        <Card>
          <CardHeader className="pb-1 p-4">
            <CardTitle className="text-sm font-semibold">Distribuție vechime</CardTitle>
            <CardDescription className="text-xs">Angajați grupați pe intervale de vechime</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={seniorityData} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/50" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} className="fill-muted-foreground" tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="fill-muted-foreground" tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.3)' }} />
                <Bar dataKey="value" name="Angajați" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} maxBarSize={48}>
                  {seniorityData.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} opacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Contract type - donut chart */}
        <Card>
          <CardHeader className="pb-1 p-4">
            <CardTitle className="text-sm font-semibold">Tip contract</CardTitle>
            <CardDescription className="text-xs">Distribuția contractelor de muncă</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={contractData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {contractData.map((_, i) => (
                      <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              {/* Legend below */}
              <div className="flex flex-wrap justify-center gap-4 mt-1">
                {contractData.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
                    <span className="text-xs text-muted-foreground">{item.name}</span>
                    <span className="text-xs font-semibold text-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default HRReportsPanel;
