import { useState, useEffect, useRef } from 'react';
import { NON_DEDUCTIBLE_TYPES, LEAVE_TYPES, getLeaveStyle } from '@/utils/leaveTypes';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { LeaveEditDialog } from '@/components/profile/LeaveEditDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { History, Pencil, Trash2, Loader2, Calendar, Paperclip, Download, Plus, AlertTriangle, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { isPublicHoliday, getPublicHolidayName } from '@/utils/romanianHolidays';

interface EmployeeLeaveHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeName: string;
  userId?: string;
  epdId?: string;
  employeeRecordId: string | null;
  onChanged: () => void;
}

interface LeaveHistoryItem {
  id: string;
  status: string;
  details: any;
  created_at: string;
}

const leaveStatusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  approved: { label: 'Aprobat', variant: 'default' },
  pending: { label: 'În așteptare', variant: 'secondary' },
  rejected: { label: 'Respins', variant: 'destructive' },
};

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

export const EmployeeLeaveHistory = ({ open, onOpenChange, employeeName, userId, epdId, employeeRecordId, onChanged }: EmployeeLeaveHistoryProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [leaves, setLeaves] = useState<LeaveHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingLeave, setEditingLeave] = useState<LeaveHistoryItem | null>(null);

  // Manual add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [addStartDate, setAddStartDate] = useState('');
  const [addEndDate, setAddEndDate] = useState('');
  const [addLeaveType, setAddLeaveType] = useState('co');
  const [addNotes, setAddNotes] = useState('');
  const [addDeductFrom, setAddDeductFrom] = useState<'auto' | 'carryover' | 'current'>('auto');
  const [addSaving, setAddSaving] = useState(false);
  const [addFile, setAddFile] = useState<File | null>(null);
  const [customHolidayDates, setCustomHolidayDates] = useState<string[]>([]);
  const [customHolidayNames, setCustomHolidayNames] = useState<Record<string, string>>({});
  const [carryoverDays, setCarryoverDays] = useState(0);
  const [carryoverRecord, setCarryoverRecord] = useState<{ id: string; used_days: number; remaining_days: number } | null>(null);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [totalLeaveDays, setTotalLeaveDays] = useState(21);
  const [overlaps, setOverlaps] = useState<string[]>([]);
  const submitGuard = useRef(false);

  useEffect(() => {
    if (open && (userId || epdId)) {
      fetchLeaves();
      fetchHolidays();
      fetchCarryoverData();
    }
    if (!open) {
      setShowAddForm(false);
      resetAddForm();
    }
  }, [open, userId, epdId]);

  const fetchHolidays = async () => {
    const { data } = await supabase.from('custom_holidays').select('holiday_date, name');
    if (data) {
      setCustomHolidayDates(data.map(h => h.holiday_date));
      const names: Record<string, string> = {};
      data.forEach(h => { names[h.holiday_date] = h.name; });
      setCustomHolidayNames(names);
    }
  };

  const fetchCarryoverData = async () => {
    const resolvedEpdId = epdId;
    let epd: any = null;
    if (resolvedEpdId) {
      const { data } = await supabase.from('employee_personal_data').select('id, total_leave_days, used_leave_days').eq('id', resolvedEpdId).maybeSingle();
      epd = data;
    } else if (employeeRecordId) {
      const { data } = await supabase.from('employee_personal_data').select('id, total_leave_days, used_leave_days').eq('employee_record_id', employeeRecordId).maybeSingle();
      epd = data;
    }
    if (epd) {
      setTotalLeaveDays(epd.total_leave_days || 21);
      setCurrentBalance((epd.total_leave_days || 21) - (epd.used_leave_days || 0));
      const currentYear = new Date().getFullYear();
      const { data: co } = await supabase.from('leave_carryover').select('id, used_days, remaining_days').eq('employee_personal_data_id', epd.id).eq('from_year', currentYear - 1).eq('to_year', currentYear).maybeSingle();
      if (co) { setCarryoverDays(co.remaining_days); setCarryoverRecord(co); }
      else { setCarryoverDays(0); setCarryoverRecord(null); }
    }
  };

  const resetAddForm = () => {
    setAddStartDate(''); setAddEndDate(''); setAddLeaveType('co'); setAddNotes(''); setAddDeductFrom('auto'); setAddFile(null); setOverlaps([]);
    submitGuard.current = false;
  };

  // Check overlaps when dates change
  useEffect(() => {
    if (!addStartDate || !addEndDate || !epdId) { setOverlaps([]); return; }
    checkOverlaps();
  }, [addStartDate, addEndDate]);

  const checkOverlaps = async () => {
    if (!epdId || !addStartDate || !addEndDate) return;
    const { data: epd } = await supabase.from('employee_personal_data').select('department').eq('id', epdId).maybeSingle();
    if (!epd?.department) return;
    const { data: colleagues } = await supabase.from('employee_personal_data').select('id, first_name, last_name').eq('department', epd.department).eq('is_archived', false).neq('id', epdId);
    if (!colleagues?.length) return;
    const colIds = colleagues.map(c => c.id);
    const { data: colLeaves } = await supabase.from('hr_requests').select('details').eq('request_type', 'concediu').eq('status', 'approved').in('details->>epd_id', colIds);
    const found: string[] = [];
    (colLeaves || []).forEach((lr: any) => {
      const d = lr.details || {};
      if (d.startDate && d.endDate && d.startDate <= addEndDate && d.endDate >= addStartDate) {
        const col = colleagues.find(c => c.id === d.epd_id);
        if (col) found.push(`${col.last_name} ${col.first_name} (${d.startDate} - ${d.endDate})`);
      }
    });
    setOverlaps(found);
  };

  const addWorkingDays = addStartDate && addEndDate ? calculateWorkingDays(addStartDate, addEndDate, customHolidayDates) : 0;
  const isDeductible = LEAVE_TYPES.find(t => t.key === addLeaveType)?.deductible ?? true;

  const getNonWorkingDays = (start: string, end: string) => {
    const s = new Date(start); const e = new Date(end);
    const result: { date: string; reason: string }[] = [];
    const cur = new Date(s);
    while (cur <= e) {
      const dow = cur.getDay(); const dateStr = format(cur, 'yyyy-MM-dd'); const fDate = format(cur, 'dd.MM.yyyy');
      if (dow === 0 || dow === 6) result.push({ date: fDate, reason: dow === 0 ? 'Duminică' : 'Sâmbătă' });
      else if (isPublicHoliday(cur)) result.push({ date: fDate, reason: getPublicHolidayName(cur) || 'Sărbătoare legală' });
      else if (customHolidayDates.includes(dateStr)) result.push({ date: fDate, reason: customHolidayNames[dateStr] || 'Zi liberă instituție' });
      cur.setDate(cur.getDate() + 1);
    }
    return result;
  };

  const handleAddLeave = async () => {
    if (!user || !addStartDate || !addEndDate || addWorkingDays <= 0) return;
    if (submitGuard.current) return;
    submitGuard.current = true;
    setAddSaving(true);

    try {
      let scannedDocumentUrl: string | null = null;
      let scannedDocumentName: string | null = null;

      // Upload attachment if provided
      if (addFile) {
        const ext = addFile.name.split('.').pop();
        const storagePath = `${epdId || userId || 'unknown'}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('employee-documents').upload(storagePath, addFile);
        if (upErr) throw upErr;
        scannedDocumentUrl = storagePath;
        scannedDocumentName = addFile.name;

        // Also save in employee_documents table
        const docType = addLeaveType === 'cm' ? 'scanare_cm' : addLeaveType === 'ev' ? 'scanare_ev' : 'scanare_concediu';
        await supabase.from('employee_documents').insert({
          user_id: epdId || userId || '',
          document_type: docType,
          name: addFile.name,
          file_url: storagePath,
          uploaded_by: user.id,
        });
      }

      // Distribute deduction
      let daysFromCarryover = 0;
      let daysFromCurrent = 0;
      if (isDeductible) {
        if (addDeductFrom === 'carryover') {
          daysFromCarryover = Math.min(addWorkingDays, carryoverDays);
          daysFromCurrent = addWorkingDays - daysFromCarryover;
        } else if (addDeductFrom === 'current') {
          daysFromCurrent = addWorkingDays;
        } else {
          daysFromCarryover = Math.min(addWorkingDays, carryoverDays);
          daysFromCurrent = addWorkingDays - daysFromCarryover;
        }
      }

      const details: any = {
        startDate: addStartDate,
        endDate: addEndDate,
        numberOfDays: addWorkingDays,
        leaveType: addLeaveType,
        notes: addNotes || undefined,
        manualEntry: true,
        epd_id: epdId || undefined,
        registeredBy: user.id,
        registeredAt: new Date().toISOString(),
        deductFrom: addDeductFrom,
        daysFromCarryover,
        daysFromCurrent,
        year: new Date(addStartDate).getFullYear(),
      };
      if (scannedDocumentUrl) {
        details.scannedDocumentUrl = scannedDocumentUrl;
        details.scannedDocumentName = scannedDocumentName;
      }

      const { error } = await supabase.from('hr_requests').insert({
        user_id: userId || user.id,
        request_type: 'concediu' as any,
        status: 'approved' as any,
        details: details as any,
      });
      if (error) {
        if (error.code === '23505') {
          toast({ title: 'Cerere duplicat', description: 'Un concediu cu aceeași perioadă există deja.', variant: 'destructive' });
          setAddSaving(false); submitGuard.current = false; return;
        }
        throw error;
      }

      // Recalculate balances using centralized DB function (FIFO)
      if (isDeductible && epdId) {
        await supabase.rpc('recalculate_leave_balance', { target_epd_id: epdId });
      }

      // Audit log
      await supabase.rpc('log_audit_event', {
        _user_id: user.id,
        _action: 'leave_manual_add',
        _entity_type: 'hr_request',
        _entity_id: epdId || userId || '',
        _details: {
          employee_name: employeeName,
          period: `${addStartDate} - ${addEndDate}`,
          days: addWorkingDays,
          leave_type: addLeaveType,
          deduct_from: addDeductFrom,
        },
      });

      toast({ title: 'Înregistrat', description: `Concediu de ${addWorkingDays} zile adăugat pentru ${employeeName}.` });
      resetAddForm();
      setShowAddForm(false);
      fetchLeaves();
      fetchCarryoverData();
      onChanged();
    } catch (err) {
      console.error('Add leave error:', err);
      toast({ title: 'Eroare', description: 'Nu s-a putut înregistra concediul.', variant: 'destructive' });
    }
    setAddSaving(false);
    submitGuard.current = false;
  };

  const fetchLeaves = async () => {
    setLoading(true);
    let allLeaves: LeaveHistoryItem[] = [];

    if (userId) {
      const { data } = await supabase.from('hr_requests').select('id, status, details, created_at').eq('user_id', userId).eq('request_type', 'concediu').order('created_at', { ascending: false });
      if (data) {
        const filtered = data.filter((item) => {
          const d = item.details as any;
          const targetEpdId = typeof d?.epd_id === 'string' ? d.epd_id : null;
          if (epdId && targetEpdId && targetEpdId !== epdId) return false;
          if (d?.manualEntry && targetEpdId && !epdId) return false;
          return true;
        });
        allLeaves = [...allLeaves, ...filtered];
      }
    }

    if (epdId) {
      const { data } = await supabase.from('hr_requests').select('id, status, details, created_at').eq('request_type', 'concediu').contains('details', { epd_id: epdId }).order('created_at', { ascending: false });
      if (data) {
        const existingIds = new Set(allLeaves.map(l => l.id));
        allLeaves = [...allLeaves, ...data.filter(l => !existingIds.has(l.id))];
      }
    }

    if (userId) {
      const { data } = await supabase.from('leave_requests').select('id, status, start_date, end_date, working_days, year, created_at, request_number, epd_id').eq('user_id', userId).order('created_at', { ascending: false });
      if (data) {
        const existingIds = new Set(allLeaves.map(l => l.id));
        const mapped = data.filter((lr) => !epdId || !lr.epd_id || lr.epd_id === epdId).filter((lr) => !existingIds.has(lr.id)).map((lr) => ({
          id: lr.id,
          status: lr.status === 'approved' ? 'approved' : lr.status === 'rejected' ? 'rejected' : 'pending',
          details: { startDate: lr.start_date, endDate: lr.end_date, numberOfDays: lr.working_days, leaveType: 'co', source: 'leave_requests', request_number: lr.request_number, year: (lr as any).year },
          created_at: lr.created_at,
        }));
        allLeaves = [...allLeaves, ...mapped];
      }
    }

    if (epdId) {
      const { data } = await supabase.from('leave_requests').select('id, status, start_date, end_date, working_days, year, created_at, request_number').eq('epd_id', epdId).order('created_at', { ascending: false });
      if (data) {
        const existingIds = new Set(allLeaves.map(l => l.id));
        const mapped = data.filter(l => !existingIds.has(l.id)).map(lr => ({
          id: lr.id,
          status: lr.status === 'approved' ? 'approved' : lr.status === 'rejected' ? 'rejected' : 'pending',
          details: { startDate: lr.start_date, endDate: lr.end_date, numberOfDays: lr.working_days, leaveType: 'co', source: 'leave_requests', request_number: lr.request_number, year: (lr as any).year },
          created_at: lr.created_at,
        }));
        allLeaves = [...allLeaves, ...mapped];
      }
    }

    allLeaves.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setLeaves(allLeaves);
    setLoading(false);
  };

  const deleteLeave = async (leave: LeaveHistoryItem) => {
    if (!confirm('Sigur doriți să ștergeți acest concediu? Zilele vor fi readăugate în sold.')) return;
    setDeletingId(leave.id);
    try {
      const numberOfDays = leave.details?.numberOfDays || 0;
      const leaveEpdId = leave.details?.epd_id || epdId;
      const leaveType = (leave.details?.leaveType || leave.details?.leave_type || 'co').toLowerCase();
      const isNonDeductible = NON_DEDUCTIBLE_TYPES.includes(leaveType);

      const { error } = await supabase.from('hr_requests').delete().eq('id', leave.id);
      if (error) throw error;

      if (!isNonDeductible) {
        if (numberOfDays > 0 && employeeRecordId) {
          const { data: record } = await supabase.from('employee_records').select('id, used_leave_days').eq('id', employeeRecordId).single();
          if (record) {
            const newUsedDays = Math.max(0, record.used_leave_days - numberOfDays);
            await supabase.from('employee_records').update({ used_leave_days: newUsedDays }).eq('id', record.id);
          }
        }

        if (numberOfDays > 0 && leaveEpdId) {
      // Recalculate balance after deletion using centralized DB function
      if (!isNonDeductible) {
        const targetId = leaveEpdId || epdId;
        if (targetId) {
          await supabase.rpc('recalculate_leave_balance', { target_epd_id: targetId });
        }
      }

      if (user) {
        await supabase.rpc('log_audit_event', {
          _user_id: user.id, _action: 'leave_delete', _entity_type: 'hr_request', _entity_id: leave.id,
          _details: { employee_name: employeeName, days_reverted: numberOfDays, period: `${leave.details?.startDate || '?'} - ${leave.details?.endDate || '?'}` },
        });
      }

      const revertMsg = isNonDeductible ? 'Concediul a fost șters (fără impact asupra soldului).' : `Concediul a fost șters. ${numberOfDays} zile readăugate în sold.`;
      toast({ title: 'Șters', description: revertMsg });
      fetchLeaves();
      fetchCarryoverData();
      onChanged();
    } catch (err) {
      console.error('Delete leave error:', err);
      toast({ title: 'Eroare', description: 'Nu s-a putut șterge concediul.', variant: 'destructive' });
    }
    setDeletingId(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Istoric Concedii — {employeeName}
            </DialogTitle>
            <DialogDescription>
              Vizualizați, adăugați, editați sau ștergeți concediile înregistrate.
            </DialogDescription>
          </DialogHeader>

          {/* Add Leave Button */}
          {!showAddForm && (
            <Button variant="outline" className="w-full gap-2 border-dashed" onClick={() => setShowAddForm(true)}>
              <Plus className="w-4 h-4" />
              Înregistrează concediu manual
            </Button>
          )}

          {/* Manual Add Form */}
          {showAddForm && (
            <div className="space-y-4 p-4 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Plus className="w-4 h-4 text-primary" />
                  Concediu Nou
                </h4>
                <Button variant="ghost" size="sm" onClick={() => { setShowAddForm(false); resetAddForm(); }}>Anulează</Button>
              </div>

              <div className="space-y-2">
                <Label>Tip Absență</Label>
                <Select value={addLeaveType} onValueChange={setAddLeaveType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEAVE_TYPES.map(t => (
                      <SelectItem key={t.key} value={t.key}>
                        <span className="flex items-center gap-2">
                          <span className={`font-bold ${t.color}`}>{t.label}</span>
                          <span className="text-muted-foreground">— {t.description}</span>
                          {!t.deductible && <Badge variant="outline" className="text-[10px] ml-1">Nu scade din sold</Badge>}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Data Început</Label>
                  <Input type="date" value={addStartDate} onChange={(e) => setAddStartDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Data Sfârșit</Label>
                  <Input type="date" value={addEndDate} onChange={(e) => setAddEndDate(e.target.value)} />
                </div>
              </div>

              {/* Working days info */}
              {addStartDate && addEndDate && (() => {
                const nonWorking = getNonWorkingDays(addStartDate, addEndDate);
                const holidays = nonWorking.filter(d => d.reason !== 'Sâmbătă' && d.reason !== 'Duminică');
                return (
                  <>
                    {holidays.length > 0 && (
                      <div className="p-2.5 rounded-lg space-y-1 bg-amber-500/10 border border-amber-500/30">
                        <p className="text-xs font-medium text-amber-700 dark:text-amber-300">📅 Zile libere excluse automat:</p>
                        {holidays.map((d, i) => <p key={i} className="text-xs text-amber-600 dark:text-amber-400">• <span className="font-medium">{d.date}</span> — {d.reason}</p>)}
                      </div>
                    )}
                    <div className={`p-2.5 rounded-lg text-sm ${addWorkingDays <= 0 ? 'bg-destructive/10 border border-destructive/30' : 'bg-muted'}`}>
                      {addWorkingDays <= 0 ? (
                        <p className="text-sm font-medium text-destructive">🚫 Perioada nu conține zile lucrătoare!</p>
                      ) : (
                        <p>Zile lucrătoare: <span className="font-bold text-primary">{addWorkingDays}</span></p>
                      )}
                    </div>
                  </>
                );
              })()}

              {/* Overlap warning */}
              {overlaps.length > 0 && (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-300 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Suprapunere cu colegi din departament:
                  </p>
                  {overlaps.map((o, i) => <p key={i} className="text-xs text-amber-600 dark:text-amber-400 ml-5">• {o}</p>)}
                </div>
              )}

              {/* Deduction source - only for deductible types with carryover */}
              {isDeductible && carryoverDays > 0 && addWorkingDays > 0 && (
                <div className="space-y-2">
                  <Label>Deduce din *</Label>
                  <RadioGroup value={addDeductFrom} onValueChange={(v) => setAddDeductFrom(v as any)} className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="auto" id="add-auto" />
                      <Label htmlFor="add-auto" className="text-sm font-normal cursor-pointer">Automat (mai întâi report {new Date().getFullYear() - 1}, apoi {new Date().getFullYear()})</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="carryover" id="add-carry" />
                      <Label htmlFor="add-carry" className="text-sm font-normal cursor-pointer">Doar report {new Date().getFullYear() - 1} ({carryoverDays} zile)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="current" id="add-current" />
                      <Label htmlFor="add-current" className="text-sm font-normal cursor-pointer">Doar sold {new Date().getFullYear()} ({currentBalance} zile)</Label>
                    </div>
                  </RadioGroup>
                </div>
              )}

              {/* File attachment */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><Paperclip className="w-3.5 h-3.5" /> Scanare atașată (opțional)</Label>
                <Input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={(e) => setAddFile(e.target.files?.[0] || null)} />
                {addFile && <p className="text-xs text-muted-foreground">{addFile.name}</p>}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Observații (opțional)</Label>
                <Textarea placeholder="Observații..." value={addNotes} onChange={(e) => setAddNotes(e.target.value)} rows={2} />
              </div>

              <Button className="w-full" onClick={handleAddLeave} disabled={addSaving || !addStartDate || !addEndDate || addWorkingDays <= 0}>
                {addSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Salvează ({addWorkingDays} zile{!isDeductible ? ', fără deducere' : ''})
              </Button>
            </div>
          )}

          {/* Existing leaves list */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : leaves.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nu există concedii înregistrate.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {leaves.map((leave) => {
                const details = leave.details || {};
                const status = leaveStatusConfig[leave.status] || leaveStatusConfig.pending;
                const startDate = details.startDate ? new Date(details.startDate) : null;
                const endDate = details.endDate ? new Date(details.endDate) : null;
                const leaveType = (details.leaveType || details.leave_type || 'co').toLowerCase();
                const typeStyle = getLeaveStyle(leaveType);

                return (
                  <div key={leave.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 border rounded-lg hover:bg-muted/40 transition-colors">
                    <div className="space-y-0.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`text-[10px] font-bold ${typeStyle.color} ${typeStyle.bg} border-0`}>{typeStyle.label}</Badge>
                        <p className="font-medium text-sm">
                          {startDate && endDate
                            ? `${format(startDate, 'dd.MM.yyyy', { locale: ro })} — ${format(endDate, 'dd.MM.yyyy', { locale: ro })}`
                            : 'Perioadă nespecificată'}
                        </p>
                        <Badge variant={status.variant} className="text-xs">{status.label}</Badge>
                        {details.manualEntry && <Badge variant="outline" className="text-[10px]">HR</Badge>}
                        {details.source === 'leave_requests' && <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800">Online</Badge>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        {details.numberOfDays && <span className="font-medium">{details.numberOfDays} zile</span>}
                        {details.year && <span>An: {details.year}</span>}
                        {details.request_number && <span className="font-mono">{details.request_number}</span>}
                        <span>Înreg.: {format(new Date(leave.created_at), 'dd MMM yyyy', { locale: ro })}</span>
                      </div>
                      {details.notes && <p className="text-xs text-muted-foreground italic mt-1">{details.notes}</p>}
                      {details.scannedDocumentUrl && (
                        <button
                          className="flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                          onClick={async () => {
                            try {
                              const { data, error } = await supabase.storage.from('employee-documents').download(details.scannedDocumentUrl);
                              if (error) throw error;
                              const url = URL.createObjectURL(data);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = details.scannedDocumentName || details.scannedDocumentUrl.split('/').pop() || 'document';
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              URL.revokeObjectURL(url);
                            } catch (err) {
                              console.error('Download error:', err);
                            }
                          }}
                        >
                          <Paperclip className="w-3 h-3" />
                          {details.scannedDocumentName || 'Scanare atașată'}
                          <Download className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => setEditingLeave(leave)}>
                        <Pencil className="w-4 h-4 mr-1" />
                        Editează
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => deleteLeave(leave)} disabled={deletingId === leave.id}>
                        {deletingId === leave.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
                        Șterge
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <LeaveEditDialog
        open={!!editingLeave}
        onOpenChange={(o) => { if (!o) setEditingLeave(null); }}
        leave={editingLeave}
        employeeRecordId={employeeRecordId}
        epdId={epdId}
        onSaved={() => { fetchLeaves(); fetchCarryoverData(); onChanged(); }}
      />
    </>
  );
};