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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format, parseISO } from 'date-fns';
import { ro } from 'date-fns/locale';
import { SignaturePad } from '@/components/shared/SignaturePad';

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
  approver_id?: string | null;
  employee_name?: string;
  employee_department?: string;
  employee_position?: string;
  employee_avatar_url?: string | null;
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
  const [isDesignatedApprover, setIsDesignatedApprover] = useState(false);
  const [approveDialog, setApproveDialog] = useState<LeaveRequest | null>(null);
  const [approverSignature, setApproverSignature] = useState<string | null>(null);

  const isDeptHead = role === 'sef' || role === 'sef_srus' || isSuperAdmin;

  useEffect(() => {
    checkDesignatedApprover();
    fetchPendingRequests();
  }, [role, user]);

  const checkDesignatedApprover = async () => {
    if (!user) return;
    const { data: empApprovers } = await supabase
      .from('leave_approvers')
      .select('id')
      .eq('approver_user_id', user.id)
      .limit(1);
    const { data: deptApprovers } = await supabase
      .from('leave_department_approvers')
      .select('id')
      .eq('approver_user_id', user.id)
      .limit(1);
    setIsDesignatedApprover((empApprovers || []).length > 0 || (deptApprovers || []).length > 0);
  };

  const fetchPendingRequests = async () => {
    if (!user) {
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

    const epdIds = [...new Set((data || []).map(r => r.epd_id).filter(Boolean))];
    let epdMap: Record<string, { name: string; department: string; position: string; avatarUrl: string | null }> = {};

    if (epdIds.length > 0) {
      const { data: epdData } = await supabase
        .from('employee_personal_data')
        .select('id, first_name, last_name, department, position, employee_record_id')
        .in('id', epdIds);

      // Get avatar URLs: record_id -> user_id -> profile.avatar_url
      const recordIds = [...new Set((epdData || []).map(e => e.employee_record_id).filter(Boolean))] as string[];
      const recordAvatarMap: Record<string, string> = {};
      if (recordIds.length > 0) {
        const { data: recordsData } = await supabase
          .from('employee_records').select('id, user_id').in('id', recordIds);
        const userIds = (recordsData || []).map(r => r.user_id);
        if (userIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles').select('user_id, avatar_url').in('user_id', userIds);
          const userAvatarMap: Record<string, string> = {};
          (profilesData || []).forEach(p => { if (p.avatar_url) userAvatarMap[p.user_id] = p.avatar_url; });
          (recordsData || []).forEach(r => { if (userAvatarMap[r.user_id]) recordAvatarMap[r.id] = userAvatarMap[r.user_id]; });
        }
      }

      (epdData || []).forEach(e => {
        epdMap[e.id] = {
          name: `${e.last_name} ${e.first_name}`,
          department: e.department || '',
          position: e.position || '',
          avatarUrl: e.employee_record_id ? recordAvatarMap[e.employee_record_id] || null : null,
        };
      });
    }

    let enrichedRequests = (data || []).map(r => ({
      ...r,
      approver_id: (r as any).approver_id || null,
      employee_name: epdMap[r.epd_id]?.name || 'N/A',
      employee_department: epdMap[r.epd_id]?.department || '',
      employee_position: epdMap[r.epd_id]?.position || '',
      employee_avatar_url: epdMap[r.epd_id]?.avatarUrl || null,
    }));

    if (!isSuperAdmin) {
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('department')
        .eq('user_id', user.id)
        .maybeSingle();

      const { data: myDeptApprovals } = await supabase
        .from('leave_department_approvers')
        .select('department')
        .eq('approver_user_id', user.id);
      const myApproverDepts = new Set((myDeptApprovals || []).map(d => d.department.toLowerCase()));

      enrichedRequests = enrichedRequests.filter(r => {
        if (r.approver_id === user.id) return true;
        if (!r.approver_id && r.employee_department && myApproverDepts.has(r.employee_department.toLowerCase())) return true;
        if (!r.approver_id && isDeptHead && myProfile?.department &&
            r.employee_department.toLowerCase() === myProfile.department.toLowerCase()) {
          return true;
        }
        return false;
      });
    }

    setRequests(enrichedRequests);
    setLoading(false);
  };

  const handleApproveWithSignature = async () => {
    if (!user || !approveDialog) return;
    if (!approverSignature) {
      toast({ title: 'Semnătură necesară', description: 'Vă rugăm să semnați înainte de aprobare.', variant: 'destructive' });
      return;
    }
    
    setProcessing(approveDialog.id);
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('leave_requests')
      .update({
        status: 'approved' as any,
        dept_head_id: user.id,
        dept_head_approved_at: now,
        dept_head_signature: approverSignature,
      } as any)
      .eq('id', approveDialog.id);

    if (error) {
      toast({ title: 'Eroare', description: 'Nu s-a putut aproba cererea.', variant: 'destructive' });
    } else {
      await deductLeaveDays(approveDialog);

      await supabase.from('notifications').insert({
        user_id: approveDialog.user_id,
        title: 'Cerere concediu aprobată',
        message: `Cererea de concediu ${approveDialog.request_number} a fost aprobată de șeful de compartiment.`,
        type: 'success',
        related_type: 'leave_request',
        related_id: approveDialog.id,
      });

      sendResultEmail(approveDialog, 'approved');

      // Notify HR staff
      notifyHRApproval(approveDialog);

      toast({ title: 'Aprobat', description: `Cererea ${approveDialog.request_number} a fost aprobată.` });
      setApproveDialog(null);
      setApproverSignature(null);
      onUpdated();
      fetchPendingRequests();
    }

    setProcessing(null);
  };

  const notifyHRApproval = async (request: LeaveRequest) => {
    try {
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user!.id)
        .maybeSingle();

      // Send in-app notifications to HR/SRUS staff
      const { data: hrRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['hr', 'sef_srus', 'super_admin'] as any);

      if (hrRoles) {
        for (const hr of hrRoles) {
          if (hr.user_id === user!.id) continue; // Don't notify yourself
          await supabase.from('notifications').insert({
            user_id: hr.user_id,
            title: 'Cerere concediu aprobată de șef',
            message: `${request.employee_name} — cererea ${request.request_number} a fost aprobată de ${myProfile?.full_name || 'Șef compartiment'}.`,
            type: 'info',
            related_type: 'leave_request',
            related_id: request.id,
          });
        }
      }

      // Send email to HR via edge function
      await supabase.functions.invoke('notify-leave-result', {
        body: {
          employee_user_id: request.user_id,
          employee_name: request.employee_name,
          request_number: request.request_number,
          start_date: format(parseISO(request.start_date), 'dd.MM.yyyy'),
          end_date: format(parseISO(request.end_date), 'dd.MM.yyyy'),
          working_days: request.working_days,
          result: 'approved',
          approver_name: myProfile?.full_name || 'Șef compartiment',
          notify_hr: true,
        },
      });
    } catch (err) {
      console.error('Failed to notify HR:', err);
    }
  };

  const deductLeaveDays = async (request: LeaveRequest) => {
    const currentYear = new Date().getFullYear();
    let daysToDeduct = request.working_days;

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

  const sendResultEmail = async (request: LeaveRequest, result: 'approved' | 'rejected', rejectionReasonText?: string) => {
    try {
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user!.id)
        .maybeSingle();

      await supabase.functions.invoke('notify-leave-result', {
        body: {
          employee_user_id: request.user_id,
          employee_name: request.employee_name,
          request_number: request.request_number,
          start_date: format(parseISO(request.start_date), 'dd.MM.yyyy'),
          end_date: format(parseISO(request.end_date), 'dd.MM.yyyy'),
          working_days: request.working_days,
          result,
          rejection_reason: rejectionReasonText || null,
          approver_name: myProfile?.full_name || 'Șef compartiment',
        },
      });
    } catch (err) {
      console.error('Failed to send result email:', err);
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

      sendResultEmail(rejectDialog, 'rejected', rejectionReason);

      toast({ title: 'Respins', description: `Cererea ${rejectDialog.request_number} a fost respinsă.` });
      setRejectDialog(null);
      setRejectionReason('');
      onUpdated();
      fetchPendingRequests();
    }

    setProcessing(null);
  };

  if (!isDeptHead && !isDesignatedApprover && !loading) return null;

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
                <div className="flex items-start gap-3">
                  <Avatar className="w-10 h-10 flex-shrink-0 mt-0.5">
                    {request.employee_avatar_url && <AvatarImage src={request.employee_avatar_url} alt={request.employee_name} />}
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {(request.employee_name || '').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
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
                </div>

                <div className="flex gap-2 flex-shrink-0">
                  <Button variant="outline" size="sm" onClick={() => setDetailsDialog(request)}>
                    <Eye className="w-4 h-4 mr-1" />
                    Detalii
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => { setApproveDialog(request); setApproverSignature(null); }}
                    disabled={processing === request.id}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
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

      {/* Approve Dialog with Signature */}
      <Dialog open={!!approveDialog} onOpenChange={() => { setApproveDialog(null); setApproverSignature(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Aprobă Cererea {approveDialog?.request_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Angajat: <strong>{approveDialog?.employee_name}</strong><br />
              Perioada: {approveDialog && format(parseISO(approveDialog.start_date), 'dd.MM.yyyy')} – {approveDialog && format(parseISO(approveDialog.end_date), 'dd.MM.yyyy')}<br />
              Zile: <strong>{approveDialog?.working_days}</strong>
            </p>
            <SignaturePad
              onSave={(sig) => setApproverSignature(sig)}
              existingSignature={approverSignature}
              label="Semnătura Șef Compartiment"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setApproveDialog(null); setApproverSignature(null); }}>Anulează</Button>
            <Button 
              onClick={handleApproveWithSignature} 
              disabled={processing === approveDialog?.id || !approverSignature}
              className="bg-green-600 hover:bg-green-700"
            >
              {processing === approveDialog?.id ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />}
              Semnează și Aprobă
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
