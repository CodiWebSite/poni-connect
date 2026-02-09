import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Users } from 'lucide-react';
import { format, addMonths, subMonths, parseISO, isWithinInterval, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isWeekend, isToday } from 'date-fns';
import { ro } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { isPublicHoliday, getPublicHolidayName } from '@/utils/romanianHolidays';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface DepartmentLeave {
  employeeName: string;
  startDate: string;
  endDate: string;
  leaveType?: string;
  isCurrentUser: boolean;
}

const LEAVE_TYPE_MAP: Record<string, { label: string; color: string; bg: string }> = {
  'co': { label: 'CO', color: 'text-sky-700 dark:text-sky-300', bg: 'bg-sky-500/20' },
  'concediu_odihna': { label: 'CO', color: 'text-sky-700 dark:text-sky-300', bg: 'bg-sky-500/20' },
  'bo': { label: 'BO', color: 'text-rose-700 dark:text-rose-300', bg: 'bg-rose-500/20' },
  'concediu_medical': { label: 'BO', color: 'text-rose-700 dark:text-rose-300', bg: 'bg-rose-500/20' },
  'ccc': { label: 'CCC', color: 'text-purple-700 dark:text-purple-300', bg: 'bg-purple-500/20' },
  'cfp': { label: 'CFP', color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-500/20' },
  'concediu_fara_plata': { label: 'CFP', color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-500/20' },
  'ev': { label: 'EV', color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-500/20' },
};

const DEFAULT_LEAVE = { label: 'CO', color: 'text-sky-700 dark:text-sky-300', bg: 'bg-sky-500/20' };
const DAY_ABBR: Record<number, string> = { 0: 'Dum', 1: 'Lun', 2: 'Mar', 3: 'Mie', 4: 'Joi', 5: 'Vin', 6: 'Sâm' };

function getLeaveStyle(leaveType?: string) {
  if (!leaveType) return DEFAULT_LEAVE;
  return LEAVE_TYPE_MAP[leaveType.toLowerCase().trim()] || DEFAULT_LEAVE;
}

const PersonalCalendarWidget = () => {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [leaves, setLeaves] = useState<DepartmentLeave[]>([]);
  const [customHolidays, setCustomHolidays] = useState<Record<string, string>>({});
  const [department, setDepartment] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchData();
  }, [user, currentMonth]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    // Get current user's profile for department
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, department')
      .eq('user_id', user.id)
      .single();

    const userDept = profile?.department || null;
    setDepartment(userDept);

    // Fetch custom holidays
    const { data: holidays } = await supabase.from('custom_holidays').select('holiday_date, name');
    const holidayMap: Record<string, string> = {};
    (holidays || []).forEach(h => { holidayMap[h.holiday_date] = h.name; });
    setCustomHolidays(holidayMap);

    // Fetch all approved leaves
    const { data: allLeaves } = await supabase
      .from('hr_requests')
      .select('user_id, details')
      .eq('request_type', 'concediu')
      .eq('status', 'approved');

    // Fetch profiles for department matching
    const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, department');
    const { data: epdData } = await supabase
      .from('employee_personal_data').select('id, first_name, last_name, department').eq('is_archived', false);

    const profileMap: Record<string, { name: string; department: string | null }> = {};
    (profiles || []).forEach(p => { profileMap[p.user_id] = { name: p.full_name, department: p.department }; });
    const epdMap: Record<string, { name: string; department: string | null }> = {};
    (epdData || []).forEach(e => { epdMap[e.id] = { name: `${e.last_name} ${e.first_name}`, department: e.department }; });

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    const entries: DepartmentLeave[] = [];
    (allLeaves || []).forEach((lr: any) => {
      const d = lr.details || {};
      if (!d.startDate || !d.endDate) return;
      const leaveStart = parseISO(d.startDate);
      const leaveEnd = parseISO(d.endDate);
      if (leaveEnd < monthStart || leaveStart > monthEnd) return;

      let empInfo: { name: string; department: string | null } | undefined;
      if (d.epd_id && epdMap[d.epd_id]) empInfo = epdMap[d.epd_id];
      else if (lr.user_id && profileMap[lr.user_id]) empInfo = profileMap[lr.user_id];
      else if (d.employee_name) empInfo = { name: d.employee_name, department: null };

      if (!empInfo) return;

      const isCurrentUser = lr.user_id === user.id;
      // Show if: it's the current user OR same department
      if (isCurrentUser || (userDept && empInfo.department === userDept)) {
        entries.push({
          employeeName: empInfo.name,
          startDate: d.startDate,
          endDate: d.endDate,
          leaveType: d.leaveType || d.leave_type || 'co',
          isCurrentUser,
        });
      }
    });

    entries.sort((a, b) => {
      if (a.isCurrentUser && !b.isCurrentUser) return -1;
      if (!a.isCurrentUser && b.isCurrentUser) return 1;
      return a.employeeName.localeCompare(b.employeeName);
    });

    setLeaves(entries);
    setLoading(false);
  };

  const days = useMemo(() => {
    return eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  }, [currentMonth]);

  // Unique employees in leaves
  const employees = useMemo(() => {
    const seen = new Set<string>();
    return leaves.filter(l => {
      if (seen.has(l.employeeName)) return false;
      seen.add(l.employeeName);
      return true;
    });
  }, [leaves]);

  const getLeaveForDay = (employeeName: string, day: Date) => {
    return leaves.find(l =>
      l.employeeName === employeeName &&
      isWithinInterval(day, { start: parseISO(l.startDate), end: parseISO(l.endDate) })
    );
  };

  const colleaguesOnLeaveToday = useMemo(() => {
    const today = new Date();
    return [...new Set(
      leaves.filter(l => !l.isCurrentUser && isWithinInterval(today, { start: parseISO(l.startDate), end: parseISO(l.endDate) }))
        .map(l => l.employeeName)
    )];
  }, [leaves]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <CalendarIcon className="w-4 h-4 text-primary" />
            Calendar {department ? `— ${department}` : ''}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs font-semibold capitalize px-2" onClick={() => setCurrentMonth(new Date())}>
              {format(currentMonth, 'MMM yyyy', { locale: ro })}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <ScrollArea className="w-full">
            <div className="min-w-[500px]">
              <table className="w-full border-collapse text-[10px]">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-background border border-border px-2 py-1 text-left font-semibold min-w-[100px]">
                    </th>
                    {days.map(day => {
                      const weekend = isWeekend(day);
                      const pubH = isPublicHoliday(day);
                      const dateStr = format(day, 'yyyy-MM-dd');
                      const customH = customHolidays[dateStr];
                      const isOff = weekend || pubH || !!customH;
                      const today = isToday(day);
                      return (
                        <th key={dateStr} className={cn(
                          'border border-border px-0.5 py-0.5 text-center min-w-[24px] w-[24px]',
                          isOff && 'bg-muted/60',
                          pubH && 'bg-red-500/10',
                          customH && !pubH && 'bg-amber-500/10',
                          today && 'ring-1 ring-primary ring-inset',
                        )}>
                          <div className="text-[9px] leading-tight font-bold">{format(day, 'dd')}</div>
                          <div className={cn(
                            'text-[7px] leading-tight',
                            weekend ? 'text-orange-500' : pubH ? 'text-red-500' : 'text-muted-foreground'
                          )}>
                            {DAY_ABBR[getDay(day)]?.charAt(0)}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {employees.length === 0 ? (
                    <tr>
                      <td colSpan={days.length + 1} className="border border-border px-3 py-4 text-center text-muted-foreground text-xs">
                        Nu sunt concedii în departamentul tău luna aceasta.
                      </td>
                    </tr>
                  ) : (
                    employees.map((emp, idx) => (
                      <tr key={emp.employeeName} className={cn(emp.isCurrentUser && 'bg-primary/5')}>
                        <td className={cn(
                          'sticky left-0 z-10 border border-border px-2 py-1 text-[10px] whitespace-nowrap bg-inherit',
                          emp.isCurrentUser ? 'font-bold text-primary' : 'font-medium'
                        )}>
                          {emp.isCurrentUser ? '→ Tu' : emp.employeeName.split(' ').slice(0, 2).join(' ')}
                        </td>
                        {days.map(day => {
                          const dateStr = format(day, 'yyyy-MM-dd');
                          const weekend = isWeekend(day);
                          const pubH = isPublicHoliday(day);
                          const customH = customHolidays[dateStr];
                          const isOff = weekend || pubH || !!customH;
                          const leave = getLeaveForDay(emp.employeeName, day);
                          const style = leave ? getLeaveStyle(leave.leaveType) : null;

                          return (
                            <td key={dateStr} className={cn(
                              'border border-border text-center py-0.5 px-0',
                              isOff && !leave && 'bg-muted/40',
                              pubH && !leave && 'bg-red-500/8',
                              leave && style?.bg,
                            )} title={leave ? `${emp.employeeName}: ${style?.label}` : undefined}>
                              {leave && (
                                <span className={cn('font-bold text-[8px]', style?.color)}>
                                  {style?.label}
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
        )}

        {/* Colleagues on leave today */}
        {colleaguesOnLeaveToday.length > 0 && (
          <div className="mt-2 p-2 rounded-md bg-muted/60 border">
            <p className="text-[10px] font-medium flex items-center gap-1 mb-1">
              <Users className="w-3 h-3" />
              Colegi în concediu azi:
            </p>
            <div className="flex flex-wrap gap-1">
              {colleaguesOnLeaveToday.map(name => (
                <Badge key={name} variant="secondary" className="text-[9px] h-5">{name}</Badge>
              ))}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[9px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <span className="font-bold text-sky-600 bg-sky-500/20 px-1 rounded text-[8px]">CO</span>
            <span>Concediu de odihnă</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-bold text-rose-600 bg-rose-500/20 px-1 rounded text-[8px]">BO</span>
            <span>Concediu medical</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-bold text-purple-600 bg-purple-500/20 px-1 rounded text-[8px]">CCC</span>
            <span>Creștere copil</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-bold text-amber-600 bg-amber-500/20 px-1 rounded text-[8px]">CFP</span>
            <span>Fără plată</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-bold text-emerald-600 bg-emerald-500/20 px-1 rounded text-[8px]">EV</span>
            <span>Eveniment</span>
          </div>
          <div className="border-l pl-2 flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div className="w-3 h-2 rounded-sm bg-red-500/15" />
              <span>Sărbătoare</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-2 rounded-sm bg-amber-500/15" />
              <span>Zi liberă</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PersonalCalendarWidget;
