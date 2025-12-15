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
import { FileSpreadsheet, Download, Calendar, Users, FileText, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

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

interface Employee {
  user_id: string;
  full_name: string;
  department: string | null;
  position: string | null;
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

const HRExportButton = ({ requests, employees }: HRExportButtonProps) => {
  const { toast } = useToast();
  const [exporting, setExporting] = useState<string | null>(null);

  const downloadExcel = (data: any[], filename: string, sheetName: string) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
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
        'Departament': e.department || '-',
        'Funcție': e.position || '-',
        'Data Angajării': e.record?.hire_date ? format(new Date(e.record.hire_date), 'dd.MM.yyyy') : '-',
        'Tip Contract': e.record?.contract_type || '-'
      }));
      downloadExcel(data, 'lista_angajati', 'Angajați');
      toast({ title: 'Export realizat', description: `${data.length} angajați exportați.` });
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default HRExportButton;
