import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, getDay, parseISO, isWithinInterval } from 'date-fns';
import { ro } from 'date-fns/locale';
import { isPublicHoliday, getPublicHolidayName } from '@/utils/romanianHolidays';
import { getLeaveStyle, LEAVE_TYPES } from '@/utils/leaveTypes';

interface LeaveEntry {
  employeeName: string;
  department: string | null;
  startDate: string;
  endDate: string;
  numberOfDays: number;
  leaveType?: string;
}

interface CustomHoliday {
  id: string;
  holiday_date: string;
  name: string;
}

// Color map for leave types (Excel ARGB without #)
const LEAVE_COLORS: Record<string, { font: string; fill: string }> = {
  co:  { font: '0369A1', fill: 'E0F2FE' },
  cm:  { font: 'BE123C', fill: 'FFE4E6' },
  bo:  { font: 'BE123C', fill: 'FFE4E6' },
  cfp: { font: 'A16207', fill: 'FEF3C7' },
  ccc: { font: '7E22CE', fill: 'F3E8FF' },
  ev:  { font: '047857', fill: 'D1FAE5' },
  md:  { font: '0F766E', fill: 'CCFBF1' },
  i:   { font: 'C2410C', fill: 'FFEDD5' },
  prb: { font: 'B91C1C', fill: 'FEE2E2' },
  l:   { font: '0E7490', fill: 'CFFAFE' },
  n:   { font: '4338CA', fill: 'E0E7FF' },
  m:   { font: 'BE185D', fill: 'FCE7F3' },
  cs:  { font: '475569', fill: 'F1F5F9' },
  d:   { font: '4D7C0F', fill: 'ECFCCB' },
  cd:  { font: 'A16207', fill: 'FEF9C3' },
  nm:  { font: '991B1B', fill: 'FECACA' },
  prm: { font: 'A21CAF', fill: 'FAE8FF' },
};

function getExcelLeaveColor(leaveType?: string) {
  if (!leaveType) return LEAVE_COLORS['co'];
  return LEAVE_COLORS[leaveType.toLowerCase().trim()] || LEAVE_COLORS['co'];
}

export async function exportLeaveCalendarExcel(
  currentMonth: Date,
  leaves: LeaveEntry[],
  customHolidays: CustomHoliday[],
  departmentFilter: string
) {
  const wb = new ExcelJS.Workbook();
  const monthName = format(currentMonth, 'MMMM yyyy', { locale: ro });
  const sheetTitle = departmentFilter === 'all'
    ? `Calendar ${monthName}`
    : `${departmentFilter} - ${monthName}`;

  const ws = wb.addWorksheet(sheetTitle.substring(0, 31));

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const customHolidayMap: Record<string, string> = {};
  customHolidays.forEach(h => { customHolidayMap[h.holiday_date] = h.name; });

  // Build employee list
  const nameMap = new Map<string, { name: string; department: string | null; leaveTypes: Set<string> }>();
  leaves.forEach(l => {
    const leaveStart = parseISO(l.startDate);
    const leaveEnd = parseISO(l.endDate);
    const mStart = startOfMonth(currentMonth);
    const mEnd = endOfMonth(currentMonth);
    if (leaveEnd < mStart || leaveStart > mEnd) return;
    if (!nameMap.has(l.employeeName)) {
      nameMap.set(l.employeeName, { name: l.employeeName, department: l.department, leaveTypes: new Set() });
    }
    nameMap.get(l.employeeName)!.leaveTypes.add(l.leaveType || 'co');
  });
  const employees = Array.from(nameMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  const getLeaveForDay = (employeeName: string, day: Date) => {
    return leaves.find(l =>
      l.employeeName === employeeName &&
      isWithinInterval(day, { start: parseISO(l.startDate), end: parseISO(l.endDate) })
    );
  };

  const DAY_ABBR: Record<number, string> = { 0: 'Dum', 1: 'Lun', 2: 'Mar', 3: 'Mie', 4: 'Joi', 5: 'Vin', 6: 'Sâm' };

  // ── Title row ──
  const titleRow = ws.addRow([`CALENDAR CONCEDII — ${monthName.toUpperCase()}${departmentFilter !== 'all' ? ` — ${departmentFilter}` : ''}`]);
  titleRow.font = { bold: true, size: 14, name: 'Arial' };
  ws.mergeCells(1, 1, 1, days.length + 2);
  titleRow.alignment = { horizontal: 'center', vertical: 'middle' };
  titleRow.height = 24;

  // ── Header row 1: Nr | ANGAJAT | TIP | day numbers ──
  const headerValues = ['Nr.', 'ANGAJAT', 'TIP', ...days.map(d => parseInt(format(d, 'dd')))];
  const headerRow = ws.addRow(headerValues);
  headerRow.font = { bold: true, size: 9, name: 'Arial' };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  headerRow.height = 28;

  // ── Header row 2: day abbreviations ──
  const dayAbbrValues = ['', '', '', ...days.map(d => DAY_ABBR[getDay(d)])];
  const abbrRow = ws.addRow(dayAbbrValues);
  abbrRow.font = { size: 8, name: 'Arial' };
  abbrRow.alignment = { horizontal: 'center', vertical: 'middle' };
  abbrRow.height = 16;

  // Style header columns
  const WEEKEND_FILL: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F5F5F5' } };
  const HOLIDAY_FILL: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEE2E2' } };
  const CUSTOM_HOLIDAY_FILL: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF3C7' } };
  const HEADER_FILL: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };

  // Set column widths
  ws.getColumn(1).width = 4;   // Nr
  ws.getColumn(2).width = 28;  // ANGAJAT
  ws.getColumn(3).width = 6;   // TIP

  for (let i = 0; i < days.length; i++) {
    const col = i + 4;
    ws.getColumn(col).width = 4.5;
    const day = days[i];
    const weekend = isWeekend(day);
    const pubHoliday = isPublicHoliday(day);
    const dateStr = format(day, 'yyyy-MM-dd');
    const customH = customHolidayMap[dateStr];

    // Apply fill to header cells
    const fill = pubHoliday ? HOLIDAY_FILL : customH ? CUSTOM_HOLIDAY_FILL : weekend ? WEEKEND_FILL : HEADER_FILL;
    headerRow.getCell(col).fill = fill;
    abbrRow.getCell(col).fill = fill;

    // Color weekend day abbreviations
    if (weekend) {
      abbrRow.getCell(col).font = { size: 8, name: 'Arial', color: { argb: 'EA580C' } };
    } else if (pubHoliday) {
      abbrRow.getCell(col).font = { size: 8, name: 'Arial', color: { argb: 'DC2626' } };
    }
  }

  // Style header row 1 fixed cols
  for (let c = 1; c <= 3; c++) {
    headerRow.getCell(c).fill = HEADER_FILL;
    abbrRow.getCell(c).fill = HEADER_FILL;
  }

  // ── Data rows ──
  employees.forEach((emp, idx) => {
    const types = Array.from(emp.leaveTypes).map(lt => getLeaveStyle(lt)?.label || lt.toUpperCase()).join(', ');
    const rowValues: (string | number)[] = [idx + 1, emp.name, types];

    days.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const weekend = isWeekend(day);
      const pubHoliday = isPublicHoliday(day);
      const customH = customHolidayMap[dateStr];
      const isOff = weekend || pubHoliday || !!customH;
      const leave = isOff ? null : getLeaveForDay(emp.name, day);

      if (leave) {
        const style = getLeaveStyle(leave.leaveType);
        rowValues.push(style?.label || 'CO');
      } else {
        rowValues.push('');
      }
    });

    const row = ws.addRow(rowValues);
    row.font = { size: 9, name: 'Arial' };
    row.alignment = { horizontal: 'center', vertical: 'middle' };
    row.height = 18;

    // Name column left-aligned
    row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(2).font = { size: 9, name: 'Arial', bold: true };

    // Alternate row coloring
    if (idx % 2 === 1) {
      for (let c = 1; c <= 3; c++) {
        row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
      }
    }

    // Style day cells
    days.forEach((day, i) => {
      const col = i + 4;
      const cell = row.getCell(col);
      const dateStr = format(day, 'yyyy-MM-dd');
      const weekend = isWeekend(day);
      const pubHoliday = isPublicHoliday(day);
      const customH = customHolidayMap[dateStr];
      const isOff = weekend || pubHoliday || !!customH;
      const leave = isOff ? null : getLeaveForDay(emp.name, day);

      if (leave) {
        const colors = getExcelLeaveColor(leave.leaveType);
        cell.font = { size: 8, name: 'Arial', bold: true, color: { argb: colors.font } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.fill } };
      } else if (pubHoliday) {
        cell.fill = HOLIDAY_FILL;
      } else if (customH) {
        cell.fill = CUSTOM_HOLIDAY_FILL;
      } else if (weekend) {
        cell.fill = WEEKEND_FILL;
      } else if (idx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
      }
    });
  });

  // ── Borders for all data cells ──
  const lastRow = ws.rowCount;
  for (let r = 2; r <= lastRow; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= days.length + 3; c++) {
      row.getCell(c).border = {
        top: { style: 'thin', color: { argb: 'D1D5DB' } },
        bottom: { style: 'thin', color: { argb: 'D1D5DB' } },
        left: { style: 'thin', color: { argb: 'D1D5DB' } },
        right: { style: 'thin', color: { argb: 'D1D5DB' } },
      };
    }
  }

  // ── Legend ──
  ws.addRow([]);
  const legendTitleRow = ws.addRow(['LEGENDĂ']);
  legendTitleRow.font = { bold: true, size: 10, name: 'Arial' };

  // 4 items per row
  for (let i = 0; i < LEAVE_TYPES.length; i += 4) {
    const chunk = LEAVE_TYPES.slice(i, i + 4);
    const vals: string[] = [];
    chunk.forEach(lt => {
      vals.push(`${lt.label} - ${lt.description}`);
    });
    const row = ws.addRow(vals);
    row.font = { size: 8, name: 'Arial' };
  }

  // Generate and download
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const fileName = `Calendar_Concedii_${format(currentMonth, 'yyyy_MM')}${departmentFilter !== 'all' ? `_${departmentFilter}` : ''}.xlsx`;
  saveAs(blob, fileName);
}
