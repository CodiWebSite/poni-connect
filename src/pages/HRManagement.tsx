import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';

import { EmployeeImport } from '@/components/hr/EmployeeImport';
import { PersonalDataEditor } from '@/components/hr/PersonalDataEditor';
import { CorrectionRequestsManager } from '@/components/hr/CorrectionRequestsManager';
import HRExportButton from '@/components/hr/HRExportButton';
import { EmployeeLeaveHistory } from '@/components/hr/EmployeeLeaveHistory';
import { 
  Users, 
  UserPlus, 
  FileText, 
  Search, 
  Edit, 
  Upload, 
  Calendar, 
  Briefcase,
  Loader2,
  Save,
  Eye,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  Download,
  FileSpreadsheet,
  FilePlus2,
  RefreshCw,
  CreditCard,
  MessageSquare,
  UserCheck,
  UserX,
  Archive,
  RotateCcw,
  History
} from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Navigate } from 'react-router-dom';
import * as XLSX from 'xlsx';

interface EmployeeRecord {
  id: string;
  user_id: string;
  hire_date: string | null;
  contract_type: string;
  total_leave_days: number;
  used_leave_days: number;
  remaining_leave_days: number;
}

interface EmployeeDocument {
  id: string;
  user_id: string;
  document_type: string;
  name: string;
  description: string | null;
  file_url: string | null;
  created_at: string;
}

interface EmployeeWithData {
  // From employee_personal_data
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  cnp: string;
  department: string | null;
  position: string | null;
  total_leave_days: number;
  used_leave_days: number;
  employment_date: string;
  contract_type: string | null;
  employee_record_id: string | null;
  // Linked data
  record?: EmployeeRecord;
  documents?: EmployeeDocument[];
  hasAccount: boolean;
  user_id?: string;
  updated_at?: string;
  last_updated_by?: string;
  last_updated_by_name?: string;
  is_archived?: boolean;
  archived_at?: string;
  archived_by?: string;
  archive_reason?: string;
  archived_by_name?: string;
}

const documentTypes = [
  { value: 'cv', label: 'CV' },
  { value: 'contract', label: 'Contract de Muncă' },
  { value: 'anexa', label: 'Anexă Contract' },
  { value: 'certificat', label: 'Certificat' },
  { value: 'diploma', label: 'Diplomă' },
  { value: 'adeverinta', label: 'Adeverință' },
  { value: 'altele', label: 'Altele' }
];

const HRManagement = () => {
  const { user } = useAuth();
  const { canManageHR, loading: roleLoading } = useUserRole();
  const { toast } = useToast();
  
  const [employees, setEmployees] = useState<EmployeeWithData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [accountFilter, setAccountFilter] = useState<'all' | 'with_account' | 'without_account'>('all');
  
  // Edit dialog state
  const [editingEmployee, setEditingEmployee] = useState<EmployeeWithData | null>(null);
  const [editForm, setEditForm] = useState({
    department: '',
    position: '',
    hire_date: '',
    contract_type: 'nedeterminat',
    total_leave_days: 21,
    used_leave_days: 0
  });
  const [saving, setSaving] = useState(false);
  
  // Upload dialog state
  const [uploadingFor, setUploadingFor] = useState<EmployeeWithData | null>(null);
  const [uploadForm, setUploadForm] = useState({
    document_type: 'contract',
    name: '',
    description: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  
  // New employee dialog
  const [showNewEmployee, setShowNewEmployee] = useState(false);
  
  // Manual leave registration dialog
  const [showManualLeave, setShowManualLeave] = useState(false);
  const [manualLeaveForm, setManualLeaveForm] = useState({
    employee_id: '', // can be user_id or epd_id prefixed with 'epd:'
    start_date: '',
    end_date: '',
    notes: ''
  });
  const [manualLeaveFile, setManualLeaveFile] = useState<File | null>(null);
  const [submittingManualLeave, setSubmittingManualLeave] = useState(false);
  const [selectedNewEmployee, setSelectedNewEmployee] = useState<string>('');
  const [syncing, setSyncing] = useState(false);
  const [editingPersonalData, setEditingPersonalData] = useState<EmployeeWithData | null>(null);
  const [archivedEmployees, setArchivedEmployees] = useState<EmployeeWithData[]>([]);
  const [loadingArchived, setLoadingArchived] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [leaveHistoryEmployee, setLeaveHistoryEmployee] = useState<EmployeeWithData | null>(null);

  useEffect(() => {
    if (canManageHR) {
      fetchEmployees();
      fetchArchivedEmployees();
    }
  }, [canManageHR]);

  const fetchEmployees = async () => {
    setLoading(true);
    
    // Fetch ALL employees from employee_personal_data (the master list)
    const { data: personalData, error: pdError } = await supabase
      .from('employee_personal_data')
      .select('*')
      .eq('is_archived', false)
      .order('last_name');
    
    if (pdError) {
      console.error('Error fetching employee_personal_data:', pdError);
      toast({ title: 'Eroare', description: 'Nu s-au putut încărca angajații.', variant: 'destructive' });
      setLoading(false);
      return;
    }

    // Fetch all employee records (for employees with accounts)
    const { data: records } = await supabase
      .from('employee_records')
      .select('*');

    // Fetch all employee documents
    const { data: documents } = await supabase
      .from('employee_documents')
      .select('*');

    // Fetch updater names
    const updaterIds = [...new Set((personalData || []).map((pd: any) => pd.last_updated_by).filter(Boolean))];
    let updaterNames: Record<string, string> = {};
    if (updaterIds.length > 0) {
      const { data: updaterProfiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', updaterIds);
      if (updaterProfiles) {
        updaterProfiles.forEach(p => { updaterNames[p.user_id] = p.full_name; });
      }
    }

    const employeesWithData: EmployeeWithData[] = personalData?.map(pd => {
      const record = records?.find(r => r.id === pd.employee_record_id);
      return {
        id: pd.id,
        email: pd.email,
        first_name: pd.first_name,
        last_name: pd.last_name,
        full_name: `${pd.last_name} ${pd.first_name}`,
        cnp: pd.cnp,
        department: pd.department,
        position: pd.position,
        total_leave_days: record?.total_leave_days ?? pd.total_leave_days ?? 21,
        used_leave_days: record?.used_leave_days ?? pd.used_leave_days ?? 0,
        employment_date: pd.employment_date,
        contract_type: pd.contract_type,
        employee_record_id: pd.employee_record_id,
        record,
        documents: record ? documents?.filter(d => d.user_id === record.user_id) : [],
        hasAccount: !!pd.employee_record_id && !!record,
        user_id: record?.user_id,
        updated_at: pd.updated_at,
        last_updated_by: (pd as any).last_updated_by,
        last_updated_by_name: (pd as any).last_updated_by ? updaterNames[(pd as any).last_updated_by] : undefined,
      };
    }) || [];

    setEmployees(employeesWithData);
    setLoading(false);
  };

  const fetchArchivedEmployees = async () => {
    setLoadingArchived(true);
    const { data: archivedData } = await supabase
      .from('employee_personal_data')
      .select('*')
      .eq('is_archived', true)
      .order('archived_at', { ascending: false });

    // Fetch archiver names
    const archiverIds = [...new Set((archivedData || []).map((pd: any) => pd.archived_by).filter(Boolean))];
    let archiverNames: Record<string, string> = {};
    if (archiverIds.length > 0) {
      const { data: archiverProfiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', archiverIds);
      if (archiverProfiles) {
        archiverProfiles.forEach(p => { archiverNames[p.user_id] = p.full_name; });
      }
    }

    const mapped: EmployeeWithData[] = (archivedData || []).map((pd: any) => ({
      id: pd.id,
      email: pd.email,
      first_name: pd.first_name,
      last_name: pd.last_name,
      full_name: `${pd.last_name} ${pd.first_name}`,
      cnp: pd.cnp,
      department: pd.department,
      position: pd.position,
      total_leave_days: pd.total_leave_days ?? 21,
      used_leave_days: pd.used_leave_days ?? 0,
      employment_date: pd.employment_date,
      contract_type: pd.contract_type,
      employee_record_id: pd.employee_record_id,
      hasAccount: false,
      is_archived: true,
      archived_at: pd.archived_at,
      archived_by: pd.archived_by,
      archive_reason: pd.archive_reason,
      archived_by_name: pd.archived_by ? archiverNames[pd.archived_by] : undefined,
    }));

    setArchivedEmployees(mapped);
    setLoadingArchived(false);
  };

  const restoreEmployee = async (employee: EmployeeWithData) => {
    if (!confirm(`Sigur doriți să restaurați angajatul ${employee.full_name}?`)) return;
    setRestoringId(employee.id);
    try {
      const { error } = await supabase
        .from('employee_personal_data')
        .update({
          is_archived: false,
          archived_at: null,
          archived_by: null,
          archive_reason: null,
        })
        .eq('id', employee.id);

      if (error) throw error;

      if (user) {
        await supabase.rpc('log_audit_event', {
          _user_id: user.id,
          _action: 'employee_restore',
          _entity_type: 'employee_personal_data',
          _entity_id: employee.id,
          _details: { employee_name: employee.full_name }
        });
      }

      toast({ title: 'Restaurat', description: `${employee.full_name} a fost restaurat în lista activă.` });
      fetchEmployees();
      fetchArchivedEmployees();
    } catch (error) {
      toast({ title: 'Eroare', description: 'Nu s-a putut restaura angajatul.', variant: 'destructive' });
    }
    setRestoringId(null);
  };

  const openEditDialog = (employee: EmployeeWithData) => {
    setEditingEmployee(employee);
    setEditForm({
      department: employee.department || '',
      position: employee.position || '',
      hire_date: employee.record?.hire_date || employee.employment_date || '',
      contract_type: employee.record?.contract_type || employee.contract_type || 'nedeterminat',
      total_leave_days: employee.total_leave_days,
      used_leave_days: employee.used_leave_days,
    });
  };

  const saveEmployeeRecord = async () => {
    if (!editingEmployee) return;
    
    setSaving(true);
    
    // 1. Always update employee_personal_data (the master record)
    const { error: epdError } = await supabase
      .from('employee_personal_data')
      .update({
        department: editForm.department || null,
        position: editForm.position || null,
        employment_date: editForm.hire_date || editingEmployee.employment_date,
        contract_type: editForm.contract_type,
        total_leave_days: editForm.total_leave_days,
        used_leave_days: editForm.used_leave_days,
        last_updated_by: user?.id || null,
      })
      .eq('id', editingEmployee.id);

    if (epdError) {
      toast({ title: 'Eroare', description: 'Nu s-au putut salva datele.', variant: 'destructive' });
      setSaving(false);
      return;
    }

    // 2. If employee has an account, also sync to employee_records and profiles
    if (editingEmployee.record && editingEmployee.user_id) {
      await supabase
        .from('employee_records')
        .update({
          hire_date: editForm.hire_date || null,
          contract_type: editForm.contract_type,
          total_leave_days: editForm.total_leave_days,
          used_leave_days: editForm.used_leave_days,
        })
        .eq('id', editingEmployee.record.id);

      await supabase
        .from('profiles')
        .update({
          department: editForm.department || null,
          position: editForm.position || null,
        })
        .eq('user_id', editingEmployee.user_id);
    }

    // Log audit event
    if (user) {
      await supabase.rpc('log_audit_event', {
        _user_id: user.id,
        _action: 'employee_edit',
        _entity_type: 'employee_personal_data',
        _entity_id: editingEmployee.id,
        _details: { employee_name: editingEmployee.full_name }
      });
    }

    toast({ title: 'Succes', description: 'Datele angajatului au fost actualizate.' });
    fetchEmployees();
    setSaving(false);
    setEditingEmployee(null);
  };

  const uploadDocument = async () => {
    if (!uploadingFor || !selectedFile || !uploadingFor.user_id) return;
    
    setUploading(true);
    
    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${uploadingFor.user_id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('employee-documents')
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from('employee_documents')
        .insert({
          user_id: uploadingFor.user_id,
          document_type: uploadForm.document_type,
          name: uploadForm.name || selectedFile.name,
          description: uploadForm.description || null,
          file_url: fileName,
          uploaded_by: user?.id
        });

      if (dbError) throw dbError;

      toast({ title: 'Succes', description: 'Documentul a fost încărcat.' });
      fetchEmployees();
      setUploadingFor(null);
      setSelectedFile(null);
      setUploadForm({ document_type: 'contract', name: '', description: '' });
    } catch (error) {
      console.error('Upload error:', error);
      toast({ title: 'Eroare', description: 'Nu s-a putut încărca documentul.', variant: 'destructive' });
    }
    
    setUploading(false);
  };

  const deleteDocument = async (doc: EmployeeDocument) => {
    if (!confirm('Sigur doriți să ștergeți acest document?')) return;
    
    try {
      if (doc.file_url) {
        await supabase.storage.from('employee-documents').remove([doc.file_url]);
      }
      
      await supabase.from('employee_documents').delete().eq('id', doc.id);
      
      toast({ title: 'Succes', description: 'Documentul a fost șters.' });
      fetchEmployees();
    } catch (error) {
      toast({ title: 'Eroare', description: 'Nu s-a putut șterge documentul.', variant: 'destructive' });
    }
  };

  const archiveEmployee = async (employee: EmployeeWithData) => {
    const reason = prompt(`Motivul arhivării angajatului ${employee.full_name}:`);
    if (reason === null) return;
    
    try {
      const { error } = await supabase
        .from('employee_personal_data')
        .update({
          is_archived: true,
          archived_at: new Date().toISOString(),
          archived_by: user?.id || null,
          archive_reason: reason || 'Fără motiv specificat',
        })
        .eq('id', employee.id);

      if (error) throw error;

      if (user) {
        await supabase.rpc('log_audit_event', {
          _user_id: user.id,
          _action: 'employee_archive',
          _entity_type: 'employee_personal_data',
          _entity_id: employee.id,
          _details: { employee_name: employee.full_name, reason: reason || 'Fără motiv' }
        });
      }

      toast({ title: 'Arhivat', description: `${employee.full_name} a fost arhivat. Datele rămân în baza de date.` });
      fetchEmployees();
      fetchArchivedEmployees();
    } catch (error) {
      toast({ title: 'Eroare', description: 'Nu s-a putut arhiva angajatul.', variant: 'destructive' });
    }
  };

  const downloadDocument = async (doc: EmployeeDocument) => {
    if (!doc.file_url) return;
    
    try {
      const { data, error } = await supabase.storage
        .from('employee-documents')
        .download(doc.file_url);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({ title: 'Eroare', description: 'Nu s-a putut descărca fișierul.', variant: 'destructive' });
    }
  };

  // Get incomplete employees (missing department or position in employee_personal_data)
  const incompleteEmployees = employees.filter(e => 
    !e.department || !e.position
  );

  const selectEmployeeToComplete = (epdId: string) => {
    const employee = employees.find(e => e.id === epdId);
    if (employee) {
      setShowNewEmployee(false);
      openEditDialog(employee);
    }
  };

  // Calculate working days between two dates (excluding weekends)
  const calculateWorkingDays = (startDate: string, endDate: string): number => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let count = 0;
    const current = new Date(start);
    
    while (current <= end) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    return count;
  };

  const submitManualLeave = async () => {
    if (!manualLeaveForm.employee_id || !manualLeaveForm.start_date || !manualLeaveForm.end_date) {
      toast({ title: 'Eroare', description: 'Completați toate câmpurile obligatorii.', variant: 'destructive' });
      return;
    }

    const isEpdOnly = manualLeaveForm.employee_id.startsWith('epd:');
    const epdId = isEpdOnly ? manualLeaveForm.employee_id.replace('epd:', '') : null;
    const employee = isEpdOnly
      ? employees.find(e => e.id === epdId)
      : employees.find(e => e.user_id === manualLeaveForm.employee_id);

    if (!employee) {
      toast({ title: 'Eroare', description: 'Angajatul nu a fost găsit.', variant: 'destructive' });
      return;
    }

    const numberOfDays = calculateWorkingDays(manualLeaveForm.start_date, manualLeaveForm.end_date);
    const remainingDays = employee.total_leave_days - employee.used_leave_days;
    
    if (numberOfDays > remainingDays) {
      toast({ 
        title: 'Eroare', 
        description: `Angajatul are doar ${remainingDays} zile disponibile.`, 
        variant: 'destructive' 
      });
      return;
    }

    setSubmittingManualLeave(true);

    try {
      let fileUrl: string | null = null;

      if (manualLeaveFile && employee.user_id) {
        const fileExt = manualLeaveFile.name.split('.').pop();
        const fileName = `${employee.user_id}/manual-leave-${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('employee-documents')
          .upload(fileName, manualLeaveFile);

        if (uploadError) throw uploadError;
        fileUrl = fileName;

        await supabase.from('employee_documents').insert({
          user_id: employee.user_id,
          document_type: 'cerere_concediu_scanata',
          name: `Cerere concediu ${format(new Date(manualLeaveForm.start_date), 'dd.MM.yyyy')} - ${format(new Date(manualLeaveForm.end_date), 'dd.MM.yyyy')}`,
          description: manualLeaveForm.notes || 'Cerere de concediu scanată - înregistrare manuală',
          file_url: fileName,
          uploaded_by: user?.id
        });
      }

      // Use the employee's user_id if they have an account, otherwise use the HR user's id
      const requestUserId = employee.user_id || user?.id;
      if (!requestUserId) throw new Error('No user ID available');

      await supabase.from('hr_requests').insert({
        user_id: requestUserId,
        request_type: 'concediu' as const,
        status: 'approved' as const,
        approver_id: user?.id,
        details: {
          startDate: manualLeaveForm.start_date,
          endDate: manualLeaveForm.end_date,
          numberOfDays,
          manualEntry: true,
          scannedDocumentUrl: fileUrl,
          notes: manualLeaveForm.notes,
          // Store epd_id for employees without accounts
          ...(isEpdOnly ? { epd_id: epdId, employee_name: employee.full_name } : {}),
        }
      });

      // Update leave balance
      if (employee.record) {
        const newUsedDays = employee.record.used_leave_days + numberOfDays;
        await supabase
          .from('employee_records')
          .update({ used_leave_days: newUsedDays })
          .eq('id', employee.record.id);
      }

      // Always update employee_personal_data
      const newEpdUsedDays = employee.used_leave_days + numberOfDays;
      await supabase
        .from('employee_personal_data')
        .update({ used_leave_days: newEpdUsedDays })
        .eq('id', employee.id);

      toast({ 
        title: 'Succes', 
        description: `Cererea de concediu a fost înregistrată. ${numberOfDays} zile deduse din sold.` 
      });

      setManualLeaveForm({ employee_id: '', start_date: '', end_date: '', notes: '' });
      setManualLeaveFile(null);
      setShowManualLeave(false);
      fetchEmployees();
    } catch (error) {
      console.error('Manual leave error:', error);
      toast({ title: 'Eroare', description: 'Nu s-a putut înregistra cererea.', variant: 'destructive' });
    }

    setSubmittingManualLeave(false);
  };

  const selectedManualEmployee = manualLeaveForm.employee_id.startsWith('epd:')
    ? employees.find(e => e.id === manualLeaveForm.employee_id.replace('epd:', ''))
    : employees.find(e => e.user_id === manualLeaveForm.employee_id);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // HR Export data adapters
  const exportEmployees = employees.map(e => ({
    user_id: e.user_id,
    full_name: e.full_name,
    email: e.email,
    department: e.department,
    position: e.position,
    hasAccount: e.hasAccount,
    record: e.record ? {
      total_leave_days: e.total_leave_days,
      used_leave_days: e.used_leave_days,
      remaining_leave_days: e.total_leave_days - e.used_leave_days,
      hire_date: e.record.hire_date,
      contract_type: e.record.contract_type,
    } : undefined,
  }));

  const syncEmployees = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-employees');
      
      if (error) throw error;
      
      if (data.success) {
        toast({ 
          title: 'Sincronizare reușită', 
          description: `${data.synced_count} angajați sincronizați.` 
        });
        fetchEmployees();
      } else {
        throw new Error(data.error);
      }
    } catch (error: unknown) {
      console.error('Sync error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Eroare necunoscută';
      toast({ title: 'Eroare la sincronizare', description: errorMessage, variant: 'destructive' });
    }
    setSyncing(false);
  };

  const filteredEmployees = employees.filter(e => {
    const matchesSearch = e.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.department?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.position?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = accountFilter === 'all' 
      ? true 
      : accountFilter === 'with_account' 
        ? e.hasAccount 
        : !e.hasAccount;
    
    return matchesSearch && matchesFilter;
  });

  // Redirect if not authorized
  if (!roleLoading && !canManageHR) {
    return <Navigate to="/" replace />;
  }

  const employeesWithAccounts = employees.filter(e => e.hasAccount);
  const remainingLeave = (emp: EmployeeWithData) => emp.total_leave_days - emp.used_leave_days;

  return (
    <MainLayout title="Gestiune HR" description="Administrare date angajați - Confidențial">
      <Tabs defaultValue="employees" className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <TabsList>
            <TabsTrigger value="employees" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Angajați</span>
            </TabsTrigger>
            <TabsTrigger value="corrections" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Cereri Corecție</span>
            </TabsTrigger>
            <TabsTrigger value="archived" className="gap-2">
              <Archive className="h-4 w-4" />
              <span className="hidden sm:inline">Arhivați ({archivedEmployees.length})</span>
            </TabsTrigger>
            <TabsTrigger value="import" className="gap-2">
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Import</span>
            </TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={syncEmployees} disabled={syncing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{syncing ? 'Sincronizare...' : 'Sincronizează'}</span>
            </Button>
            <HRExportButton requests={[]} employees={exportEmployees} />
            <Button variant="outline" onClick={() => setShowManualLeave(true)}>
              <FilePlus2 className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Concediu Manual</span>
            </Button>
            {incompleteEmployees.length > 0 && (
              <Button onClick={() => setShowNewEmployee(true)}>
                <UserPlus className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Completare Date</span>
              </Button>
            )}
          </div>
        </div>

        {/* Employees Tab */}
        <TabsContent value="employees" className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="relative max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Caută după nume, email, departament..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-1 rounded-lg border border-border p-1 bg-muted/50">
              <Button
                variant={accountFilter === 'all' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setAccountFilter('all')}
                className="text-xs h-8"
              >
                <Users className="w-3.5 h-3.5 mr-1" />
                Toți ({employees.length})
              </Button>
              <Button
                variant={accountFilter === 'with_account' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setAccountFilter('with_account')}
                className="text-xs h-8"
              >
                <UserCheck className="w-3.5 h-3.5 mr-1" />
                Cu cont ({employeesWithAccounts.length})
              </Button>
              <Button
                variant={accountFilter === 'without_account' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setAccountFilter('without_account')}
                className="text-xs h-8"
              >
                <UserX className="w-3.5 h-3.5 mr-1" />
                Fără cont ({employees.length - employeesWithAccounts.length})
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Users className="w-8 h-8 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{employees.length}</p>
                    <p className="text-xs text-muted-foreground">Total Angajați</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <UserCheck className="w-8 h-8 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold">{employeesWithAccounts.length}</p>
                    <p className="text-xs text-muted-foreground">Cu Cont Activ</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <FileText className="w-8 h-8 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold">
                      {employees.reduce((acc, e) => acc + (e.documents?.length || 0), 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">Documente</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Clock className="w-8 h-8 text-amber-500" />
                  <div>
                    <p className="text-2xl font-bold">{incompleteEmployees.length}</p>
                    <p className="text-xs text-muted-foreground">Date Incomplete</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Lista Angajaților ({filteredEmployees.length})
              </CardTitle>
              <CardDescription>
                Toți angajații importați din fișierele XLS — gestionează datele și documentele
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nu s-au găsit angajați</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredEmployees.map((employee) => (
                    <div
                      key={employee.id}
                      className="p-4 bg-secondary/30 rounded-lg border border-border"
                    >
                      <div className="flex flex-col lg:flex-row gap-4">
                        {/* Employee Info */}
                        <div className="flex items-start gap-3 flex-1">
                          <Avatar className="w-12 h-12 flex-shrink-0">
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {getInitials(employee.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-foreground">{employee.full_name}</p>
                              {employee.hasAccount ? (
                                <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                                  <UserCheck className="w-3 h-3 mr-1" />
                                  Cont activ
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs text-muted-foreground">
                                  <UserX className="w-3 h-3 mr-1" />
                                  Fără cont
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {employee.position || 'Fără funcție'} • {employee.department || 'Fără departament'}
                            </p>
                            <p className="text-xs text-muted-foreground">{employee.email}</p>
                            
                            <div className="flex flex-wrap gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">
                                <Calendar className="w-3 h-3 mr-1" />
                                {remainingLeave(employee)} zile disponibile
                              </Badge>
                              {employee.employment_date && (
                                <Badge variant="outline" className="text-xs">
                                  Angajat: {format(new Date(employee.employment_date), 'dd MMM yyyy', { locale: ro })}
                                </Badge>
                              )}
                              {(!employee.department || !employee.position) && (
                                <Badge variant="destructive" className="text-xs">
                                  Date incomplete
                                </Badge>
                              )}
                              {employee.documents && employee.documents.length > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  <FileText className="w-3 h-3 mr-1" />
                                  {employee.documents.length} doc.
                                </Badge>
                              )}
                              {employee.updated_at && (
                                <Badge variant="outline" className="text-xs text-muted-foreground">
                                  <Clock className="w-3 h-3 mr-1" />
                                  Actualizat: {format(new Date(employee.updated_at), 'dd.MM.yyyy HH:mm', { locale: ro })}
                                  {employee.last_updated_by_name && (
                                    <span className="ml-1">de {employee.last_updated_by_name}</span>
                                  )}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap gap-2 lg:flex-shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(employee)}
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Editează
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const empId = employee.hasAccount ? employee.user_id! : `epd:${employee.id}`;
                              setManualLeaveForm({ ...manualLeaveForm, employee_id: empId });
                              setShowManualLeave(true);
                            }}
                          >
                            <Calendar className="w-4 h-4 mr-1" />
                            Concediu
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setLeaveHistoryEmployee(employee)}
                          >
                            <History className="w-4 h-4 mr-1" />
                            Istoric
                          </Button>
                          {employee.hasAccount && employee.user_id && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setUploadingFor(employee)}
                            >
                              <Upload className="w-4 h-4 mr-1" />
                              Doc.
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingPersonalData(employee)}
                          >
                            <CreditCard className="w-4 h-4 mr-1" />
                            Date CI
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => archiveEmployee(employee)}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Arhivează
                          </Button>
                        </div>
                      </div>

                      {/* Documents Preview */}
                      {employee.documents && employee.documents.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-border">
                          <p className="text-sm font-medium mb-2">Documente:</p>
                          <div className="flex flex-wrap gap-2">
                            {employee.documents.slice(0, 5).map((doc) => (
                              <div
                                key={doc.id}
                                className="flex items-center gap-1 px-2 py-1 bg-background rounded text-xs border"
                              >
                                <FileText className="w-3 h-3" />
                                <span className="max-w-[100px] truncate">{doc.name}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="w-5 h-5"
                                  onClick={() => downloadDocument(doc)}
                                >
                                  <Download className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="w-5 h-5 text-destructive"
                                  onClick={() => deleteDocument(doc)}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            ))}
                            {employee.documents.length > 5 && (
                              <Badge variant="secondary">+{employee.documents.length - 5} mai multe</Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Corrections Tab */}
        <TabsContent value="corrections">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                Cereri de Corecție Date
              </CardTitle>
              <CardDescription>
                Gestionați cererile de corecție trimise de angajați
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CorrectionRequestsManager />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Archived Tab */}
        <TabsContent value="archived" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Archive className="w-5 h-5 text-primary" />
                Angajați Arhivați ({archivedEmployees.length})
              </CardTitle>
              <CardDescription>
                Angajați eliminați din lista activă. Datele sunt păstrate în baza de date.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingArchived ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : archivedEmployees.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Archive className="w-12 h-12 mx-auto mb-4 opacity-40" />
                  <p>Nu există angajați arhivați.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {archivedEmployees.map((employee) => (
                    <div key={employee.id} className="p-4 bg-secondary/30 rounded-lg border border-border">
                      <div className="flex flex-col sm:flex-row gap-4 items-start">
                        <div className="flex items-start gap-3 flex-1">
                          <Avatar className="w-12 h-12 flex-shrink-0">
                            <AvatarFallback className="bg-muted text-muted-foreground">
                              {getInitials(employee.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold">{employee.full_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {employee.position || 'Fără funcție'} • {employee.department || 'Fără departament'}
                            </p>
                            <p className="text-xs text-muted-foreground">{employee.email}</p>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {employee.archived_at && (
                                <Badge variant="outline" className="text-xs">
                                  <Clock className="w-3 h-3 mr-1" />
                                  Arhivat: {format(new Date(employee.archived_at), 'dd MMM yyyy HH:mm', { locale: ro })}
                                </Badge>
                              )}
                              {employee.archived_by_name && (
                                <Badge variant="outline" className="text-xs">
                                  De: {employee.archived_by_name}
                                </Badge>
                              )}
                              {employee.archive_reason && (
                                <Badge variant="secondary" className="text-xs">
                                  Motiv: {employee.archive_reason}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => restoreEmployee(employee)}
                          disabled={restoringId === employee.id}
                        >
                          {restoringId === employee.id ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <RotateCcw className="w-4 h-4 mr-1" />
                          )}
                          Restaurează
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Import Tab */}
        <TabsContent value="import">
          <EmployeeImport />
        </TabsContent>
      </Tabs>

      {/* Edit Employee Dialog */}
      <Dialog open={!!editingEmployee} onOpenChange={(open) => !open && setEditingEmployee(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editare Date Angajat</DialogTitle>
            <DialogDescription>
              {editingEmployee?.full_name}
              {editingEmployee && !editingEmployee.hasAccount && (
                <span className="text-amber-500 ml-2">(fără cont)</span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            {/* Profile Information */}
            <div className="space-y-3 pb-3 border-b border-border">
              <p className="text-sm font-medium text-muted-foreground">Informații Profil</p>
              <div className="space-y-2">
                <Label>Departament / Compartiment</Label>
                <Input
                  placeholder="ex: Laborator Polimeri"
                  value={editForm.department}
                  onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Funcție</Label>
                <Input
                  placeholder="ex: Cercetător Științific"
                  value={editForm.position}
                  onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
                />
              </div>
            </div>

            {/* Employment Information */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Informații Angajare</p>
              <div className="space-y-2">
                <Label>Data Angajării</Label>
                <Input
                  type="date"
                  value={editForm.hire_date}
                  onChange={(e) => setEditForm({ ...editForm, hire_date: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Tip Contract</Label>
                <Select
                  value={editForm.contract_type}
                  onValueChange={(v) => setEditForm({ ...editForm, contract_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nedeterminat">Perioadă Nedeterminată</SelectItem>
                    <SelectItem value="determinat">Perioadă Determinată</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Total Zile Concediu</Label>
                  <Input
                    type="number"
                    value={editForm.total_leave_days}
                    onChange={(e) => setEditForm({ ...editForm, total_leave_days: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Zile Utilizate</Label>
                  <Input
                    type="number"
                    value={editForm.used_leave_days}
                    onChange={(e) => setEditForm({ ...editForm, used_leave_days: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
              
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm">
                  <span className="text-muted-foreground">Zile disponibile: </span>
                  <span className="font-bold text-primary">
                    {editForm.total_leave_days - editForm.used_leave_days}
                  </span>
                </p>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingEmployee(null)}>
              Anulează
            </Button>
            <Button onClick={saveEmployeeRecord} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Salvează
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Document Dialog */}
      <Dialog open={!!uploadingFor} onOpenChange={() => setUploadingFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Încarcă Document</DialogTitle>
            <DialogDescription>
              Pentru: {uploadingFor?.full_name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tip Document</Label>
              <Select
                value={uploadForm.document_type}
                onValueChange={(v) => setUploadForm({ ...uploadForm, document_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {documentTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Nume Document</Label>
              <Input
                placeholder="ex: Contract 2024"
                value={uploadForm.name}
                onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Descriere (opțional)</Label>
              <Input
                placeholder="Descriere scurtă"
                value={uploadForm.description}
                onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Fișier</Label>
              <Input
                type="file"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadingFor(null)}>
              Anulează
            </Button>
            <Button onClick={uploadDocument} disabled={uploading || !selectedFile}>
              {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Încarcă
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Incomplete Employees Dialog */}
      <Dialog open={showNewEmployee} onOpenChange={(open) => {
        setShowNewEmployee(open);
        if (!open) setSelectedNewEmployee('');
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Completare Date Angajat</DialogTitle>
            <DialogDescription>
              Selectați un angajat cu date incomplete pentru a-i completa departamentul sau funcția
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {incompleteEmployees.length > 0 ? (
              <>
                <div className="space-y-2">
                  <Label>Selectați Angajatul</Label>
                  <Select
                    value={selectedNewEmployee}
                    onValueChange={setSelectedNewEmployee}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Alegeți un angajat..." />
                    </SelectTrigger>
                    <SelectContent>
                      {incompleteEmployees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          <div className="flex items-center gap-2">
                            <span>{emp.full_name}</span>
                            {!emp.department && (
                              <Badge variant="outline" className="text-xs">Fără departament</Badge>
                            )}
                            {!emp.position && (
                              <Badge variant="outline" className="text-xs">Fără funcție</Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    <Users className="w-4 h-4 inline mr-1" />
                    {incompleteEmployees.length} angajați cu date incomplete
                  </p>
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                <p className="font-medium">Toți angajații au datele complete!</p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewEmployee(false)}>
              Anulează
            </Button>
            <Button 
              onClick={() => selectEmployeeToComplete(selectedNewEmployee)}
              disabled={!selectedNewEmployee}
            >
              <Edit className="w-4 h-4 mr-2" />
              Completează Date
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Leave Registration Dialog */}
      <Dialog open={showManualLeave} onOpenChange={(open) => {
        setShowManualLeave(open);
        if (!open) {
          setManualLeaveForm({ employee_id: '', start_date: '', end_date: '', notes: '' });
          setManualLeaveFile(null);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FilePlus2 className="w-5 h-5" />
              Înregistrare Manuală Concediu
            </DialogTitle>
            <DialogDescription>
              Adăugați o cerere de concediu pe hârtie pentru un angajat
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Angajat *</Label>
              <Select
                value={manualLeaveForm.employee_id}
                onValueChange={(v) => setManualLeaveForm({ ...manualLeaveForm, employee_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selectați angajatul..." />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2 pb-1">
                    <Input
                      placeholder="Caută angajat..."
                      className="h-8 text-sm"
                      onChange={(e) => {
                        const search = e.target.value.toLowerCase();
                        const items = document.querySelectorAll('[data-manual-leave-item]');
                        items.forEach((item) => {
                          const name = item.getAttribute('data-manual-leave-item') || '';
                          (item as HTMLElement).style.display = name.includes(search) ? '' : 'none';
                        });
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                  {employees.map((emp) => {
                    const empValue = emp.hasAccount ? emp.user_id! : `epd:${emp.id}`;
                    const remaining = emp.total_leave_days - emp.used_leave_days;
                    return (
                      <SelectItem 
                        key={empValue} 
                        value={empValue}
                        data-manual-leave-item={emp.full_name.toLowerCase()}
                      >
                        <div className="flex items-center gap-2">
                          <span>{emp.full_name}</span>
                          {emp.department && (
                            <span className="text-xs text-muted-foreground">({emp.department})</span>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {remaining} zile disp.
                          </Badge>
                          {!emp.hasAccount && (
                            <Badge variant="secondary" className="text-[10px]">Fără cont</Badge>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {selectedManualEmployee && (
              <div className="p-3 bg-muted rounded-lg space-y-1">
                <p className="text-sm font-medium">{selectedManualEmployee.full_name}</p>
                {selectedManualEmployee.department && (
                  <p className="text-xs text-muted-foreground">{selectedManualEmployee.department}</p>
                )}
                <p className="text-sm">
                  <span className="text-muted-foreground">Sold concediu: </span>
                  <span className="font-bold text-primary">
                    {selectedManualEmployee.total_leave_days - selectedManualEmployee.used_leave_days} zile disponibile
                  </span>
                  <span className="text-muted-foreground"> din {selectedManualEmployee.total_leave_days}</span>
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Început *</Label>
                <Input
                  type="date"
                  value={manualLeaveForm.start_date}
                  onChange={(e) => setManualLeaveForm({ ...manualLeaveForm, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Sfârșit *</Label>
                <Input
                  type="date"
                  value={manualLeaveForm.end_date}
                  onChange={(e) => setManualLeaveForm({ ...manualLeaveForm, end_date: e.target.value })}
                />
              </div>
            </div>

            {manualLeaveForm.start_date && manualLeaveForm.end_date && (() => {
              const workingDays = calculateWorkingDays(manualLeaveForm.start_date, manualLeaveForm.end_date);
              const remaining = selectedManualEmployee
                ? selectedManualEmployee.total_leave_days - selectedManualEmployee.used_leave_days
                : 0;
              const afterBalance = remaining - workingDays;
              const exceeds = afterBalance < 0;
              
              return (
                <div className={`p-3 rounded-lg space-y-1 ${exceeds ? 'bg-destructive/10 border border-destructive/30' : 'bg-primary/10'}`}>
                  <p className="text-sm font-medium">
                    Zile lucrătoare: <span className="font-bold">{workingDays}</span>
                  </p>
                  {selectedManualEmployee && (
                    <p className="text-sm">
                      Sold după înregistrare: <span className={`font-bold ${exceeds ? 'text-destructive' : 'text-primary'}`}>{afterBalance} zile</span>
                    </p>
                  )}
                  {exceeds && (
                    <p className="text-xs text-destructive font-medium">
                      ⚠️ Zilele solicitate depășesc soldul disponibil!
                    </p>
                  )}
                </div>
              );
            })()}

            <div className="space-y-2">
              <Label>Observații</Label>
              <Input
                placeholder="ex: Cerere originală depusă la secretariat"
                value={manualLeaveForm.notes}
                onChange={(e) => setManualLeaveForm({ ...manualLeaveForm, notes: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Cerere Scanată (opțional)</Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setManualLeaveFile(e.target.files?.[0] || null)}
              />
              <p className="text-xs text-muted-foreground">
                Încărcați cererea de concediu scanată (PDF sau imagine)
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManualLeave(false)}>
              Anulează
            </Button>
            <Button 
              onClick={submitManualLeave} 
              disabled={submittingManualLeave || !manualLeaveForm.employee_id || !manualLeaveForm.start_date || !manualLeaveForm.end_date}
            >
              {submittingManualLeave ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Înregistrează
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Personal Data Editor Dialog */}
      <PersonalDataEditor
        employeeRecordId={editingPersonalData?.employee_record_id || null}
        employeeName={editingPersonalData?.full_name || ''}
        open={!!editingPersonalData}
        onOpenChange={(open) => !open && setEditingPersonalData(null)}
        onSaved={fetchEmployees}
        employeePersonalDataId={editingPersonalData?.id}
      />

      {/* Employee Leave History Dialog */}
      <EmployeeLeaveHistory
        open={!!leaveHistoryEmployee}
        onOpenChange={(open) => !open && setLeaveHistoryEmployee(null)}
        employeeName={leaveHistoryEmployee?.full_name || ''}
        userId={leaveHistoryEmployee?.user_id}
        epdId={leaveHistoryEmployee?.id}
        employeeRecordId={leaveHistoryEmployee?.employee_record_id || null}
        onChanged={fetchEmployees}
      />
    </MainLayout>
  );
};

export default HRManagement;