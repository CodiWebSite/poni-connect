import { useState, useEffect, useMemo } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Users, Calendar as CalendarIcon } from 'lucide-react';
import { format, addMonths, subMonths, parseISO, isWithinInterval, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isWeekend, isToday } from 'date-fns';
import { ro } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { isPublicHoliday, getPublicHolidayName } from '@/utils/romanianHolidays';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface DepartmentLeave {
  employeeName: string;
  startDate: string;
  endDate: string;
  leaveType?: string;
  isCurrentUser: boolean;
}

const LEAVE_TYPE_MAP: Record<string, { label: string; color: string; bg: string; bgSolid: string }> = {
  'co': { label: 'CO', color: 'text-sky-700 dark:text-sky-300', bg: 'bg-sky-500/20', bgSolid: 'bg-sky-100 dark:bg-sky-900/40' },
  'concediu_odihna': { label: 'CO', color: 'text-sky-700 dark:text-sky-300', bg: 'bg-sky-500/20', bgSolid: 'bg-sky-100 dark:bg-sky-900/40' },
  'bo': { label: 'BO', color: 'text-rose-700 dark:text-rose-300', bg: 'bg-rose-500/20', bgSolid: 'bg-rose-100 dark:bg-rose-900/40' },
  'concediu_medical': { label: 'BO', color: 'text-rose-700 dark:text-rose-300', bg: 'bg-rose-500/20', bgSolid: 'bg-rose-100 dark:bg-rose-900/40' },
  'ccc': { label: 'CCC', color: 'text-purple-700 dark:text-purple-300', bg: 'bg-purple-500/20', bgSolid: 'bg-purple-100 dark:bg-purple-900/40' },
  'cfp': { label: 'CFP', color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-500/20', bgSolid: 'bg-amber-100 dark:bg-amber-900/40' },
  'concediu_fara_plata': { label: 'CFP', color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-500/20', bgSolid: 'bg-amber-100 dark:bg-amber-900/40' },
  'ev': { label: 'EV', color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-500/20', bgSolid: 'bg-emerald-100 dark:bg-emerald-900/40' },
};

const DEFAULT_LEAVE = { label: 'CO', color: 'text-sky-700 dark:text-sky-300', bg: 'bg-sky-500/20', bgSolid: 'bg-sky-100 dark:bg-sky-900/40' };

const DAY_NAMES: Record<number, string> = { 0: 'Dum', 1: 'Lun', 2: 'Mar', 3: 'Mie', 4: 'Joi', 5: 'Vin', 6: 'Sâm' };

function getLeaveStyle(leaveType?: string) {
  if (!leaveType) return DEFAULT_LEAVE;
  return LEAVE_TYPE_MAP[leaveType.toLowerCase().trim()] || DEFAULT_LEAVE;
}

const LeaveCalendar = () => {
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

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, department')
      .eq('user_id', user.id)
      .single();

    const userDept = profile?.department || null;
    setDepartment(userDept);

    const { data: holidays } = await supabase.from('custom_holidays').select('holiday_date, name');
    const holidayMap: Record<string, string> = {};
    (holidays || []).forEach(h => { holidayMap[h.holiday_date] = h.name; });
    setCustomHolidays(holidayMap);

    const { data: allLeaves } = await supabase
      .from('hr_requests')
      .select('user_id, details')
      .eq('request_type', 'concediu')
      .eq('status', 'approved');

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
    <MainLayout title="Calendar Concedii" description={department ? `Departament: ${department}` : 'Vizualizare concedii departament'}>
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <CalendarIcon className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-display font-bold text-foreground capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: ro })}
            </h2>
            <p className="text-sm text-muted-foreground">
              {employees.length} {employees.length === 1 ? 'coleg' : 'colegi'} cu concediu
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())} className="font-medium">
            Azi
          </Button>
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Colleagues on leave today */}
      {colleaguesOnLeaveToday.length > 0 && (
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <p className="text-sm font-semibold flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-primary" />
              Colegi în concediu azi — {format(new Date(), 'd MMMM', { locale: ro })}
            </p>
            <div className="flex flex-wrap gap-2">
              {colleaguesOnLeaveToday.map(name => (
                <Badge key={name} variant="secondary" className="text-xs">{name}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main calendar table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <ScrollArea className="w-full">
              <div className="min-w-[700px]">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-20 bg-muted border border-border px-4 py-3 text-left font-semibold min-w-[160px]">
                        Angajat
                      </th>
                      {days.map(day => {
                        const weekend = isWeekend(day);
                        const pubH = isPublicHoliday(day);
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const customH = customHolidays[dateStr];
                        const isOff = weekend || pubH || !!customH;
                        const today = isToday(day);
                        const holidayName = pubH ? getPublicHolidayName(day) : customH || null;

                        return (
                          <Tooltip key={dateStr}>
                            <TooltipTrigger asChild>
                              <th className={cn(
                                'border border-border px-0 py-2 text-center min-w-[36px] w-[36px] transition-colors',
                                isOff && 'bg-muted/70',
                                pubH && 'bg-red-500/10',
                                customH && !pubH && 'bg-amber-500/10',
                                today && 'ring-2 ring-primary ring-inset bg-primary/5',
                              )}>
                                <div className="text-xs font-bold leading-tight">{format(day, 'dd')}</div>
                                <div className={cn(
                                  'text-[10px] leading-tight font-medium',
                                  weekend ? 'text-orange-500' : pubH ? 'text-red-500' : 'text-muted-foreground'
                                )}>
                                  {DAY_NAMES[getDay(day)]}
                                </div>
                              </th>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              <p className="font-medium">{format(day, 'EEEE, d MMMM yyyy', { locale: ro })}</p>
                              {holidayName && <p className="text-red-500">{holidayName}</p>}
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {employees.length === 0 ? (
                      <tr>
                        <td colSpan={days.length + 1} className="border border-border px-6 py-16 text-center">
                          <CalendarIcon className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
                          <p className="text-muted-foreground font-medium">Nu sunt concedii în departamentul tău luna aceasta.</p>
                          <p className="text-xs text-muted-foreground mt-1">Concediile aprobate vor fi afișate aici automat.</p>
                        </td>
                      </tr>
                    ) : (
                      employees.map((emp) => (
                        <tr key={emp.employeeName} className={cn(
                          'transition-colors hover:bg-muted/30',
                          emp.isCurrentUser && 'bg-primary/5 hover:bg-primary/10'
                        )}>
                          <td className={cn(
                            'sticky left-0 z-10 border border-border px-4 py-2.5 whitespace-nowrap bg-inherit',
                            emp.isCurrentUser ? 'font-bold text-primary' : 'font-medium text-foreground'
                          )}>
                            <div className="flex items-center gap-2">
                              {emp.isCurrentUser && (
                                <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                              )}
                              <span>{emp.isCurrentUser ? 'Tu' : emp.employeeName}</span>
                            </div>
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
                                'border border-border text-center py-1.5 px-0 transition-colors',
                                isOff && !leave && 'bg-muted/50',
                                pubH && !leave && 'bg-red-500/8',
                                leave && style?.bgSolid,
                              )}>
                                {leave && (
                                  <span className={cn('font-bold text-xs', style?.color)}>
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
        </CardContent>
      </Card>

      {/* Legend */}
      <Card className="mt-4">
        <CardContent className="p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Legendă</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {[
              { label: 'CO', desc: 'Concediu de odihnă', color: 'text-sky-600', bg: 'bg-sky-500/20' },
              { label: 'BO', desc: 'Concediu medical', color: 'text-rose-600', bg: 'bg-rose-500/20' },
              { label: 'CCC', desc: 'Creștere copil', color: 'text-purple-600', bg: 'bg-purple-500/20' },
              { label: 'CFP', desc: 'Fără plată', color: 'text-amber-600', bg: 'bg-amber-500/20' },
              { label: 'EV', desc: 'Eveniment', color: 'text-emerald-600', bg: 'bg-emerald-500/20' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-1.5 text-sm">
                <span className={cn('font-bold px-1.5 py-0.5 rounded text-xs', item.color, item.bg)}>{item.label}</span>
                <span className="text-muted-foreground">{item.desc}</span>
              </div>
            ))}
            <div className="border-l border-border pl-4 flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-sm">
                <div className="w-4 h-3 rounded bg-red-500/15 border border-red-500/20" />
                <span className="text-muted-foreground">Sărbătoare legală</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                <div className="w-4 h-3 rounded bg-amber-500/15 border border-amber-500/20" />
                <span className="text-muted-foreground">Zi liberă</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </MainLayout>
  );
};

export default LeaveCalendar;
