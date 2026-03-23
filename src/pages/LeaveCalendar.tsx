import { useState, useEffect, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { useUserRole } from '@/hooks/useUserRole';
import { useIsApprover } from '@/hooks/useIsApprover';
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
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useIsMobile } from '@/hooks/use-mobile';

interface DepartmentLeave {
  employeeId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  leaveType?: string;
  isCurrentUser: boolean;
  avatarUrl?: string | null;
}

import { LEAVE_TYPES, LEAVE_TYPE_MAP, getLeaveStyle } from '@/utils/leaveTypes';

const DAY_NAMES: Record<number, string> = { 0: 'Dum', 1: 'Lun', 2: 'Mar', 3: 'Mie', 4: 'Joi', 5: 'Vin', 6: 'Sâm' };

const LeaveCalendar = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
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

    const { data: profile } = await supabase.from('profiles').select('full_name, department').eq('user_id', user.id).single();
    const userDept = profile?.department || null;
    setDepartment(userDept);

    const { data: holidays } = await supabase.from('custom_holidays').select('holiday_date, name');
    const holidayMap: Record<string, string> = {};
    (holidays || []).forEach(h => { holidayMap[h.holiday_date] = h.name; });
    setCustomHolidays(holidayMap);

    const { data: allLeaves } = await supabase.from('hr_requests').select('user_id, details').eq('request_type', 'concediu').eq('status', 'approved');

    // Also fetch approved leave_requests
    const { data: leaveReqs } = await supabase.from('leave_requests').select('user_id, epd_id, start_date, end_date, status').eq('status', 'approved' as any);

    const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, department, avatar_url');
    const { data: epdData } = await supabase.from('employee_personal_data').select('id, first_name, last_name, department, employee_record_id').eq('is_archived', false);
    const { data: records } = await supabase.from('employee_records').select('id, user_id');
    const { data: directoryRows } = await supabase.from('employee_directory_full').select('id, user_id');

    const profileMap: Record<string, { name: string; department: string | null; avatarUrl: string | null }> = {};
    (profiles || []).forEach(p => { profileMap[p.user_id] = { name: p.full_name, department: p.department, avatarUrl: p.avatar_url }; });

    const recordUserMap: Record<string, string> = {};
    (records || []).forEach(r => { recordUserMap[r.id] = r.user_id; });

    // Build a reverse map from epd_id to user_id using directory + records
    const epdIdToUserId: Record<string, string> = {};
    (directoryRows || []).forEach((row: any) => {
      if (row.id && row.user_id) epdIdToUserId[row.id] = row.user_id;
    });
    (epdData || []).forEach(e => {
      if (e.employee_record_id && recordUserMap[e.employee_record_id]) {
        if (!epdIdToUserId[e.id]) epdIdToUserId[e.id] = recordUserMap[e.employee_record_id];
      }
    });

    const epdMap: Record<string, { name: string; department: string | null; avatarUrl: string | null }> = {};
    (epdData || []).forEach(e => {
      const userId = epdIdToUserId[e.id] || (e.employee_record_id ? recordUserMap[e.employee_record_id] : null);
      const avatar = userId ? profileMap[userId]?.avatarUrl || null : null;
      epdMap[e.id] = { name: `${e.last_name} ${e.first_name}`, department: e.department, avatarUrl: avatar };
    });

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    // Build a map from user_id to their canonical EPD id for deduplication
    const userIdToEpdId: Record<string, string> = {};

    // Primary source: unified employee directory
    (directoryRows || []).forEach((row: any) => {
      if (row.user_id && row.id) userIdToEpdId[row.user_id] = row.id;
    });

    // Fallback source: employee_record linkage
    (epdData || []).forEach(e => {
      if (e.employee_record_id) {
        const uid = recordUserMap[e.employee_record_id];
        if (uid && !userIdToEpdId[uid]) userIdToEpdId[uid] = e.id;
      }
    });

    const entries: DepartmentLeave[] = [];
    // Use person ID (epd_id or user_id) + dates as dedupe key to avoid name-format issues
    const seenLeaveKeys = new Set<string>();
    // Keep one canonical display name per person id (NUME PRENUME)
    const personDisplayName = new Map<string, string>();

    const resolvePersonId = (userId: string | null, epdId: string | null): string => {
      if (epdId) return `epd_${epdId}`;
      if (userId && userIdToEpdId[userId]) return `epd_${userIdToEpdId[userId]}`;
      return `uid_${userId || 'unknown'}`;
    };

    const resolveEmpInfo = (userId: string | null, epdId: string | null, fallbackName?: string) => {
      // If epd_id is explicitly set, ONLY use EPD data — don't fall back to creator's profile
      if (epdId) {
        if (epdMap[epdId]) return epdMap[epdId];
        // EPD not found (archived?) — use raw employee_name from details if available
        if (fallbackName) return { name: fallbackName, department: null, avatarUrl: null };
        return undefined;
      }
      // No epd_id: this is the user's own leave
      if (userId && userIdToEpdId[userId] && epdMap[userIdToEpdId[userId]]) return epdMap[userIdToEpdId[userId]];
      if (userId && profileMap[userId]) return profileMap[userId];
      return undefined;
    };

    const getCanonicalDisplayName = (personId: string, resolvedName: string) => {
      if (personDisplayName.has(personId)) return personDisplayName.get(personId)!;
      personDisplayName.set(personId, resolvedName);
      return resolvedName;
    };

    // Process hr_requests leaves
    (allLeaves || []).forEach((lr: any) => {
      const d = lr.details || {};
      if (!d.startDate || !d.endDate) return;
      const leaveStart = parseISO(d.startDate);
      const leaveEnd = parseISO(d.endDate);
      if (leaveEnd < monthStart || leaveStart > monthEnd) return;

      const empInfo = resolveEmpInfo(lr.user_id, d.epd_id, d.employee_name);
      if (!empInfo) return;

      const personId = resolvePersonId(lr.user_id, d.epd_id);
      const key = `${personId}|${d.startDate}|${d.endDate}`;
      if (seenLeaveKeys.has(key)) return;
      seenLeaveKeys.add(key);

      const isCurrentUser = lr.user_id === user.id && !d.epd_id;
      if (isCurrentUser || (userDept && empInfo.department === userDept)) {
        entries.push({
          employeeId: personId,
          employeeName: getCanonicalDisplayName(personId, empInfo.name),
          startDate: d.startDate,
          endDate: d.endDate,
          leaveType: d.leaveType || d.leave_type || 'co',
          isCurrentUser,
          avatarUrl: empInfo.avatarUrl || null,
        });
      }
    });

    // Process leave_requests
    (leaveReqs || []).forEach((lr: any) => {
      if (!lr.start_date || !lr.end_date) return;
      const leaveStart = parseISO(lr.start_date);
      const leaveEnd = parseISO(lr.end_date);
      if (leaveEnd < monthStart || leaveStart > monthEnd) return;

      const empInfo = resolveEmpInfo(lr.user_id, lr.epd_id);
      if (!empInfo) return;

      const personId = resolvePersonId(lr.user_id, lr.epd_id);
      const key = `${personId}|${lr.start_date}|${lr.end_date}`;
      if (seenLeaveKeys.has(key)) return;
      seenLeaveKeys.add(key);

      const isCurrentUser = lr.user_id === user.id && !lr.epd_id;
      if (isCurrentUser || (userDept && empInfo.department === userDept)) {
        entries.push({
          employeeId: personId,
          employeeName: getCanonicalDisplayName(personId, empInfo.name),
          startDate: lr.start_date,
          endDate: lr.end_date,
          leaveType: 'co',
          isCurrentUser,
          avatarUrl: empInfo.avatarUrl || null,
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

  const days = useMemo(() => eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) }), [currentMonth]);

  const employees = useMemo(() => {
    const seen = new Set<string>();
    return leaves.filter(l => {
      if (seen.has(l.employeeId)) return false;
      seen.add(l.employeeId);
      return true;
    });
  }, [leaves]);

  const getLeaveForDay = (employeeId: string, day: Date) => {
    return leaves.find(l => l.employeeId === employeeId && isWithinInterval(day, { start: parseISO(l.startDate), end: parseISO(l.endDate) }));
  };

  const colleaguesOnLeaveToday = useMemo(() => {
    const today = new Date();
    const uniqueNames = new Map<string, string>();

    leaves
      .filter(l => !l.isCurrentUser && isWithinInterval(today, { start: parseISO(l.startDate), end: parseISO(l.endDate) }))
      .forEach(l => {
        if (!uniqueNames.has(l.employeeId)) uniqueNames.set(l.employeeId, l.employeeName);
      });

    return Array.from(uniqueNames.values());
  }, [leaves]);

  // Group leaves by employee for mobile view
  const leavesByEmployee = useMemo(() => {
    const map = new Map<string, DepartmentLeave[]>();
    leaves.forEach(l => {
      if (!map.has(l.employeeId)) map.set(l.employeeId, []);
      map.get(l.employeeId)!.push(l);
    });
    return map;
  }, [leaves]);

  return (
    <MainLayout title="Calendar Concedii" description={department ? `Departament: ${department}` : 'Vizualizare concedii departament'}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="p-2 sm:p-2.5 rounded-xl bg-primary/10 shrink-0">
            <CalendarIcon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-xl font-display font-bold text-foreground capitalize truncate">
              {format(currentMonth, 'MMMM yyyy', { locale: ro })}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {employees.length} {employees.length === 1 ? 'coleg' : 'colegi'} cu concediu
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <Button variant="outline" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8 sm:h-9 text-xs sm:text-sm font-medium px-2 sm:px-3" onClick={() => setCurrentMonth(new Date())}>
            Azi
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Colleagues on leave today */}
      {colleaguesOnLeaveToday.length > 0 && (
        <Card className="mb-4 sm:mb-6 border-primary/20 bg-primary/5">
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs sm:text-sm font-semibold flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-primary" />
              Colegi în concediu azi
            </p>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {colleaguesOnLeaveToday.map(name => (
                <Badge key={name} variant="secondary" className="text-[10px] sm:text-xs">{name}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ─── MOBILE: Card-based view ─── */}
          <div className="md:hidden space-y-3">
            {employees.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <CalendarIcon className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-40" />
                  <p className="text-sm text-muted-foreground font-medium">Nu sunt concedii luna aceasta.</p>
                </CardContent>
              </Card>
            ) : (
              employees.map(emp => {
                const empLeaves = leavesByEmployee.get(emp.employeeId) || [];
                return (
                  <Card key={emp.employeeId} className={cn(emp.isCurrentUser && 'border-primary/30 bg-primary/5')}>
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Avatar className="w-7 h-7 flex-shrink-0">
                          {emp.avatarUrl && <AvatarImage src={emp.avatarUrl} alt={emp.employeeName} />}
                          <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                            {emp.employeeName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        {emp.isCurrentUser && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                        <p className={cn('font-medium text-sm', emp.isCurrentUser ? 'text-primary font-bold' : 'text-foreground')}>
                          {emp.employeeName}
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        {empLeaves.map((leave, i) => {
                          const style = getLeaveStyle(leave.leaveType);
                          const start = parseISO(leave.startDate);
                          const end = parseISO(leave.endDate);
                          const typeName = getLeaveStyle(leave.leaveType)?.description || 'Concediu';
                          return (
                            <div key={i} className={cn('flex items-center justify-between gap-2 p-2 rounded-lg border', style.bgSolid)}>
                              <div className="flex items-center gap-2 min-w-0">
                                <Badge className={cn('text-[10px] shrink-0 font-bold', style.color, style.bg)} variant="secondary">
                                  {style.label}
                                </Badge>
                                <span className="text-xs text-foreground truncate">{typeName}</span>
                              </div>
                              <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                                {format(start, 'dd MMM')} — {format(end, 'dd MMM', { locale: ro })}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          {/* ─── DESKTOP: Table view ─── */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
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
                          </td>
                        </tr>
                      ) : (
                        employees.map((emp) => (
                          <tr key={emp.employeeId} className={cn('transition-colors hover:bg-muted/30', emp.isCurrentUser && 'bg-primary/5 hover:bg-primary/10')}>
                            <td className={cn('sticky left-0 z-10 border border-border px-4 py-2.5 whitespace-nowrap bg-inherit', emp.isCurrentUser ? 'font-bold text-primary' : 'font-medium text-foreground')}>
                              <div className="flex items-center gap-2">
                                <Avatar className="w-6 h-6 flex-shrink-0">
                                  {emp.avatarUrl && <AvatarImage src={emp.avatarUrl} alt={emp.employeeName} />}
                                  <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
                                    {emp.employeeName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                  </AvatarFallback>
                                </Avatar>
                                {emp.isCurrentUser && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                                <span>{emp.employeeName}</span>
                              </div>
                            </td>
                            {days.map(day => {
                              const dateStr = format(day, 'yyyy-MM-dd');
                              const weekend = isWeekend(day);
                              const pubH = isPublicHoliday(day);
                              const customH = customHolidays[dateStr];
                              const isOff = weekend || pubH || !!customH;
                              const leave = isOff ? null : getLeaveForDay(emp.employeeId, day);
                              const style = leave ? getLeaveStyle(leave.leaveType) : null;
                              return (
                                <td key={dateStr} className={cn(
                                  'border border-border text-center py-1.5 px-0 transition-colors',
                                  isOff && !leave && 'bg-muted/50',
                                  pubH && !leave && 'bg-red-500/8',
                                  leave && style?.bgSolid,
                                )}>
                                  {leave && <span className={cn('font-bold text-xs', style?.color)}>{style?.label}</span>}
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
            </CardContent>
          </Card>
        </>
      )}

      {/* Legend */}
      <Card className="mt-4">
        <CardContent className="p-3 sm:p-4">
          <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground mb-2 sm:mb-3 uppercase tracking-wide">Legendă</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-1.5">
            {LEAVE_TYPES.map(item => (
              <div key={item.key} className="flex items-center gap-1.5 text-xs">
                <span className={cn('font-bold px-1 sm:px-1.5 py-0.5 rounded text-[10px] sm:text-xs', item.color, item.colorDark, item.bg)}>{item.label}</span>
                <span className="text-muted-foreground text-[11px] sm:text-xs truncate">{item.description}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </MainLayout>
  );
};

export default LeaveCalendar;
