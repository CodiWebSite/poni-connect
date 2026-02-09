import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Loader2, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus, X, Star, Users } from 'lucide-react';
import { format, startOfMonth, endOfMonth, addMonths, subMonths, parseISO, isWithinInterval } from 'date-fns';
import { ro } from 'date-fns/locale';
import { toast } from 'sonner';
import MonthlyCalendarGrid, { DayInfo } from '@/components/shared/MonthlyCalendarGrid';

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
}

const LeaveCalendar = () => {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [leaves, setLeaves] = useState<LeaveEntry[]>([]);
  const [customHolidays, setCustomHolidays] = useState<CustomHoliday[]>([]);
  const [showAddHoliday, setShowAddHoliday] = useState(false);
  const [newHolidayName, setNewHolidayName] = useState('');
  const [newHolidayDate, setNewHolidayDate] = useState<Date>();

  useEffect(() => {
    fetchLeaves();
    fetchCustomHolidays();
  }, [currentMonth]);

  const fetchCustomHolidays = async () => {
    const { data } = await supabase.from('custom_holidays').select('id, holiday_date, name').order('holiday_date');
    setCustomHolidays(data || []);
  };

  const addCustomHoliday = async () => {
    if (!newHolidayDate || !newHolidayName.trim()) {
      toast.error('Completați data și numele sărbătorii.');
      return;
    }
    const dateStr = format(newHolidayDate, 'yyyy-MM-dd');
    const { error } = await supabase.from('custom_holidays').insert({ holiday_date: dateStr, name: newHolidayName.trim(), created_by: user?.id });
    if (error) {
      if (error.code === '23505') toast.error('Există deja o sărbătoare la această dată.');
      else toast.error('Eroare: ' + error.message);
      return;
    }
    toast.success('Sărbătoare adăugată');
    setNewHolidayName('');
    setNewHolidayDate(undefined);
    setShowAddHoliday(false);
    fetchCustomHolidays();
  };

  const deleteCustomHoliday = async (id: string) => {
    const { error } = await supabase.from('custom_holidays').delete().eq('id', id);
    if (error) { toast.error('Eroare la ștergere'); return; }
    toast.success('Sărbătoare ștearsă');
    fetchCustomHolidays();
  };

  const fetchLeaves = async () => {
    setLoading(true);
    const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

    const { data: allLeaves } = await supabase
      .from('hr_requests').select('user_id, details, status')
      .eq('request_type', 'concediu').eq('status', 'approved');

    const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, department');
    const { data: epdData } = await supabase
      .from('employee_personal_data').select('id, first_name, last_name, department').eq('is_archived', false);

    const profileMap: Record<string, { name: string; department: string | null }> = {};
    (profiles || []).forEach(p => { profileMap[p.user_id] = { name: p.full_name, department: p.department }; });
    const epdMap: Record<string, { name: string; department: string | null }> = {};
    (epdData || []).forEach(e => { epdMap[e.id] = { name: `${e.last_name} ${e.first_name}`, department: e.department }; });

    const entries: LeaveEntry[] = [];
    (allLeaves || []).forEach((lr: any) => {
      const d = lr.details || {};
      if (!d.startDate || !d.endDate) return;
      const leaveStart = parseISO(d.startDate);
      const leaveEnd = parseISO(d.endDate);
      const mStart = startOfMonth(currentMonth);
      const mEnd = endOfMonth(currentMonth);
      if (leaveEnd < mStart || leaveStart > mEnd) return;

      let empInfo: { name: string; department: string | null } | undefined;
      if (d.epd_id && epdMap[d.epd_id]) empInfo = epdMap[d.epd_id];
      else if (lr.user_id && profileMap[lr.user_id]) empInfo = profileMap[lr.user_id];
      else if (d.employee_name) empInfo = { name: d.employee_name, department: null };

      if (empInfo) {
        entries.push({ employeeName: empInfo.name, department: empInfo.department, startDate: d.startDate, endDate: d.endDate, numberOfDays: d.numberOfDays || 0 });
      }
    });

    entries.sort((a, b) => a.employeeName.localeCompare(b.employeeName));
    const unique = entries.filter((e, i, arr) =>
      arr.findIndex(x => x.employeeName === e.employeeName && x.startDate === e.startDate && x.endDate === e.endDate) === i
    );
    setLeaves(unique);
    setLoading(false);
  };

  const customHolidayDates = useMemo(() => new Set(customHolidays.map(h => h.holiday_date)), [customHolidays]);

  const getDayInfo = useCallback((day: Date): DayInfo => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const customH = customHolidays.find(h => h.holiday_date === dateStr);
    const onLeave = leaves.some(l => {
      const start = parseISO(l.startDate);
      const end = parseISO(l.endDate);
      return isWithinInterval(day, { start, end });
    });
    const leaveNames = onLeave
      ? leaves.filter(l => isWithinInterval(day, { start: parseISO(l.startDate), end: parseISO(l.endDate) })).map(l => l.employeeName)
      : [];

    return {
      isLeave: onLeave,
      leaveLabel: leaveNames.length > 0 ? `Concediu: ${leaveNames.join(', ')}` : undefined,
      isCustomHoliday: !!customH,
      customHolidayName: customH?.name,
    };
  }, [leaves, customHolidays]);

  const onLeaveToday = useMemo(() => {
    const today = new Date();
    return [...new Set(leaves.filter(l => isWithinInterval(today, { start: parseISO(l.startDate), end: parseISO(l.endDate) })).map(l => l.employeeName))];
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
            <Button variant="outline" className="min-w-[180px] font-semibold capitalize" onClick={() => setCurrentMonth(new Date())}>
              {format(currentMonth, 'MMMM yyyy', { locale: ro })}
            </Button>
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {onLeaveToday.length > 0 && (
          <div className="mt-3 p-3 rounded-lg bg-muted border">
            <p className="text-sm font-medium mb-1 flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              Astăzi în concediu ({onLeaveToday.length}):
            </p>
            <div className="flex flex-wrap gap-1.5">
              {onLeaveToday.map(name => (
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
        ) : (
          <MonthlyCalendarGrid currentMonth={currentMonth} getDayInfo={getDayInfo} />
        )}

        {/* Leave list for this month */}
        {leaves.length > 0 && (
          <div className="mt-6 border-t pt-4">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              Concedii în {format(currentMonth, 'MMMM yyyy', { locale: ro })}
            </h4>
            <div className="space-y-1.5">
              {leaves.map((l, i) => (
                <div key={i} className="flex items-center gap-2 text-xs p-2 rounded-md bg-sky-500/10 border border-sky-500/20">
                  <div className="w-2 h-2 rounded-full bg-sky-500 shrink-0" />
                  <span className="font-medium">{l.employeeName}</span>
                  <span className="text-muted-foreground">
                    {format(parseISO(l.startDate), 'dd MMM', { locale: ro })} — {format(parseISO(l.endDate), 'dd MMM', { locale: ro })}
                  </span>
                  {l.numberOfDays > 0 && <Badge variant="outline" className="text-[10px] ml-auto">{l.numberOfDays} zile</Badge>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground border-t pt-3">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-3 rounded-sm bg-sky-500/25 ring-1 ring-sky-500/50 ring-inset" />
            <span>Concediu</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-3 rounded-sm bg-red-500/15" />
            <span>Sărbătoare legală</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-3 rounded-sm bg-amber-500/20" />
            <span>Zi liberă instituție</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-3 rounded-sm bg-orange-500/10" />
            <span>Weekend</span>
          </div>
        </div>

        {/* Custom Holidays Management */}
        <div className="mt-4 border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold flex items-center gap-1.5">
              <Star className="w-4 h-4 text-amber-500" />
              Zile Libere Instituție
            </h4>
            <Dialog open={showAddHoliday} onOpenChange={setShowAddHoliday}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  <Plus className="w-3.5 h-3.5" />
                  Adaugă
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>Adaugă Zi Liberă</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nume</Label>
                    <Input value={newHolidayName} onChange={e => setNewHolidayName(e.target.value)} placeholder="Ex: Zi porți deschise" maxLength={100} />
                  </div>
                  <div className="space-y-2">
                    <Label>Data</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !newHolidayDate && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {newHolidayDate ? format(newHolidayDate, 'PPP', { locale: ro }) : 'Selectează data'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={newHolidayDate} onSelect={setNewHolidayDate} initialFocus className={cn("p-3 pointer-events-auto")} />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowAddHoliday(false)}>Anulează</Button>
                    <Button onClick={addCustomHoliday}>Adaugă</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {customHolidays.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nu există zile libere adăugate de instituție.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {customHolidays.map(h => (
                <Badge key={h.id} variant="outline" className="gap-1.5 text-xs bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300">
                  {format(parseISO(h.holiday_date), 'dd MMM yyyy', { locale: ro })} — {h.name}
                  <button onClick={() => deleteCustomHoliday(h.id)} className="ml-0.5 hover:text-destructive transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default LeaveCalendar;
