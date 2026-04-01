import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { LEAVE_TYPES } from '@/utils/leaveTypes';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { PersonalDataEditor } from '@/components/hr/PersonalDataEditor';
import { EmployeeLeaveHistory } from '@/components/hr/EmployeeLeaveHistory';
import { LeaveBonusManager } from '@/components/hr/LeaveBonusManager';
import EmployeeDigitalDossier from '@/components/hr/EmployeeDigitalDossier';
import {
  Users, UserCheck, UserX, Search, Edit, Upload, Calendar,
  Loader2, Save, Trash2, Clock, Download, FileText,
  UserPlus, RefreshCw, Archive, RotateCcw, Gift,
  FolderOpen, MoreHorizontal, CreditCard, Eye
} from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

// Re-export the EmployeeWithData type for use in other components
export interface EmployeeWithData {
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
  record?: any;
  documents?: any[];
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
  avatar_url?: string | null;
}

interface EmployeeHubProps {
  employees: EmployeeWithData[];
  archivedEmployees: EmployeeWithData[];
  loading: boolean;
  onRefresh: () => void;
  onSync: () => void;
  syncing: boolean;
}

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

export default function EmployeeHub({ employees, archivedEmployees, loading, onRefresh, onSync, syncing }: EmployeeHubProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [accountFilter, setAccountFilter] = useState<'all' | 'with_account' | 'without_account'>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [departmentHeadEmails, setDepartmentHeadEmails] = useState<Map<string, string>>(new Map());

  // Dialogs
  const [editingEmployee, setEditingEmployee] = useState<EmployeeWithData | null>(null);
  const [editForm, setEditForm] = useState({ department: '', position: '', grade: '', hire_date: '', contract_type: 'nedeterminat', total_leave_days: 21, used_leave_days: 0 });
  const [saving, setSaving] = useState(false);
  const [uploadingFor, setUploadingFor] = useState<EmployeeWithData | null>(null);
  const [uploadForm, setUploadForm] = useState({ document_type: 'contract', name: '', description: '' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingPersonalData, setEditingPersonalData] = useState<EmployeeWithData | null>(null);
  const [leaveHistoryEmployee, setLeaveHistoryEmployee] = useState<EmployeeWithData | null>(null);
  const [bonusEmployee, setBonusEmployee] = useState<EmployeeWithData | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [archivedSearchQuery, setArchivedSearchQuery] = useState('');

  useEffect(() => {
    fetchDepartmentHeads();
  }, []);

  const fetchDepartmentHeads = async () => {
    const headMap = new Map<string, string>();
    const { data: sefRoles } = await supabase.from('user_roles').select('user_id, role').in('role', leadershipRoles as any[]);
    if (sefRoles && sefRoles.length > 0) {
      const userRoleMap = new Map<string, string>();
      sefRoles.forEach(r => userRoleMap.set(r.user_id, r.role));
      const userIds = sefRoles.map(r => r.user_id);
      const { data: records } = await supabase.from('employee_records').select('user_id, id').in('user_id', userIds);
      if (records) {
        const recordToUser = new Map<string, string>();
        records.forEach(r => recordToUser.set(r.id, r.user_id));
        const recordIds = records.map(r => r.id);
        const { data: epdData } = await supabase.from('employee_personal_data').select('email, employee_record_id').in('employee_record_id', recordIds);
        (epdData || []).forEach(e => {
          const userId = recordToUser.get(e.employee_record_id || '');
          const role = userId ? userRoleMap.get(userId) : undefined;
          if (role) headMap.set(e.email.toLowerCase(), role);
        });
      }
    }
    const { data: preAssigned } = await supabase.from('pre_assigned_roles').select('email, role').in('role', leadershipRoles as any[]);
    (preAssigned || []).forEach((p: any) => {
      if (!headMap.has(p.email.toLowerCase())) headMap.set(p.email.toLowerCase(), p.role);
    });
    setDepartmentHeadEmails(headMap);
  };

  const allDepartments = [...new Set([
    ...employees.map(e => e.department).filter(Boolean) as string[],
    ...archivedEmployees.map(e => e.department).filter(Boolean) as string[],
  ])].sort();

  const employeesWithAccounts = employees.filter(e => e.hasAccount);
  const remainingLeave = (emp: EmployeeWithData) => emp.total_leave_days + (emp.carryoverDays || 0) + (emp.bonusDays || 0) - emp.used_leave_days;
  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const filteredEmployees = employees.filter(e => {
    const matchesSearch = e.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.department?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.position?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = accountFilter === 'all' ? true : accountFilter === 'with_account' ? e.hasAccount : !e.hasAccount;
    const matchesDept = departmentFilter === 'all' ? true : e.department === departmentFilter;
    return matchesSearch && matchesFilter && matchesDept;
  }).sort((a, b) => {
    const aIsHead = departmentHeadEmails.has(a.email.toLowerCase());
    const bIsHead = departmentHeadEmails.has(b.email.toLowerCase());
    if (aIsHead && !bIsHead) return -1;
    if (!aIsHead && bIsHead) return 1;
    return a.full_name.localeCompare(b.full_name, 'ro');
  });

  const filteredArchivedEmployees = archivedEmployees.filter(e => {
    if (!archivedSearchQuery) return true;
    const q = archivedSearchQuery.toLowerCase();
    return e.full_name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q) || e.department?.toLowerCase().includes(q);
  });

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
    const { error: epdError } = await supabase.from('employee_personal_data').update({
      department: editForm.department || null, position: editForm.position || null, grade: editForm.grade || null,
      employment_date: editForm.hire_date || editingEmployee.employment_date, contract_type: editForm.contract_type,
      total_leave_days: editForm.total_leave_days, used_leave_days: editForm.used_leave_days, last_updated_by: user?.id || null,
    }).eq('id', editingEmployee.id);
    if (epdError) { toast({ title: 'Eroare', description: 'Nu s-au putut salva datele.', variant: 'destructive' }); setSaving(false); return; }
    if (editingEmployee.record && editingEmployee.user_id) {
      await supabase.from('employee_records').update({ hire_date: editForm.hire_date || null, contract_type: editForm.contract_type, total_leave_days: editForm.total_leave_days, used_leave_days: editForm.used_leave_days }).eq('id', editingEmployee.record.id);
      await supabase.from('profiles').update({ department: editForm.department || null, position: editForm.position || null }).eq('user_id', editingEmployee.user_id);
    }
    if (user) { await supabase.rpc('log_audit_event', { _user_id: user.id, _action: 'employee_edit', _entity_type: 'employee_personal_data', _entity_id: editingEmployee.id, _details: { employee_name: editingEmployee.full_name } }); }
    toast({ title: 'Succes', description: 'Datele angajatului au fost actualizate.' });
    onRefresh(); setSaving(false); setEditingEmployee(null);
  };

  const uploadDocument = async () => {
    if (!uploadingFor || !selectedFile || !uploadingFor.user_id) return;
    setUploading(true);
    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${uploadingFor.user_id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('employee-documents').upload(fileName, selectedFile);
      if (uploadError) throw uploadError;
      const { error: dbError } = await supabase.from('employee_documents').insert({ user_id: uploadingFor.user_id, document_type: uploadForm.document_type, name: uploadForm.name || selectedFile.name, description: uploadForm.description || null, file_url: fileName, uploaded_by: user?.id });
      if (dbError) throw dbError;
      toast({ title: 'Succes', description: 'Documentul a fost încărcat.' });
      onRefresh(); setUploadingFor(null); setSelectedFile(null); setUploadForm({ document_type: 'contract', name: '', description: '' });
    } catch (error) { toast({ title: 'Eroare', description: 'Nu s-a putut încărca documentul.', variant: 'destructive' }); }
    setUploading(false);
  };

  const archiveEmployee = async (employee: EmployeeWithData) => {
    const reason = prompt(`Motivul arhivării angajatului ${employee.full_name}:`);
    if (reason === null) return;
    try {
      const { error } = await supabase.from('employee_personal_data').update({ is_archived: true, archived_at: new Date().toISOString(), archived_by: user?.id || null, archive_reason: reason || 'Fără motiv specificat' }).eq('id', employee.id);
      if (error) throw error;
      if (user) { await supabase.rpc('log_audit_event', { _user_id: user.id, _action: 'employee_archive', _entity_type: 'employee_personal_data', _entity_id: employee.id, _details: { employee_name: employee.full_name, reason: reason || 'Fără motiv' } }); }
      toast({ title: 'Arhivat', description: `${employee.full_name} a fost arhivat.` });
      onRefresh();
    } catch { toast({ title: 'Eroare', description: 'Nu s-a putut arhiva angajatul.', variant: 'destructive' }); }
  };

  const restoreEmployee = async (employee: EmployeeWithData) => {
    if (!confirm(`Sigur doriți să restaurați angajatul ${employee.full_name}?`)) return;
    setRestoringId(employee.id);
    try {
      const { error } = await supabase.from('employee_personal_data').update({ is_archived: false, archived_at: null, archived_by: null, archive_reason: null }).eq('id', employee.id);
      if (error) throw error;
      if (user) { await supabase.rpc('log_audit_event', { _user_id: user.id, _action: 'employee_restore', _entity_type: 'employee_personal_data', _entity_id: employee.id, _details: { employee_name: employee.full_name } }); }
      toast({ title: 'Restaurat', description: `${employee.full_name} a fost restaurat.` });
      onRefresh();
    } catch { toast({ title: 'Eroare', description: 'Nu s-a putut restaura angajatul.', variant: 'destructive' }); }
    setRestoringId(null);
  };

  const documentTypes = [
    { value: 'cv', label: 'CV' }, { value: 'contract', label: 'Contract de Muncă' },
    { value: 'anexa', label: 'Anexă Contract' }, { value: 'certificat', label: 'Certificat' },
    { value: 'diploma', label: 'Diplomă' }, { value: 'adeverinta', label: 'Adeverință' },
    { value: 'altele', label: 'Altele' },
  ];

  return (
    <div className="space-y-6">
      {/* Sub-tab toggle */}
      <div className="flex gap-0.5 rounded-xl border border-border p-1 bg-muted/30 backdrop-blur-sm w-fit">
        <button onClick={() => setActiveTab('active')} className={cn("px-4 py-1.5 text-sm font-medium rounded-lg transition-all duration-300 flex items-center gap-2", activeTab === 'active' ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground")}>
          <Users className="w-4 h-4" /> Activi ({employees.length})
        </button>
        <button onClick={() => setActiveTab('archived')} className={cn("px-4 py-1.5 text-sm font-medium rounded-lg transition-all duration-300 flex items-center gap-2", activeTab === 'archived' ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground")}>
          <Archive className="w-4 h-4" /> Arhivați ({archivedEmployees.length})
        </button>
      </div>

      {activeTab === 'active' ? (
        <>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
            <div className="relative max-w-md w-full group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <Input placeholder="Caută după nume, email, departament..." className="pl-10 transition-shadow duration-300 focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.1)]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-full sm:w-[220px]"><SelectValue placeholder="Departament" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toate departamentele</SelectItem>
                {allDepartments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex gap-0.5 rounded-xl border border-border p-1 bg-muted/30 backdrop-blur-sm relative">
              {[
                { key: 'all' as const, label: 'Toți', icon: Users, count: employees.length },
                { key: 'with_account' as const, label: 'Cu cont', icon: UserCheck, count: employeesWithAccounts.length },
                { key: 'without_account' as const, label: 'Fără cont', icon: UserX, count: employees.length - employeesWithAccounts.length },
              ].map(f => (
                <button key={f.key} onClick={() => setAccountFilter(f.key)} className={cn("px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-300 flex items-center gap-1.5", accountFilter === f.key ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground hover:bg-muted/50")}>
                  <f.icon className="w-3.5 h-3.5" /> {f.label} ({f.count})
                </button>
              ))}
            </div>
          </div>

          {/* Employee List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5 text-primary" /> Angajați ({filteredEmployees.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
              ) : filteredEmployees.length === 0 ? (
                <div className="text-center py-12"><Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" /><p className="text-muted-foreground">Nu s-au găsit angajați</p></div>
              ) : (
                <div className="space-y-3">
                  {filteredEmployees.map((employee) => (
                    <div key={employee.id} className={cn("p-4 rounded-xl border transition-all duration-300 hover:shadow-card-hover hover:-translate-y-0.5 relative overflow-hidden bg-card border-border/60 border-l-[3px]", (!employee.department || !employee.position) ? "border-l-destructive" : employee.hasAccount ? "border-l-success" : "border-l-muted-foreground/30")}>
                      <div className="flex flex-col lg:flex-row gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <Avatar className="w-11 h-11">
                            {employee.avatar_url && <AvatarImage src={employee.avatar_url} alt={employee.full_name} />}
                            <AvatarFallback className="bg-primary/10 text-primary font-semibold">{getInitials(employee.full_name)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-foreground">{employee.full_name}</p>
                              {departmentHeadEmails.has(employee.email.toLowerCase()) && (() => {
                                const role = departmentHeadEmails.get(employee.email.toLowerCase()) || 'sef';
                                return <Badge className={`text-xs ${leadershipRoleColors[role] || 'bg-amber-600 text-white'}`}>{leadershipRoleLabels[role] || 'Șef'}</Badge>;
                              })()}
                              {employee.hasAccount ? (
                                <Badge variant="outline" className="text-xs text-green-600 border-green-300"><UserCheck className="w-3 h-3 mr-1" />Cont activ</Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs text-muted-foreground"><UserX className="w-3 h-3 mr-1" />Fără cont</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{employee.position || 'Fără funcție'} • {employee.department || 'Fără departament'}</p>
                            <p className="text-xs text-muted-foreground">{employee.email}</p>
                            <div className="flex flex-wrap gap-2 mt-2">
                              <Badge variant="outline" className="text-xs"><Calendar className="w-3 h-3 mr-1" />{remainingLeave(employee)} zile disponibile</Badge>
                              {(employee.carryoverDays || 0) > 0 && <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">+{employee.carryoverDays} report</Badge>}
                              {(employee.bonusDays || 0) > 0 && <Badge variant="outline" className="text-xs text-primary border-primary/30"><Gift className="w-3 h-3 mr-1" />+{employee.bonusDays} bonus</Badge>}
                              {(!employee.department || !employee.position) && <Badge variant="destructive" className="text-xs">Date incomplete</Badge>}
                              {employee.documents && employee.documents.length > 0 && (
                                <Badge variant="secondary" className="text-xs cursor-pointer hover:bg-secondary/80"><FileText className="w-3 h-3 mr-1" />{employee.documents.length} doc.</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button variant="outline" size="sm" onClick={() => openEditDialog(employee)}><Edit className="w-4 h-4 sm:mr-1" /><span className="hidden sm:inline">Editează</span></Button>
                          <Button variant="outline" size="sm" onClick={() => setLeaveHistoryEmployee(employee)}><Calendar className="w-4 h-4 sm:mr-1" /><span className="hidden sm:inline">Concedii</span></Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="sm"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setEditingPersonalData(employee)}><CreditCard className="w-4 h-4 mr-2" />Date Personale (CI)</DropdownMenuItem>
                              {employee.hasAccount && <DropdownMenuItem onClick={() => setUploadingFor(employee)}><Upload className="w-4 h-4 mr-2" />Încarcă Document</DropdownMenuItem>}
                              <DropdownMenuItem onClick={() => setBonusEmployee(employee)}><Gift className="w-4 h-4 mr-2" />Sold Suplimentar</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive" onClick={() => archiveEmployee(employee)}><Archive className="w-4 h-4 mr-2" />Arhivează</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        /* Archived Tab */
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Archive className="w-5 h-5 text-primary" />Angajați Arhivați ({archivedEmployees.length})</CardTitle>
            {archivedEmployees.length > 0 && (
              <div className="relative max-w-sm mt-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Caută în arhivați..." className="pl-10" value={archivedSearchQuery} onChange={(e) => setArchivedSearchQuery(e.target.value)} />
              </div>
            )}
          </CardHeader>
          <CardContent>
            {archivedEmployees.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground"><Archive className="w-12 h-12 mx-auto mb-4 opacity-40" /><p>Nu există angajați arhivați.</p></div>
            ) : (
              <div className="space-y-3">
                {filteredArchivedEmployees.map((employee) => (
                  <div key={employee.id} className="p-4 bg-secondary/30 rounded-lg border border-border">
                    <div className="flex flex-col sm:flex-row gap-4 items-start">
                      <div className="flex items-start gap-3 flex-1">
                        <Avatar className="w-12 h-12"><AvatarFallback className="bg-muted text-muted-foreground">{getInitials(employee.full_name)}</AvatarFallback></Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold">{employee.full_name}</p>
                          <p className="text-sm text-muted-foreground">{employee.position || 'Fără funcție'} • {employee.department || 'Fără departament'}</p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {employee.archived_at && <Badge variant="outline" className="text-xs"><Clock className="w-3 h-3 mr-1" />Arhivat: {format(new Date(employee.archived_at), 'dd MMM yyyy', { locale: ro })}</Badge>}
                            {employee.archive_reason && <Badge variant="secondary" className="text-xs">Motiv: {employee.archive_reason}</Badge>}
                          </div>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => restoreEmployee(employee)} disabled={restoringId === employee.id}>
                        {restoringId === employee.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-1" />}Restaurează
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingEmployee} onOpenChange={() => setEditingEmployee(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editare {editingEmployee?.full_name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Departament</Label><Input value={editForm.department} onChange={(e) => setEditForm({ ...editForm, department: e.target.value })} /></div>
              <div className="space-y-2"><Label>Funcție</Label><Input value={editForm.position} onChange={(e) => setEditForm({ ...editForm, position: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Grad / Treaptă</Label><Input value={editForm.grade} onChange={(e) => setEditForm({ ...editForm, grade: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Data Angajării</Label><Input type="date" value={editForm.hire_date} onChange={(e) => setEditForm({ ...editForm, hire_date: e.target.value })} /></div>
              <div className="space-y-2"><Label>Tip Contract</Label>
                <Select value={editForm.contract_type} onValueChange={(v) => setEditForm({ ...editForm, contract_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="nedeterminat">Nedeterminat</SelectItem><SelectItem value="determinat">Determinat</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Total Zile CO</Label><Input type="number" value={editForm.total_leave_days} onChange={(e) => setEditForm({ ...editForm, total_leave_days: parseInt(e.target.value) || 0 })} /></div>
              <div className="space-y-2"><Label>Zile Utilizate</Label><Input type="number" value={editForm.used_leave_days} onChange={(e) => setEditForm({ ...editForm, used_leave_days: parseInt(e.target.value) || 0 })} /></div>
            </div>
            <div className="p-3 bg-muted rounded-lg"><p className="text-sm"><span className="text-muted-foreground">Disponibile: </span><span className="font-bold text-primary">{editForm.total_leave_days - editForm.used_leave_days}</span></p></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingEmployee(null)}>Anulează</Button>
            <Button onClick={saveEmployeeRecord} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Salvează</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Document Dialog */}
      <Dialog open={!!uploadingFor} onOpenChange={() => setUploadingFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Încarcă Document</DialogTitle><DialogDescription>Pentru: {uploadingFor?.full_name}</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Tip Document</Label>
              <Select value={uploadForm.document_type} onValueChange={(v) => setUploadForm({ ...uploadForm, document_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{documentTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Nume Document</Label><Input value={uploadForm.name} onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Fișier</Label><Input type="file" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadingFor(null)}>Anulează</Button>
            <Button onClick={uploadDocument} disabled={uploading || !selectedFile}>{uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}Încarcă</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Personal Data Editor */}
      <PersonalDataEditor employeeRecordId={editingPersonalData?.employee_record_id || null} employeeName={editingPersonalData?.full_name || ''} open={!!editingPersonalData} onOpenChange={(open) => !open && setEditingPersonalData(null)} onSaved={onRefresh} employeePersonalDataId={editingPersonalData?.id} />

      {/* Leave History */}
      <EmployeeLeaveHistory open={!!leaveHistoryEmployee} onOpenChange={(open) => !open && setLeaveHistoryEmployee(null)} employeeName={leaveHistoryEmployee?.full_name || ''} userId={leaveHistoryEmployee?.user_id} epdId={leaveHistoryEmployee?.id} employeeRecordId={leaveHistoryEmployee?.employee_record_id || null} onChanged={onRefresh} />

      {/* Bonus Manager */}
      {bonusEmployee && (
        <LeaveBonusManager employeePersonalDataId={bonusEmployee.id} employeeName={bonusEmployee.full_name} open={!!bonusEmployee} onOpenChange={(open) => !open && setBonusEmployee(null)} onSaved={onRefresh} />
      )}
    </div>
  );
}
