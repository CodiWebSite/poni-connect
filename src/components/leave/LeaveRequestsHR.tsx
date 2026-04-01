import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDemoMode } from '@/contexts/DemoModeContext';
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
import { Download, Search, Loader2, FileText, Filter, Trash2, UserCheck, FileSpreadsheet, CheckCircle, Bell } from 'lucide-react';
import ExcelJS from 'exceljs';
import { format, parseISO } from 'date-fns';
import { ro } from 'date-fns/locale';
import { generateLeaveDocx } from '@/utils/generateLeaveDocx';
import { getClientIP } from '@/utils/getClientIP';

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
  director_id: string | null;
  director_name?: string;
  dept_head_approved_at: string | null;
  dept_head_id: string | null;
  dept_head_name?: string;
  rejection_reason: string | null;
  dept_head_signature?: string | null;
  employee_signature?: string | null;
  avatar_url?: string | null;
  epd_id?: string;
  user_id: string;
  source_label?: string;
}

const statusLabels: Record<string, string> = {
  draft: 'Ciornă',
  pending_department_head: 'Așteptare Șef Comp.',
  pending_srus: 'Așteptare SRUS',
  approved: 'Aprobată',
  rejected: 'Respinsă',
};

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  pending_department_head: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  pending_srus: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

interface LeaveRequestsHRProps {
  refreshTrigger: number;
}

export function LeaveRequestsHR({ refreshTrigger }: LeaveRequestsHRProps) {
  const { toast } = useToast();
  const { isDemo } = useDemoMode();
  const [requests, setRequests] = useState<LeaveRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [downloading, setDownloading] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [downloadDialog, setDownloadDialog] = useState<LeaveRequestRow | null>(null);
  const [selectedSrusOfficer, setSelectedSrusOfficer] = useState<string>('Cătălina Bălan');
  const [srusSignature, setSrusSignature] = useState<string | null>(null);
  const [exportingXls, setExportingXls] = useState(false);
  const [srusApproveDialog, setSrusApproveDialog] = useState<LeaveRequestRow | null>(null);
  const [srusApproveOfficer, setSrusApproveOfficer] = useState<string>('Cătălina Bălan');
  const [srusApproveSig, setSrusApproveSig] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [sendingReminder, setSendingReminder] = useState(false);

  useEffect(() => {
    fetchAllRequests();
  }, [refreshTrigger]);

  const fetchAllRequests = async () => {
    setLoading(true);

    const baseQuery = supabase
      .from('leave_requests')
      .select('*');
    
    const { data, error } = await (baseQuery as any).eq('is_demo', isDemo).order('created_at', { ascending: false }) as { data: any[] | null; error: any };

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

    // Get approver names (dept heads + directors)
    const deptHeadIds = [...new Set((data || []).map(r => r.dept_head_id).filter(Boolean))];
    const directorIds = [...new Set((data || []).map(r => r.director_id).filter(Boolean))];
    const allApproverIds = [...new Set([...deptHeadIds, ...directorIds])];
    let approverMap: Record<string, string> = {};
    if (allApproverIds.length > 0) {
      const { data: approverProfiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', allApproverIds);
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

    // Fetch carryover data to determine source (Report vs Sold)
    let carryoverMap: Record<string, { from_year: number; to_year: number; initial_days: number; remaining_days: number; updated_at: string }[]> = {};
    if (epdIds.length > 0) {
      const { data: carryovers } = await supabase
        .from('leave_carryover')
        .select('employee_personal_data_id, from_year, to_year, initial_days, remaining_days, updated_at')
        .in('employee_personal_data_id', epdIds);
      (carryovers || []).forEach(c => {
        if (!carryoverMap[c.employee_personal_data_id]) carryoverMap[c.employee_personal_data_id] = [];
        carryoverMap[c.employee_personal_data_id].push({
          from_year: c.from_year,
          to_year: c.to_year,
          initial_days: c.initial_days,
          remaining_days: c.remaining_days,
          updated_at: c.updated_at,
        });
      });
    }

    // FIFO simulation per employee:
    // - dacă reportul a fost deja actualizat înainte de prima cerere din anul respectiv,
    //   pornim din remaining_days (snapshot real, include consumuri istorice/import)
    // - altfel, pornim din initial_days și simulăm FIFO pe cererile existente
    const approvedData = (data || []).filter((r: any) => r.status === 'approved' || r.status === 'pending_srus' || r.status === 'pending_department_head');
    const sourceLabels: Record<string, string> = {};

    // Group by epd_id
    const byEpd: Record<string, any[]> = {};
    approvedData.forEach((r: any) => {
      if (!r.epd_id) return;
      if (!byEpd[r.epd_id]) byEpd[r.epd_id] = [];
      byEpd[r.epd_id].push(r);
    });

    Object.entries(byEpd).forEach(([epdId, reqs]) => {
      // Sort by start_date chronologically
      reqs.sort((a, b) => a.start_date.localeCompare(b.start_date));
      
      // Group by year
      const byYear: Record<number, any[]> = {};
      reqs.forEach(r => {
        if (!byYear[r.year]) byYear[r.year] = [];
        byYear[r.year].push(r);
      });

      Object.entries(byYear).forEach(([yearStr, yearReqs]) => {
        const year = Number(yearStr);
        const carryovers = carryoverMap[epdId] || [];
        const relevantCarryover = carryovers.find(c => c.to_year === year && c.from_year === year - 1);

        const earliestRequestCreatedAt = yearReqs.reduce<string | null>((earliest, req) => {
          if (!req?.created_at) return earliest;
          if (!earliest) return req.created_at;
          return req.created_at < earliest ? req.created_at : earliest;
        }, null);

        const useSnapshotRemaining = Boolean(
          relevantCarryover &&
          earliestRequestCreatedAt &&
          relevantCarryover.updated_at &&
          new Date(relevantCarryover.updated_at).getTime() <= new Date(earliestRequestCreatedAt).getTime()
        );

        let carryoverRemaining = useSnapshotRemaining
          ? Math.max(relevantCarryover?.remaining_days || 0, 0)
          : Math.max(relevantCarryover?.initial_days || 0, 0);

        yearReqs.sort((a, b) => {
          const byStartDate = (a.start_date || '').localeCompare(b.start_date || '');
          if (byStartDate !== 0) return byStartDate;
          return (a.created_at || '').localeCompare(b.created_at || '');
        });

        yearReqs.forEach(r => {
          const days = Number(r.working_days) || 0;
          if (carryoverRemaining <= 0 || days <= 0) {
            sourceLabels[r.id] = `Sold ${year}`;
          } else if (carryoverRemaining >= days) {
            sourceLabels[r.id] = `Report ${year - 1}`;
            carryoverRemaining -= days;
          } else {
            sourceLabels[r.id] = `Report ${year - 1} + Sold ${year}`;
            carryoverRemaining = 0;
          }
        });
      });
    });

    setRequests(
      (data || []).map(r => ({
        ...r,
        employee_name: epdMap[r.epd_id]?.name || 'N/A',
        employee_department: epdMap[r.epd_id]?.department || '',
        employee_position: epdMap[r.epd_id]?.position || '',
        employee_grade: epdMap[r.epd_id]?.grade || '',
        dept_head_name: r.dept_head_id ? approverMap[r.dept_head_id] || '' : '',
        dept_head_signature: (r as any).dept_head_signature || null,
        director_name: r.director_id ? approverMap[r.director_id] || '' : '',
        avatar_url: r.epd_id ? avatarMap[r.epd_id] || null : null,
        source_label: sourceLabels[r.id] || `Sold ${r.year}`,
      }))
    );
    setLoading(false);
  };

  const handleDownloadApproved = async (request: LeaveRequestRow) => {
    setDownloading(request.id);
    try {
      let totalLeaveDays = 0;
      let usedLeaveDays = 0;
      let carryoverDays = 0;
      let carryoverInitialDays = 0;
      let carryoverFromYear: number | undefined;

      if (request.epd_id) {
        const { data: epd } = await supabase
          .from('employee_personal_data')
          .select('total_leave_days, used_leave_days')
          .eq('id', request.epd_id)
          .maybeSingle();
        totalLeaveDays = epd?.total_leave_days ?? 0;
        usedLeaveDays = epd?.used_leave_days ?? 0;

        const { data: carryoverData } = await supabase
          .from('leave_carryover')
          .select('remaining_days, initial_days, from_year')
          .eq('employee_personal_data_id', request.epd_id)
          .eq('to_year', request.year)
          .maybeSingle();
        if (carryoverData) {
          carryoverDays = carryoverData.remaining_days;
          carryoverInitialDays = carryoverData.initial_days;
          carryoverFromYear = carryoverData.from_year;
        }
      }

      // Fetch stored SRUS data from the leave request
      const { data: lrData } = await supabase
        .from('leave_requests')
        .select('srus_officer_name, srus_signature, srus_signed_at')
        .eq('id', request.id)
        .maybeSingle();

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
        isApproved: true,
        employeeSignature: request.employee_signature,
        totalLeaveDays,
        usedLeaveDays,
        carryoverDays,
        carryoverInitialDays,
        carryoverFromYear,
        srusOfficerName: (lrData as any)?.srus_officer_name || undefined,
        srusSignature: (lrData as any)?.srus_signature || undefined,
        approvalDate: request.dept_head_approved_at ? format(parseISO(request.dept_head_approved_at), 'dd.MM.yyyy') : undefined,
        deptHeadSignature: request.dept_head_signature,
        deptHeadName: request.dept_head_name,
        directorName: request.director_name,
        directorApprovalDate: request.director_approved_at ? format(parseISO(request.director_approved_at), 'dd.MM.yyyy') : undefined,
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

  const handleSrusApprove = async () => {
    if (!srusApproveDialog || !srusApproveSig) {
      toast({ title: 'Semnătură necesară', description: 'Vă rugăm să semnați înainte de validare.', variant: 'destructive' });
      return;
    }
    setProcessing(srusApproveDialog.id);
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('leave_requests')
      .update({
        status: 'approved' as any,
        srus_officer_name: srusApproveOfficer,
        srus_signature: srusApproveSig,
        srus_signed_at: now,
      } as any)
      .eq('id', srusApproveDialog.id);

    if (error) {
      toast({ title: 'Eroare', description: 'Nu s-a putut valida cererea.', variant: 'destructive' });
    } else {
      // Deduct leave days now that it's fully approved
      await deductLeaveDays(srusApproveDialog);

      // Notify employee
      await supabase.from('notifications').insert({
        user_id: srusApproveDialog.user_id,
        title: 'Cerere concediu aprobată',
        message: `Cererea ${srusApproveDialog.request_number} a fost validată de SRUS și este aprobată definitiv.`,
        type: 'success',
        related_type: 'leave_request',
        related_id: srusApproveDialog.id,
      });

      toast({ title: 'Validată SRUS', description: `Cererea ${srusApproveDialog.request_number} este acum aprobată definitiv.` });
      setSrusApproveDialog(null);
      setSrusApproveSig(null);
      fetchAllRequests();
    }
    setProcessing(null);
  };

  const deductLeaveDays = async (request: LeaveRequestRow) => {
    // Skip deduction in demo mode to protect real balances
    if (isDemo) return;
    if (!request.epd_id) return;
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
        .select('used_leave_days')
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

  const filtered = requests.filter(r => {
    const matchesSearch = !searchQuery ||
      r.employee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.request_number.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleExportExcel = async () => {
    setExportingXls(true);
    try {
      const wb = new ExcelJS.Workbook();
      wb.creator = 'ICMPP HR';
      const ws = wb.addWorksheet('Cereri Concediu');
      ws.columns = [
        { header: 'Nr. Cerere', key: 'nr', width: 18 },
        { header: 'Angajat', key: 'name', width: 25 },
        { header: 'Departament', key: 'dept', width: 22 },
        { header: 'Funcție', key: 'position', width: 22 },
        { header: 'Grad/Treaptă', key: 'grade', width: 16 },
        { header: 'Perioada', key: 'period', width: 22 },
        { header: 'Zile', key: 'days', width: 8 },
        { header: 'Sursă Zile', key: 'source', width: 22 },
        { header: 'Înlocuitor', key: 'replacement', width: 22 },
        { header: 'Status', key: 'status', width: 18 },
        { header: 'Aprobat de', key: 'approver', width: 22 },
        { header: 'Data aprobării', key: 'approvalDate', width: 16 },
        { header: 'Data depunerii', key: 'createdAt', width: 16 },
      ];
      const sMap: Record<string, string> = { draft: 'Ciornă', pending_department_head: 'Așteptare Șef', pending_srus: 'Așteptare SRUS', approved: 'Aprobată', rejected: 'Respinsă' };
      filtered.forEach(r => {
        ws.addRow({
          nr: r.request_number, name: r.employee_name, dept: r.employee_department,
          position: r.employee_position, grade: r.employee_grade || '-',
          period: `${format(parseISO(r.start_date), 'dd.MM.yyyy')} – ${format(parseISO(r.end_date), 'dd.MM.yyyy')}`,
          days: r.working_days, source: r.source_label || `Sold ${r.year}`, replacement: r.replacement_name,
          status: sMap[r.status] || r.status, approver: r.dept_head_name || '-',
          approvalDate: r.dept_head_approved_at ? format(parseISO(r.dept_head_approved_at), 'dd.MM.yyyy') : '-',
          createdAt: format(parseISO(r.created_at), 'dd.MM.yyyy'),
        });
      });
      const hr = ws.getRow(1);
      hr.height = 28;
      hr.eachCell(c => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
        c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        c.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
      });
      for (let i = 2; i <= ws.rowCount; i++) {
        ws.getRow(i).eachCell(c => {
          c.alignment = { horizontal: 'center', vertical: 'middle' };
          c.border = { top: { style: 'thin', color: { argb: 'FFB0B0B0' } }, bottom: { style: 'thin', color: { argb: 'FFB0B0B0' } }, left: { style: 'thin', color: { argb: 'FFB0B0B0' } }, right: { style: 'thin', color: { argb: 'FFB0B0B0' } } };
          if (i % 2 === 0) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F6FA' } };
        });
      }
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cereri_concediu_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Export realizat', description: `${filtered.length} cereri exportate în Excel.` });
    } catch (err) {
      console.error('Export error:', err);
      toast({ title: 'Eroare', description: 'Nu s-a putut genera fișierul Excel.', variant: 'destructive' });
    }
    setExportingXls(false);
  };

  const handleSendReminder = async () => {
    setSendingReminder(true);
    try {
      const { data, error } = await supabase.functions.invoke('remind-leave-approvers', {
        body: {},
      });
      if (error) throw error;
      toast({
        title: 'Reminder-uri trimise',
        description: `${data?.sent_to || 0} email(uri) trimise către aprobatori pentru ${data?.pending_requests || 0} cereri pendinte.`,
      });
    } catch (err) {
      console.error('Error sending reminders:', err);
      toast({
        title: 'Eroare',
        description: 'Nu s-au putut trimite reminder-urile.',
        variant: 'destructive',
      });
    }
    setSendingReminder(false);
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
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Centralizare Cereri Concediu ({filtered.length})
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSendReminder} disabled={sendingReminder}>
            {sendingReminder ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Bell className="w-4 h-4 mr-2" />}
            Reminder Aprobatori
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={exportingXls || filtered.length === 0}>
            {exportingXls ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
            Export Excel
          </Button>
        </div>
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
              <SelectItem value="pending_srus">Așteptare SRUS</SelectItem>
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
                  <TableHead>Funcție / Grad</TableHead>
                  <TableHead>Perioada</TableHead>
                   <TableHead>Zile</TableHead>
                   <TableHead className="text-center">Sursă</TableHead>
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
                    <TableCell className="text-sm">
                      <div>
                        {r.employee_position && <span>{r.employee_position}</span>}
                        {r.employee_grade && <span className="text-xs text-muted-foreground block">{r.employee_grade}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {format(parseISO(r.start_date), 'dd.MM.yy')} – {format(parseISO(r.end_date), 'dd.MM.yy')}
                    </TableCell>
                     <TableCell className="text-center font-medium">{r.working_days}</TableCell>
                     <TableCell className="text-center text-xs">
                       {r.source_label?.includes('+') ? (
                         <div className="flex flex-col gap-0.5">
                           {r.source_label.split(' + ').map((s, i) => (
                             <Badge key={i} variant="outline" className={`text-[10px] px-1.5 py-0 ${s.startsWith('Report') ? 'border-blue-300 text-blue-700 dark:border-blue-600 dark:text-blue-400' : 'border-emerald-300 text-emerald-700 dark:border-emerald-600 dark:text-emerald-400'}`}>
                               {s}
                             </Badge>
                           ))}
                         </div>
                       ) : (
                         <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${r.source_label?.startsWith('Report') ? 'border-blue-300 text-blue-700 dark:border-blue-600 dark:text-blue-400' : 'border-emerald-300 text-emerald-700 dark:border-emerald-600 dark:text-emerald-400'}`}>
                           {r.source_label || `Sold ${r.year}`}
                         </Badge>
                       )}
                     </TableCell>
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
                      ) : r.status === 'pending_srus' && r.dept_head_name ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1 text-sm text-amber-700 dark:text-amber-400">
                                <UserCheck className="w-3.5 h-3.5" />
                                <span className="truncate max-w-[120px]">{r.dept_head_name}</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Aprobat de: {r.dept_head_name}</p>
                              <p className="text-xs text-muted-foreground">Așteptare validare SRUS</p>
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
                        {r.status === 'pending_srus' && (
                          <Button
                            variant="default"
                            size="sm"
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                            onClick={() => { setSrusApproveDialog(r); setSrusApproveOfficer('Cătălina Bălan'); setSrusApproveSig(null); }}
                            disabled={processing === r.id}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Validează SRUS
                          </Button>
                        )}
                        {r.status === 'approved' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setDownloadDialog(r); }}
                            disabled={downloading === r.id}
                          >
                            {downloading === r.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                          </Button>
                        )}
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

      {/* Download Dialog - simple, SRUS data already stored */}
      <Dialog open={!!downloadDialog} onOpenChange={() => setDownloadDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Descarcă Document {downloadDialog?.request_number}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Angajat: <strong>{downloadDialog?.employee_name}</strong>
          </p>
          <p className="text-sm text-muted-foreground">
            Toate semnăturile și ștampilele vor fi incluse în document.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDownloadDialog(null)}>Anulează</Button>
            <Button
              onClick={() => downloadDialog && handleDownloadApproved(downloadDialog)}
              disabled={downloading === downloadDialog?.id}
            >
              {downloading === downloadDialog?.id ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Download className="w-4 h-4 mr-1" />}
              Descarcă DOCX
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SRUS Approval Dialog */}
      <Dialog open={!!srusApproveDialog} onOpenChange={() => { setSrusApproveDialog(null); setSrusApproveSig(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Validare SRUS — {srusApproveDialog?.request_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Angajat: <strong>{srusApproveDialog?.employee_name}</strong> • {srusApproveDialog?.working_days} zile
            </p>
            <div className="space-y-2">
              <Label>Salariat SRUS</Label>
              <Select value={srusApproveOfficer} onValueChange={(v) => { setSrusApproveOfficer(v); setSrusApproveSig(null); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover z-[9999]">
                  <SelectItem value="Cătălina Bălan">Cătălina Bălan</SelectItem>
                  <SelectItem value="Loredana Negru">Loredana Negru</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <SignaturePad
              label="Semnătura salariat SRUS"
              onSave={(sig) => setSrusApproveSig(sig)}
              existingSignature={srusApproveSig}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSrusApproveDialog(null); setSrusApproveSig(null); }}>Anulează</Button>
            <Button
              onClick={handleSrusApprove}
              disabled={!srusApproveSig || processing === srusApproveDialog?.id}
              className="bg-green-600 hover:bg-green-700"
            >
              {processing === srusApproveDialog?.id ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />}
              Validează și Aprobă
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
