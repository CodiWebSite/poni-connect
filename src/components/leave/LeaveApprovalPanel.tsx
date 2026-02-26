import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, Loader2, Eye } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ro } from 'date-fns/locale';

interface LeaveRequest {
  id: string;
  user_id: string;
  epd_id: string;
  request_number: string;
  start_date: string;
  end_date: string;
  working_days: number;
  year: number;
  replacement_name: string;
  replacement_position: string | null;
  status: string;
  created_at: string;
  employee_name?: string;
  employee_department?: string;
  employee_position?: string;
}

interface LeaveApprovalPanelProps {
  onUpdated: () => void;
}

export function LeaveApprovalPanel({ onUpdated }: LeaveApprovalPanelProps) {
  const { user } = useAuth();
  const { role, isSuperAdmin } = useUserRole();
  const { toast } = useToast();

  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectDialog, setRejectDialog] = useState<LeaveRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [detailsDialog, setDetailsDialog] = useState<LeaveRequest | null>(null);

  const isDeptHead = role === 'sef' || role === 'sef_srus' || isSuperAdmin;

  useEffect(() => {
    fetchPendingRequests();
  }, [role]);

  const fetchPendingRequests = async () => {
    if (!isDeptHead) {
      setRequests([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('status', 'pending_department_head' as any)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching pending requests:', error);
      setLoading(false);
      return;
    }

    // Enrich with employee names
    const epdIds = [...new Set((data || []).map(r => r.epd_id).filter(Boolean))];
    let epdMap: Record<string, { name: string; department: string; position: string }> = {};

    if (epdIds.length > 0) {
      const { data: epdData } = await supabase
        .from('employee_personal_data')
        .select('id, first_name, last_name, department, position')
        .in('id', epdIds);

      (epdData || []).forEach(e => {
        epdMap[e.id] = {
          name: `${e.last_name} ${e.first_name}`,
          department: e.department || '',
          position: e.position || '',
        };
      });
    }

    let enrichedRequests = (data || []).map(r => ({
      ...r,
      employee_name: epdMap[r.epd_id]?.name || 'N/A',
      employee_department: epdMap[r.epd_id]?.department || '',
      employee_position: epdMap[r.epd_id]?.position || '',
    }));

    // For actual dept heads (not super admin), filter to own department
    if (!isSuperAdmin && user) {
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('department')
        .eq('user_id', user.id)
        .maybeSingle();

      if (myProfile?.department) {
        enrichedRequests = enrichedRequests.filter(
          r => r.employee_department.toLowerCase() === myProfile.department!.toLowerCase()
        );
      }
    }

    setRequests(enrichedRequests);
    setLoading(false);
  };

  const handleApprove = async (request: LeaveRequest) => {
    if (!user) return;
    setProcessing(request.id);

    const { error } = await supabase
      .from('leave_requests')
      .update({
        status: 'approved' as any,
        dept_head_id: user.id,
        dept_head_approved_at: new Date().toISOString(),
      })
      .eq('id', request.id);

    if (error) {
      toast({ title: 'Eroare', description: 'Nu s-a putut aproba cererea.', variant: 'destructive' });
    } else {
      // Deduct leave days
      await deductLeaveDays(request);

      // Notify employee
      await supabase.from('notifications').insert({
        user_id: request.user_id,
        title: 'Cerere concediu aprobată',
        message: `Cererea de concediu ${request.request_number} a fost aprobată de șeful de compartiment.`,
        type: 'success',
        related_type: 'leave_request',
        related_id: request.id,
      });

      toast({ title: 'Aprobat', description: `Cererea ${request.request_number} a fost aprobată.` });
      onUpdated();
      fetchPendingRequests();
    }

    setProcessing(null);
  };

  const deductLeaveDays = async (request: LeaveRequest) => {
    const currentYear = new Date().getFullYear();
    let daysToDeduct = request.working_days;

    // First, try to deduct from 2025 carryover
    const { data: carryovers } = await supabase
      .from('leave_carryover')
      .select('id, remaining_days, used_days')
      .eq('employee_personal_data_id', request.epd_id)
      .eq('to_year', currentYear)
      .gt('remaining_days', 0);

    if (carryovers && carryovers.length > 0) {
      for (const carry of carryovers) {
        if (daysToDeduct <= 0) break;
        const deductFromCarry = Math.min(daysToDeduct, carry.remaining_days);
        await supabase
          .from('leave_carryover')
          .update({
            used_days: carry.used_days + deductFromCarry,
            remaining_days: carry.remaining_days - deductFromCarry,
          })
          .eq('id', carry.id);
        daysToDeduct -= deductFromCarry;
      }
    }

    // Remaining days deduct from current year (employee_personal_data.used_leave_days)
    if (daysToDeduct > 0) {
      const { data: epd } = await supabase
        .from('employee_personal_data')
        .select('used_leave_days, employee_record_id')
        .eq('id', request.epd_id)
        .maybeSingle();

      if (epd) {
        await supabase
          .from('employee_personal_data')
          .update({ used_leave_days: (epd.used_leave_days || 0) + daysToDeduct })
          .eq('id', request.epd_id);
      }
    }
  };

  const handleReject = async () => {
    if (!user || !rejectDialog) return;
    setProcessing(rejectDialog.id);

    const { error } = await supabase
      .from('leave_requests')
      .update({
        status: 'rejected' as any,
        rejected_by: user.id,
        rejected_at: new Date().toISOString(),
        rejection_reason: rejectionReason || 'Respinsă fără motiv specificat.',
      })
      .eq('id', rejectDialog.id);

    if (error) {
      toast({ title: 'Eroare', description: 'Nu s-a putut respinge cererea.', variant: 'destructive' });
    } else {
      await supabase.from('notifications').insert({
        user_id: rejectDialog.user_id,
        title: 'Cerere concediu respinsă',
        message: `Cererea ${rejectDialog.request_number} a fost respinsă. Motiv: ${rejectionReason || 'Nespecificat'}`,
        type: 'warning',
        related_type: 'leave_request',
        related_id: rejectDialog.id,
      });

      toast({ title: 'Respins', description: `Cererea ${rejectDialog.request_number} a fost respinsă.` });
      setRejectDialog(null);
      setRejectionReason('');
      onUpdated();
      fetchPendingRequests();
    }

    setProcessing(null);
  };

  if (!isDeptHead && !loading) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Nu există cereri de aprobat.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {requests.map(request => (
          <Card key={request.id} className="border-l-4 border-l-warning">
            <CardContent className="pt-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{request.employee_name}</span>
                    <Badge variant="outline" className="text-xs">{request.request_number}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {request.employee_department} • {request.employee_position}
                  </p>
                  <p className="text-sm">
                    <strong>{request.working_days} zile</strong> • {format(parseISO(request.start_date), 'dd MMM yyyy', { locale: ro })} – {format(parseISO(request.end_date), 'dd MMM yyyy', { locale: ro })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Înlocuitor: {request.replacement_name}
                  </p>
                </div>

                <div className="flex gap-2 flex-shrink-0">
                  <Button variant="outline" size="sm" onClick={() => setDetailsDialog(request)}>
                    <Eye className="w-4 h-4 mr-1" />
                    Detalii
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleApprove(request)}
                    disabled={processing === request.id}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {processing === request.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mr-1" />
                    )}
                    Aprobă
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setRejectDialog(request)}
                    disabled={processing === request.id}
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Respinge
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={() => setRejectDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Respinge Cererea {rejectDialog?.request_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Angajat: <strong>{rejectDialog?.employee_name}</strong><br />
              Perioada: {rejectDialog && format(parseISO(rejectDialog.start_date), 'dd.MM.yyyy')} – {rejectDialog && format(parseISO(rejectDialog.end_date), 'dd.MM.yyyy')}
            </p>
            <div className="space-y-2">
              <Label>Motivul respingerii</Label>
              <Textarea
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="Introduceți motivul respingerii..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)}>Anulează</Button>
            <Button variant="destructive" onClick={handleReject} disabled={processing === rejectDialog?.id}>
              {processing === rejectDialog?.id ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Respinge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={!!detailsDialog} onOpenChange={() => setDetailsDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalii Cerere {detailsDialog?.request_number}</DialogTitle>
          </DialogHeader>
          {detailsDialog && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Angajat:</span><br /><strong>{detailsDialog.employee_name}</strong></div>
                <div><span className="text-muted-foreground">Departament:</span><br /><strong>{detailsDialog.employee_department}</strong></div>
                <div><span className="text-muted-foreground">Funcția:</span><br /><strong>{detailsDialog.employee_position}</strong></div>
                <div><span className="text-muted-foreground">Zile solicitate:</span><br /><strong>{detailsDialog.working_days} zile lucrătoare</strong></div>
                <div><span className="text-muted-foreground">Perioada:</span><br /><strong>{format(parseISO(detailsDialog.start_date), 'dd.MM.yyyy')} – {format(parseISO(detailsDialog.end_date), 'dd.MM.yyyy')}</strong></div>
                <div><span className="text-muted-foreground">An:</span><br /><strong>{detailsDialog.year}</strong></div>
                <div className="col-span-2"><span className="text-muted-foreground">Înlocuitor:</span><br /><strong>{detailsDialog.replacement_name} {detailsDialog.replacement_position ? `- ${detailsDialog.replacement_position}` : ''}</strong></div>
                <div><span className="text-muted-foreground">Depusă la:</span><br /><strong>{format(parseISO(detailsDialog.created_at), 'dd.MM.yyyy HH:mm', { locale: ro })}</strong></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
