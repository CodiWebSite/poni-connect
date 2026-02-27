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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';

import { EmployeeImport } from '@/components/hr/EmployeeImport';
import { CIExpiryImport } from '@/components/hr/CIExpiryImport';
import { LeaveCarryoverImport } from '@/components/hr/LeaveCarryoverImport';
import { LeaveBonusManager } from '@/components/hr/LeaveBonusManager';
import { PersonalDataEditor } from '@/components/hr/PersonalDataEditor';
import { CorrectionRequestsManager } from '@/components/hr/CorrectionRequestsManager';
import HRExportButton from '@/components/hr/HRExportButton';
import { LeaveApproversManager } from '@/components/hr/LeaveApproversManager';
import { EmployeeLeaveHistory } from '@/components/hr/EmployeeLeaveHistory';
import LeaveCalendar from '@/components/hr/LeaveCalendar';
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
  History,
  Gift
} from 'lucide-react';
import { format, isWeekend, eachDayOfInterval, parseISO } from 'date-fns';
import { ro } from 'date-fns/locale';
import { isPublicHoliday, getPublicHolidayName } from '@/utils/romanianHolidays';
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
  grade: string | null;
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
  leaveHistory?: { startDate: string; endDate: string; numberOfDays: number }[];
  carryoverDays?: number;
  bonusDays?: number;
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
  const [departmentHeadEmails, setDepartmentHeadEmails] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [accountFilter, setAccountFilter] = useState<'all' | 'with_account' | 'without_account'>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  
  // Department rename dialog state
  const [showRenameDept, setShowRenameDept] = useState(false);
  const [renameDeptOld, setRenameDeptOld] = useState('');
  const [renameDeptNew, setRenameDeptNew] = useState('');
  const [renamingDept, setRenamingDept] = useState(false);
  
  // Edit dialog state
  const [editingEmployee, setEditingEmployee] = useState<EmployeeWithData | null>(null);
  const [editForm, setEditForm] = useState({
    department: '',
    position: '',
    grade: '',
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
  
  // New employee dialog (complete data for incomplete imports)
  const [showNewEmployee, setShowNewEmployee] = useState(false);

  // Manual add employee dialog (from scratch)
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [addEmployeeForm, setAddEmployeeForm] = useState({
    first_name: '',
    last_name: '',
    cnp: '',
    email: '',
    department: '',
    customDepartment: '',
    position: '',
    employment_date: '',
    contract_type: 'nedeterminat',
    total_leave_days: 21,
  });
  const [addingEmployee, setAddingEmployee] = useState(false);
  
  // Manual leave registration dialog
  const [showManualLeave, setShowManualLeave] = useState(false);
  const [manualLeaveForm, setManualLeaveForm] = useState({
    employee_id: '', // can be user_id or epd_id prefixed with 'epd:'
    start_date: '',
    end_date: '',
    notes: '',
    leave_type: 'co',
    deduct_from: 'auto' as 'auto' | 'carryover' | 'current',
  });
  const [manualLeaveFile, setManualLeaveFile] = useState<File | null>(null);
  const [submittingManualLeave, setSubmittingManualLeave] = useState(false);
  const [selectedNewEmployee, setSelectedNewEmployee] = useState<string>('');
  const [syncing, setSyncing] = useState(false);
  const [editingPersonalData, setEditingPersonalData] = useState<EmployeeWithData | null>(null);
  const [archivedEmployees, setArchivedEmployees] = useState<EmployeeWithData[]>([]);
  const [loadingArchived, setLoadingArchived] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [archivedSearchQuery, setArchivedSearchQuery] = useState('');
  const [leaveHistoryEmployee, setLeaveHistoryEmployee] = useState<EmployeeWithData | null>(null);
  const [customHolidayDates, setCustomHolidayDates] = useState<string[]>([]);
  const [customHolidayNames, setCustomHolidayNames] = useState<Record<string, string>>({});
  const [bonusEmployee, setBonusEmployee] = useState<EmployeeWithData | null>(null);

  useEffect(() => {
    if (canManageHR) {
      fetchEmployees();
      fetchCustomHolidays();
      fetchArchivedEmployees();
      fetchDepartmentHeads();
    }
  }, [canManageHR]);

  const leadershipRoles = ['sef', 'sef_srus', 'director_institut', 'director_adjunct', 'secretar_stiintific', 'hr', 'super_admin'];

  const leadershipRoleLabels: Record<string, string> = {
    super_admin: 'Super Admin',
    director_institut: 'Director',
    director_adjunct: 'Dir. Adjunct',
    secretar_stiintific: 'Secretar Șt.',
    sef_srus: 'Șef SRUS',
    sef: 'Șef Dept.',
    hr: 'HR',
  };

  const leadershipRoleColors: Record<string, string> = {
    super_admin: 'bg-destructive text-destructive-foreground',
    director_institut: 'bg-indigo-700 text-white',
    director_adjunct: 'bg-indigo-500 text-white',
    secretar_stiintific: 'bg-teal-600 text-white',
    sef_srus: 'bg-blue-600 text-white',
    sef: 'bg-amber-600 text-white',
    hr: 'bg-purple-500 text-white',
  };

  const fetchDepartmentHeads = async () => {
    const headMap = new Map<string, string>();

    // 1. Get users with leadership roles who have accounts
    const { data: sefRoles } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .in('role', leadershipRoles as any[]);

    if (sefRoles && sefRoles.length > 0) {
      const userRoleMap = new Map<string, string>();
      sefRoles.forEach(r => userRoleMap.set(r.user_id, r.role));
      
      const userIds = sefRoles.map(r => r.user_id);
      const { data: records } = await supabase
        .from('employee_records')
        .select('user_id, id')
        .in('user_id', userIds);

      if (records) {
        const recordToUser = new Map<string, string>();
        records.forEach(r => recordToUser.set(r.id, r.user_id));
        
        const recordIds = records.map(r => r.id);
        const { data: epdData } = await supabase
          .from('employee_personal_data')
          .select('email, employee_record_id')
          .in('employee_record_id', recordIds);

        (epdData || []).forEach(e => {
          const userId = recordToUser.get(e.employee_record_id || '');
          const role = userId ? userRoleMap.get(userId) : undefined;
          if (role) headMap.set(e.email.toLowerCase(), role);
        });
      }
    }

    // 2. Also check pre_assigned_roles for leadership roles
    const { data: preAssigned } = await supabase
      .from('pre_assigned_roles')
      .select('email, role')
      .in('role', leadershipRoles as any[]);

    (preAssigned || []).forEach(p => {
      if (!headMap.has(p.email.toLowerCase())) {
        headMap.set(p.email.toLowerCase(), p.role);
      }
    });

    setDepartmentHeadEmails(headMap);
  };

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

    // Fetch all approved leave requests for all employees
    const { data: allLeaves } = await supabase
      .from('hr_requests')
      .select('user_id, details, status')
      .eq('request_type', 'concediu')
      .eq('status', 'approved');

    // Build leave lookup maps: by user_id and by epd_id
    const leavesByUserId: Record<string, { startDate: string; endDate: string; numberOfDays: number }[]> = {};
    const leavesByEpdId: Record<string, { startDate: string; endDate: string; numberOfDays: number }[]> = {};
    (allLeaves || []).forEach((lr: any) => {
      const d = lr.details || {};
      const entry = { startDate: d.startDate || '', endDate: d.endDate || '', numberOfDays: d.numberOfDays || 0 };
      if (d.epd_id) {
        if (!leavesByEpdId[d.epd_id]) leavesByEpdId[d.epd_id] = [];
        leavesByEpdId[d.epd_id].push(entry);
      } else if (lr.user_id) {
        if (!leavesByUserId[lr.user_id]) leavesByUserId[lr.user_id] = [];
        leavesByUserId[lr.user_id].push(entry);
      }
    });

    // Fetch carryover and bonus data
    const currentYear = new Date().getFullYear();
    const { data: carryovers } = await supabase
      .from('leave_carryover')
      .select('employee_personal_data_id, remaining_days')
      .eq('to_year', currentYear);

    const { data: bonusesData } = await supabase
      .from('leave_bonus')
      .select('employee_personal_data_id, bonus_days')
      .eq('year', currentYear);

    const carryoverMap: Record<string, number> = {};
    (carryovers || []).forEach((c: any) => {
      carryoverMap[c.employee_personal_data_id] = (carryoverMap[c.employee_personal_data_id] || 0) + c.remaining_days;
    });

    const bonusMap: Record<string, number> = {};
    (bonusesData || []).forEach((b: any) => {
      bonusMap[b.employee_personal_data_id] = (bonusMap[b.employee_personal_data_id] || 0) + b.bonus_days;
    });

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
        grade: (pd as any).grade || null,
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
        leaveHistory: [
          ...(record?.user_id ? (leavesByUserId[record.user_id] || []) : []),
          ...(leavesByEpdId[pd.id] || []),
        ].sort((a, b) => (b.startDate || '').localeCompare(a.startDate || '')),
        carryoverDays: carryoverMap[pd.id] || 0,
        bonusDays: bonusMap[pd.id] || 0,
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
      grade: (pd as any).grade || null,
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
      grade: employee.grade || '',
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
        grade: editForm.grade || null,
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

  const handleAddEmployee = async () => {
    const dept = addEmployeeForm.department === '__custom__' 
      ? addEmployeeForm.customDepartment.trim() 
      : addEmployeeForm.department;

    if (!addEmployeeForm.first_name.trim() || !addEmployeeForm.last_name.trim() || 
        !addEmployeeForm.cnp.trim() || !addEmployeeForm.email.trim() || 
        !dept || !addEmployeeForm.employment_date) {
      toast({ title: 'Eroare', description: 'Completați toate câmpurile obligatorii.', variant: 'destructive' });
      return;
    }

    // Validate CNP (13 digits)
    if (!/^\d{13}$/.test(addEmployeeForm.cnp.trim())) {
      toast({ title: 'Eroare', description: 'CNP-ul trebuie să conțină exact 13 cifre.', variant: 'destructive' });
      return;
    }

    setAddingEmployee(true);

    const { error } = await supabase.from('employee_personal_data').insert({
      first_name: addEmployeeForm.first_name.trim(),
      last_name: addEmployeeForm.last_name.trim(),
      cnp: addEmployeeForm.cnp.trim(),
      email: addEmployeeForm.email.trim().toLowerCase(),
      department: dept,
      position: addEmployeeForm.position.trim() || null,
      employment_date: addEmployeeForm.employment_date,
      contract_type: addEmployeeForm.contract_type,
      total_leave_days: addEmployeeForm.total_leave_days,
      used_leave_days: 0,
    });

    if (error) {
      console.error('Error adding employee:', error);
      const msg = error.message.includes('duplicate') 
        ? 'Un angajat cu acest CNP sau email există deja.' 
        : 'Nu s-a putut adăuga angajatul.';
      toast({ title: 'Eroare', description: msg, variant: 'destructive' });
    } else {
      toast({ title: 'Succes', description: `${addEmployeeForm.last_name} ${addEmployeeForm.first_name} a fost adăugat(ă) cu succes.` });
      setShowAddEmployee(false);
      setAddEmployeeForm({
        first_name: '', last_name: '', cnp: '', email: '',
        department: '', customDepartment: '', position: '',
        employment_date: '', contract_type: 'nedeterminat', total_leave_days: 21,
      });
      fetchEmployees();
    }

    setAddingEmployee(false);
  };

  const fetchCustomHolidays = async () => {
    const { data } = await supabase.from('custom_holidays').select('holiday_date, name').order('holiday_date');
    if (data) {
      setCustomHolidayDates(data.map(h => h.holiday_date));
      const names: Record<string, string> = {};
      data.forEach(h => { names[h.holiday_date] = h.name; });
      setCustomHolidayNames(names);
    }
  };

  // Calculate working days between two dates (excluding weekends, public holidays, custom holidays)
  const calculateWorkingDays = (startDate: string, endDate: string): number => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let count = 0;
    const current = new Date(start);
    
    while (current <= end) {
      const dayOfWeek = current.getDay();
      const dateStr = format(current, 'yyyy-MM-dd');
      const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6;
      const isHoliday = isPublicHoliday(current);
      const isCustomHoliday = customHolidayDates.includes(dateStr);
      
      if (!isWeekendDay && !isHoliday && !isCustomHoliday) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    return count;
  };

  // Get non-working days in a period for display
  const getNonWorkingDays = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const nonWorking: { date: string; reason: string }[] = [];
    const current = new Date(start);
    
    while (current <= end) {
      const dayOfWeek = current.getDay();
      const dateStr = format(current, 'yyyy-MM-dd');
      const formattedDate = format(current, 'dd.MM.yyyy');
      
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        nonWorking.push({ date: formattedDate, reason: dayOfWeek === 0 ? 'Duminică' : 'Sâmbătă' });
      } else if (isPublicHoliday(current)) {
        nonWorking.push({ date: formattedDate, reason: getPublicHolidayName(current) || 'Sărbătoare legală' });
      } else if (customHolidayDates.includes(dateStr)) {
        nonWorking.push({ date: formattedDate, reason: customHolidayNames[dateStr] || 'Zi liberă instituție' });
      }
      current.setDate(current.getDate() + 1);
    }
    return nonWorking;
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
    const carryover = employee.carryoverDays || 0;
    const currentRemaining = employee.total_leave_days - employee.used_leave_days;
    const totalAvailable = currentRemaining + carryover + (employee.bonusDays || 0);

    // Types that don't deduct from leave balance
    const nonDeductibleTypes = ['cfp', 'bo', 'ccc', 'ev'];
    const isNonDeductible = nonDeductibleTypes.includes(manualLeaveForm.leave_type);

    // Validate based on deduction source (skip for non-deductible types)
    if (!isNonDeductible) {
      if (manualLeaveForm.deduct_from === 'carryover' && numberOfDays > carryover) {
        toast({ title: 'Eroare', description: `Soldul report ${new Date().getFullYear() - 1} are doar ${carryover} zile disponibile.`, variant: 'destructive' });
        return;
      }
      if (manualLeaveForm.deduct_from === 'current' && numberOfDays > currentRemaining) {
        toast({ title: 'Eroare', description: `Soldul ${new Date().getFullYear()} are doar ${currentRemaining} zile disponibile.`, variant: 'destructive' });
        return;
      }
      if (numberOfDays > totalAvailable) {
        toast({ title: 'Eroare', description: `Angajatul are doar ${totalAvailable} zile disponibile.`, variant: 'destructive' });
        return;
      }
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
          leaveType: manualLeaveForm.leave_type,
          manualEntry: true,
          scannedDocumentUrl: fileUrl,
          notes: manualLeaveForm.notes,
          deductFrom: manualLeaveForm.deduct_from,
          // Store epd_id for employees without accounts
          ...(isEpdOnly ? { epd_id: epdId, employee_name: employee.full_name } : {}),
        }
      });

      // Skip deduction for non-deductible leave types (CFP, BO, CCC, EV)
      if (!isNonDeductible) {
        // Calculate how many days go to carryover vs current
        const deductFrom = manualLeaveForm.deduct_from;
        let daysFromCarryover = 0;
        let daysFromCurrent = 0;

        if (deductFrom === 'carryover') {
          daysFromCarryover = numberOfDays;
        } else if (deductFrom === 'current') {
          daysFromCurrent = numberOfDays;
        } else {
          // Auto: carryover first, then current
          daysFromCarryover = Math.min(numberOfDays, carryover);
          daysFromCurrent = numberOfDays - daysFromCarryover;
        }

        // Update carryover if applicable
        if (daysFromCarryover > 0) {
          const currentYear = new Date().getFullYear();
          const { data: carryData } = await supabase
            .from('leave_carryover')
            .select('id, used_days, remaining_days')
            .eq('employee_personal_data_id', employee.id)
            .eq('from_year', currentYear - 1)
            .eq('to_year', currentYear)
            .maybeSingle();

          if (carryData) {
            await supabase.from('leave_carryover').update({
              used_days: carryData.used_days + daysFromCarryover,
              remaining_days: carryData.remaining_days - daysFromCarryover,
            }).eq('id', carryData.id);
          }
        }

        // Update employee_records used_leave_days (only current year days)
        if (daysFromCurrent > 0 && employee.record) {
          const newUsedDays = employee.record.used_leave_days + daysFromCurrent;
          await supabase
            .from('employee_records')
            .update({ used_leave_days: newUsedDays })
            .eq('id', employee.record.id);
        }

        // Always update employee_personal_data used_leave_days (only current year)
        if (daysFromCurrent > 0) {
          const newEpdUsedDays = employee.used_leave_days + daysFromCurrent;
          await supabase
            .from('employee_personal_data')
            .update({ used_leave_days: newEpdUsedDays })
            .eq('id', employee.id);
        }
      }

      const leaveTypeLabels: Record<string, string> = {
        co: 'Concediu de odihnă',
        bo: 'Concediu medical',
        ccc: 'Concediu creștere copil',
        cfp: 'Concediu fără plată',
        ev: 'Eveniment',
      };

      const deductFrom = manualLeaveForm.deduct_from;
      let daysFromCarryover = 0;
      let daysFromCurrent = 0;
      if (!isNonDeductible) {
        if (deductFrom === 'carryover') {
          daysFromCarryover = numberOfDays;
        } else if (deductFrom === 'current') {
          daysFromCurrent = numberOfDays;
        } else {
          daysFromCarryover = Math.min(numberOfDays, carryover);
          daysFromCurrent = numberOfDays - daysFromCarryover;
        }
      }

      const deductionDesc = isNonDeductible
        ? `${leaveTypeLabels[manualLeaveForm.leave_type] || manualLeaveForm.leave_type} — fără deducere din sold`
        : daysFromCarryover > 0 && daysFromCurrent > 0
        ? `${daysFromCarryover} zile din report ${new Date().getFullYear() - 1} + ${daysFromCurrent} zile din ${new Date().getFullYear()}`
        : daysFromCarryover > 0
        ? `${daysFromCarryover} zile din report ${new Date().getFullYear() - 1}`
        : `${daysFromCurrent} zile din sold ${new Date().getFullYear()}`;

      toast({ 
        title: 'Succes', 
        description: `Cererea de concediu a fost înregistrată. ${deductionDesc}.` 
      });

      setManualLeaveForm({ employee_id: '', start_date: '', end_date: '', notes: '', leave_type: 'co', deduct_from: 'auto' });
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
    cnp: e.cnp,
    employment_date: e.employment_date,
    contract_type: e.contract_type,
    leaveHistory: e.leaveHistory,
    carryoverDays: e.carryoverDays || 0,
    bonusDays: e.bonusDays || 0,
    record: {
      total_leave_days: e.total_leave_days,
      used_leave_days: e.used_leave_days,
      remaining_leave_days: e.total_leave_days - e.used_leave_days,
      hire_date: e.record?.hire_date || e.employment_date || null,
      contract_type: e.record?.contract_type || e.contract_type || '-',
    },
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

  // Include departments from both active and archived employees
  const allDepartments = [...new Set([
    ...employees.map(e => e.department).filter(Boolean) as string[],
    ...archivedEmployees.map(e => e.department).filter(Boolean) as string[],
  ])].sort();

  const renameDepartment = async () => {
    if (!renameDeptNew.trim() || !renameDeptOld) return;
    setRenamingDept(true);
    try {
      // Update employee_personal_data
      const { error: epdErr } = await supabase
        .from('employee_personal_data')
        .update({ department: renameDeptNew.trim() })
        .eq('department', renameDeptOld);
      if (epdErr) throw epdErr;

      // Update profiles
      await supabase
        .from('profiles')
        .update({ department: renameDeptNew.trim() })
        .eq('department', renameDeptOld);

      // Log audit
      if (user) {
        await supabase.rpc('log_audit_event', {
          _user_id: user.id,
          _action: 'department_rename',
          _entity_type: 'department',
          _entity_id: renameDeptOld,
          _details: { old_name: renameDeptOld, new_name: renameDeptNew.trim() }
        });
      }

      toast({ title: 'Succes', description: `Departamentul „${renameDeptOld}" a fost redenumit în „${renameDeptNew.trim()}".` });
      setShowRenameDept(false);
      setRenameDeptOld('');
      setRenameDeptNew('');
      if (departmentFilter === renameDeptOld) setDepartmentFilter(renameDeptNew.trim());
      fetchEmployees();
    } catch (error) {
      toast({ title: 'Eroare', description: 'Nu s-a putut redenumi departamentul.', variant: 'destructive' });
    }
    setRenamingDept(false);
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

    const matchesDept = departmentFilter === 'all' ? true : e.department === departmentFilter;
    
    return matchesSearch && matchesFilter && matchesDept;
  }).sort((a, b) => {
    // Department heads appear first
    const aIsHead = departmentHeadEmails.has(a.email.toLowerCase());
    const bIsHead = departmentHeadEmails.has(b.email.toLowerCase());
    if (aIsHead && !bIsHead) return -1;
    if (!aIsHead && bIsHead) return 1;
    return a.full_name.localeCompare(b.full_name, 'ro');
  });

  const filteredArchivedEmployees = archivedEmployees.filter(e => {
    if (!archivedSearchQuery) return true;
    const q = archivedSearchQuery.toLowerCase();
    return e.full_name.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q) ||
      e.department?.toLowerCase().includes(q) ||
      e.position?.toLowerCase().includes(q) ||
      e.archive_reason?.toLowerCase().includes(q);
  });

  // Redirect if not authorized
  if (!roleLoading && !canManageHR) {
    return <Navigate to="/" replace />;
  }

  const employeesWithAccounts = employees.filter(e => e.hasAccount);
  const remainingLeave = (emp: EmployeeWithData) => emp.total_leave_days + (emp.carryoverDays || 0) + (emp.bonusDays || 0) - emp.used_leave_days;

  return (
    <MainLayout title="Gestiune HR" description="Administrare date angajați - Confidențial">
      <Tabs defaultValue="employees" className="space-y-6">
        {/* Action buttons row */}
        <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={syncEmployees} disabled={syncing}>
            <RefreshCw className={`w-4 h-4 sm:mr-2 ${syncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{syncing ? 'Sincronizare...' : 'Sincronizează'}</span>
          </Button>
          <HRExportButton requests={[]} employees={exportEmployees} />
          <Button variant="outline" size="sm" onClick={() => setShowManualLeave(true)}>
            <FilePlus2 className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Concediu Manual</span>
          </Button>
          <Button size="sm" onClick={() => setShowAddEmployee(true)}>
            <UserPlus className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Adaugă Angajat</span>
          </Button>
          {incompleteEmployees.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setShowNewEmployee(true)}>
              <Edit className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Completare Date</span>
            </Button>
          )}
        </div>

        {/* Tabs navigation */}
        <TabsList className="flex flex-wrap h-auto gap-1 p-1">
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
            <span className="hidden sm:inline">Arhivați</span>
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Calendar</span>
          </TabsTrigger>
          <TabsTrigger value="approvers" className="gap-2">
            <UserCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Aprobatori</span>
          </TabsTrigger>
          <TabsTrigger value="import" className="gap-2">
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Import</span>
          </TabsTrigger>
          <TabsTrigger value="changelog" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Modificări</span>
          </TabsTrigger>
        </TabsList>

        {/* Employees Tab */}
        <TabsContent value="employees" className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
            <div className="relative max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Caută după nume, email, departament..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Departament" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toate departamentele</SelectItem>
                {allDepartments.map(d => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {departmentFilter !== 'all' && (
              <Button variant="ghost" size="sm" onClick={() => {
                setRenameDeptOld(departmentFilter);
                setRenameDeptNew(departmentFilter);
                setShowRenameDept(true);
              }}>
                <Edit className="w-3.5 h-3.5 mr-1" />
                Redenumește
              </Button>
            )}
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
                              {departmentHeadEmails.has(employee.email.toLowerCase()) && (() => {
                                const role = departmentHeadEmails.get(employee.email.toLowerCase()) || 'sef';
                                return (
                                  <Badge className={`text-xs ${leadershipRoleColors[role] || 'bg-amber-600 text-white'}`}>
                                    {leadershipRoleLabels[role] || 'Șef'}
                                  </Badge>
                                );
                              })()}
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
                              {(employee.carryoverDays || 0) > 0 && (
                                <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                                  +{employee.carryoverDays} report 2025
                                </Badge>
                              )}
                              {(employee.bonusDays || 0) > 0 && (
                                <Badge variant="outline" className="text-xs text-primary border-primary/30">
                                  <Gift className="w-3 h-3 mr-1" />
                                  +{employee.bonusDays} bonus
                                </Badge>
                              )}
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
                              {employee.leaveHistory && employee.leaveHistory.length > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  <Calendar className="w-3 h-3 mr-1" />
                                  {employee.leaveHistory.length} concedii
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

                            {/* Leave periods summary */}
                            {employee.leaveHistory && employee.leaveHistory.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {employee.leaveHistory.slice(0, 4).map((lv, idx) => (
                                  <span key={idx} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border">
                                    {lv.startDate && lv.endDate
                                      ? `${format(new Date(lv.startDate), 'dd.MM')} - ${format(new Date(lv.endDate), 'dd.MM.yy')}`
                                      : '—'}
                                    {lv.numberOfDays > 0 && <span className="font-medium">({lv.numberOfDays}z)</span>}
                                  </span>
                                ))}
                                {employee.leaveHistory.length > 4 && (
                                  <span className="text-[11px] text-muted-foreground px-2 py-0.5">
                                    +{employee.leaveHistory.length - 4} altele
                                  </span>
                                )}
                              </div>
                            )}
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
                            onClick={() => setBonusEmployee(employee)}
                          >
                            <Gift className="w-4 h-4 mr-1" />
                            Sold+
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

        {/* Calendar Tab */}
        <TabsContent value="calendar">
          <LeaveCalendar />
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
              {archivedEmployees.length > 0 && (
                <div className="relative max-w-sm mt-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Caută în arhivați..."
                    className="pl-10"
                    value={archivedSearchQuery}
                    onChange={(e) => setArchivedSearchQuery(e.target.value)}
                  />
                </div>
              )}
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
              ) : filteredArchivedEmployees.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Search className="w-12 h-12 mx-auto mb-4 opacity-40" />
                  <p>Nu s-au găsit rezultate pentru „{archivedSearchQuery}"</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredArchivedEmployees.map((employee) => (
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

        {/* Approvers Tab */}
        <TabsContent value="approvers" className="space-y-6">
          <LeaveApproversManager />
        </TabsContent>

        {/* Import Tab */}
        <TabsContent value="import" className="space-y-6">
          <EmployeeImport />
          <LeaveCarryoverImport onImported={fetchEmployees} />
          <CIExpiryImport />
        </TabsContent>

        {/* Changelog Tab */}
        <TabsContent value="changelog" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Modificări și Actualizări - Modul HR
              </CardTitle>
              <CardDescription>
                Istoric al funcționalităților noi, actualizărilor și măsurilor de securitate implementate în modulul de Resurse Umane.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* v2.7 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary text-primary-foreground">v2.7</Badge>
                  <span className="text-sm text-muted-foreground">Februarie 2026</span>
                </div>
                <div className="ml-4 space-y-2 border-l-2 border-primary/20 pl-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">👥 Sistem de Aprobare Ierarhică (leave_approvers)</p>
                    <p className="text-xs text-muted-foreground">
                      HR-ul poate configura pentru fiecare angajat un aprobator specific de concediu. Astfel, un șef de laborator 
                      poate avea ca aprobator șeful de compartiment, iar acesta la rândul lui alt superior. Tab-ul „Aprobatori" din 
                      Gestiune HR permite gestionarea acestor relații.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">🔄 Rutare Automată Cereri</p>
                    <p className="text-xs text-muted-foreground">
                      La depunerea unei cereri de concediu, sistemul caută automat aprobatorul desemnat. Dacă există, cererea merge 
                      direct la acel aprobator; dacă nu, se folosește comportamentul implicit (orice șef din departament).
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">📋 Tab „De Aprobat" Extins</p>
                    <p className="text-xs text-muted-foreground">
                      Tab-ul „De Aprobat" este acum vizibil și pentru angajații care au subordonați configurați în sistemul de 
                      aprobare, nu doar pentru rolurile de tip „sef" sau „sef_srus".
                    </p>
                  </div>
                </div>
              </div>

              {/* v2.6 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">v2.6</Badge>
                  <span className="text-sm text-muted-foreground">Februarie 2026</span>
                </div>
                <div className="ml-4 space-y-2 border-l-2 border-primary/20 pl-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">📋 Selecție Sold la Concediu Manual</p>
                    <p className="text-xs text-muted-foreground">
                      La înregistrarea unui concediu manual, HR-ul poate alege sursa de deducere: automat (prioritar din report 2025, 
                      apoi sold 2026), doar din report 2025 sau doar din sold 2026. Soldul total include acum corect: 
                      zile cuvenite 2026 + report 2025 + bonus.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">✏️ Selecție Sold în Editare Concediu</p>
                    <p className="text-xs text-muted-foreground">
                      Dialogul de editare a concediilor permite acum selectarea sursei de deducere (report 2025 / sold 2026) 
                      atunci când se modifică numărul de zile, cu recalculare automată a soldurilor.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">🔄 Consum Zile Report 2025 în Cereri Automate</p>
                    <p className="text-xs text-muted-foreground">
                      Cererile de concediu depuse prin sistem consumă acum corect zilele rămase din reportul 2025, 
                      indiferent că anul curent este 2026. Zilele de report sunt prioritare la deducere.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">📊 Export Excel Actualizat cu Report 2025</p>
                    <p className="text-xs text-muted-foreground">
                      Toate rapoartele Excel (salarizare, sold concedii, total per departament) includ acum coloanele 
                      „Report 2025", „Sold+" și „Total Disponibil" cu formula completă: CO 2026 + Report 2025 + Bonus - Utilizate.
                    </p>
                  </div>
                </div>
              </div>

              {/* v2.5 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">v2.5</Badge>
                  <span className="text-sm text-muted-foreground">Februarie 2026</span>
                </div>
                <div className="ml-4 space-y-2 border-l-2 border-primary/20 pl-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">🎁 Sold Suplimentar Concediu (Bonus Leave)</p>
                    <p className="text-xs text-muted-foreground">
                      Se pot adăuga oricâte alocări suplimentare de concediu per angajat, fiecare cu motiv și bază legală 
                      (ex: Legea 448/2006 pentru handicap, HG 250/1992 pentru vechime). Soldul total se calculează automat: 
                      zile cuvenite + bonus + report - utilizate.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">📥 Import Concedii Reportate 2025 → 2026</p>
                    <p className="text-xs text-muted-foreground">
                      Funcționalitate de import Excel/CSV pentru zilele de concediu rămase din 2025 care se reportează în 2026. 
                      Potrivirea se face automat după CNP. Zilele reportate apar ca badge pe cardul angajatului.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">📊 Raport Salarizare cu 2 Sheet-uri</p>
                    <p className="text-xs text-muted-foreground">
                      Exportul Excel „Raport salarizare" include acum un al doilea sheet cu totaluri per departament 
                      pe fiecare lună (nr. angajați, total CO, utilizate, rămase, zile/lună).
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">🪪 CI în Documente Angajat</p>
                    <p className="text-xs text-muted-foreground">
                      Când se încarcă o scanare a Cărții de Identitate, aceasta apare automat și în secțiunea 
                      „Documente" din profilul angajatului, accesibilă acestuia pentru descărcare.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">📊 Raport Salarizare – Sheet-uri per Departament</p>
                    <p className="text-xs text-muted-foreground">
                      Raportul de salarizare Excel include acum câte un sheet separat pentru fiecare departament, 
                      cu lista angajaților, zilele de concediu și perioadele defalcate pe luni. Angajații fără departament 
                      sunt excluși din sheet-urile departamentale.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">🔍 Filtru și Redenumire Departamente</p>
                    <p className="text-xs text-muted-foreground">
                      În tab-ul Angajați s-a adăugat un dropdown de filtrare pe departament. La selectarea unui departament, 
                      apare un buton „Redenumește" care permite modificarea numelui departamentului pentru toți angajații 
                      simultan, cu reflectare automată în profiluri și rapoarte.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">👤 Sold Reportat și Bonus în Profilul Meu</p>
                    <p className="text-xs text-muted-foreground">
                      Fiecare angajat poate vedea în pagina „Profilul Meu" zilele de concediu reportate din anul anterior 
                      și bonusurile acordate (cu motiv și bază legală), alături de soldul curent.
                    </p>
                  </div>
                </div>
              </div>

              {/* v2.4 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">v2.4</Badge>
                  <span className="text-sm text-muted-foreground">Februarie 2026</span>
                </div>
                <div className="ml-4 space-y-2 border-l-2 border-muted-foreground/20 pl-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">📥 Import Date Expirare CI</p>
                    <p className="text-xs text-muted-foreground">
                      Import în masă al datelor de expirare CI din Excel/CSV cu potrivire automată după CNP. 
                      Înlocuiește funcționalitatea anterioară de OCR cu AI Vision.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">💰 Raport Salarizare (CO/lună)</p>
                    <p className="text-xs text-muted-foreground">
                      Export Excel cu detalii complete per angajat: date personale, sold concediu și defalcare lunară 
                      a zilelor și perioadelor de concediu pentru anul curent.
                    </p>
                  </div>
                </div>
              </div>

              {/* v2.3 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">v2.3</Badge>
                  <span className="text-sm text-muted-foreground">Ianuarie 2026</span>
                </div>
                <div className="ml-4 space-y-2 border-l-2 border-muted-foreground/20 pl-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">🔒 Securitate - RLS Policies</p>
                    <p className="text-xs text-muted-foreground">
                      Toate tabelele HR au politici Row-Level Security (RLS) active. Doar utilizatorii cu rolurile 
                      hr, admin, super_admin sau director pot accesa și modifica datele angajaților. Angajații pot vedea 
                      doar propriile date.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">📋 Jurnal de Audit</p>
                    <p className="text-xs text-muted-foreground">
                      Toate acțiunile critice sunt înregistrate automat: import angajați, modificări date personale, 
                      încărcare CI, ștergere/arhivare angajați, înregistrare concedii manuale, import în masă. 
                      Fiecare intrare conține cine, ce, când și detalii complete.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">🗂️ Arhivare Angajați</p>
                    <p className="text-xs text-muted-foreground">
                      Angajații pot fi arhivați (soft delete) cu posibilitate de restaurare. Datele arhivate sunt 
                      păstrate dar nu apar în listele active. Include motiv și timestamp.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">👤 Editare Completă Date Personale</p>
                    <p className="text-xs text-muted-foreground">
                      HR-ul poate edita toate câmpurile: email, CNP, CI (serie, număr, emitent, data eliberării, 
                      data expirării), adresă completă, departament, funcție, tip contract, sold concediu. 
                      Se urmărește automat cine a făcut ultima modificare.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">📄 Gestionare Documente</p>
                    <p className="text-xs text-muted-foreground">
                      Încărcare și gestionare documente per angajat (CI, contracte, adeverințe). Fișierele sunt 
                      stocate securizat cu acces controlat prin politici de storage.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">📅 Calendar Concedii</p>
                    <p className="text-xs text-muted-foreground">
                      Vizualizare calendar cu toate concediile angajaților, incluzând sărbătorile legale și 
                      zilele libere personalizate. Filtrare după departament disponibilă.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">📊 Export Rapoarte Excel</p>
                    <p className="text-xs text-muted-foreground">
                      Multiple tipuri de rapoarte exportabile: cereri concediu, toate cererile HR, sold concedii, 
                      lista angajați, angajați fără cont. Toate în format Excel (.xlsx).
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">🔄 Sincronizare Automată</p>
                    <p className="text-xs text-muted-foreground">
                      La înregistrarea unui angajat cu email existent în sistemul de import, datele se sincronizează 
                      automat: profil, departament, funcție, sold concediu. Funcționează și manual prin butonul Sincronizează.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
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
                  placeholder="ex: CS, IDT"
                  value={editForm.position}
                  onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Grad / Treaptă</Label>
                <Input
                  placeholder="ex: I, II, III"
                  value={editForm.grade}
                  onChange={(e) => setEditForm({ ...editForm, grade: e.target.value })}
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

      {/* Add Employee Dialog */}
      <Dialog open={showAddEmployee} onOpenChange={setShowAddEmployee}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Adaugă Angajat Manual
            </DialogTitle>
            <DialogDescription>
              Introduceți datele noului angajat. Câmpurile marcate cu * sunt obligatorii.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nume *</Label>
                <Input
                  value={addEmployeeForm.last_name}
                  onChange={e => setAddEmployeeForm(f => ({ ...f, last_name: e.target.value }))}
                  placeholder="ex: POPESCU"
                />
              </div>
              <div className="space-y-2">
                <Label>Prenume *</Label>
                <Input
                  value={addEmployeeForm.first_name}
                  onChange={e => setAddEmployeeForm(f => ({ ...f, first_name: e.target.value }))}
                  placeholder="ex: Maria"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>CNP *</Label>
              <Input
                value={addEmployeeForm.cnp}
                onChange={e => setAddEmployeeForm(f => ({ ...f, cnp: e.target.value.replace(/\D/g, '').slice(0, 13) }))}
                placeholder="13 cifre"
                maxLength={13}
              />
            </div>

            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={addEmployeeForm.email}
                onChange={e => setAddEmployeeForm(f => ({ ...f, email: e.target.value }))}
                placeholder="email@icmpp.ro"
              />
            </div>

            <div className="space-y-2">
              <Label>Departament *</Label>
              <Select
                value={addEmployeeForm.department}
                onValueChange={v => setAddEmployeeForm(f => ({ ...f, department: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selectează departamentul" />
                </SelectTrigger>
                <SelectContent>
                  {allDepartments.map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                  <SelectItem value="__custom__">+ Alt departament...</SelectItem>
                </SelectContent>
              </Select>
              {addEmployeeForm.department === '__custom__' && (
                <Input
                  value={addEmployeeForm.customDepartment}
                  onChange={e => setAddEmployeeForm(f => ({ ...f, customDepartment: e.target.value }))}
                  placeholder="Introduceți numele departamentului"
                  className="mt-2"
                />
              )}
            </div>

            <div className="space-y-2">
              <Label>Funcția</Label>
              <Input
                value={addEmployeeForm.position}
                onChange={e => setAddEmployeeForm(f => ({ ...f, position: e.target.value }))}
                placeholder="ex: Medic medicina muncii"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data angajării *</Label>
                <Input
                  type="date"
                  value={addEmployeeForm.employment_date}
                  onChange={e => setAddEmployeeForm(f => ({ ...f, employment_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Tip contract</Label>
                <Select
                  value={addEmployeeForm.contract_type}
                  onValueChange={v => setAddEmployeeForm(f => ({ ...f, contract_type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nedeterminat">Nedeterminat</SelectItem>
                    <SelectItem value="determinat">Determinat</SelectItem>
                    <SelectItem value="part_time">Part-time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Zile concediu / an</Label>
              <Input
                type="number"
                min={0}
                max={60}
                value={addEmployeeForm.total_leave_days}
                onChange={e => setAddEmployeeForm(f => ({ ...f, total_leave_days: parseInt(e.target.value) || 21 }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddEmployee(false)}>Anulează</Button>
            <Button onClick={handleAddEmployee} disabled={addingEmployee}>
              {addingEmployee ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
              Adaugă Angajat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showManualLeave} onOpenChange={(open) => {
        setShowManualLeave(open);
        if (!open) {
          setManualLeaveForm({ employee_id: '', start_date: '', end_date: '', notes: '', leave_type: 'co', deduct_from: 'auto' });
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
                    const remaining = emp.total_leave_days + (emp.carryoverDays || 0) + (emp.bonusDays || 0) - emp.used_leave_days;
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
                    {remainingLeave(selectedManualEmployee)} zile disponibile
                  </span>
                </p>
                <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                  <p>• {selectedManualEmployee.total_leave_days} cuvenite {new Date().getFullYear()} − {selectedManualEmployee.used_leave_days} utilizate = <strong>{selectedManualEmployee.total_leave_days - selectedManualEmployee.used_leave_days}</strong></p>
                  {(selectedManualEmployee.carryoverDays || 0) > 0 && <p>• {selectedManualEmployee.carryoverDays} zile report {new Date().getFullYear() - 1}</p>}
                  {(selectedManualEmployee.bonusDays || 0) > 0 && <p>• {selectedManualEmployee.bonusDays} zile Sold+</p>}
                </div>
                {(selectedManualEmployee.carryoverDays || 0) > 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    ⚠ Include {selectedManualEmployee.carryoverDays} zile report {new Date().getFullYear() - 1}
                  </p>
                )}
              </div>
            )}

            {/* Non-deductible leave type info */}
            {['cfp', 'bo', 'ccc', 'ev'].includes(manualLeaveForm.leave_type) && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  ℹ️ {manualLeaveForm.leave_type === 'cfp' ? 'Concediu fără plată — contract suspendat. ' : ''}Nu se deduce din soldul de concediu de odihnă.
                </p>
              </div>
            )}

            {/* Deduction source selection - only show when employee has carryover and deductible type */}
            {selectedManualEmployee && (selectedManualEmployee.carryoverDays || 0) > 0 && !['cfp', 'bo', 'ccc', 'ev'].includes(manualLeaveForm.leave_type) && (
              <div className="space-y-2">
                <Label>Deduce din soldul *</Label>
                <RadioGroup
                  value={manualLeaveForm.deduct_from}
                  onValueChange={(v) => setManualLeaveForm({ ...manualLeaveForm, deduct_from: v as 'auto' | 'carryover' | 'current' })}
                  className="space-y-1"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="auto" id="deduct-auto" />
                    <Label htmlFor="deduct-auto" className="text-sm font-normal cursor-pointer">
                      Automat (mai întâi report {new Date().getFullYear() - 1}, apoi {new Date().getFullYear()})
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="carryover" id="deduct-carryover" />
                    <Label htmlFor="deduct-carryover" className="text-sm font-normal cursor-pointer">
                      Doar din report {new Date().getFullYear() - 1} ({selectedManualEmployee.carryoverDays} zile disponibile)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="current" id="deduct-current" />
                    <Label htmlFor="deduct-current" className="text-sm font-normal cursor-pointer">
                      Doar din sold {new Date().getFullYear()} ({selectedManualEmployee.total_leave_days - selectedManualEmployee.used_leave_days} zile disponibile)
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            )}

            <div className="space-y-2">
              <Label>Tip Concediu *</Label>
              <Select
                value={manualLeaveForm.leave_type}
                onValueChange={(v) => setManualLeaveForm({ ...manualLeaveForm, leave_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="co">CO — Concediu de odihnă</SelectItem>
                  <SelectItem value="bo">BO — Concediu medical</SelectItem>
                  <SelectItem value="ccc">CCC — Concediu creștere copil</SelectItem>
                  <SelectItem value="cfp">CFP — Concediu fără plată</SelectItem>
                  <SelectItem value="ev">EV — Eveniment</SelectItem>
                </SelectContent>
              </Select>
            </div>

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

            {/* Non-working days warning */}
            {manualLeaveForm.start_date && manualLeaveForm.end_date && (() => {
              const nonWorking = getNonWorkingDays(manualLeaveForm.start_date, manualLeaveForm.end_date);
              const holidays = nonWorking.filter(d => d.reason !== 'Sâmbătă' && d.reason !== 'Duminică');
              const weekendCount = nonWorking.filter(d => d.reason === 'Sâmbătă' || d.reason === 'Duminică').length;
              
              if (nonWorking.length === 0) return null;

              const totalDays = Math.ceil((new Date(manualLeaveForm.end_date).getTime() - new Date(manualLeaveForm.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1;
              const allNonWorking = nonWorking.length === totalDays;
              
              return (
                <div className={`p-3 rounded-lg space-y-2 ${allNonWorking ? 'bg-destructive/10 border border-destructive/30' : 'bg-amber-500/10 border border-amber-500/30'}`}>
                  {allNonWorking && (
                    <p className="text-sm font-medium text-destructive flex items-center gap-1.5">
                      🚫 Perioada selectată nu conține zile lucrătoare!
                    </p>
                  )}
                  {holidays.length > 0 && (
                    <>
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                        📅 Zile libere în perioada selectată (excluse automat):
                      </p>
                      <div className="space-y-0.5">
                        {holidays.map((d, i) => (
                          <p key={i} className="text-xs text-amber-600 dark:text-amber-400">
                            • <span className="font-medium">{d.date}</span> — {d.reason}
                          </p>
                        ))}
                      </div>
                    </>
                  )}
                  {weekendCount > 0 && (
                    <p className="text-xs text-muted-foreground">
                      + {weekendCount} {weekendCount === 1 ? 'zi de weekend' : 'zile de weekend'} excluse
                    </p>
                  )}
                </div>
              );
            })()}

            {/* Overlap warning */}
            {selectedManualEmployee && manualLeaveForm.start_date && manualLeaveForm.end_date && (() => {
              const sameDeptEmployees = employees.filter(e => 
                e.department && e.department === selectedManualEmployee.department && 
                e.full_name !== selectedManualEmployee.full_name
              );
              const overlapping = sameDeptEmployees.filter(colleague => {
                return (colleague.leaveHistory || []).some(lv => {
                  if (!lv.startDate || !lv.endDate) return false;
                  return lv.startDate <= manualLeaveForm.end_date && lv.endDate >= manualLeaveForm.start_date;
                });
              });
              
              if (overlapping.length === 0) return null;
              
              return (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                    ⚠️ Suprapunere cu colegi din același departament:
                  </p>
                  <div className="mt-1.5 space-y-1">
                    {overlapping.map(c => {
                      const overlappingLeave = (c.leaveHistory || []).find(lv => 
                        lv.startDate <= manualLeaveForm.end_date && lv.endDate >= manualLeaveForm.start_date
                      );
                      return (
                        <p key={c.full_name} className="text-xs text-amber-600 dark:text-amber-400">
                          • <span className="font-medium">{c.full_name}</span>
                          {overlappingLeave && ` (${format(new Date(overlappingLeave.startDate), 'dd.MM')} - ${format(new Date(overlappingLeave.endDate), 'dd.MM')})`}
                        </p>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {manualLeaveForm.start_date && manualLeaveForm.end_date && (() => {
              const workingDays = calculateWorkingDays(manualLeaveForm.start_date, manualLeaveForm.end_date);
              const isNonDeductible = ['cfp', 'bo', 'ccc', 'ev'].includes(manualLeaveForm.leave_type);
              const emp = selectedManualEmployee;
              const carryover = emp?.carryoverDays || 0;
              const currentRemaining = emp ? emp.total_leave_days - emp.used_leave_days : 0;
              const totalAvailable = currentRemaining + carryover + (emp?.bonusDays || 0);
              
              let daysFromCarryover = 0;
              let daysFromCurrent = 0;
              if (!isNonDeductible) {
                if (manualLeaveForm.deduct_from === 'carryover') {
                  daysFromCarryover = workingDays;
                } else if (manualLeaveForm.deduct_from === 'current') {
                  daysFromCurrent = workingDays;
                } else {
                  daysFromCarryover = Math.min(workingDays, carryover);
                  daysFromCurrent = workingDays - daysFromCarryover;
                }
              }

              const exceeds = !isNonDeductible && (
                manualLeaveForm.deduct_from === 'carryover'
                  ? workingDays > carryover
                  : manualLeaveForm.deduct_from === 'current'
                  ? workingDays > currentRemaining
                  : workingDays > totalAvailable
              );
              
              return (
                <div className={`p-3 rounded-lg space-y-1 ${exceeds ? 'bg-destructive/10 border border-destructive/30' : 'bg-primary/10'}`}>
                  <p className="text-sm font-medium">
                    Zile lucrătoare: <span className="font-bold">{workingDays}</span>
                  </p>
                  {!isNonDeductible && emp && carryover > 0 && manualLeaveForm.deduct_from === 'auto' && (
                    <p className="text-xs text-muted-foreground">
                      Se vor consuma: <strong>{daysFromCarryover} zile din report {new Date().getFullYear() - 1}</strong>
                      {daysFromCurrent > 0 && <> + <strong>{daysFromCurrent} zile din {new Date().getFullYear()}</strong></>}
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
              disabled={submittingManualLeave || !manualLeaveForm.employee_id || !manualLeaveForm.start_date || !manualLeaveForm.end_date || (manualLeaveForm.start_date && manualLeaveForm.end_date && calculateWorkingDays(manualLeaveForm.start_date, manualLeaveForm.end_date) <= 0)}
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

      {/* Leave Bonus Manager Dialog */}
      {bonusEmployee && (
        <LeaveBonusManager
          employeePersonalDataId={bonusEmployee.id}
          employeeName={bonusEmployee.full_name}
          open={!!bonusEmployee}
          onOpenChange={(open) => !open && setBonusEmployee(null)}
          onSaved={fetchEmployees}
        />
      )}

      {/* Department Rename Dialog */}
      <Dialog open={showRenameDept} onOpenChange={setShowRenameDept}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redenumire departament</DialogTitle>
            <DialogDescription>
              Noul nume se va aplica tuturor angajaților din „{renameDeptOld}" și va fi reflectat în rapoarte.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nume curent</Label>
              <Input value={renameDeptOld} disabled />
            </div>
            <div>
              <Label>Nume nou</Label>
              <Input
                value={renameDeptNew}
                onChange={(e) => setRenameDeptNew(e.target.value)}
                placeholder="Introduceți noul nume..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameDept(false)}>Anulează</Button>
            <Button onClick={renameDepartment} disabled={renamingDept || !renameDeptNew.trim() || renameDeptNew.trim() === renameDeptOld}>
              {renamingDept && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Redenumește
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default HRManagement;