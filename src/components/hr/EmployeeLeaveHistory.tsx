import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { LeaveEditDialog } from '@/components/profile/LeaveEditDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { History, Pencil, Trash2, Loader2, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

interface EmployeeLeaveHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeName: string;
  userId: string;
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

export const EmployeeLeaveHistory = ({ open, onOpenChange, employeeName, userId, employeeRecordId, onChanged }: EmployeeLeaveHistoryProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [leaves, setLeaves] = useState<LeaveHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingLeave, setEditingLeave] = useState<LeaveHistoryItem | null>(null);

  useEffect(() => {
    if (open && userId) fetchLeaves();
  }, [open, userId]);

  const fetchLeaves = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('hr_requests')
      .select('id, status, details, created_at')
      .eq('user_id', userId)
      .eq('request_type', 'concediu')
      .order('created_at', { ascending: false });
    setLeaves(data || []);
    setLoading(false);
  };

  const deleteLeave = async (leave: LeaveHistoryItem) => {
    if (!confirm('Sigur doriți să ștergeți acest concediu? Zilele vor fi readăugate în sold.')) return;
    setDeletingId(leave.id);
    try {
      const numberOfDays = leave.details?.numberOfDays || 0;

      const { error } = await supabase.from('hr_requests').delete().eq('id', leave.id);
      if (error) throw error;

      if (numberOfDays > 0 && employeeRecordId) {
        const { data: record } = await supabase
          .from('employee_records')
          .select('id, used_leave_days')
          .eq('id', employeeRecordId)
          .single();

        if (record) {
          const newUsedDays = Math.max(0, record.used_leave_days - numberOfDays);
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

      if (user) {
        await supabase.rpc('log_audit_event', {
          _user_id: user.id,
          _action: 'leave_delete',
          _entity_type: 'hr_request',
          _entity_id: leave.id,
          _details: {
            employee_name: employeeName,
            days_reverted: numberOfDays,
            period: `${leave.details?.startDate || '?'} - ${leave.details?.endDate || '?'}`,
          },
        });
      }

      toast({ title: 'Șters', description: `Concediul a fost șters. ${numberOfDays} zile readăugate în sold.` });
      fetchLeaves();
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
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Istoric Concedii — {employeeName}
            </DialogTitle>
            <DialogDescription>
              Vizualizați, editați sau ștergeți concediile înregistrate.
            </DialogDescription>
          </DialogHeader>

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

                return (
                  <div key={leave.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 border rounded-lg hover:bg-muted/40 transition-colors">
                    <div className="space-y-0.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">
                          {startDate && endDate
                            ? `${format(startDate, 'dd MMM', { locale: ro })} — ${format(endDate, 'dd MMM yyyy', { locale: ro })}`
                            : 'Perioadă nespecificată'}
                        </p>
                        <Badge variant={status.variant} className="text-xs">{status.label}</Badge>
                        {details.manualEntry && <Badge variant="outline" className="text-[10px]">HR</Badge>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {details.numberOfDays && <span className="font-medium">{details.numberOfDays} zile</span>}
                        <span>Înreg.: {format(new Date(leave.created_at), 'dd MMM yyyy', { locale: ro })}</span>
                      </div>
                      {details.notes && <p className="text-xs text-muted-foreground italic mt-1">{details.notes}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => setEditingLeave(leave)}>
                        <Pencil className="w-4 h-4 mr-1" />
                        Editează
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteLeave(leave)}
                        disabled={deletingId === leave.id}
                      >
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
        onSaved={() => { fetchLeaves(); onChanged(); }}
      />
    </>
  );
};
