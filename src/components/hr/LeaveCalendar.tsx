import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Loader2, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus, X, Star, Users, Filter, Download } from 'lucide-react';
import { exportLeaveCalendarExcel } from '@/utils/exportLeaveCalendar';
import { format, startOfMonth, endOfMonth, addMonths, subMonths, parseISO, isWithinInterval } from 'date-fns';
import { ro } from 'date-fns/locale';
import { toast } from 'sonner';
import LeaveCalendarTable from './LeaveCalendarTable';

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
  sourceLabel?: string | null;
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
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [exporting, setExporting] = useState(false);

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
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    // Fetch from BOTH hr_requests AND leave_requests
    const { data: hrLeaves } = await supabase
      .from('hr_requests').select('user_id, details, status')
      .eq('request_type', 'concediu').eq('status', 'approved');

    const { data: formalLeaves } = await supabase
      .from('leave_requests').select('user_id, epd_id, start_date, end_date, working_days, status, year')
      .eq('status', 'approved');

    const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, department, avatar_url');
    const { data: epdData } = await supabase
      .from('employee_personal_data').select('id, first_name, last_name, department, employee_record_id').eq('is_archived', false);
    const { data: records } = await supabase.from('employee_records').select('id, user_id');

    const profileMap: Record<string, { name: string; department: string | null; avatarUrl: string | null }> = {};
    (profiles || []).forEach(p => { profileMap[p.user_id] = { name: p.full_name, department: p.department, avatarUrl: p.avatar_url }; });
    
    const recordUserMap: Record<string, string> = {};
    (records || []).forEach(r => { recordUserMap[r.id] = r.user_id; });

    // Also fetch directory to map epd_id -> user_id for avatars
    const { data: directoryRows } = await supabase.from('employee_directory_full').select('id, user_id');

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
    const userIdToEpdId: Record<string, string> = {};
    (epdData || []).forEach(e => {
      const userId = epdIdToUserId[e.id] || (e.employee_record_id ? recordUserMap[e.employee_record_id] : null);
      const avatar = userId ? profileMap[userId]?.avatarUrl || null : null;
      epdMap[e.id] = { name: `${e.last_name} ${e.first_name}`, department: e.department, avatarUrl: avatar };
      if (userId) userIdToEpdId[userId] = e.id;
    });

    // Fetch carryover data for source labels
    const allEpdIds = (epdData || []).map(e => e.id);
    let carryoverMap: Record<string, { from_year: number; initial_days: number }[]> = {};
    if (allEpdIds.length > 0) {
      const { data: carryovers } = await supabase
        .from('leave_carryover')
        .select('employee_personal_data_id, from_year, initial_days')
        .in('employee_personal_data_id', allEpdIds);
      (carryovers || []).forEach(c => {
        if (!carryoverMap[c.employee_personal_data_id]) carryoverMap[c.employee_personal_data_id] = [];
        carryoverMap[c.employee_personal_data_id].push({ from_year: c.from_year, initial_days: c.initial_days });
      });
    }

    // We'll assign sourceLabel after collecting all entries using FIFO simulation

    const entries: LeaveEntry[] = [];
    // Track seen leaves by normalized key to avoid duplicates across tables
    const seenLeaveKeys = new Set<string>();

    const makeDedupeKey = (name: string, start: string, end: string) =>
      `${name.toLowerCase().trim()}|${start}|${end}`;

    // Process hr_requests leaves
    (hrLeaves || []).forEach((lr: any) => {
      const d = lr.details || {};
      if (!d.startDate || !d.endDate) return;
      const leaveStart = parseISO(d.startDate);
      const leaveEnd = parseISO(d.endDate);
      if (leaveEnd < monthStart || leaveStart > monthEnd) return;

      let empInfo: { name: string; department: string | null; avatarUrl?: string | null } | undefined;
      if (d.epd_id && epdMap[d.epd_id]) empInfo = epdMap[d.epd_id];
      else if (lr.user_id) {
        const linkedEpdId = userIdToEpdId[lr.user_id];
        if (linkedEpdId && epdMap[linkedEpdId]) empInfo = epdMap[linkedEpdId];
        else if (profileMap[lr.user_id]) empInfo = profileMap[lr.user_id];
      }
      else if (d.employee_name) empInfo = { name: d.employee_name, department: null, avatarUrl: null };

      if (empInfo) {
        const key = makeDedupeKey(empInfo.name, d.startDate, d.endDate);
        if (!seenLeaveKeys.has(key)) {
          seenLeaveKeys.add(key);
          entries.push({
            employeeName: empInfo.name,
            department: empInfo.department,
            startDate: d.startDate,
            endDate: d.endDate,
            numberOfDays: d.numberOfDays || 0,
            leaveType: d.leaveType || d.leave_type || 'co',
            avatarUrl: empInfo.avatarUrl || null,
            sourceYear: d.startDate ? new Date(d.startDate).getFullYear() : null,
            sourceLabel: null, // will be computed via FIFO below
          });
        }
      }
    });

    // Process leave_requests (formal workflow)
    (formalLeaves || []).forEach((lr: any) => {
      if (!lr.start_date || !lr.end_date) return;
      const leaveStart = parseISO(lr.start_date);
      const leaveEnd = parseISO(lr.end_date);
      if (leaveEnd < monthStart || leaveStart > monthEnd) return;

      let empInfo: { name: string; department: string | null; avatarUrl?: string | null } | undefined;
      if (lr.epd_id && epdMap[lr.epd_id]) empInfo = epdMap[lr.epd_id];
      else if (lr.user_id) {
        const linkedEpdId = userIdToEpdId[lr.user_id];
        if (linkedEpdId && epdMap[linkedEpdId]) empInfo = epdMap[linkedEpdId];
        else if (profileMap[lr.user_id]) empInfo = profileMap[lr.user_id];
      }

      if (empInfo) {
        const key = makeDedupeKey(empInfo.name, lr.start_date, lr.end_date);
        if (!seenLeaveKeys.has(key)) {
          seenLeaveKeys.add(key);
          entries.push({
            employeeName: empInfo.name,
            department: empInfo.department,
            startDate: lr.start_date,
            endDate: lr.end_date,
            numberOfDays: lr.working_days || 0,
            leaveType: 'co',
            avatarUrl: empInfo.avatarUrl || null,
            sourceYear: lr.year || null,
            sourceLabel: null, // will be computed via FIFO below
          });
        }
      }
    });

    entries.sort((a, b) => a.employeeName.localeCompare(b.employeeName) || a.startDate.localeCompare(b.startDate));

    // FIFO simulation: assign sourceLabel per employee based on carryover consumption
    const nameToEpdId: Record<string, string> = {};
    Object.entries(epdMap).forEach(([epdId, info]) => {
      nameToEpdId[info.name] = epdId;
    });

    // Group CO entries by employee
    const coByEmployee: Record<string, LeaveEntry[]> = {};
    entries.forEach(e => {
      if (e.leaveType === 'co') {
        if (!coByEmployee[e.employeeName]) coByEmployee[e.employeeName] = [];
        coByEmployee[e.employeeName].push(e);
      }
    });

    Object.entries(coByEmployee).forEach(([empName, empEntries]) => {
      const epdId = nameToEpdId[empName];
      if (!epdId) {
        empEntries.forEach(e => { e.sourceLabel = `Sold ${e.sourceYear || new Date().getFullYear()}`; });
        return;
      }
      const carryovers = carryoverMap[epdId] || [];
      
      // Group by year
      const byYear: Record<number, LeaveEntry[]> = {};
      empEntries.forEach(e => {
        const yr = e.sourceYear || new Date().getFullYear();
        if (!byYear[yr]) byYear[yr] = [];
        byYear[yr].push(e);
      });

      Object.entries(byYear).forEach(([yearStr, yearEntries]) => {
        const year = Number(yearStr);
        const relevantCarryover = carryovers.find(c => c.from_year === year - 1 && c.initial_days > 0);
        let carryoverRemaining = relevantCarryover?.initial_days || 0;

        yearEntries.forEach(e => {
          const days = e.numberOfDays || 0;
          if (carryoverRemaining <= 0) {
            e.sourceLabel = `Sold ${year}`;
          } else if (carryoverRemaining >= days) {
            e.sourceLabel = `Report ${year - 1}`;
            carryoverRemaining -= days;
          } else {
            e.sourceLabel = `Report ${year - 1} + Sold ${year}`;
            carryoverRemaining = 0;
          }
        });
      });
    });

    // Assign default label for non-CO entries
    entries.forEach(e => {
      if (!e.sourceLabel) {
        e.sourceLabel = e.leaveType !== 'co' ? (e.leaveType?.toUpperCase() || '') : `Sold ${e.sourceYear || new Date().getFullYear()}`;
      }
    });

    setLeaves(entries);
    setLoading(false);
  };

  // Get unique departments for filter — normalize known duplicates
  const normalizeDept = (d: string) => d.trim() === 'Oficiu Juridic' ? 'Oficiu juridic' : d.trim();
  const dynamicDepts = leaves.map(l => l.department ? normalizeDept(l.department) : '').filter(Boolean);
  if (!dynamicDepts.includes('Oficiu juridic')) {
    dynamicDepts.push('Oficiu juridic');
  }
  const departments = [...new Set(dynamicDepts)];

  // Filter leaves by department
  const filteredLeaves = departmentFilter === 'all'
    ? leaves
    : leaves.filter(l => l.department && normalizeDept(l.department) === departmentFilter);

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      await exportLeaveCalendarExcel(currentMonth, filteredLeaves, customHolidays, departmentFilter);
      toast.success('Export Excel generat cu succes!');
    } catch (e) {
      console.error(e);
      toast.error('Eroare la generarea exportului');
    }
    setExporting(false);
  };

  const onLeaveToday = filteredLeaves.filter(l => {
    const today = new Date();
    return isWithinInterval(today, { start: parseISO(l.startDate), end: parseISO(l.endDate) });
  });
  const uniqueOnLeaveToday = [...new Set(onLeaveToday.map(l => l.employeeName))];

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
            <Button variant="outline" size="sm" className="ml-2 gap-1.5" onClick={handleExportExcel} disabled={exporting || loading}>
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Export Excel
            </Button>
          </div>
        </div>

        {/* Department filter */}
        {departments.length > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-[260px] h-8 text-sm">
                <SelectValue placeholder="Toate departamentele" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toate departamentele</SelectItem>
                {departments.sort().map(dep => (
                  <SelectItem key={dep} value={dep}>{dep}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {departmentFilter !== 'all' && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setDepartmentFilter('all')}>
                <X className="w-3 h-3 mr-1" /> Resetează
              </Button>
            )}
          </div>
        )}

        {uniqueOnLeaveToday.length > 0 && (
          <div className="mt-3 p-3 rounded-lg bg-muted border">
            <p className="text-sm font-medium mb-1 flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              Astăzi în concediu ({uniqueOnLeaveToday.length}):
            </p>
            <div className="flex flex-wrap gap-1.5">
              {uniqueOnLeaveToday.map(name => (
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
          <LeaveCalendarTable currentMonth={currentMonth} leaves={filteredLeaves} customHolidays={customHolidays} />
        )}

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
