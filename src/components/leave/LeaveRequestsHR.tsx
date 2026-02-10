import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Download, Search, Loader2, FileText, Filter } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ro } from 'date-fns/locale';
import { generateLeaveDocx } from '@/utils/generateLeaveDocx';

interface LeaveRequestRow {
  id: string;
  request_number: string;
  start_date: string;
  end_date: string;
  working_days: number;
  year: number;
  replacement_name: string;
  replacement_position: string | null;
  status: string;
  created_at: string;
  employee_name: string;
  employee_department: string;
  employee_position: string;
  director_approved_at: string | null;
  dept_head_approved_at: string | null;
  rejection_reason: string | null;
}

const statusLabels: Record<string, string> = {
  draft: 'Ciornă',
  pending_director: 'Așteptare Director',
  pending_department_head: 'Așteptare Șef Comp.',
  approved: 'Aprobată',
  rejected: 'Respinsă',
};

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  pending_director: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  pending_department_head: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

interface LeaveRequestsHRProps {
  refreshTrigger: number;
}

export function LeaveRequestsHR({ refreshTrigger }: LeaveRequestsHRProps) {
  const { toast } = useToast();
  const [requests, setRequests] = useState<LeaveRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    fetchAllRequests();
  }, [refreshTrigger]);

  const fetchAllRequests = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('leave_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching leave requests:', error);
      setLoading(false);
      return;
    }

    // Enrich with employee data
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

    setRequests(
      (data || []).map(r => ({
        ...r,
        employee_name: epdMap[r.epd_id]?.name || 'N/A',
        employee_department: epdMap[r.epd_id]?.department || '',
        employee_position: epdMap[r.epd_id]?.position || '',
      }))
    );
    setLoading(false);
  };

  const handleDownload = async (request: LeaveRequestRow & { epd_id?: string; employee_signature?: string | null }) => {
    setDownloading(request.id);
    try {
      // Get leave balance data
      let totalLeaveDays = 0;
      let usedLeaveDays = 0;
      let carryoverDays = 0;
      let carryoverFromYear: number | undefined;

      if (request.epd_id) {
        const { data: epd } = await supabase
          .from('employee_personal_data')
          .select('total_leave_days, used_leave_days')
          .eq('id', request.epd_id)
          .maybeSingle();
        totalLeaveDays = epd?.total_leave_days ?? 0;
        usedLeaveDays = epd?.used_leave_days ?? 0;

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
        employeeName: request.employee_name,
        employeePosition: request.employee_position,
        department: request.employee_department,
        workingDays: request.working_days,
        year: request.year,
        startDate: request.start_date,
        replacementName: request.replacement_name,
        replacementPosition: request.replacement_position || '',
        requestDate: format(parseISO(request.created_at), 'dd.MM.yyyy'),
        requestNumber: request.request_number,
        isApproved: request.status === 'approved',
        employeeSignature: request.employee_signature,
        totalLeaveDays,
        usedLeaveDays,
        carryoverDays,
        carryoverFromYear,
      });
      toast({ title: 'Descărcat', description: `Document ${request.request_number} generat cu succes.` });
    } catch (err) {
      console.error('Error generating DOCX:', err);
      toast({ title: 'Eroare', description: 'Nu s-a putut genera documentul.', variant: 'destructive' });
    }
    setDownloading(null);
  };

  const filtered = requests.filter(r => {
    const matchesSearch = !searchQuery ||
      r.employee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.request_number.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
          <FileText className="w-5 h-5" />
          Centralizare Cereri Concediu ({filtered.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Caută după nume sau număr cerere..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toate statusurile</SelectItem>
              <SelectItem value="pending_director">Așteptare Director</SelectItem>
              <SelectItem value="pending_department_head">Așteptare Șef</SelectItem>
              <SelectItem value="approved">Aprobate</SelectItem>
              <SelectItem value="rejected">Respinse</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">Nu s-au găsit cereri.</p>
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
                  <TableHead>Acțiuni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(r => (
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
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(r)}
                        disabled={downloading === r.id}
                      >
                        {downloading === r.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                      </Button>
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
