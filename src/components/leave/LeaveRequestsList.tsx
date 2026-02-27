import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, FileText, Trash2, Download } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ro } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { generateLeaveDocx } from '@/utils/generateLeaveDocx';

const statusLabels: Record<string, string> = {
  draft: 'Ciornă',
  pending_department_head: 'Așteptare Șef Comp.',
  approved: 'Aprobată',
  rejected: 'Respinsă',
};

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  pending_department_head: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

interface LeaveRequestsListProps {
  refreshTrigger: number;
}

export function LeaveRequestsList({ refreshTrigger }: LeaveRequestsListProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchMyRequests();
  }, [user, refreshTrigger]);

  const fetchMyRequests = async () => {
    if (!user) return;
    setLoading(true);

    const { data } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    setRequests(data || []);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Sigur doriți să ștergeți această cerere?')) return;

    const { error } = await supabase.from('leave_requests').delete().eq('id', id);
    if (error) {
      toast({ title: 'Eroare', description: 'Nu s-a putut șterge cererea.', variant: 'destructive' });
    } else {
      toast({ title: 'Șters', description: 'Cererea a fost ștearsă.' });
      fetchMyRequests();
    }
  };

  const handleDownload = async (request: any) => {
    // Get employee data for the docx
    const { data: epd } = await supabase
      .from('employee_personal_data')
      .select('first_name, last_name, department, position, grade, total_leave_days, used_leave_days')
      .eq('id', request.epd_id)
      .maybeSingle();

    // Get carryover data
    let carryoverDays = 0;
    let carryoverFromYear: number | undefined;
    if (request.epd_id) {
      const { data: carryover } = await supabase
        .from('leave_carryover')
        .select('initial_days, from_year')
        .eq('employee_personal_data_id', request.epd_id)
        .eq('to_year', request.year)
        .maybeSingle();
      if (carryover) {
        carryoverDays = carryover.initial_days;
        carryoverFromYear = carryover.from_year;
      }
    }

    await generateLeaveDocx({
      employeeName: epd ? `${epd.last_name} ${epd.first_name}` : '',
      employeePosition: epd?.position || '',
      employeeGrade: epd?.grade || undefined,
      department: epd?.department || '',
      workingDays: request.working_days,
      year: request.year,
      startDate: request.start_date,
      endDate: request.end_date,
      replacementName: request.replacement_name,
      replacementPosition: request.replacement_position || '',
      requestDate: format(parseISO(request.created_at), 'dd.MM.yyyy'),
      requestNumber: request.request_number,
      isApproved: request.status === 'approved',
      employeeSignature: request.employee_signature,
      totalLeaveDays: epd?.total_leave_days ?? 0,
      usedLeaveDays: epd?.used_leave_days ?? 0,
      carryoverDays,
      carryoverFromYear,
      approvalDate: request.dept_head_approved_at ? format(parseISO(request.dept_head_approved_at), 'dd.MM.yyyy') : undefined,
    });
  };

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
          Nu aveți cereri de concediu depuse.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map(r => (
        <Card key={r.id}>
          <CardContent className="pt-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="font-mono text-sm">{r.request_number}</span>
                  <Badge className={`text-xs ${statusColors[r.status] || ''}`}>
                    {statusLabels[r.status] || r.status}
                  </Badge>
                </div>
                <p className="text-sm">
                  <strong>{r.working_days} zile</strong> • {format(parseISO(r.start_date), 'dd MMM yyyy', { locale: ro })} – {format(parseISO(r.end_date), 'dd MMM yyyy', { locale: ro })}
                </p>
                <p className="text-xs text-muted-foreground">
                  Înlocuitor: {r.replacement_name} • Depusă: {format(parseISO(r.created_at), 'dd.MM.yyyy HH:mm', { locale: ro })}
                </p>
                {r.status === 'rejected' && r.rejection_reason && (
                  <p className="text-xs text-destructive mt-1">
                    Motiv respingere: {r.rejection_reason}
                  </p>
                )}
              </div>

              <div className="flex gap-2 flex-shrink-0">
                <Button variant="ghost" size="sm" onClick={() => handleDownload(r)}>
                  <Download className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)} className="text-destructive hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
