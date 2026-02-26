import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { SignaturePad } from '@/components/shared/SignaturePad';
import { Calendar, Loader2, Send, AlertTriangle } from 'lucide-react';
import { format, eachDayOfInterval, parseISO, isWeekend } from 'date-fns';

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}
import { ro } from 'date-fns/locale';
import { isPublicHoliday, isDayOff } from '@/utils/romanianHolidays';

interface EmployeeData {
  id: string;
  first_name: string;
  last_name: string;
  department: string | null;
  position: string | null;
  total_leave_days: number;
  used_leave_days: number;
  employee_record_id: string | null;
}

interface ColleagueOption {
  id: string;
  name: string;
  position: string | null;
}

interface LeaveRequestFormProps {
  onSubmitted: () => void;
}

export function LeaveRequestForm({ onSubmitted }: LeaveRequestFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [employeeData, setEmployeeData] = useState<EmployeeData | null>(null);
  const [colleagues, setColleagues] = useState<ColleagueOption[]>([]);
  const [customHolidayDates, setCustomHolidayDates] = useState<string[]>([]);
  const [carryoverDays, setCarryoverDays] = useState(0);
  const [bonusDays, setBonusDays] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [replacementId, setReplacementId] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [workingDays, setWorkingDays] = useState(0);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      fetchEmployeeData();
      fetchCustomHolidays();
    }
  }, [user]);

  useEffect(() => {
    if (startDate && endDate) {
      calculateWorkingDays();
    } else {
      setWorkingDays(0);
      setWarnings([]);
    }
  }, [startDate, endDate, customHolidayDates]);

  const fetchEmployeeData = async () => {
    if (!user) return;
    setLoading(true);

    // Get employee record
    const { data: record } = await supabase
      .from('employee_records')
      .select('id, total_leave_days, used_leave_days')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!record) {
      setLoading(false);
      return;
    }

    // Get personal data
    const { data: pd } = await supabase
      .from('employee_personal_data')
      .select('id, first_name, last_name, department, position, total_leave_days, used_leave_days, employee_record_id')
      .eq('employee_record_id', record.id)
      .maybeSingle();

    if (pd) {
      setEmployeeData({
        ...pd,
        total_leave_days: record.total_leave_days ?? pd.total_leave_days ?? 21,
        used_leave_days: record.used_leave_days ?? pd.used_leave_days ?? 0,
      });

      // Fetch colleagues from same department
      if (pd.department) {
        const { data: deptColleagues } = await supabase
          .from('employee_personal_data')
          .select('id, first_name, last_name, position')
          .eq('department', pd.department)
          .eq('is_archived', false)
          .neq('id', pd.id);

        setColleagues(
          (deptColleagues || []).map(c => ({
            id: c.id,
            name: `${c.last_name} ${c.first_name}`,
            position: c.position,
          }))
        );
      }

      // Fetch carryover & bonus
      const currentYear = new Date().getFullYear();
      const { data: carryovers } = await supabase
        .from('leave_carryover')
        .select('remaining_days')
        .eq('employee_personal_data_id', pd.id)
        .eq('to_year', currentYear);

      const { data: bonuses } = await supabase
        .from('leave_bonus')
        .select('bonus_days')
        .eq('employee_personal_data_id', pd.id)
        .eq('year', currentYear);

      setCarryoverDays((carryovers || []).reduce((s, c) => s + c.remaining_days, 0));
      setBonusDays((bonuses || []).reduce((s, b) => s + b.bonus_days, 0));
    }

    setLoading(false);
  };

  const fetchCustomHolidays = async () => {
    const { data } = await supabase.from('custom_holidays').select('holiday_date');
    setCustomHolidayDates((data || []).map(h => h.holiday_date));
  };

  const calculateWorkingDays = () => {
    if (!startDate || !endDate) return;

    try {
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      if (end < start) {
        setWorkingDays(0);
        setWarnings(['Data de sfârșit trebuie să fie după data de început.']);
        return;
      }

      const allDays = eachDayOfInterval({ start, end });
      const w: string[] = [];
      let count = 0;

      allDays.forEach(day => {
        if (!isDayOff(day, customHolidayDates)) {
          count++;
        } else if (isPublicHoliday(day)) {
          w.push(`${format(day, 'dd.MM.yyyy')} este sărbătoare legală`);
        }
      });

      if (count === 0) {
        w.push('Perioada selectată nu conține zile lucrătoare.');
      }

      setWorkingDays(count);
      setWarnings(w);
    } catch {
      setWorkingDays(0);
    }
  };

  const availableDays = (employeeData?.total_leave_days ?? 0) + carryoverDays + bonusDays - (employeeData?.used_leave_days ?? 0);

  // Calculate how days would be deducted: 2025 carryover first, then 2026
  const deductionBreakdown = (() => {
    if (workingDays <= 0) return { from2025: 0, from2026: 0 };
    const from2025 = Math.min(workingDays, carryoverDays);
    const from2026 = workingDays - from2025;
    return { from2025, from2026 };
  })();

  const handleSubmit = async () => {
    if (!user || !employeeData || !signature || !startDate || !endDate || !replacementId) {
      toast({ title: 'Eroare', description: 'Completați toate câmpurile și semnați cererea.', variant: 'destructive' });
      return;
    }

    if (workingDays <= 0) {
      toast({ title: 'Eroare', description: 'Perioada selectată nu conține zile lucrătoare.', variant: 'destructive' });
      return;
    }

    if (workingDays > availableDays) {
      toast({ title: 'Eroare', description: `Nu aveți suficiente zile disponibile (${availableDays} zile).`, variant: 'destructive' });
      return;
    }

    setSubmitting(true);

    const selectedColleague = colleagues.find(c => c.id === replacementId);

    // Lookup designated approver: per-employee first, then per-department fallback
    let designatedApproverId: string | null = null;
    const { data: approverMapping } = await supabase
      .from('leave_approvers')
      .select('approver_user_id')
      .eq('employee_user_id', user.id)
      .maybeSingle();

    if (approverMapping) {
      designatedApproverId = approverMapping.approver_user_id;
    } else if (employeeData.department) {
      // Fallback: check department-level approver
      const { data: deptApprover } = await supabase
        .from('leave_department_approvers')
        .select('approver_user_id')
        .eq('department', employeeData.department)
        .maybeSingle();
      if (deptApprover) {
        designatedApproverId = deptApprover.approver_user_id;
      }
    }

    const { data: insertedRequest, error } = await supabase.from('leave_requests').insert({
      user_id: user.id,
      epd_id: employeeData.id,
      start_date: startDate,
      end_date: endDate,
      working_days: workingDays,
      year: new Date().getFullYear(),
      replacement_name: selectedColleague?.name || '',
      replacement_position: selectedColleague?.position || '',
      status: 'pending_department_head' as any,
      employee_signature: signature,
      employee_signed_at: new Date().toISOString(),
      director_approved_at: new Date().toISOString(),
      approver_id: designatedApproverId,
    } as any).select('id, request_number').single();

    if (error) {
      console.error('Error creating leave request:', error);
      toast({ title: 'Eroare', description: 'Nu s-a putut trimite cererea.', variant: 'destructive' });
    } else {
      // Notify department heads (same department) via intranet notification
      if (insertedRequest) {
        const employeeName = `${employeeData.last_name} ${employeeData.first_name}`;
        
        if (designatedApproverId) {
          // Notify the designated approver directly
          await supabase.from('notifications').insert({
            user_id: designatedApproverId,
            title: 'Cerere nouă de concediu',
            message: `${employeeName} a depus cererea ${insertedRequest.request_number} (${workingDays} zile, ${formatDate(startDate)} - ${formatDate(endDate)}). Verifică și aprobă cererea.`,
            type: 'warning',
            related_type: 'leave_request',
            related_id: insertedRequest.id,
          });
        } else if (employeeData.department) {
          // Fallback: notify all dept heads in same department
          const { data: deptHeadProfiles } = await supabase
            .from('profiles')
            .select('user_id, department')
            .eq('department', employeeData.department);

          if (deptHeadProfiles) {
            for (const profile of deptHeadProfiles) {
              const { data: roleData } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', profile.user_id)
                .in('role', ['sef', 'sef_srus'])
                .maybeSingle();

              if (roleData) {
                await supabase.from('notifications').insert({
                  user_id: profile.user_id,
                  title: 'Cerere nouă de concediu',
                  message: `${employeeName} a depus cererea ${insertedRequest.request_number} (${workingDays} zile, ${formatDate(startDate)} - ${formatDate(endDate)}). Verifică și aprobă cererea.`,
                  type: 'warning',
                  related_type: 'leave_request',
                  related_id: insertedRequest.id,
                });
              }
            }
          }
        }
      }

      toast({ title: 'Cerere trimisă', description: 'Cererea de concediu a fost trimisă la șeful de compartiment pentru aprobare.' });

      // Trimite email către șeful de departament (non-blocking)
      const selectedColleagueForEmail = colleagues.find(c => c.id === replacementId);
      supabase.functions.invoke('notify-leave-email', {
        body: {
          employee_name: `${employeeData.last_name} ${employeeData.first_name}`,
          department: employeeData.department,
          request_number: insertedRequest.request_number,
          start_date: formatDate(startDate),
          end_date: formatDate(endDate),
          working_days: workingDays,
          replacement_name: selectedColleagueForEmail?.name || '',
          approver_user_id: designatedApproverId || null,
        },
      }).then(res => {
        if (res.error) console.warn('Email notification failed:', res.error);
        else console.log('Email notification sent successfully');
      }).catch(err => console.warn('Email notification error:', err));

      onSubmitted();
    }

    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!employeeData) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Nu s-au găsit datele angajatului. Contactați departamentul HR.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Cerere Concediu de Odihnă
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Auto-filled info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg bg-muted/50 border border-border">
          <div>
            <Label className="text-xs text-muted-foreground">Nume și prenume</Label>
            <p className="font-medium">{employeeData.last_name} {employeeData.first_name}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Funcția</Label>
            <p className="font-medium">{employeeData.position || 'N/A'}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Compartimentul</Label>
            <p className="font-medium">{employeeData.department || 'N/A'}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Sold concediu disponibil</Label>
            <p className="font-medium text-primary">
              {availableDays} zile
            </p>
            <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
              <p>• {employeeData.total_leave_days} cuvenite {new Date().getFullYear()} − {employeeData.used_leave_days} utilizate = <strong>{employeeData.total_leave_days - employeeData.used_leave_days}</strong></p>
              {carryoverDays > 0 && <p>• {carryoverDays} zile report {new Date().getFullYear() - 1}</p>}
              {bonusDays > 0 && <p>• {bonusDays} zile Sold+ (suplimentar)</p>}
            </div>
            {carryoverDays > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                ⚠ Se consumă mai întâi soldul din {new Date().getFullYear() - 1} ({carryoverDays} zile disponibile)
              </p>
            )}
          </div>
        </div>

        {/* Period selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="start_date">Data început *</Label>
            <Input
              id="start_date"
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              min={format(new Date(), 'yyyy-MM-dd')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end_date">Data sfârșit *</Label>
            <Input
              id="end_date"
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              min={startDate || format(new Date(), 'yyyy-MM-dd')}
            />
          </div>
        </div>

        {/* Working days display */}
        {workingDays > 0 && (
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 space-y-1">
            <p className="font-medium text-primary">
              Zile lucrătoare solicitate: <strong>{workingDays}</strong>
            </p>
            {carryoverDays > 0 && workingDays > 0 && (
              <p className="text-xs text-muted-foreground">
                Se vor consuma: <strong>{deductionBreakdown.from2025} zile din soldul 2025</strong>
                {deductionBreakdown.from2026 > 0 && <> și <strong>{deductionBreakdown.from2026} zile din soldul 2026</strong></>}
              </p>
            )}
          </div>
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 space-y-1">
            {warnings.map((w, i) => (
              <p key={i} className="text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
                {w}
              </p>
            ))}
          </div>
        )}

        {/* Replacement */}
        <div className="space-y-2">
          <Label>Înlocuitor pe perioada concediului *</Label>
          <Select value={replacementId} onValueChange={setReplacementId}>
            <SelectTrigger>
              <SelectValue placeholder="Selectați înlocuitorul" />
            </SelectTrigger>
            <SelectContent>
              {colleagues.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} {c.position ? `- ${c.position}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {colleagues.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Nu s-au găsit colegi în același departament.
            </p>
          )}
        </div>

        {/* Signature */}
        <SignaturePad
          onSave={setSignature}
          existingSignature={signature}
          label="Semnătura angajat"
        />

        {/* Submit */}
        <div className="flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={submitting || !signature || !startDate || !endDate || !replacementId || workingDays <= 0}
            className="gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Trimite Cererea
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
