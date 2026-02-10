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
import * as XLSX from 'xlsx';
import { format, parseISO, eachDayOfInterval, isWeekend, getMonth } from 'date-fns';
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
  hasAccount?: boolean;
  cnp?: string;
  employment_date?: string;
  contract_type?: string | null;
  leaveHistory?: LeaveEntry[];
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

const HRExportButton = ({ requests, employees }: HRExportButtonProps) => {
  const { toast } = useToast();
  const [exporting, setExporting] = useState<string | null>(null);

  const downloadExcel = (data: any[], filename: string, sheetName: string) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${filename}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const downloadExcelMultiSheet = (sheets: { name: string; data: any[] }[], filename: string) => {
    const wb = XLSX.utils.book_new();
    sheets.forEach(s => {
      const ws = XLSX.utils.json_to_sheet(s.data);
      XLSX.utils.book_append_sheet(wb, ws, s.name.substring(0, 31));
    });
    XLSX.writeFile(wb, `${filename}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const exportLeaveRequests = () => {
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
      downloadExcel(data, 'cereri_concediu', 'Cereri Concediu');
      toast({ title: 'Export realizat', description: `${data.length} cereri de concediu exportate.` });
    } finally {
      setExporting(null);
    }
  };

  const exportAllRequests = () => {
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
      downloadExcel(data, 'toate_cererile_hr', 'Cereri HR');
      toast({ title: 'Export realizat', description: `${data.length} cereri HR exportate.` });
    } finally {
      setExporting(null);
    }
  };

  const exportLeaveBalances = () => {
    setExporting('balance');
    try {
      const data = employees.map(e => ({
        'Nume Complet': e.full_name,
        'Departament': e.department || '-',
        'Funcție': e.position || '-',
        'Data Angajării': e.record?.hire_date ? format(new Date(e.record.hire_date), 'dd.MM.yyyy') : '-',
        'Tip Contract': e.record?.contract_type || '-',
        'Total Zile Concediu': e.record?.total_leave_days ?? 21,
        'Zile Utilizate': e.record?.used_leave_days ?? 0,
        'Zile Rămase': e.record?.remaining_leave_days ?? (e.record?.total_leave_days ?? 21) - (e.record?.used_leave_days ?? 0)
      }));
      downloadExcel(data, 'sold_concedii', 'Sold Concedii');
      toast({ title: 'Export realizat', description: `${data.length} angajați exportați.` });
    } finally {
      setExporting(null);
    }
  };

  const exportEmployeeList = () => {
    setExporting('employees');
    try {
      const data = employees.map(e => ({
        'Nume Complet': e.full_name,
        'Email': e.email || '-',
        'Departament': e.department || '-',
        'Funcție': e.position || '-',
        'Data Angajării': e.record?.hire_date ? format(new Date(e.record.hire_date), 'dd.MM.yyyy') : '-',
        'Tip Contract': e.record?.contract_type || '-',
        'Cont Activ': e.hasAccount ? 'Da' : 'Nu'
      }));
      downloadExcel(data, 'lista_angajati', 'Angajați');
      toast({ title: 'Export realizat', description: `${data.length} angajați exportați.` });
    } finally {
      setExporting(null);
    }
  };

  const exportWithoutAccount = () => {
    setExporting('no_account');
    try {
      const noAccount = employees.filter(e => !e.hasAccount);
      const data = noAccount.map(e => ({
        'Nume Complet': e.full_name,
        'Email': e.email || '-',
        'Departament': e.department || '-',
        'Funcție': e.position || '-',
      }));
      downloadExcel(data, 'angajati_fara_cont', 'Fără Cont');
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

  const exportPayrollReport = () => {
    setExporting('payroll');
    try {
      const currentYear = new Date().getFullYear();
      
      const data = employees.map(e => {
        const leaves = e.leaveHistory || [];
        const row: Record<string, any> = {
          'Nume': e.full_name,
          'CNP': e.cnp || '-',
          'Email': e.email || '-',
          'Departament': e.department || '-',
          'Funcție': e.position || '-',
          'Data Angajării': e.employment_date ? format(new Date(e.employment_date), 'dd.MM.yyyy') : (e.record?.hire_date ? format(new Date(e.record.hire_date), 'dd.MM.yyyy') : '-'),
          'Tip Contract': e.contract_type || e.record?.contract_type || '-',
          'Total Zile CO': e.record?.total_leave_days ?? 21,
          'Zile Utilizate': e.record?.used_leave_days ?? 0,
          'Zile Rămase': (e.record?.total_leave_days ?? 21) - (e.record?.used_leave_days ?? 0),
        };

        // Add monthly columns: days + periods
        for (let m = 0; m < 12; m++) {
          const days = leaves.reduce((sum, l) => sum + getWorkingDaysInMonth(l.startDate, l.endDate, m, currentYear), 0);
          const periods = getPeriodsInMonth(leaves, m, currentYear);
          row[`${MONTH_NAMES[m]} - Zile`] = days || '';
          row[`${MONTH_NAMES[m]} - Perioade`] = periods;
        }

        return row;
      });

      // Build department sheets - only real departments
      const departments = [...new Set(
        employees
          .filter(e => e.department && e.department.trim() !== '')
          .map(e => e.department!)
      )].sort();

      const departmentSheets = departments.map(dept => {
        const deptEmployees = employees.filter(e => e.department === dept);
        const deptData = deptEmployees.map(e => {
          const leaves = e.leaveHistory || [];
          const row: Record<string, any> = {
            'Nume': e.full_name,
            'Funcție': e.position || '-',
            'Total Zile CO': e.record?.total_leave_days ?? 21,
            'Zile Utilizate': e.record?.used_leave_days ?? 0,
            'Zile Rămase': (e.record?.total_leave_days ?? 21) - (e.record?.used_leave_days ?? 0),
          };

          for (let m = 0; m < 12; m++) {
            const days = leaves.reduce((sum, l) => sum + getWorkingDaysInMonth(l.startDate, l.endDate, m, currentYear), 0);
            const periods = getPeriodsInMonth(leaves, m, currentYear);
            row[`${MONTH_NAMES[m]} - Zile`] = days || '';
            row[`${MONTH_NAMES[m]} - Perioade`] = periods;
          }

          return row;
        });

        return { name: dept.substring(0, 31), data: deptData };
      });

      // Build department summary sheet
      const deptSummary = departments.map(dept => {
        const deptEmployees = employees.filter(e => e.department === dept);
        const row: Record<string, any> = {
          'Departament': dept,
          'Nr. Angajați': deptEmployees.length,
          'Total Zile CO': deptEmployees.reduce((s, e) => s + (e.record?.total_leave_days ?? 21), 0),
          'Total Utilizate': deptEmployees.reduce((s, e) => s + (e.record?.used_leave_days ?? 0), 0),
          'Total Rămase': deptEmployees.reduce((s, e) => s + ((e.record?.total_leave_days ?? 21) - (e.record?.used_leave_days ?? 0)), 0),
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

      downloadExcelMultiSheet(
        [
          { name: 'Salarizare', data },
          { name: 'Total per Departament', data: deptSummary },
          ...departmentSheets,
        ],
        `raport_salarizare_${currentYear}`
      );
      toast({ title: 'Export realizat', description: `Raport salarizare cu ${data.length} angajați și ${departments.length} departamente exportat.` });
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
