import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FileSpreadsheet, Download, Calendar, Users, FileText, Loader2, Banknote } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ExcelJS from 'exceljs';
import { format, parseISO, eachDayOfInterval, isWeekend } from 'date-fns';
import { ro } from 'date-fns/locale';
import { isPublicHoliday } from '@/utils/romanianHolidays';

interface HRRequest {
  id: string;
  user_id: string;
  request_type: string;
  status: string;
  details: any;
  created_at: string;
  employee_signature?: string | null;
  department_head_signature?: string | null;
}

interface LeaveEntry {
  startDate: string;
  endDate: string;
  numberOfDays: number;
}

interface Employee {
  user_id?: string;
  full_name: string;
  email?: string;
  department: string | null;
  position: string | null;
  grade?: string | null;
  hasAccount?: boolean;
  cnp?: string;
  employment_date?: string;
  contract_type?: string | null;
  leaveHistory?: LeaveEntry[];
  carryoverDays?: number;
  bonusDays?: number;
  record?: {
    total_leave_days: number;
    used_leave_days: number;
    remaining_leave_days: number;
    hire_date: string | null;
    contract_type: string;
  };
}

interface HRExportButtonProps {
  requests: HRRequest[];
  employees: Employee[];
}

const MONTH_NAMES = [
  'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
  'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'
];

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1F4E79' },
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: 'FFFFFFFF' },
  size: 11,
};

const CENTER_ALIGNMENT: Partial<ExcelJS.Alignment> = {
  horizontal: 'center',
  vertical: 'middle',
  wrapText: true,
};

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFB0B0B0' } },
  bottom: { style: 'thin', color: { argb: 'FFB0B0B0' } },
  left: { style: 'thin', color: { argb: 'FFB0B0B0' } },
  right: { style: 'thin', color: { argb: 'FFB0B0B0' } },
};

const styleSheet = (ws: ExcelJS.Worksheet) => {
  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = CENTER_ALIGNMENT;
    cell.border = THIN_BORDER;
  });
  headerRow.height = 28;

  for (let i = 2; i <= ws.rowCount; i++) {
    const row = ws.getRow(i);
    row.eachCell((cell) => {
      cell.alignment = CENTER_ALIGNMENT;
      cell.border = THIN_BORDER;
    });
    if (i % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F6FA' } };
      });
    }
  }

  ws.columns.forEach((col) => {
    let maxLen = 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = cell.value ? String(cell.value).length : 0;
      if (len > maxLen) maxLen = len;
    });
    col.width = Math.min(maxLen + 3, 35);
  });
};

const saveWorkbook = async (wb: ExcelJS.Workbook, filename: string) => {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
};

const currentYear = new Date().getFullYear();
const prevYear = currentYear - 1;

/** Total available = current year + carryover + bonus - used */
const totalAvailable = (e: Employee) => {
  return (e.record?.total_leave_days ?? 21) + (e.carryoverDays || 0) + (e.bonusDays || 0) - (e.record?.used_leave_days ?? 0);
};

const HRExportButton = ({ requests, employees }: HRExportButtonProps) => {
  const { toast } = useToast();
  const [exporting, setExporting] = useState<string | null>(null);

  const exportSingleSheet = async (data: Record<string, any>[], filename: string, sheetName: string) => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(sheetName);
    if (data.length === 0) return;
    ws.columns = Object.keys(data[0]).map(key => ({ header: key, key }));
    data.forEach(row => ws.addRow(row));
    styleSheet(ws);
    await saveWorkbook(wb, filename);
  };

  const exportLeaveRequests = async () => {
    setExporting('leave');
    try {
      const leaveRequests = requests.filter(r => r.request_type === 'concediu');
      const data = leaveRequests.map(r => {
        const emp = employees.find(e => e.user_id === r.user_id);
        return {
          'Data Cererii': format(new Date(r.created_at), 'dd.MM.yyyy HH:mm', { locale: ro }),
          'Angajat': r.details?.employeeName || emp?.full_name || '-',
          'Departament': r.details?.department || emp?.department || '-',
          'Funcție': r.details?.position || emp?.position || '-',
          'Data Început': r.details?.startDate ? format(new Date(r.details.startDate), 'dd.MM.yyyy') : '-',
          'Data Sfârșit': r.details?.endDate ? format(new Date(r.details.endDate), 'dd.MM.yyyy') : '-',
          'Număr Zile': r.details?.numberOfDays || '-',
          'Înlocuitor': r.details?.replacementName || '-',
          'Status': r.status === 'approved' ? 'Aprobat' : r.status === 'rejected' ? 'Respins' : 'În așteptare',
          'Semnat Angajat': r.employee_signature ? 'Da' : 'Nu',
          'Semnat Șef': r.department_head_signature ? 'Da' : 'Nu'
        };
      });
      await exportSingleSheet(data, 'cereri_concediu', 'Cereri Concediu');
      toast({ title: 'Export realizat', description: `${data.length} cereri de concediu exportate.` });
    } finally {
      setExporting(null);
    }
  };

  const exportAllRequests = async () => {
    setExporting('all');
    try {
      const data = requests.map(r => {
        const emp = employees.find(e => e.user_id === r.user_id);
        const typeLabels: Record<string, string> = {
          concediu: 'Concediu',
          delegatie: 'Delegație',
          adeverinta: 'Adeverință',
          demisie: 'Demisie'
        };
        return {
          'Data Cererii': format(new Date(r.created_at), 'dd.MM.yyyy HH:mm', { locale: ro }),
          'Tip Cerere': typeLabels[r.request_type] || r.request_type,
          'Angajat': r.details?.employeeName || emp?.full_name || '-',
          'Departament': r.details?.department || emp?.department || '-',
          'Status': r.status === 'approved' ? 'Aprobat' : r.status === 'rejected' ? 'Respins' : 'În așteptare',
          'Detalii': JSON.stringify(r.details)
        };
      });
      await exportSingleSheet(data, 'toate_cererile_hr', 'Cereri HR');
      toast({ title: 'Export realizat', description: `${data.length} cereri HR exportate.` });
    } finally {
      setExporting(null);
    }
  };

  const exportLeaveBalances = async () => {
    setExporting('balance');
    try {
      const data = employees.map(e => ({
        'Nume Complet': e.full_name,
        'Departament': e.department || '-',
        'Funcție': e.position || '-',
        'Grad/Treaptă': e.grade || '-',
        'Data Angajării': e.record?.hire_date ? format(new Date(e.record.hire_date), 'dd.MM.yyyy') : '-',
        'Tip Contract': e.record?.contract_type || '-',
        [`Zile CO ${currentYear}`]: e.record?.total_leave_days ?? 21,
        [`Report ${prevYear}`]: e.carryoverDays || 0,
        'Sold+ (Bonus)': e.bonusDays || 0,
        'Total Disponibil': (e.record?.total_leave_days ?? 21) + (e.carryoverDays || 0) + (e.bonusDays || 0),
        'Zile Utilizate': e.record?.used_leave_days ?? 0,
        'Zile Rămase': totalAvailable(e),
      }));
      await exportSingleSheet(data, 'sold_concedii', 'Sold Concedii');
      toast({ title: 'Export realizat', description: `${data.length} angajați exportați.` });
    } finally {
      setExporting(null);
    }
  };

  const exportEmployeeList = async () => {
    setExporting('employees');
    try {
      const data = employees.map(e => ({
        'Nume Complet': e.full_name,
        'Email': e.email || '-',
        'Departament': e.department || '-',
        'Funcție': e.position || '-',
        'Grad/Treaptă': e.grade || '-',
        'Data Angajării': e.record?.hire_date ? format(new Date(e.record.hire_date), 'dd.MM.yyyy') : '-',
        'Tip Contract': e.record?.contract_type || '-',
        'Cont Activ': e.hasAccount ? 'Da' : 'Nu'
      }));
      await exportSingleSheet(data, 'lista_angajati', 'Angajați');
      toast({ title: 'Export realizat', description: `${data.length} angajați exportați.` });
    } finally {
      setExporting(null);
    }
  };

  const exportWithoutAccount = async () => {
    setExporting('no_account');
    try {
      const noAccount = employees.filter(e => !e.hasAccount);
      const data = noAccount.map(e => ({
        'Nume Complet': e.full_name,
        'Email': e.email || '-',
        'Departament': e.department || '-',
        'Funcție': e.position || '-',
      }));
      await exportSingleSheet(data, 'angajati_fara_cont', 'Fără Cont');
      toast({ title: 'Export realizat', description: `${data.length} angajați fără cont exportați.` });
    } finally {
      setExporting(null);
    }
  };

  const getWorkingDaysInMonth = (startDate: string, endDate: string, month: number, year: number): number => {
    try {
      const leaveStart = parseISO(startDate);
      const leaveEnd = parseISO(endDate);
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0);
      const overlapStart = leaveStart > monthStart ? leaveStart : monthStart;
      const overlapEnd = leaveEnd < monthEnd ? leaveEnd : monthEnd;
      if (overlapStart > overlapEnd) return 0;
      const days = eachDayOfInterval({ start: overlapStart, end: overlapEnd });
      return days.filter(d => !isWeekend(d) && !isPublicHoliday(d)).length;
    } catch {
      return 0;
    }
  };

  const getPeriodsInMonth = (leaves: LeaveEntry[], month: number, year: number): string => {
    const periods: string[] = [];
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    leaves.forEach(l => {
      if (!l.startDate || !l.endDate) return;
      try {
        const leaveStart = parseISO(l.startDate);
        const leaveEnd = parseISO(l.endDate);
        const overlapStart = leaveStart > monthStart ? leaveStart : monthStart;
        const overlapEnd = leaveEnd < monthEnd ? leaveEnd : monthEnd;
        if (overlapStart <= overlapEnd) {
          periods.push(`${format(overlapStart, 'dd.MM')}-${format(overlapEnd, 'dd.MM')}`);
        }
      } catch { /* skip invalid */ }
    });
    return periods.join('; ') || '';
  };

  const buildPayrollRow = (e: Employee, year: number, includeDetails: boolean) => {
    const leaves = e.leaveHistory || [];
    const carryover = e.carryoverDays || 0;
    const bonus = e.bonusDays || 0;
    const totalCO = e.record?.total_leave_days ?? 21;
    const used = e.record?.used_leave_days ?? 0;
    const totalDisponibil = totalCO + carryover + bonus;
    const ramas = totalDisponibil - used;

    const row: Record<string, any> = includeDetails
      ? {
          'Nume': e.full_name,
          'CNP': e.cnp || '-',
          'Email': e.email || '-',
          'Departament': e.department || '-',
          'Funcție': e.position || '-',
          'Grad/Treaptă': e.grade || '-',
          'Data Angajării': e.employment_date ? format(new Date(e.employment_date), 'dd.MM.yyyy') : (e.record?.hire_date ? format(new Date(e.record.hire_date), 'dd.MM.yyyy') : '-'),
          'Tip Contract': e.contract_type || e.record?.contract_type || '-',
          [`Zile CO ${year}`]: totalCO,
          [`Report ${year - 1}`]: carryover || '',
          'Sold+': bonus || '',
          'Total Disponibil': totalDisponibil,
          'Zile Utilizate': used,
          'Zile Rămase': ramas,
        }
      : {
          'Nume': e.full_name,
          'Funcție': e.position || '-',
          [`Zile CO ${year}`]: totalCO,
          [`Report ${year - 1}`]: carryover || '',
          'Sold+': bonus || '',
          'Total Disponibil': totalDisponibil,
          'Zile Utilizate': used,
          'Zile Rămase': ramas,
        };

    for (let m = 0; m < 12; m++) {
      const days = leaves.reduce((sum, l) => sum + getWorkingDaysInMonth(l.startDate, l.endDate, m, year), 0);
      const periods = getPeriodsInMonth(leaves, m, year);
      row[`${MONTH_NAMES[m]} - Zile`] = days || '';
      row[`${MONTH_NAMES[m]} - Perioade`] = periods;
    }
    return row;
  };

  const addStyledSheet = (wb: ExcelJS.Workbook, name: string, data: Record<string, any>[]) => {
    const ws = wb.addWorksheet(name.substring(0, 31));
    if (data.length === 0) return ws;
    ws.columns = Object.keys(data[0]).map(key => ({ header: key, key }));
    data.forEach(row => ws.addRow(row));
    styleSheet(ws);
    return ws;
  };

  const exportPayrollReport = async () => {
    setExporting('payroll');
    try {
      const wb = new ExcelJS.Workbook();
      wb.creator = 'ICMPP HR';
      wb.created = new Date();

      // Main sheet
      const mainData = employees.map(e => buildPayrollRow(e, currentYear, true));
      addStyledSheet(wb, 'Salarizare', mainData);

      // Department summary
      const departments = [...new Set(
        employees.filter(e => e.department?.trim()).map(e => e.department!)
      )].sort();

      const deptSummary = departments.map(dept => {
        const deptEmployees = employees.filter(e => e.department === dept);
        const row: Record<string, any> = {
          'Departament': dept,
          'Nr. Angajați': deptEmployees.length,
          [`Zile CO ${currentYear}`]: deptEmployees.reduce((s, e) => s + (e.record?.total_leave_days ?? 21), 0),
          [`Report ${prevYear}`]: deptEmployees.reduce((s, e) => s + (e.carryoverDays || 0), 0),
          'Sold+': deptEmployees.reduce((s, e) => s + (e.bonusDays || 0), 0),
          'Total Disponibil': deptEmployees.reduce((s, e) => s + (e.record?.total_leave_days ?? 21) + (e.carryoverDays || 0) + (e.bonusDays || 0), 0),
          'Total Utilizate': deptEmployees.reduce((s, e) => s + (e.record?.used_leave_days ?? 0), 0),
          'Total Rămase': deptEmployees.reduce((s, e) => s + totalAvailable(e), 0),
        };
        for (let m = 0; m < 12; m++) {
          const monthDays = deptEmployees.reduce((sum, e) => {
            const leaves = e.leaveHistory || [];
            return sum + leaves.reduce((s, l) => s + getWorkingDaysInMonth(l.startDate, l.endDate, m, currentYear), 0);
          }, 0);
          row[`${MONTH_NAMES[m]}`] = monthDays || '';
        }
        return row;
      });
      addStyledSheet(wb, 'Total per Departament', deptSummary);

      // Per-department sheets
      departments.forEach(dept => {
        const deptEmployees = employees.filter(e => e.department === dept);
        const deptData = deptEmployees.map(e => buildPayrollRow(e, currentYear, false));
        addStyledSheet(wb, dept, deptData);
      });

      await saveWorkbook(wb, `raport_salarizare_${currentYear}`);
      toast({ title: 'Export realizat', description: `Raport salarizare cu ${mainData.length} angajați și ${departments.length} departamente exportat.` });
    } finally {
      setExporting(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={!!exporting}>
          {exporting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <FileSpreadsheet className="w-4 h-4 mr-2" />
          )}
          Export Excel
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Rapoarte disponibile</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={exportPayrollReport}>
          <Banknote className="w-4 h-4 mr-2" />
          Raport salarizare (CO/lună)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={exportLeaveRequests}>
          <Calendar className="w-4 h-4 mr-2" />
          Cereri de concediu
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportAllRequests}>
          <FileText className="w-4 h-4 mr-2" />
          Toate cererile HR
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={exportLeaveBalances}>
          <Download className="w-4 h-4 mr-2" />
          Sold concedii angajați
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportEmployeeList}>
          <Users className="w-4 h-4 mr-2" />
          Lista angajați
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportWithoutAccount}>
          <FileText className="w-4 h-4 mr-2" />
          Angajați fără cont
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default HRExportButton;
