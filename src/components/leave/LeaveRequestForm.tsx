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

    const { error } = await supabase.from('leave_requests').insert({
      user_id: user.id,
      epd_id: employeeData.id,
      start_date: startDate,
      end_date: endDate,
      working_days: workingDays,
      year: new Date().getFullYear(),
      replacement_name: selectedColleague?.name || '',
      replacement_position: selectedColleague?.position || '',
      status: 'pending_director' as any,
      employee_signature: signature,
      employee_signed_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Error creating leave request:', error);
      toast({ title: 'Eroare', description: 'Nu s-a putut trimite cererea.', variant: 'destructive' });
    } else {
      toast({ title: 'Cerere trimisă', description: 'Cererea de concediu a fost trimisă pentru aprobare.' });
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
              <span className="text-xs text-muted-foreground ml-2">
                ({employeeData.total_leave_days} bază + {carryoverDays} reportate + {bonusDays} bonus - {employeeData.used_leave_days} utilizate)
              </span>
            </p>
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
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
            <p className="font-medium text-primary">
              Zile lucrătoare solicitate: <strong>{workingDays}</strong>
            </p>
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
