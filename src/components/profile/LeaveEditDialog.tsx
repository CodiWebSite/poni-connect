import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Pencil } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { isPublicHoliday, getPublicHolidayName } from '@/utils/romanianHolidays';

interface LeaveEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leave: {
    id: string;
    status: string;
    details: any;
    created_at: string;
  } | null;
  employeeRecordId: string | null;
  epdId?: string;
  onSaved: () => void;
}

const calculateWorkingDays = (startDate: string, endDate: string, customHolidayDates: string[]): number => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getDay();
    const dateStr = format(current, 'yyyy-MM-dd');
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !isPublicHoliday(current) && !customHolidayDates.includes(dateStr)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
};

export const LeaveEditDialog = ({ open, onOpenChange, leave, employeeRecordId, epdId, onSaved }: LeaveEditDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [deductFrom, setDeductFrom] = useState<'auto' | 'carryover' | 'current'>('auto');
  const [customHolidayDates, setCustomHolidayDates] = useState<string[]>([]);
  const [customHolidayNames, setCustomHolidayNames] = useState<Record<string, string>>({});
  const [carryoverDays, setCarryoverDays] = useState(0);
  const [carryoverRecord, setCarryoverRecord] = useState<{ id: string; used_days: number; remaining_days: number } | null>(null);
  const [currentBalance, setCurrentBalance] = useState(0);

  useEffect(() => {
    const fetchHolidays = async () => {
      const { data } = await supabase.from('custom_holidays').select('holiday_date, name');
      if (data) {
        setCustomHolidayDates(data.map(h => h.holiday_date));
        const names: Record<string, string> = {};
        data.forEach(h => { names[h.holiday_date] = h.name; });
        setCustomHolidayNames(names);
      }
    };
    if (open) {
      fetchHolidays();
      fetchCarryoverData();
    }
  }, [open]);

  useEffect(() => {
    if (leave?.details) {
      setStartDate(leave.details.startDate || '');
      setEndDate(leave.details.endDate || '');
      setNotes(leave.details.notes || '');
      setDeductFrom(leave.details.deductFrom || 'auto');
    }
  }, [leave]);

  const fetchCarryoverData = async () => {
    const resolvedEpdId = leave?.details?.epd_id || epdId;
    if (!resolvedEpdId) {
      // Try to get epdId from employeeRecordId
      if (employeeRecordId) {
        const { data: epd } = await supabase
          .from('employee_personal_data')
          .select('id, total_leave_days, used_leave_days')
          .eq('employee_record_id', employeeRecordId)
          .maybeSingle();
        if (epd) {
          await loadCarryover(epd.id);
          setCurrentBalance((epd.total_leave_days || 21) - (epd.used_leave_days || 0));
        }
      }
      return;
    }

    const { data: epd } = await supabase
      .from('employee_personal_data')
      .select('id, total_leave_days, used_leave_days')
      .eq('id', resolvedEpdId)
      .maybeSingle();
    if (epd) {
      await loadCarryover(epd.id);
      setCurrentBalance((epd.total_leave_days || 21) - (epd.used_leave_days || 0));
    }
  };

  const loadCarryover = async (empEpdId: string) => {
    const currentYear = new Date().getFullYear();
    const { data } = await supabase
      .from('leave_carryover')
      .select('id, used_days, remaining_days')
      .eq('employee_personal_data_id', empEpdId)
      .eq('from_year', currentYear - 1)
      .eq('to_year', currentYear)
      .maybeSingle();

    if (data) {
      setCarryoverDays(data.remaining_days);
      setCarryoverRecord(data);
    } else {
      setCarryoverDays(0);
      setCarryoverRecord(null);
    }
  };

  const oldDays = leave?.details?.numberOfDays || 0;
  const newDays = startDate && endDate ? calculateWorkingDays(startDate, endDate, customHolidayDates) : 0;
  const daysDiff = newDays - oldDays;

  const getNonWorkingDays = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    const result: { date: string; reason: string }[] = [];
    const cur = new Date(s);
    while (cur <= e) {
      const dow = cur.getDay();
      const dateStr = format(cur, 'yyyy-MM-dd');
      const fDate = format(cur, 'dd.MM.yyyy');
      if (dow === 0 || dow === 6) {
        result.push({ date: fDate, reason: dow === 0 ? 'Duminică' : 'Sâmbătă' });
      } else if (isPublicHoliday(cur)) {
        result.push({ date: fDate, reason: getPublicHolidayName(cur) || 'Sărbătoare legală' });
      } else if (customHolidayDates.includes(dateStr)) {
        result.push({ date: fDate, reason: customHolidayNames[dateStr] || 'Zi liberă instituție' });
      }
      cur.setDate(cur.getDate() + 1);
    }
    return result;
  };

  const handleSave = async () => {
    if (!leave || !startDate || !endDate || !user) return;
    if (newDays <= 0) {
      toast({ title: 'Eroare', description: 'Perioada selectată nu conține zile lucrătoare.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      // Update the hr_request details
      const newDetails = {
        ...leave.details,
        startDate,
        endDate,
        numberOfDays: newDays,
        notes,
        deductFrom,
        lastEditedBy: user.id,
        lastEditedAt: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('hr_requests')
        .update({ details: newDetails as any })
        .eq('id', leave.id);

      if (error) throw error;

      // Adjust leave balance if days changed
      if (daysDiff !== 0) {
        // Calculate how to distribute the diff based on deductFrom
        let diffCarryover = 0;
        let diffCurrent = 0;

        if (deductFrom === 'carryover') {
          diffCarryover = daysDiff;
        } else if (deductFrom === 'current') {
          diffCurrent = daysDiff;
        } else {
          // Auto: for increases, take from carryover first; for decreases, return to current first
          if (daysDiff > 0) {
            diffCarryover = Math.min(daysDiff, carryoverDays);
            diffCurrent = daysDiff - diffCarryover;
          } else {
            diffCurrent = daysDiff; // Return to current year
          }
        }

        // Update carryover if needed
        if (diffCarryover !== 0 && carryoverRecord) {
          await supabase.from('leave_carryover').update({
            used_days: carryoverRecord.used_days + diffCarryover,
            remaining_days: carryoverRecord.remaining_days - diffCarryover,
          }).eq('id', carryoverRecord.id);
        }

        // Update employee_records if available (only current year portion)
        if (diffCurrent !== 0 && employeeRecordId) {
          const { data: record } = await supabase
            .from('employee_records')
            .select('id, used_leave_days')
            .eq('id', employeeRecordId)
            .single();

          if (record) {
            const newUsedDays = Math.max(0, record.used_leave_days + diffCurrent);
            await supabase.from('employee_records').update({ used_leave_days: newUsedDays }).eq('id', record.id);

            const { data: epd } = await supabase
              .from('employee_personal_data')
              .select('id')
              .eq('employee_record_id', record.id)
              .maybeSingle();
            if (epd) {
              await supabase.from('employee_personal_data').update({ used_leave_days: newUsedDays }).eq('id', epd.id);
            }
          }
        }

        // Update EPD directly for employees without accounts (only current year portion)
        if (diffCurrent !== 0) {
          const leaveEpdId = leave.details?.epd_id || epdId;
          if (leaveEpdId && !employeeRecordId) {
            const { data: epd } = await supabase
              .from('employee_personal_data')
              .select('id, used_leave_days')
              .eq('id', leaveEpdId)
              .maybeSingle();
            if (epd) {
              const newUsedDays = Math.max(0, (epd.used_leave_days || 0) + diffCurrent);
              await supabase.from('employee_personal_data').update({ used_leave_days: newUsedDays }).eq('id', epd.id);
            }
          }
        }
      }

      // Audit log
      await supabase.rpc('log_audit_event', {
        _user_id: user.id,
        _action: 'leave_edit',
        _entity_type: 'hr_request',
        _entity_id: leave.id,
        _details: {
          old_period: `${leave.details?.startDate} - ${leave.details?.endDate}`,
          new_period: `${startDate} - ${endDate}`,
          old_days: oldDays,
          new_days: newDays,
          days_diff: daysDiff,
          deduct_from: deductFrom,
        }
      });

      toast({
        title: 'Actualizat',
        description: daysDiff !== 0
          ? `Perioada concediului a fost modificată. Sold ajustat cu ${daysDiff > 0 ? '+' : ''}${daysDiff} zile.`
          : 'Perioada concediului a fost modificată.',
      });

      onOpenChange(false);
      onSaved();
    } catch (error) {
      console.error('Edit leave error:', error);
      toast({ title: 'Eroare', description: 'Nu s-a putut modifica concediul.', variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5" />
            Editare Perioadă Concediu
          </DialogTitle>
          <DialogDescription>
            Modificați perioada concediului. Soldul de zile va fi recalculat automat.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data Început</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Data Sfârșit</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          {startDate && endDate && (() => {
            const nonWorking = getNonWorkingDays(startDate, endDate);
            const holidays = nonWorking.filter(d => d.reason !== 'Sâmbătă' && d.reason !== 'Duminică');
            const weekendCount = nonWorking.filter(d => d.reason === 'Sâmbătă' || d.reason === 'Duminică').length;

            return (
              <>
                {holidays.length > 0 && (
                  <div className="p-3 rounded-lg space-y-1 bg-amber-500/10 border border-amber-500/30">
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                      📅 Zile libere excluse automat:
                    </p>
                    {holidays.map((d, i) => (
                      <p key={i} className="text-xs text-amber-600 dark:text-amber-400">
                        • <span className="font-medium">{d.date}</span> — {d.reason}
                      </p>
                    ))}
                    {weekendCount > 0 && (
                      <p className="text-xs text-muted-foreground">+ {weekendCount} zile de weekend excluse</p>
                    )}
                  </div>
                )}
                <div className={`p-3 rounded-lg text-sm space-y-1 ${newDays <= 0 ? 'bg-destructive/10 border border-destructive/30' : daysDiff !== 0 ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-muted'}`}>
                  {newDays <= 0 ? (
                    <p className="text-sm font-medium text-destructive">🚫 Perioada selectată nu conține zile lucrătoare!</p>
                  ) : (
                    <>
                      <p>Zile lucrătoare: <span className="font-bold">{newDays}</span></p>
                      {daysDiff !== 0 && (
                        <p className="text-xs">
                          {daysDiff > 0 ? `+${daysDiff} zile vor fi scăzute din sold` : `${Math.abs(daysDiff)} zile vor fi readăugate în sold`}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </>
            );
          })()}

          {/* Deduction source selection - only show when carryover exists */}
          {carryoverDays > 0 && daysDiff !== 0 && (
            <div className="space-y-2">
              <Label>Deduce diferența din *</Label>
              <RadioGroup
                value={deductFrom}
                onValueChange={(v) => setDeductFrom(v as 'auto' | 'carryover' | 'current')}
                className="space-y-1"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="auto" id="edit-deduct-auto" />
                  <Label htmlFor="edit-deduct-auto" className="text-sm font-normal cursor-pointer">
                    Automat (mai întâi report {new Date().getFullYear() - 1}, apoi {new Date().getFullYear()})
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="carryover" id="edit-deduct-carryover" />
                  <Label htmlFor="edit-deduct-carryover" className="text-sm font-normal cursor-pointer">
                    Doar din report {new Date().getFullYear() - 1} ({carryoverDays} zile disponibile)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="current" id="edit-deduct-current" />
                  <Label htmlFor="edit-deduct-current" className="text-sm font-normal cursor-pointer">
                    Doar din sold {new Date().getFullYear()} ({currentBalance} zile disponibile)
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          <div className="space-y-2">
            <Label>Observații (opțional)</Label>
            <Input
              placeholder="Motiv modificare..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Anulează</Button>
          <Button onClick={handleSave} disabled={saving || !startDate || !endDate || newDays <= 0}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Pencil className="w-4 h-4 mr-2" />}
            Salvează
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};