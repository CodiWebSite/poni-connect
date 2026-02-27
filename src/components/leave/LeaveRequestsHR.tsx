import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Download, Search, Loader2, FileText, Filter, Trash2, UserCheck } from 'lucide-react';
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
  employee_grade: string;
  director_approved_at: string | null;
  dept_head_approved_at: string | null;
  dept_head_id: string | null;
  dept_head_name?: string;
  rejection_reason: string | null;
  dept_head_signature?: string | null;
  employee_signature?: string | null;
  avatar_url?: string | null;
  epd_id?: string;
}

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
  const [deleting, setDeleting] = useState<string | null>(null);
  const [downloadDialog, setDownloadDialog] = useState<LeaveRequestRow | null>(null);
  const [selectedSrusOfficer, setSelectedSrusOfficer] = useState<string>('Cătălina Bălan');

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
    let epdMap: Record<string, { name: string; department: string; position: string; grade: string }> = {};

    if (epdIds.length > 0) {
      const { data: epdData } = await supabase
        .from('employee_personal_data')
        .select('id, first_name, last_name, department, position, grade')
        .in('id', epdIds);

      (epdData || []).forEach(e => {
        epdMap[e.id] = {
          name: `${e.last_name} ${e.first_name}`,
          department: e.department || '',
          position: e.position || '',
          grade: e.grade || '',
        };
      });
    }

    // Get approver names
    const deptHeadIds = [...new Set((data || []).map(r => r.dept_head_id).filter(Boolean))];
    let approverMap: Record<string, string> = {};
    if (deptHeadIds.length > 0) {
      const { data: approverProfiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', deptHeadIds);
      (approverProfiles || []).forEach(p => {
        approverMap[p.user_id] = p.full_name;
      });
    }

    // Get avatar URLs via employee_records -> profiles
    const recordIds = [...new Set(Object.values(epdMap).map((_, i) => epdIds[i]).filter(Boolean))];
    let avatarMap: Record<string, string> = {};
    if (epdIds.length > 0) {
      const { data: recordsData } = await supabase
        .from('employee_records')
        .select('id, user_id')
        .in('id', (data || []).map(r => r.epd_id).filter(Boolean).map(epdId => {
          // We need employee_record_id from EPD, not epd_id directly
          return epdId;
        }));
      
      // Get employee_record_ids from EPD
      const { data: epdWithRecords } = await supabase
        .from('employee_personal_data')
        .select('id, employee_record_id')
        .in('id', epdIds);
      
      const epdToRecordId: Record<string, string> = {};
      (epdWithRecords || []).forEach(e => {
        if (e.employee_record_id) epdToRecordId[e.id] = e.employee_record_id;
      });

      const recordIdsForAvatar = [...new Set(Object.values(epdToRecordId))];
      if (recordIdsForAvatar.length > 0) {
        const { data: records } = await supabase
          .from('employee_records')
          .select('id, user_id')
          .in('id', recordIdsForAvatar);
        
        const recordToUserId: Record<string, string> = {};
        (records || []).forEach(r => { recordToUserId[r.id] = r.user_id; });

        const userIdsForAvatar = [...new Set(Object.values(recordToUserId))];
        if (userIdsForAvatar.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('user_id, avatar_url')
            .in('user_id', userIdsForAvatar);
          
          const userToAvatar: Record<string, string> = {};
          (profilesData || []).forEach(p => { if (p.avatar_url) userToAvatar[p.user_id] = p.avatar_url; });

          // Map EPD id -> avatar_url
          Object.entries(epdToRecordId).forEach(([epdId, recordId]) => {
            const userId = recordToUserId[recordId];
            if (userId && userToAvatar[userId]) {
              avatarMap[epdId] = userToAvatar[userId];
            }
          });
        }
      }
    }

    setRequests(
      (data || []).map(r => ({
        ...r,
        employee_name: epdMap[r.epd_id]?.name || 'N/A',
        employee_department: epdMap[r.epd_id]?.department || '',
        employee_position: epdMap[r.epd_id]?.position || '',
        employee_grade: epdMap[r.epd_id]?.grade || '',
        dept_head_name: r.dept_head_id ? approverMap[r.dept_head_id] || '' : '',
        dept_head_signature: (r as any).dept_head_signature || null,
        avatar_url: r.epd_id ? avatarMap[r.epd_id] || null : null,
      }))
    );
    setLoading(false);
  };

  const handleDownload = async (request: LeaveRequestRow, srusOfficerName: string) => {
    setDownloading(request.id);
    try {
      let totalLeaveDays = 0;
      let usedLeaveDays = 0;
      let carryoverDays = 0;
      let carryoverFromYear: number | undefined;
      let remainingDays = 0;

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
          .select('initial_days, remaining_days, from_year')
          .eq('employee_personal_data_id', request.epd_id)
          .eq('to_year', request.year)
          .maybeSingle();
        if (carryover) {
          carryoverDays = carryover.initial_days;
          carryoverFromYear = carryover.from_year;
        }

        const totalAvailable = totalLeaveDays + (carryover?.remaining_days ?? 0);
        remainingDays = totalAvailable - usedLeaveDays;
        if (remainingDays < 0) remainingDays = 0;
      }

      await generateLeaveDocx({
        employeeName: request.employee_name,
        employeePosition: request.employee_position,
        employeeGrade: request.employee_grade || undefined,
        department: request.employee_department,
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
        totalLeaveDays,
        usedLeaveDays,
        carryoverDays,
        carryoverFromYear,
        srusOfficerName,
        approvalDate: request.dept_head_approved_at ? format(parseISO(request.dept_head_approved_at), 'dd.MM.yyyy') : undefined,
        deptHeadSignature: request.dept_head_signature,
        deptHeadName: request.dept_head_name,
        remainingDays,
      });
      toast({ title: 'Descărcat', description: `Document ${request.request_number} generat cu succes.` });
    } catch (err) {
      console.error('Error generating DOCX:', err);
      toast({ title: 'Eroare', description: 'Nu s-a putut genera documentul.', variant: 'destructive' });
    }
    setDownloading(null);
    setDownloadDialog(null);
  };

  const handleDelete = async (id: string, requestNumber: string) => {
    if (!confirm(`Sigur doriți să ștergeți cererea ${requestNumber}? Această acțiune este ireversibilă.`)) return;
    setDeleting(id);
    const { error } = await supabase.from('leave_requests').delete().eq('id', id);
    if (error) {
      toast({ title: 'Eroare', description: 'Nu s-a putut șterge cererea.', variant: 'destructive' });
    } else {
      toast({ title: 'Șters', description: `Cererea ${requestNumber} a fost ștearsă.` });
      fetchAllRequests();
    }
    setDeleting(null);
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
                  <TableHead>Aprobat de</TableHead>
                  <TableHead>Acțiuni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.request_number}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="w-7 h-7 flex-shrink-0">
                          {r.avatar_url && <AvatarImage src={r.avatar_url} alt={r.employee_name} />}
                          <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                            {r.employee_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{r.employee_name}</span>
                      </div>
                    </TableCell>
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
                      {r.status === 'approved' && r.dept_head_name ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1 text-sm text-green-700 dark:text-green-400">
                                <UserCheck className="w-3.5 h-3.5" />
                                <span className="truncate max-w-[120px]">{r.dept_head_name}</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Aprobat de: {r.dept_head_name}</p>
                              {r.dept_head_approved_at && (
                                <p className="text-xs text-muted-foreground">
                                  Data: {format(parseISO(r.dept_head_approved_at), 'dd.MM.yyyy HH:mm', { locale: ro })}
                                </p>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : r.status === 'rejected' ? (
                        <span className="text-xs text-muted-foreground">Respinsă</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setDownloadDialog(r); setSelectedSrusOfficer('Cătălina Bălan'); }}
                          disabled={downloading === r.id}
                        >
                          {downloading === r.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(r.id, r.request_number)}
                          disabled={deleting === r.id}
                        >
                          {deleting === r.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Download Dialog - SRUS Officer Selection */}
      <Dialog open={!!downloadDialog} onOpenChange={() => setDownloadDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Descarcă Document {downloadDialog?.request_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Angajat: <strong>{downloadDialog?.employee_name}</strong>
            </p>
            <div className="space-y-2">
              <Label>Salariat SRUS (semnează documentul)</Label>
              <Select value={selectedSrusOfficer} onValueChange={setSelectedSrusOfficer}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover z-[9999]">
                  <SelectItem value="Cătălina Bălan">Cătălina Bălan</SelectItem>
                  <SelectItem value="Loredana Negru">Loredana Negru</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDownloadDialog(null)}>Anulează</Button>
            <Button
              onClick={() => downloadDialog && handleDownload(downloadDialog, selectedSrusOfficer)}
              disabled={downloading === downloadDialog?.id}
            >
              {downloading === downloadDialog?.id ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Download className="w-4 h-4 mr-1" />}
              Descarcă DOCX
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
