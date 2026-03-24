import { useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isWeekend, parseISO, isWithinInterval } from 'date-fns';
import { ro } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { isPublicHoliday, getPublicHolidayName } from '@/utils/romanianHolidays';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface CustomHoliday {
  id: string;
  holiday_date: string;
  name: string;
}

interface LeaveEntry {
  employeeName: string;
  department: string | null;
  startDate: string;
  endDate: string;
  numberOfDays: number;
  leaveType?: string;
  avatarUrl?: string | null;
  sourceYear?: number | null;
}

interface LeaveCalendarTableProps {
  currentMonth: Date;
  leaves: LeaveEntry[];
  customHolidays: CustomHoliday[];
}

import { LEAVE_TYPES, getLeaveStyle } from '@/utils/leaveTypes';

const DAY_ABBR: Record<number, string> = { 0: 'Dum', 1: 'Lun', 2: 'Mar', 3: 'Mie', 4: 'Joi', 5: 'Vin', 6: 'Sâm' };

const LeaveCalendarTable = ({ currentMonth, leaves, customHolidays }: LeaveCalendarTableProps) => {
  const days = useMemo(() => {
    return eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  }, [currentMonth]);

  const customHolidayMap = useMemo(() => {
    const map: Record<string, string> = {};
    customHolidays.forEach(h => { map[h.holiday_date] = h.name; });
    return map;
  }, [customHolidays]);

  // Unique employees with their leave types for the month
  const employees = useMemo(() => {
    const nameMap = new Map<string, { name: string; department: string | null; leaveTypes: Set<string>; avatarUrl: string | null; sourceYears: Set<number> }>();
    leaves.forEach(l => {
      const leaveStart = parseISO(l.startDate);
      const leaveEnd = parseISO(l.endDate);
      const mStart = startOfMonth(currentMonth);
      const mEnd = endOfMonth(currentMonth);
      if (leaveEnd < mStart || leaveStart > mEnd) return;
      
      if (!nameMap.has(l.employeeName)) {
        nameMap.set(l.employeeName, { name: l.employeeName, department: l.department, leaveTypes: new Set(), avatarUrl: l.avatarUrl || null, sourceYears: new Set() });
      }
      const entry = nameMap.get(l.employeeName)!;
      entry.leaveTypes.add(l.leaveType || 'co');
      if (l.sourceYear) entry.sourceYears.add(l.sourceYear);
      if (l.avatarUrl && !entry.avatarUrl) {
        entry.avatarUrl = l.avatarUrl;
      }
    });
    return Array.from(nameMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [leaves, currentMonth]);

  // Get leave info for a specific employee on a specific day
  const getLeaveForDay = (employeeName: string, day: Date) => {
    return leaves.find(l =>
      l.employeeName === employeeName &&
      isWithinInterval(day, { start: parseISO(l.startDate), end: parseISO(l.endDate) })
    );
  };

  return (
    <div className="space-y-4">
      <ScrollArea className="w-full">
        <div className="min-w-[800px]">
          <table className="w-full border-collapse text-xs">
            <thead>
              {/* Day numbers row */}
              <tr>
                <th className="sticky left-0 z-10 bg-background border border-border px-3 py-2 text-left font-semibold text-sm min-w-[190px]">
                  ANGAJAT
                </th>
                <th className="sticky left-[190px] z-10 bg-background border border-border px-2 py-2 text-center font-semibold text-sm min-w-[60px] w-[60px]">
                  TIP
                </th>
                <th className="sticky left-[250px] z-10 bg-background border border-border px-2 py-2 text-center font-semibold text-sm min-w-[50px] w-[50px]">
                  AN
                </th>
                {days.map((day) => {
                  const weekend = isWeekend(day);
                  const pubHoliday = isPublicHoliday(day);
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const customH = customHolidayMap[dateStr];
                  const isOff = weekend || pubHoliday || !!customH;

                  return (
                    <th
                      key={dateStr}
                      className={cn(
                        'border border-border px-1 py-1 text-center font-bold min-w-[38px] w-[38px]',
                        isOff && 'bg-muted/60',
                        pubHoliday && 'bg-red-500/10',
                        customH && !pubHoliday && 'bg-amber-500/10',
                      )}
                    >
                      <div className="text-[11px] leading-tight">{format(day, 'dd')}</div>
                      <div className={cn(
                        'text-[9px] leading-tight font-medium',
                        weekend ? 'text-orange-500' : pubHoliday ? 'text-red-500' : customH ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'
                      )}>
                        {DAY_ABBR[getDay(day)]}
                      </div>
                    </th>
                  );
                })}
              </tr>
              {/* Holiday names row - only if there are any holidays this month */}
              {days.some(d => isPublicHoliday(d) || !!customHolidayMap[format(d, 'yyyy-MM-dd')]) && (
                <tr>
                  <th className="sticky left-0 z-10 bg-background border border-border px-3 py-0.5"></th>
                  <th className="sticky left-[190px] z-10 bg-background border border-border px-2 py-0.5"></th>
                  <th className="sticky left-[250px] z-10 bg-background border border-border px-2 py-0.5"></th>
                  {days.map((day) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const pubName = getPublicHolidayName(day);
                    const customH = customHolidayMap[dateStr];
                    const name = pubName || customH;

                    return (
                      <th key={dateStr} className={cn(
                        'border border-border px-0.5 py-0.5 text-center',
                        pubName && 'bg-red-500/10',
                        customH && !pubName && 'bg-amber-500/10',
                      )}>
                        {name && (
                          <div className={cn(
                            'text-[7px] leading-tight font-medium writing-vertical',
                            pubName ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
                          )} title={name}>
                            {name.length > 12 ? name.substring(0, 12) + '…' : name}
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              )}
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={days.length + 2} className="border border-border px-4 py-8 text-center text-muted-foreground">
                    Nu există concedii înregistrate în această lună.
                  </td>
                </tr>
              ) : (
                employees.map((emp, idx) => (
                  <tr key={emp.name} className={cn(idx % 2 === 0 ? 'bg-background' : 'bg-muted/30')}>
                    <td className="sticky left-0 z-10 border border-border px-3 py-2 font-medium text-xs whitespace-nowrap bg-inherit">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-[10px] w-4">{idx + 1}</span>
                        <Avatar className="w-6 h-6 flex-shrink-0">
                          {emp.avatarUrl && <AvatarImage src={emp.avatarUrl} alt={emp.name} />}
                          <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
                            {emp.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-semibold text-foreground">{emp.name}</div>
                          {emp.department && <div className="text-[10px] text-muted-foreground">{emp.department}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="sticky left-[190px] z-10 border border-border px-1 py-1 text-center bg-inherit">
                      <div className="flex flex-col items-center gap-0.5">
                        {Array.from(emp.leaveTypes).map(lt => {
                          const style = getLeaveStyle(lt);
                          return (
                            <span key={lt} className={cn('font-bold text-[9px] px-1 py-0.5 rounded', style.color, style.bg)}>
                              {style.label}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    {days.map((day) => {
                      const dateStr = format(day, 'yyyy-MM-dd');
                      const weekend = isWeekend(day);
                      const pubHoliday = isPublicHoliday(day);
                      const customH = customHolidayMap[dateStr];
                      const isOff = weekend || pubHoliday || !!customH;
                      const leave = isOff ? null : getLeaveForDay(emp.name, day);
                      const leaveStyle = leave ? getLeaveStyle(leave.leaveType) : null;

                      return (
                        <td
                          key={dateStr}
                          className={cn(
                            'border border-border text-center py-1.5 px-0.5 transition-colors',
                            isOff && !leave && 'bg-muted/50',
                            pubHoliday && !leave && 'bg-red-500/8',
                            customH && !pubHoliday && !leave && 'bg-amber-500/8',
                            leave && leaveStyle?.bg,
                          )}
                          title={leave ? `${emp.name}: ${leaveStyle?.label || 'CO'}` : undefined}
                        >
                          {leave && (
                            <span className={cn('font-bold text-[10px]', leaveStyle?.color)}>
                              {leaveStyle?.label || 'CO'}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Legend */}
      <div className="border-t pt-3 space-y-2">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          {LEAVE_TYPES.map(item => (
            <div key={item.key} className="flex items-center gap-1.5">
              <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${item.color} ${item.colorDark} ${item.bg}`}>{item.label}</span>
              <span className="truncate">{item.description}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground border-t pt-2 mt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-3 rounded-sm bg-red-500/15 border border-red-500/20" />
            <span>Sărbătoare legală</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-3 rounded-sm bg-amber-500/15 border border-amber-500/20" />
            <span>Zi liberă instituție</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-3 rounded-sm bg-muted/60 border border-border" />
            <span>Weekend</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaveCalendarTable;
