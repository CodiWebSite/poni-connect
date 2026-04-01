import { useState, useEffect, useCallback } from 'react';
import { LEAVE_TYPES } from '@/utils/leaveTypes';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Navigate } from 'react-router-dom';

// Existing sub-components
import HRExportButton from '@/components/hr/HRExportButton';
import { LeaveApproversManager } from '@/components/hr/LeaveApproversManager';
import LeaveCalendar from '@/components/hr/LeaveCalendar';
import { EmployeeImport } from '@/components/hr/EmployeeImport';
import { CIExpiryImport } from '@/components/hr/CIExpiryImport';
import { LeaveCarryoverImport } from '@/components/hr/LeaveCarryoverImport';
import { EmailSyncImport } from '@/components/hr/EmailSyncImport';
import HRReportsPanel from '@/components/hr/HRReportsPanel';
import CertificateGenerator from '@/components/hr/CertificateGenerator';
import EmployeeDigitalDossier from '@/components/hr/EmployeeDigitalDossier';

// New modular components
import HRDashboard from '@/components/hr/HRDashboard';
import EmployeeHub, { type EmployeeWithData } from '@/components/hr/EmployeeHub';
import EmployeeLifecycle from '@/components/hr/EmployeeLifecycle';
import DataQualityPanel from '@/components/hr/DataQualityPanel';
import DocumentsExpirationsPanel from '@/components/hr/DocumentsExpirationsPanel';
import HRRequestsInbox from '@/components/hr/HRRequestsInbox';
import HRNotificationsRules from '@/components/hr/HRNotificationsRules';

import {
  Users, LayoutDashboard, FileText, Upload, Calendar, UserCheck,
  RefreshCw, UserPlus, FilePlus2, FolderOpen, Shield, Bell,
  Inbox, BarChart3, Award, Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { isPublicHoliday } from '@/utils/romanianHolidays';

const HRManagement = () => {
  const { user } = useAuth();
  const { canManageHR, loading: roleLoading } = useUserRole();
  const { toast } = useToast();

  const [employees, setEmployees] = useState<EmployeeWithData[]>([]);
  const [archivedEmployees, setArchivedEmployees] = useState<EmployeeWithData[]>([]);
  const [hrRequests, setHrRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [customHolidayDates, setCustomHolidayDates] = useState<string[]>([]);

  useEffect(() => {
    if (canManageHR) {
      fetchEmployees();
      fetchCustomHolidays();
      fetchArchivedEmployees();
    }
  }, [canManageHR]);

  const fetchEmployees = async () => {
    setLoading(true);
    const { data: personalData, error: pdError } = await supabase
      .from('employee_personal_data').select('*').eq('is_archived', false).order('last_name');
    if (pdError) { toast({ title: 'Eroare', description: 'Nu s-au putut încărca angajații.', variant: 'destructive' }); setLoading(false); return; }

    const [{ data: records }, { data: documents }, { data: allHrRequests }] = await Promise.all([
      supabase.from('employee_records').select('*'),
      supabase.from('employee_documents').select('*'),
      supabase.from('hr_requests').select('*'),
    ]);

    setHrRequests(allHrRequests || []);

    const allLeaves = (allHrRequests || []).filter((r: any) => r.request_type === 'concediu' && r.status === 'approved');
    const leavesByUserId: Record<string, any[]> = {};
    const leavesByEpdId: Record<string, any[]> = {};
    (allLeaves || []).forEach((lr: any) => {
      const d = lr.details || {};
      const entry = { startDate: d.startDate || '', endDate: d.endDate || '', numberOfDays: d.numberOfDays || 0 };
      if (d.epd_id) { if (!leavesByEpdId[d.epd_id]) leavesByEpdId[d.epd_id] = []; leavesByEpdId[d.epd_id].push(entry); }
      else if (lr.user_id) { if (!leavesByUserId[lr.user_id]) leavesByUserId[lr.user_id] = []; leavesByUserId[lr.user_id].push(entry); }
    });

    const currentYear = new Date().getFullYear();
    const [{ data: carryovers }, { data: bonusesData }, { data: allProfiles }] = await Promise.all([
      supabase.from('leave_carryover').select('employee_personal_data_id, remaining_days').eq('to_year', currentYear),
      supabase.from('leave_bonus').select('employee_personal_data_id, bonus_days').eq('year', currentYear),
      supabase.from('profiles').select('user_id, full_name, avatar_url'),
    ]);

    const carryoverMap: Record<string, number> = {};
    (carryovers || []).forEach((c: any) => { carryoverMap[c.employee_personal_data_id] = (carryoverMap[c.employee_personal_data_id] || 0) + c.remaining_days; });
    const bonusMap: Record<string, number> = {};
    (bonusesData || []).forEach((b: any) => { bonusMap[b.employee_personal_data_id] = (bonusMap[b.employee_personal_data_id] || 0) + b.bonus_days; });
    const updaterNames: Record<string, string> = {};
    const avatarMap: Record<string, string> = {};
    (allProfiles || []).forEach(p => { updaterNames[p.user_id] = p.full_name; if (p.avatar_url) avatarMap[p.user_id] = p.avatar_url; });

    const employeesWithData: EmployeeWithData[] = personalData?.map(pd => {
      const record = records?.find(r => r.id === pd.employee_record_id);
      return {
        id: pd.id, email: pd.email, first_name: pd.first_name, last_name: pd.last_name,
        full_name: `${pd.last_name} ${pd.first_name}`, cnp: pd.cnp, department: pd.department,
        position: pd.position, grade: (pd as any).grade || null,
        total_leave_days: record?.total_leave_days ?? pd.total_leave_days ?? 21,
        used_leave_days: record?.used_leave_days ?? pd.used_leave_days ?? 0,
        employment_date: pd.employment_date, contract_type: pd.contract_type,
        employee_record_id: pd.employee_record_id, record,
        documents: record ? documents?.filter(d => d.user_id === record.user_id) : [],
        hasAccount: !!pd.employee_record_id && !!record,
        user_id: record?.user_id, updated_at: pd.updated_at,
        last_updated_by: (pd as any).last_updated_by,
        last_updated_by_name: (pd as any).last_updated_by ? updaterNames[(pd as any).last_updated_by] : undefined,
        leaveHistory: [
          ...(record?.user_id ? (leavesByUserId[record.user_id] || []) : []),
          ...(leavesByEpdId[pd.id] || []),
        ].sort((a: any, b: any) => (b.startDate || '').localeCompare(a.startDate || '')),
        carryoverDays: carryoverMap[pd.id] || 0,
        bonusDays: bonusMap[pd.id] || 0,
        avatar_url: record?.user_id ? avatarMap[record.user_id] || null : null,
      };
    }) || [];

    setEmployees(employeesWithData);
    setLoading(false);
  };

  const fetchArchivedEmployees = async () => {
    const { data: archivedData } = await supabase.from('employee_personal_data').select('*').eq('is_archived', true).order('archived_at', { ascending: false });
    const archiverIds = [...new Set((archivedData || []).map((pd: any) => pd.archived_by).filter(Boolean))];
    let archiverNames: Record<string, string> = {};
    if (archiverIds.length > 0) {
      const { data: archiverProfiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', archiverIds);
      if (archiverProfiles) archiverProfiles.forEach(p => { archiverNames[p.user_id] = p.full_name; });
    }
    const mapped: EmployeeWithData[] = (archivedData || []).map((pd: any) => ({
      id: pd.id, email: pd.email, first_name: pd.first_name, last_name: pd.last_name,
      full_name: `${pd.last_name} ${pd.first_name}`, cnp: pd.cnp, department: pd.department,
      position: pd.position, grade: (pd as any).grade || null,
      total_leave_days: pd.total_leave_days ?? 21, used_leave_days: pd.used_leave_days ?? 0,
      employment_date: pd.employment_date, contract_type: pd.contract_type,
      employee_record_id: pd.employee_record_id, hasAccount: false,
      is_archived: true, archived_at: pd.archived_at, archived_by: pd.archived_by,
      archive_reason: pd.archive_reason, archived_by_name: pd.archived_by ? archiverNames[pd.archived_by] : undefined,
    }));
    setArchivedEmployees(mapped);
  };

  const fetchCustomHolidays = async () => {
    const { data } = await supabase.from('custom_holidays').select('holiday_date, name').order('holiday_date');
    if (data) setCustomHolidayDates(data.map(h => h.holiday_date));
  };

  const syncEmployees = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-employees');
      if (error) throw error;
      if (data.success) { toast({ title: 'Sincronizare reușită', description: `${data.synced_count} angajați sincronizați.` }); fetchEmployees(); }
      else throw new Error(data.error);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Eroare necunoscută';
      toast({ title: 'Eroare', description: msg, variant: 'destructive' });
    }
    setSyncing(false);
  };

  const handleRefresh = useCallback(() => { fetchEmployees(); fetchArchivedEmployees(); }, []);

  const allDepartments = [...new Set([
    ...employees.map(e => e.department).filter(Boolean) as string[],
    ...archivedEmployees.map(e => e.department).filter(Boolean) as string[],
  ])].sort();

  const exportEmployees = employees.map(e => ({
    user_id: e.user_id, full_name: e.full_name, email: e.email, department: e.department,
    position: e.position, hasAccount: e.hasAccount, cnp: e.cnp, employment_date: e.employment_date,
    contract_type: e.contract_type, leaveHistory: e.leaveHistory, carryoverDays: e.carryoverDays || 0,
    bonusDays: e.bonusDays || 0,
    record: { total_leave_days: e.total_leave_days, used_leave_days: e.used_leave_days,
      remaining_leave_days: e.total_leave_days - e.used_leave_days,
      hire_date: e.record?.hire_date || e.employment_date || null,
      contract_type: e.record?.contract_type || e.contract_type || '-' },
  }));

  if (!roleLoading && !canManageHR) return <Navigate to="/" replace />;

  return (
    <MainLayout title="Gestiune HR" description="Centru Profesionist de Administrare Personal">
      <Tabs defaultValue="dashboard" className="space-y-6">
        {/* Sticky toolbar */}
        <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/40 -mx-4 px-4 py-2 md:-mx-6 md:px-6 flex flex-wrap gap-2 justify-between items-center">
          <div className="overflow-x-auto scrollbar-hide flex-1">
            <TabsList className="inline-flex h-auto gap-1 p-1 min-w-max">
              <TabsTrigger value="dashboard" className="gap-2"><LayoutDashboard className="h-4 w-4" /><span className="hidden sm:inline">Dashboard</span></TabsTrigger>
              <TabsTrigger value="employees" className="gap-2"><Users className="h-4 w-4" /><span className="hidden sm:inline">Angajați</span></TabsTrigger>
              <TabsTrigger value="lifecycle" className="gap-2"><UserPlus className="h-4 w-4" /><span className="hidden sm:inline">Ciclu de Viață</span></TabsTrigger>
              <TabsTrigger value="quality" className="gap-2"><Shield className="h-4 w-4" /><span className="hidden sm:inline">Calitate Date</span></TabsTrigger>
              <TabsTrigger value="documents" className="gap-2"><FileText className="h-4 w-4" /><span className="hidden sm:inline">Documente</span></TabsTrigger>
              <TabsTrigger value="requests" className="gap-2"><Inbox className="h-4 w-4" /><span className="hidden sm:inline">Cereri HR</span></TabsTrigger>
              <TabsTrigger value="notifications" className="gap-2"><Bell className="h-4 w-4" /><span className="hidden sm:inline">Notificări</span></TabsTrigger>
              <TabsTrigger value="calendar" className="gap-2"><Calendar className="h-4 w-4" /><span className="hidden sm:inline">Calendar</span></TabsTrigger>
              <TabsTrigger value="approvers" className="gap-2"><UserCheck className="h-4 w-4" /><span className="hidden sm:inline">Aprobatori</span></TabsTrigger>
              <TabsTrigger value="import" className="gap-2"><Upload className="h-4 w-4" /><span className="hidden sm:inline">Import</span></TabsTrigger>
              <TabsTrigger value="reports" className="gap-2"><BarChart3 className="h-4 w-4" /><span className="hidden sm:inline">Rapoarte</span></TabsTrigger>
              <TabsTrigger value="certificates" className="gap-2"><Award className="h-4 w-4" /><span className="hidden sm:inline">Adeverințe</span></TabsTrigger>
              <TabsTrigger value="dossier" className="gap-2"><FolderOpen className="h-4 w-4" /><span className="hidden sm:inline">Dosare</span></TabsTrigger>
            </TabsList>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={syncEmployees} disabled={syncing}>
              <RefreshCw className={`w-4 h-4 sm:mr-2 ${syncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{syncing ? 'Sincronizare...' : 'Sincronizează'}</span>
            </Button>
            <HRExportButton requests={hrRequests} employees={exportEmployees} />
          </div>
        </div>

        {/* Tab Contents */}
        <TabsContent value="dashboard"><HRDashboard /></TabsContent>

        <TabsContent value="employees">
          <EmployeeHub employees={employees} archivedEmployees={archivedEmployees} loading={loading} onRefresh={handleRefresh} onSync={syncEmployees} syncing={syncing} />
        </TabsContent>

        <TabsContent value="lifecycle">
          <EmployeeLifecycle departments={allDepartments} onRefresh={handleRefresh} onSync={syncEmployees} syncing={syncing} />
        </TabsContent>

        <TabsContent value="quality"><DataQualityPanel /></TabsContent>

        <TabsContent value="documents"><DocumentsExpirationsPanel /></TabsContent>

        <TabsContent value="requests"><HRRequestsInbox /></TabsContent>

        <TabsContent value="notifications"><HRNotificationsRules /></TabsContent>

        <TabsContent value="calendar"><LeaveCalendar /></TabsContent>

        <TabsContent value="approvers"><LeaveApproversManager /></TabsContent>

        <TabsContent value="import" className="space-y-6">
          <EmployeeImport />
          <LeaveCarryoverImport onImported={fetchEmployees} />
          <CIExpiryImport />
          <EmailSyncImport />
        </TabsContent>

        <TabsContent value="reports"><HRReportsPanel /></TabsContent>

        <TabsContent value="certificates"><CertificateGenerator /></TabsContent>

        <TabsContent value="dossier"><EmployeeDigitalDossier /></TabsContent>
      </Tabs>
    </MainLayout>
  );
};

export default HRManagement;
