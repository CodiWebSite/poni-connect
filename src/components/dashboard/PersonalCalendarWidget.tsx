import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { format, addMonths, subMonths, parseISO, isWithinInterval } from 'date-fns';
import { ro } from 'date-fns/locale';
import MonthlyCalendarGrid, { DayInfo } from '@/components/shared/MonthlyCalendarGrid';

interface PersonalLeave {
  startDate: string;
  endDate: string;
}

const PersonalCalendarWidget = () => {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [leaves, setLeaves] = useState<PersonalLeave[]>([]);
  const [customHolidayDates, setCustomHolidayDates] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user) {
      fetchMyLeaves();
      fetchCustomHolidays();
    }
  }, [user, currentMonth]);

  const fetchMyLeaves = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('hr_requests')
      .select('details')
      .eq('user_id', user.id)
      .eq('request_type', 'concediu')
      .eq('status', 'approved');

    const entries: PersonalLeave[] = [];
    (data || []).forEach((lr: any) => {
      const d = lr.details || {};
      if (d.startDate && d.endDate) {
        entries.push({ startDate: d.startDate, endDate: d.endDate });
      }
    });
    setLeaves(entries);
  };

  const fetchCustomHolidays = async () => {
    const { data } = await supabase.from('custom_holidays').select('holiday_date, name');
    const map: Record<string, string> = {};
    (data || []).forEach(h => { map[h.holiday_date] = h.name; });
    setCustomHolidayDates(map);
  };

  const getDayInfo = useCallback((day: Date): DayInfo => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const customH = customHolidayDates[dateStr];
    const onLeave = leaves.some(l =>
      isWithinInterval(day, { start: parseISO(l.startDate), end: parseISO(l.endDate) })
    );

    return {
      isLeave: onLeave,
      leaveLabel: onLeave ? 'Concediul tău' : undefined,
      isCustomHoliday: !!customH,
      customHolidayName: customH,
    };
  }, [leaves, customHolidayDates]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <CalendarIcon className="w-4 h-4 text-primary" />
            Calendar
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
        <MonthlyCalendarGrid currentMonth={currentMonth} getDayInfo={getDayInfo} compact />

        {/* Mini legend */}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 rounded-sm bg-sky-500/25 ring-1 ring-sky-500/50 ring-inset" />
            <span>Concediu</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 rounded-sm bg-red-500/15" />
            <span>Sărbătoare</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 rounded-sm bg-amber-500/20" />
            <span>Zi liberă</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 rounded-sm bg-orange-500/10" />
            <span>Weekend</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PersonalCalendarWidget;
