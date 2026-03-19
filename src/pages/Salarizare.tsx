import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/hooks/useAuth';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Download, Loader2, Banknote, CalendarDays } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { format, startOfMonth, endOfMonth, subMonths, eachDayOfInterval, isWeekend } from 'date-fns';
import { ro } from 'date-fns/locale';
import { LEAVE_TYPES, LEAVE_TYPE_MAP } from '@/utils/leaveTypes';
import { isPublicHoliday } from '@/utils/romanianHolidays';

const MONTH_NAMES_RO = [
  'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
  'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'
];

const HEADER_FILL: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1F4E79' },
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: 'FFFFFFFF' },
  size: 11,
};

const BORDER_THIN: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
};

interface EmployeeData {
  id: string;
  first_name: string;
  last_name: string;
  department: string | null;
  position: string | null;
  employee_record_id: string | null;
  total_leave_days: number | null;
  used_leave_days: number | null;
}

interface LeaveRecord {
  start_date: string;
  end_date: string;
  working_days: number;
  epd_id: string | null;
  user_id: string;
  leave_type: string;
  deduct_from?: string; // 'auto' | 'carryover_only' | 'current_only'
}

interface CarryoverData {
  employee_personal_data_id: string;
  from_year: number;
  to_year: number;
  initial_days: number;
  used_days: number;
  remaining_days: number;
}

interface BonusData {
  employee_personal_data_id: string;
  year: number;
  bonus_days: number;
  reason: string;
}

function getWorkingDaysInRange(start: Date, end: Date, monthStart: Date, monthEnd: Date): { days: number; period: string } {
  const effectiveStart = start < monthStart ? monthStart : start;
  const effectiveEnd = end > monthEnd ? monthEnd : end;
  
  if (effectiveStart > effectiveEnd) return { days: 0, period: '' };
  
  const allDays = eachDayOfInterval({ start: effectiveStart, end: effectiveEnd });
  const workingDays = allDays.filter(d => !isWeekend(d) && !isPublicHoliday(d)).length;
  
  return {
    days: workingDays,
    period: `${format(effectiveStart, 'dd.MM')}-${format(effectiveEnd, 'dd.MM')}`,
  };
}

function addMonthSheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  employees: EmployeeData[],
  leaveRecords: LeaveRecord[],
  monthStart: Date,
  monthEnd: Date
) {
  const ws = wb.addWorksheet(sheetName);

  // Header
  const headers = ['Nr', 'Nume', 'Departament', 'Funcție', 'Tip', 'Zile', 'Perioade'];
  const headerRow = ws.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.border = BORDER_THIN;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // Sort employees A-Z by last_name + first_name
  const sorted = [...employees].sort((a, b) => {
    const nameA = `${a.last_name} ${a.first_name}`.toLowerCase();
    const nameB = `${b.last_name} ${b.first_name}`.toLowerCase();
    return nameA.localeCompare(nameB, 'ro');
  });

  // Build labels from centralized leave types config
  const leaveTypeLabels: Record<string, string> = {};
  for (const lt of LEAVE_TYPES) {
    leaveTypeLabels[lt.key] = lt.label;
  }
  // Legacy aliases
  leaveTypeLabels['concediu_odihna'] = 'CO';
  leaveTypeLabels['concediu_medical'] = 'CM';
  leaveTypeLabels['concediu_fara_plata'] = 'CS';
  leaveTypeLabels['concediu_crestere_copil'] = 'CS';
  leaveTypeLabels['cfp'] = 'CS';
  leaveTypeLabels['ccc'] = 'CS';
  leaveTypeLabels['eveniment'] = 'EV';
  leaveTypeLabels['bo'] = 'CM';

  sorted.forEach((emp, idx) => {
    // Find all leave records for this employee in this month
    const empLeaves = leaveRecords.filter(lr => lr.epd_id === emp.id);
    
    // Group by leave type
    const byType: Record<string, { days: number; periods: string[] }> = {};

    empLeaves.forEach(lr => {
      const lrStart = new Date(lr.start_date);
      const lrEnd = new Date(lr.end_date);
      const result = getWorkingDaysInRange(lrStart, lrEnd, monthStart, monthEnd);
      if (result.days > 0) {
        const type = lr.leave_type || 'co';
        if (!byType[type]) byType[type] = { days: 0, periods: [] };
        byType[type].days += result.days;
        byType[type].periods.push(result.period);
      }
    });

    const types = Object.keys(byType);
    if (types.length === 0) {
      // No leave - single row
      const row = ws.addRow([
        idx + 1,
        `${emp.last_name} ${emp.first_name}`,
        emp.department || '',
        emp.position || '',
        '',
        0,
        '',
      ]);
      row.eachCell((cell) => {
        cell.border = BORDER_THIN;
        cell.alignment = { vertical: 'middle' };
      });
      if (idx % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
        });
      }
    } else {
      types.forEach((type, typeIdx) => {
        const info = byType[type];
        const row = ws.addRow([
          typeIdx === 0 ? idx + 1 : '',
          typeIdx === 0 ? `${emp.last_name} ${emp.first_name}` : '',
          typeIdx === 0 ? (emp.department || '') : '',
          typeIdx === 0 ? (emp.position || '') : '',
          leaveTypeLabels[type] || type.toUpperCase(),
          info.days,
          info.periods.join(', '),
        ]);
        row.eachCell((cell) => {
          cell.border = BORDER_THIN;
          cell.alignment = { vertical: 'middle' };
        });
        if (idx % 2 === 1) {
          row.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
          });
        }
      });
    }
  });

  // Column widths
  ws.getColumn(1).width = 6;
  ws.getColumn(2).width = 30;
  ws.getColumn(3).width = 22;
  ws.getColumn(4).width = 22;
  ws.getColumn(5).width = 8;
  ws.getColumn(6).width = 10;
  ws.getColumn(7).width = 35;
}

function addBalanceSummarySheet(
  wb: ExcelJS.Workbook,
  employees: EmployeeData[],
  carryovers: CarryoverData[],
  bonuses: BonusData[],
  year: number
) {
  const ws = wb.addWorksheet('Sold Concedii');

  const headers = [
    'Nr', 'Nume', 'Departament', 'Funcție',
    `Report ${year - 1} (Zile inițiale)`, `Report ${year - 1} (Folosite)`, `Report ${year - 1} (Rămase)`,
    `Sold+ (Bonus ${year})`,
    `Sold ${year} (Total)`, `Sold ${year} (Folosite)`, `Sold ${year} (Rămase)`,
    'Total Disponibil'
  ];
  const headerRow = ws.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.border = BORDER_THIN;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  headerRow.height = 36;

  const sorted = [...employees].sort((a, b) => {
    const nameA = `${a.last_name} ${a.first_name}`.toLowerCase();
    const nameB = `${b.last_name} ${b.first_name}`.toLowerCase();
    return nameA.localeCompare(nameB, 'ro');
  });

  sorted.forEach((emp, idx) => {
    // Carryover from previous year to this year
    const carryover = carryovers.find(
      c => c.employee_personal_data_id === emp.id && c.to_year === year
    );
    const coInitial = carryover?.initial_days ?? 0;
    const coUsed = carryover?.used_days ?? 0;
    const coRemaining = carryover?.remaining_days ?? 0;

    // Bonus days for this year
    const empBonuses = bonuses.filter(
      b => b.employee_personal_data_id === emp.id && b.year === year
    );
    const totalBonus = empBonuses.reduce((sum, b) => sum + b.bonus_days, 0);

    // Current year balance from EPD
    const totalYearDays = emp.total_leave_days ?? 21;
    const usedYearDays = emp.used_leave_days ?? 0;
    const remainingYear = totalYearDays - usedYearDays;

    const totalAvailable = coRemaining + totalBonus + remainingYear;

    const row = ws.addRow([
      idx + 1,
      `${emp.last_name} ${emp.first_name}`,
      emp.department || '',
      emp.position || '',
      coInitial,
      coUsed,
      coRemaining,
      totalBonus,
      totalYearDays,
      usedYearDays,
      remainingYear,
      totalAvailable,
    ]);

    row.eachCell((cell, colNumber) => {
      cell.border = BORDER_THIN;
      cell.alignment = { vertical: 'middle', horizontal: colNumber >= 5 ? 'center' : 'left' };
    });

    if (idx % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
      });
    }

    // Highlight low availability in red
    const availCell = row.getCell(12);
    if (totalAvailable <= 0) {
      availCell.font = { bold: true, color: { argb: 'FFFF0000' } };
    }
  });

  // Column widths
  ws.getColumn(1).width = 6;
  ws.getColumn(2).width = 30;
  ws.getColumn(3).width = 22;
  ws.getColumn(4).width = 22;
  ws.getColumn(5).width = 18;
  ws.getColumn(6).width = 18;
  ws.getColumn(7).width = 18;
  ws.getColumn(8).width = 16;
  ws.getColumn(9).width = 16;
  ws.getColumn(10).width = 16;
  ws.getColumn(11).width = 16;
  ws.getColumn(12).width = 16;
}

const Salarizare = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isSalarizare, loading: roleLoading } = useUserRole();
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    if (!roleLoading && !isSalarizare) {
      navigate('/');
    }
  }, [roleLoading, isSalarizare, navigate]);

  if (roleLoading) {
    return (
      <MainLayout title="Salarizare">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!isSalarizare) return null;

  const fetchData = async () => {
    const [{ data: employees }, { data: hrReqs }, { data: empRecords }, { data: carryovers }, { data: bonuses }] = await Promise.all([
      supabase.from('employee_personal_data').select('id, first_name, last_name, department, position, employee_record_id, total_leave_days, used_leave_days').eq('is_archived', false),
      supabase.from('hr_requests').select('*').eq('request_type', 'concediu' as any).eq('status', 'approved' as any),
      supabase.from('employee_records').select('id, user_id'),
      supabase.from('leave_carryover').select('employee_personal_data_id, from_year, to_year, initial_days, used_days, remaining_days'),
      supabase.from('leave_bonus').select('employee_personal_data_id, year, bonus_days, reason'),
    ]);

    // Build user_id -> epd_id mapping via employee_records
    const userIdToEpdId: Record<string, string> = {};
    (employees || []).forEach((emp: any) => {
      if (emp.employee_record_id) {
        const rec = (empRecords || []).find((r: any) => r.id === emp.employee_record_id);
        if (rec) {
          userIdToEpdId[rec.user_id] = emp.id;
        }
      }
    });

    // Transform hr_requests into LeaveRecord format
    const leaveRecords: LeaveRecord[] = (hrReqs || []).map((hr: any) => {
      const details = hr.details || {};
      const resolvedEpdId = details.epd_id || userIdToEpdId[hr.user_id] || null;
      let rawType = (details.leaveType || 'co').toLowerCase().trim();
      const mapped = LEAVE_TYPE_MAP[rawType];
      const normalizedType = mapped ? mapped.key : rawType;
      return {
        start_date: details.startDate || '',
        end_date: details.endDate || '',
        working_days: details.numberOfDays || 0,
        epd_id: resolvedEpdId,
        user_id: hr.user_id,
        leave_type: normalizedType,
      };
    });

    // Also fetch from leave_requests table (formal workflow)
    const { data: formalLeaves } = await supabase
      .from('leave_requests')
      .select('start_date, end_date, working_days, epd_id, user_id, status')
      .eq('status', 'approved' as any)
      .eq('is_demo', false);

    (formalLeaves || []).forEach((lr: any) => {
      leaveRecords.push({
        start_date: lr.start_date,
        end_date: lr.end_date,
        working_days: lr.working_days,
        epd_id: lr.epd_id || userIdToEpdId[lr.user_id] || null,
        user_id: lr.user_id,
        leave_type: 'co',
      });
    });

    return {
      employees: (employees || []) as EmployeeData[],
      leaveRecords,
      carryovers: (carryovers || []) as CarryoverData[],
      bonuses: (bonuses || []) as BonusData[],
    };
  };

  const exportPreviousMonth = async () => {
    setExporting('prev');
    try {
      const { employees, leaveRecords } = await fetchData();
      const now = new Date();
      const prevMonth = subMonths(now, 1);
      const monthStart = startOfMonth(prevMonth);
      const monthEnd = endOfMonth(prevMonth);
      const sheetName = `${MONTH_NAMES_RO[prevMonth.getMonth()]} ${prevMonth.getFullYear()}`;

      const wb = new ExcelJS.Workbook();
      addMonthSheet(wb, sheetName, employees, leaveRecords, monthStart, monthEnd);

      const buf = await wb.xlsx.writeBuffer();
      saveAs(new Blob([buf]), `Salarizare_${sheetName.replace(' ', '_')}.xlsx`);
      toast.success(`Export "${sheetName}" generat cu succes!`);
    } catch (err) {
      console.error(err);
      toast.error('Eroare la generarea exportului');
    } finally {
      setExporting(null);
    }
  };

  const exportYear = async (year: number) => {
    setExporting(String(year));
    try {
      const { employees, leaveRecords, carryovers, bonuses } = await fetchData();
      const wb = new ExcelJS.Workbook();

      // First sheet: Balance summary
      addBalanceSummarySheet(wb, employees, carryovers, bonuses, year);

      for (let m = 0; m < 12; m++) {
        const monthStart = new Date(year, m, 1);
        const monthEnd = endOfMonth(monthStart);
        const sheetName = `${MONTH_NAMES_RO[m]} ${year}`;
        addMonthSheet(wb, sheetName, employees, leaveRecords, monthStart, monthEnd);
      }

      const buf = await wb.xlsx.writeBuffer();
      saveAs(new Blob([buf]), `Concedii_${year}.xlsx`);
      toast.success(`Export concedii ${year} generat cu succes!`);
    } catch (err) {
      console.error(err);
      toast.error('Eroare la generarea exportului');
    } finally {
      setExporting(null);
    }
  };

  return (
    <MainLayout title="Salarizare">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Banknote className="w-7 h-7 text-primary" />
            Salarizare
          </h1>
          <p className="text-muted-foreground mt-1">
            Export rapoarte concedii pentru departamentul de salarizare
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {/* Luna precedentă */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarDays className="w-5 h-5" />
                Luna Precedentă
              </CardTitle>
              <CardDescription>
                {(() => {
                  const prev = subMonths(new Date(), 1);
                  return `${MONTH_NAMES_RO[prev.getMonth()]} ${prev.getFullYear()}`;
                })()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Export cu toți angajații și zilele de concediu din luna precedentă.
              </p>
              <Button
                onClick={exportPreviousMonth}
                disabled={!!exporting}
                className="w-full"
              >
                {exporting === 'prev' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Export XLSX
              </Button>
            </CardContent>
          </Card>

          {/* Concedii 2025 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarDays className="w-5 h-5" />
                Concedii 2025
              </CardTitle>
              <CardDescription>
                12 foi lunare (Ianuarie – Decembrie 2025)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Export complet cu angajații și concediile pe fiecare lună din 2025.
              </p>
              <Button
                onClick={() => exportYear(2025)}
                disabled={!!exporting}
                className="w-full"
              >
                {exporting === '2025' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Export XLSX
              </Button>
            </CardContent>
          </Card>

          {/* Concedii 2026 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarDays className="w-5 h-5" />
                Concedii 2026
              </CardTitle>
              <CardDescription>
                12 foi lunare (Ianuarie – Decembrie 2026)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Export complet cu angajații și concediile pe fiecare lună din 2026.
              </p>
              <Button
                onClick={() => exportYear(2026)}
                disabled={!!exporting}
                className="w-full"
              >
                {exporting === '2026' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Export XLSX
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
};

export default Salarizare;
