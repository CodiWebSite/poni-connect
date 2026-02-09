import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, isSameMonth, addMonths, subMonths, isWithinInterval, parseISO, isSameDay } from 'date-fns';
import { ro } from 'date-fns/locale';

// Romanian public holidays for 2025-2030 (fixed + variable Orthodox Easter/Rusalii)
const PUBLIC_HOLIDAYS: Record<number, string[]> = {
  2025: [
    '2025-01-01','2025-01-02','2025-01-06','2025-01-07','2025-01-24',
    '2025-04-18','2025-04-19','2025-04-20','2025-04-21',
    '2025-05-01','2025-06-01','2025-06-08','2025-06-09',
    '2025-08-15','2025-11-30','2025-12-01','2025-12-25','2025-12-26',
  ],
  2026: [
    '2026-01-01','2026-01-02','2026-01-06','2026-01-07','2026-01-24',
    '2026-04-10','2026-04-11','2026-04-12','2026-04-13',
    '2026-05-01','2026-05-31','2026-06-01',
    '2026-08-15','2026-11-30','2026-12-01','2026-12-25','2026-12-26',
  ],
  2027: [
    '2027-01-01','2027-01-02','2027-01-06','2027-01-07','2027-01-24',
    '2027-05-01','2027-05-02','2027-05-03','2027-05-04',
    '2027-06-01','2027-06-20','2027-06-21',
    '2027-08-15','2027-11-30','2027-12-01','2027-12-25','2027-12-26',
  ],
};

const HOLIDAY_NAMES: Record<string, string> = {
  '01-01': 'Anul Nou', '01-02': 'Anul Nou', '01-06': 'Boboteaza', '01-07': 'Sf. Ioan',
  '01-24': 'Ziua Unirii', '05-01': 'Ziua Muncii', '06-01': 'Ziua Copilului',
  '08-15': 'Adormirea Maicii Domnului', '11-30': 'Sf. Andrei',
  '12-01': 'Ziua Națională', '12-25': 'Crăciunul', '12-26': 'Crăciunul',
};

function isPublicHoliday(day: Date): boolean {
  const year = day.getFullYear();
  const dateStr = format(day, 'yyyy-MM-dd');
  return PUBLIC_HOLIDAYS[year]?.includes(dateStr) ?? false;
}

function getHolidayName(day: Date): string | null {
  const dateStr = format(day, 'yyyy-MM-dd');
  const year = day.getFullYear();
  if (!PUBLIC_HOLIDAYS[year]?.includes(dateStr)) return null;
  const mmdd = format(day, 'MM-dd');
  return HOLIDAY_NAMES[mmdd] || 'Sărbătoare legală';
}

interface LeaveEntry {
  employeeName: string;
  department: string | null;
  startDate: string;
  endDate: string;
  numberOfDays: number;
}

const LeaveCalendar = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [leaves, setLeaves] = useState<LeaveEntry[]>([]);

  useEffect(() => {
    fetchLeaves();
  }, [currentMonth]);

  const fetchLeaves = async () => {
    setLoading(true);
    const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

    // Fetch all approved leaves
    const { data: allLeaves } = await supabase
      .from('hr_requests')
      .select('user_id, details, status')
      .eq('request_type', 'concediu')
      .eq('status', 'approved');

    // Fetch profiles for names
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, department');

    // Fetch employee_personal_data for epd-based leaves
    const { data: epdData } = await supabase
      .from('employee_personal_data')
      .select('id, first_name, last_name, department')
      .eq('is_archived', false);

    const profileMap: Record<string, { name: string; department: string | null }> = {};
    (profiles || []).forEach(p => {
      profileMap[p.user_id] = { name: p.full_name, department: p.department };
    });
    const epdMap: Record<string, { name: string; department: string | null }> = {};
    (epdData || []).forEach(e => {
      epdMap[e.id] = { name: `${e.last_name} ${e.first_name}`, department: e.department };
    });

    const entries: LeaveEntry[] = [];
    (allLeaves || []).forEach((lr: any) => {
      const d = lr.details || {};
      if (!d.startDate || !d.endDate) return;

      // Check if this leave overlaps with current month
      const leaveStart = parseISO(d.startDate);
      const leaveEnd = parseISO(d.endDate);
      const mStart = startOfMonth(currentMonth);
      const mEnd = endOfMonth(currentMonth);

      if (leaveEnd < mStart || leaveStart > mEnd) return;

      let empInfo: { name: string; department: string | null } | undefined;
      if (d.epd_id && epdMap[d.epd_id]) {
        empInfo = epdMap[d.epd_id];
      } else if (lr.user_id && profileMap[lr.user_id]) {
        empInfo = profileMap[lr.user_id];
      } else if (d.employee_name) {
        empInfo = { name: d.employee_name, department: null };
      }

      if (empInfo) {
        entries.push({
          employeeName: empInfo.name,
          department: empInfo.department,
          startDate: d.startDate,
          endDate: d.endDate,
          numberOfDays: d.numberOfDays || 0,
        });
      }
    });

    // Sort by employee name
    entries.sort((a, b) => a.employeeName.localeCompare(b.employeeName));

    // Deduplicate by employee + period
    const unique = entries.filter((e, i, arr) =>
      arr.findIndex(x => x.employeeName === e.employeeName && x.startDate === e.startDate && x.endDate === e.endDate) === i
    );

    setLeaves(unique);
    setLoading(false);
  };

  const days = useMemo(() => {
    return eachDayOfInterval({
      start: startOfMonth(currentMonth),
      end: endOfMonth(currentMonth),
    });
  }, [currentMonth]);

  // Group leaves by employee (an employee can have multiple leave periods)
  const employeeLeaves = useMemo(() => {
    const map = new Map<string, LeaveEntry[]>();
    leaves.forEach(l => {
      if (!map.has(l.employeeName)) map.set(l.employeeName, []);
      map.get(l.employeeName)!.push(l);
    });
    return Array.from(map.entries()).map(([name, entries]) => ({
      name,
      department: entries[0].department,
      entries,
    }));
  }, [leaves]);

  const isOnLeave = (entries: LeaveEntry[], day: Date) => {
    return entries.some(e => {
      const start = parseISO(e.startDate);
      const end = parseISO(e.endDate);
      return isWithinInterval(day, { start, end });
    });
  };

  // Color palette for visual variety
  const colors = [
    'bg-chart-1/30 border-chart-1/50',
    'bg-chart-2/30 border-chart-2/50',
    'bg-chart-3/30 border-chart-3/50',
    'bg-chart-4/30 border-chart-4/50',
    'bg-chart-5/30 border-chart-5/50',
  ];

  const onLeaveToday = useMemo(() => {
    const today = new Date();
    return leaves.filter(l => {
      const start = parseISO(l.startDate);
      const end = parseISO(l.endDate);
      return isWithinInterval(today, { start, end });
    });
  }, [leaves]);

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            Calendar Concedii
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              className="min-w-[180px] font-semibold capitalize"
              onClick={() => setCurrentMonth(new Date())}
            >
              {format(currentMonth, 'MMMM yyyy', { locale: ro })}
            </Button>
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Today summary */}
        {onLeaveToday.length > 0 && (
          <div className="mt-3 p-3 rounded-lg bg-muted border">
            <p className="text-sm font-medium mb-1">
              Astăzi în concediu ({onLeaveToday.length}):
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[...new Set(onLeaveToday.map(l => l.employeeName))].map(name => (
                <Badge key={name} variant="secondary" className="text-xs">{name}</Badge>
              ))}
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : employeeLeaves.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nu există concedii în {format(currentMonth, 'MMMM yyyy', { locale: ro })}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Header row with day numbers */}
              <div className="flex border-b border-border sticky top-0 bg-background z-10">
                <div className="w-[180px] shrink-0 p-2 text-xs font-semibold text-muted-foreground border-r border-border">
                  Angajat
                </div>
                <div className="flex flex-1">
                  {days.map((day, i) => {
                    const weekend = isWeekend(day);
                    const holiday = isPublicHoliday(day);
                    const holidayName = getHolidayName(day);
                    const dayOff = weekend || holiday;
                    return (
                      <div
                        key={i}
                        className={`flex-1 min-w-[28px] p-1 text-center border-r border-border last:border-r-0 ${
                          holiday ? 'bg-destructive/10' : weekend ? 'bg-muted/50' : ''
                        }`}
                        title={holidayName || undefined}
                      >
                        <span className={`text-[10px] font-medium ${holiday ? 'text-destructive' : weekend ? 'text-muted-foreground' : 'text-foreground'}`}>
                          {format(day, 'EEE', { locale: ro }).charAt(0).toUpperCase()}
                        </span>
                        <br />
                        <span className={`text-xs font-semibold ${holiday ? 'text-destructive' : weekend ? 'text-muted-foreground' : 'text-foreground'}`}>
                          {format(day, 'd')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Employee rows */}
              {employeeLeaves.map((emp, empIdx) => (
                <div key={emp.name} className="flex border-b border-border last:border-b-0 hover:bg-muted/20 transition-colors">
                  <div className="w-[180px] shrink-0 p-2 border-r border-border">
                    <p className="text-xs font-medium truncate" title={emp.name}>{emp.name}</p>
                    {emp.department && (
                      <p className="text-[10px] text-muted-foreground truncate">{emp.department}</p>
                    )}
                  </div>
                  <div className="flex flex-1">
                    {days.map((day, dayIdx) => {
                      const weekend = isWeekend(day);
                      const holiday = isPublicHoliday(day);
                      const dayOff = weekend || holiday;
                      const onLeave = isOnLeave(emp.entries, day);
                      const colorClass = colors[empIdx % colors.length];

                      return (
                        <div
                          key={dayIdx}
                          className={`flex-1 min-w-[28px] h-[36px] border-r border-border last:border-r-0 ${
                            holiday && !onLeave ? 'bg-destructive/8' : weekend ? 'bg-muted/30' : ''
                          } ${onLeave && !dayOff ? colorClass + ' border-y' : ''}`}
                          title={onLeave ? `${emp.name} - Concediu` : getHolidayName(day) || ''}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Summary row */}
              <div className="flex border-t-2 border-border bg-muted/20">
                <div className="w-[180px] shrink-0 p-2 border-r border-border">
                  <p className="text-xs font-semibold text-muted-foreground">Total în concediu</p>
                </div>
                <div className="flex flex-1">
                  {days.map((day, dayIdx) => {
                    const weekend = isWeekend(day);
                    const holiday = isPublicHoliday(day);
                    const dayOff = weekend || holiday;
                    const count = employeeLeaves.filter(emp => isOnLeave(emp.entries, day)).length;
                    return (
                      <div
                        key={dayIdx}
                        className={`flex-1 min-w-[28px] h-[36px] border-r border-border last:border-r-0 flex items-center justify-center ${
                          holiday ? 'bg-destructive/8' : weekend ? 'bg-muted/30' : ''
                        }`}
                      >
                        {count > 0 && !dayOff && (
                          <span className={`text-[10px] font-bold ${count >= 3 ? 'text-destructive' : 'text-muted-foreground'}`}>
                            {count}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Legend */}
        {employeeLeaves.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground border-t pt-3">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded-sm bg-chart-1/30 border border-chart-1/50" />
              <span>Perioadă concediu</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded-sm bg-destructive/10 border border-destructive/20" />
              <span>Sărbătoare legală</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded-sm bg-muted/50" />
              <span>Weekend</span>
            </div>
            <span className="ml-auto">{employeeLeaves.length} angajați cu concedii în {format(currentMonth, 'MMMM yyyy', { locale: ro })}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LeaveCalendar;
