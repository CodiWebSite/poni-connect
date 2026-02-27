import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, History } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ro } from 'date-fns/locale';

interface ApprovedRequest {
  id: string;
  request_number: string;
  start_date: string;
  end_date: string;
  working_days: number;
  year: number;
  status: string;
  dept_head_approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  employee_name: string;
  employee_department: string;
}

const statusLabels: Record<string, string> = {
  approved: 'Aprobată',
  rejected: 'Respinsă',
  pending_department_head: 'În așteptare',
};

const statusColors: Record<string, string> = {
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  pending_department_head: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
};

interface LeaveApprovalHistoryProps {
  refreshTrigger: number;
}

export function LeaveApprovalHistory({ refreshTrigger }: LeaveApprovalHistoryProps) {
  const { user } = useAuth();
  const { isSuperAdmin } = useUserRole();
  const { isDemo } = useDemoMode();
  const [requests, setRequests] = useState<ApprovedRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, [user, refreshTrigger]);

  const fetchHistory = async () => {
    if (!user) return;
    setLoading(true);

    // Get requests where this user (or any dept head for super admin) approved or rejected
    const baseQuery = supabase
      .from('leave_requests')
      .select('*')
      .in('status', ['approved', 'rejected'] as any[]);
    
    let query = (baseQuery as any).eq('is_demo', isDemo).order('dept_head_approved_at', { ascending: false, nullsFirst: false });

    if (!isSuperAdmin) {
      // Only show requests approved/rejected by this user
      query = query.or(`dept_head_id.eq.${user.id},rejected_by.eq.${user.id}`);
    }

    const { data, error } = await query as { data: any[] | null; error: any };

    if (error) {
      console.error('Error fetching approval history:', error);
      setLoading(false);
      return;
    }

    // Enrich with employee names
    const epdIds = [...new Set((data || []).map(r => r.epd_id).filter(Boolean))];
    let epdMap: Record<string, { name: string; department: string }> = {};

    if (epdIds.length > 0) {
      const { data: epdData } = await supabase
        .from('employee_personal_data')
        .select('id, first_name, last_name, department')
        .in('id', epdIds);

      (epdData || []).forEach(e => {
        epdMap[e.id] = {
          name: `${e.last_name} ${e.first_name}`,
          department: e.department || '',
        };
      });
    }

    setRequests(
      (data || []).map(r => ({
        ...r,
        employee_name: epdMap[r.epd_id]?.name || 'N/A',
        employee_department: epdMap[r.epd_id]?.department || '',
      }))
    );
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="w-5 h-5" />
          Centralizator Aprobări ({requests.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {requests.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">Nu există istoric de aprobări.</p>
        ) : (
          <div className="border rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nr.</TableHead>
                  <TableHead>Angajat</TableHead>
                  <TableHead>Departament</TableHead>
                  <TableHead>Perioada</TableHead>
                  <TableHead>Zile</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data decizie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.request_number}</TableCell>
                    <TableCell className="font-medium">{r.employee_name}</TableCell>
                    <TableCell className="text-sm">{r.employee_department}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {format(parseISO(r.start_date), 'dd.MM.yy')} – {format(parseISO(r.end_date), 'dd.MM.yy')}
                    </TableCell>
                    <TableCell className="text-center font-medium">{r.working_days}</TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${statusColors[r.status] || ''}`}>
                        {statusLabels[r.status] || r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {r.status === 'approved' && r.dept_head_approved_at
                        ? format(parseISO(r.dept_head_approved_at), 'dd.MM.yyyy HH:mm', { locale: ro })
                        : r.status === 'rejected' && r.rejected_at
                          ? format(parseISO(r.rejected_at), 'dd.MM.yyyy HH:mm', { locale: ro })
                          : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
