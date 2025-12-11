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
  FilePlus2
} from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Navigate } from 'react-router-dom';
import * as XLSX from 'xlsx';

interface Profile {
  user_id: string;
  full_name: string;
  department: string | null;
  position: string | null;
  phone: string | null;
}

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

interface HRRequest {
  id: string;
  user_id: string;
  request_type: string;
  status: string;
  details: any;
  created_at: string;
}

interface EmployeeWithData extends Profile {
  record?: EmployeeRecord;
  documents?: EmployeeDocument[];
  requests?: HRRequest[];
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

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive'; icon: React.ReactNode }> = {
  pending: { label: 'În așteptare', variant: 'secondary', icon: <Clock className="w-3 h-3" /> },
  approved: { label: 'Aprobat', variant: 'default', icon: <CheckCircle className="w-3 h-3" /> },
  rejected: { label: 'Respins', variant: 'destructive', icon: <XCircle className="w-3 h-3" /> }
};

const HRManagement = () => {
  const { user } = useAuth();
  const { canManageHR, loading: roleLoading } = useUserRole();
  const { toast } = useToast();
  
  const [employees, setEmployees] = useState<EmployeeWithData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Edit dialog state
  const [editingEmployee, setEditingEmployee] = useState<EmployeeWithData | null>(null);
  const [editForm, setEditForm] = useState({
    department: '',
    position: '',
    phone: '',
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
  
  // View requests dialog
  const [viewingRequests, setViewingRequests] = useState<EmployeeWithData | null>(null);
  
  // New employee dialog - now for selecting incomplete employees
  const [showNewEmployee, setShowNewEmployee] = useState(false);
  
  // Manual leave registration dialog
  const [showManualLeave, setShowManualLeave] = useState(false);
  const [manualLeaveForm, setManualLeaveForm] = useState({
    employee_id: '',
    start_date: '',
    end_date: '',
    notes: ''
  });
  const [manualLeaveFile, setManualLeaveFile] = useState<File | null>(null);
  const [submittingManualLeave, setSubmittingManualLeave] = useState(false);
  const [selectedNewEmployee, setSelectedNewEmployee] = useState<string>('');

  useEffect(() => {
    if (canManageHR) {
      fetchEmployees();
    }
  }, [canManageHR]);

  const fetchEmployees = async () => {
    setLoading(true);
    
    // Fetch all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, full_name, department, position, phone')
      .order('full_name');
    
    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      toast({ title: 'Eroare', description: 'Nu s-au putut încărca angajații.', variant: 'destructive' });
      setLoading(false);
      return;
    }

    // Fetch all employee records
    const { data: records } = await supabase
      .from('employee_records')
      .select('*');

    // Fetch all employee documents
    const { data: documents } = await supabase
      .from('employee_documents')
      .select('*');

    // Fetch all HR requests
    const { data: requests } = await supabase
      .from('hr_requests')
      .select('*')
      .order('created_at', { ascending: false });

    const employeesWithData: EmployeeWithData[] = profiles?.map(profile => ({
      ...profile,
      record: records?.find(r => r.user_id === profile.user_id),
      documents: documents?.filter(d => d.user_id === profile.user_id) || [],
      requests: requests?.filter(r => r.user_id === profile.user_id) || []
    })) || [];

    setEmployees(employeesWithData);
    setLoading(false);
  };

  const openEditDialog = (employee: EmployeeWithData) => {
    setEditingEmployee(employee);
    setEditForm({
      department: employee.department || '',
      position: employee.position || '',
      phone: employee.phone || '',
      hire_date: employee.record?.hire_date || '',
      contract_type: employee.record?.contract_type || 'nedeterminat',
      total_leave_days: employee.record?.total_leave_days || 21,
      used_leave_days: employee.record?.used_leave_days || 0
    });
  };

  const saveEmployeeRecord = async () => {
    if (!editingEmployee) return;
    
    setSaving(true);
    
    // Update profile data (department, position, phone)
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        department: editForm.department || null,
        position: editForm.position || null,
        phone: editForm.phone || null
      })
      .eq('user_id', editingEmployee.user_id);

    if (profileError) {
      toast({ title: 'Eroare', description: 'Nu s-au putut salva datele profilului.', variant: 'destructive' });
      setSaving(false);
      return;
    }
    
    if (editingEmployee.record) {
      // Update existing employee record
      const { error } = await supabase
        .from('employee_records')
        .update({
          hire_date: editForm.hire_date || null,
          contract_type: editForm.contract_type,
          total_leave_days: editForm.total_leave_days,
          used_leave_days: editForm.used_leave_days
        })
        .eq('id', editingEmployee.record.id);

      if (error) {
        toast({ title: 'Eroare', description: 'Nu s-au putut salva datele de angajare.', variant: 'destructive' });
      } else {
        toast({ title: 'Succes', description: 'Datele angajatului au fost actualizate.' });
        fetchEmployees();
      }
    } else {
      // Create new employee record
      const { error } = await supabase
        .from('employee_records')
        .insert({
          user_id: editingEmployee.user_id,
          hire_date: editForm.hire_date || null,
          contract_type: editForm.contract_type,
          total_leave_days: editForm.total_leave_days,
          used_leave_days: editForm.used_leave_days
        });

      if (error) {
        toast({ title: 'Eroare', description: 'Nu s-au putut crea datele de angajare.', variant: 'destructive' });
      } else {
        toast({ title: 'Succes', description: 'Datele angajatului au fost create.' });
        fetchEmployees();
      }
    }
    
    setSaving(false);
    setEditingEmployee(null);
  };

  const uploadDocument = async () => {
    if (!uploadingFor || !selectedFile) return;
    
    setUploading(true);
    
    try {
      // Upload file to storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${uploadingFor.user_id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('employee-documents')
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      // Create document record
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

  // Get incomplete employees (missing department, position, or no employee_record)
  const incompleteEmployees = employees.filter(e => 
    !e.department || !e.position || !e.record
  );

  const selectEmployeeToComplete = (userId: string) => {
    const employee = employees.find(e => e.user_id === userId);
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

    const employee = employees.find(e => e.user_id === manualLeaveForm.employee_id);
    if (!employee?.record) {
      toast({ title: 'Eroare', description: 'Angajatul nu are date de angajare configurate.', variant: 'destructive' });
      return;
    }

    const numberOfDays = calculateWorkingDays(manualLeaveForm.start_date, manualLeaveForm.end_date);
    
    if (numberOfDays > employee.record.remaining_leave_days) {
      toast({ 
        title: 'Eroare', 
        description: `Angajatul are doar ${employee.record.remaining_leave_days} zile disponibile.`, 
        variant: 'destructive' 
      });
      return;
    }

    setSubmittingManualLeave(true);

    try {
      let fileUrl: string | null = null;

      // Upload scanned document if provided
      if (manualLeaveFile) {
        const fileExt = manualLeaveFile.name.split('.').pop();
        const fileName = `${manualLeaveForm.employee_id}/manual-leave-${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('employee-documents')
          .upload(fileName, manualLeaveFile);

        if (uploadError) throw uploadError;
        fileUrl = fileName;

        // Create document record for the scanned leave request
        await supabase.from('employee_documents').insert({
          user_id: manualLeaveForm.employee_id,
          document_type: 'cerere_concediu_scanata',
          name: `Cerere concediu ${format(new Date(manualLeaveForm.start_date), 'dd.MM.yyyy')} - ${format(new Date(manualLeaveForm.end_date), 'dd.MM.yyyy')}`,
          description: manualLeaveForm.notes || 'Cerere de concediu scanată - înregistrare manuală',
          file_url: fileName,
          uploaded_by: user?.id
        });
      }

      // Create HR request record as approved
      await supabase.from('hr_requests').insert({
        user_id: manualLeaveForm.employee_id,
        request_type: 'concediu',
        status: 'approved',
        approver_id: user?.id,
        details: {
          startDate: manualLeaveForm.start_date,
          endDate: manualLeaveForm.end_date,
          numberOfDays,
          manualEntry: true,
          scannedDocumentUrl: fileUrl,
          notes: manualLeaveForm.notes
        }
      });

      // Update employee leave balance
      const newUsedDays = employee.record.used_leave_days + numberOfDays;
      await supabase
        .from('employee_records')
        .update({ used_leave_days: newUsedDays })
        .eq('id', employee.record.id);

      toast({ 
        title: 'Succes', 
        description: `Cererea de concediu a fost înregistrată. ${numberOfDays} zile deduse din sold.` 
      });

      // Reset form and refresh
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

  const selectedManualEmployee = employees.find(e => e.user_id === manualLeaveForm.employee_id);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const exportLeaveReport = () => {
    const data = employees.map(e => ({
      'Nume Complet': e.full_name,
      'Departament': e.department || '-',
      'Funcție': e.position || '-',
      'Data Angajării': e.record?.hire_date ? format(new Date(e.record.hire_date), 'dd.MM.yyyy') : '-',
      'Tip Contract': e.record?.contract_type || '-',
      'Total Zile Concediu': e.record?.total_leave_days ?? 21,
      'Zile Utilizate': e.record?.used_leave_days ?? 0,
      'Zile Rămase': e.record?.remaining_leave_days ?? (e.record?.total_leave_days ?? 21) - (e.record?.used_leave_days ?? 0),
      'Cereri Concediu': e.requests?.filter(r => r.request_type === 'concediu').length || 0,
      'Cereri Aprobate': e.requests?.filter(r => r.request_type === 'concediu' && r.status === 'approved').length || 0,
      'Cereri Respinse': e.requests?.filter(r => r.request_type === 'concediu' && r.status === 'rejected').length || 0,
      'Cereri În Așteptare': e.requests?.filter(r => r.request_type === 'concediu' && r.status === 'pending').length || 0
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Raport Concedii');
    
    // Auto-width columns
    const colWidths = Object.keys(data[0] || {}).map(key => ({ wch: Math.max(key.length, 15) }));
    ws['!cols'] = colWidths;

    XLSX.writeFile(wb, `Raport_Concedii_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    
    toast({ title: 'Export realizat', description: 'Raportul a fost descărcat cu succes.' });
  };

  const filteredEmployees = employees.filter(e =>
    e.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.department?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.position?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Redirect if not authorized
  if (!roleLoading && !canManageHR) {
    return <Navigate to="/" replace />;
  }

  return (
    <MainLayout title="Gestiune HR" description="Administrare date angajați - Confidențial">
      <div className="space-y-6">
        {/* Header with actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div className="relative flex-1 max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Caută angajați..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportLeaveReport} disabled={employees.length === 0}>
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Export Concedii
            </Button>
            <Button variant="outline" onClick={() => setShowManualLeave(true)}>
              <FilePlus2 className="w-4 h-4 mr-2" />
              Concediu Manual
            </Button>
            <Button onClick={() => setShowNewEmployee(true)}>
              <UserPlus className="w-4 h-4 mr-2" />
              Angajat Nou
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
                <Calendar className="w-8 h-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">
                    {employees.filter(e => e.record).length}
                  </p>
                  <p className="text-xs text-muted-foreground">Cu Date Complete</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Clock className="w-8 h-8 text-amber-500" />
                <div>
                  <p className="text-2xl font-bold">
                    {employees.reduce((acc, e) => acc + (e.requests?.filter(r => r.status === 'pending').length || 0), 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Cereri Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Employees List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Lista Angajaților
            </CardTitle>
            <CardDescription>
              Gestionează datele și documentele fiecărui angajat
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
                    key={employee.user_id}
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
                          <p className="font-semibold text-foreground">{employee.full_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {employee.position || 'Fără funcție'} • {employee.department || 'Fără departament'}
                          </p>
                          
                          <div className="flex flex-wrap gap-2 mt-2">
                            {employee.record ? (
                              <>
                                <Badge variant="outline" className="text-xs">
                                  <Calendar className="w-3 h-3 mr-1" />
                                  {employee.record.remaining_leave_days} zile disponibile
                                </Badge>
                                {employee.record.hire_date && (
                                  <Badge variant="outline" className="text-xs">
                                    Angajat: {format(new Date(employee.record.hire_date), 'dd MMM yyyy', { locale: ro })}
                                  </Badge>
                                )}
                              </>
                            ) : (
                              <Badge variant="destructive" className="text-xs">
                                Date lipsă
                              </Badge>
                            )}
                            <Badge variant="secondary" className="text-xs">
                              <FileText className="w-3 h-3 mr-1" />
                              {employee.documents?.length || 0} doc.
                            </Badge>
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
                          onClick={() => setUploadingFor(employee)}
                        >
                          <Upload className="w-4 h-4 mr-1" />
                          Încarcă Doc.
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setViewingRequests(employee)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Cereri ({employee.requests?.length || 0})
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
      </div>

      {/* Edit Employee Dialog */}
      <Dialog open={!!editingEmployee} onOpenChange={() => setEditingEmployee(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editare Date Angajat</DialogTitle>
            <DialogDescription>
              {editingEmployee?.full_name}
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
              <div className="space-y-2">
                <Label>Telefon</Label>
                <Input
                  placeholder="ex: 0232-123456"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
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

      {/* View Requests Dialog */}
      <Dialog open={!!viewingRequests} onOpenChange={() => setViewingRequests(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Istoric Cereri HR</DialogTitle>
            <DialogDescription>
              {viewingRequests?.full_name}
            </DialogDescription>
          </DialogHeader>
          
          {viewingRequests?.requests && viewingRequests.requests.length > 0 ? (
            <div className="space-y-3">
              {viewingRequests.requests.map((request) => (
                <div key={request.id} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium capitalize">{request.request_type}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(request.created_at), 'dd MMM yyyy HH:mm', { locale: ro })}
                      </p>
                    </div>
                    <Badge variant={statusConfig[request.status]?.variant || 'secondary'}>
                      {statusConfig[request.status]?.icon}
                      <span className="ml-1">{statusConfig[request.status]?.label || request.status}</span>
                    </Badge>
                  </div>
                  {request.details && (
                    <div className="mt-2 text-sm text-muted-foreground">
                      {request.details.startDate && (
                        <p>Perioadă: {request.details.startDate} - {request.details.endDate}</p>
                      )}
                      {request.details.numberOfDays && (
                        <p>Număr zile: {request.details.numberOfDays}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nu există cereri HR pentru acest angajat.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* New Employee Dialog - Select from incomplete profiles */}
      <Dialog open={showNewEmployee} onOpenChange={(open) => {
        setShowNewEmployee(open);
        if (!open) setSelectedNewEmployee('');
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Completare Date Angajat</DialogTitle>
            <DialogDescription>
              Selectați un angajat înregistrat pentru a-i completa datele (departament, funcție, etc.)
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
                        <SelectItem key={emp.user_id} value={emp.user_id}>
                          <div className="flex items-center gap-2">
                            <span>{emp.full_name}</span>
                            {!emp.record && (
                              <Badge variant="outline" className="text-xs">Fără date angajare</Badge>
                            )}
                            {(!emp.department || !emp.position) && (
                              <Badge variant="outline" className="text-xs">Profil incomplet</Badge>
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
                <p className="text-sm text-muted-foreground mt-1">
                  Nu există angajați care necesită completarea datelor.
                </p>
              </div>
            )}
            
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                <strong>Notă:</strong> Angajații noi trebuie să se înregistreze prin pagina de autentificare (/auth). 
                După înregistrare, vor apărea automat în această listă.
              </p>
            </div>
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
                  {employees.filter(e => e.record).map((emp) => (
                    <SelectItem key={emp.user_id} value={emp.user_id}>
                      <div className="flex items-center gap-2">
                        <span>{emp.full_name}</span>
                        <Badge variant="outline" className="text-xs">
                          {emp.record?.remaining_leave_days} zile disp.
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedManualEmployee && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm">
                  <span className="text-muted-foreground">Sold concediu: </span>
                  <span className="font-bold text-primary">
                    {selectedManualEmployee.record?.remaining_leave_days} zile disponibile
                  </span>
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

            {manualLeaveForm.start_date && manualLeaveForm.end_date && (
              <div className="p-3 bg-primary/10 rounded-lg">
                <p className="text-sm font-medium">
                  Număr zile lucrătoare: {calculateWorkingDays(manualLeaveForm.start_date, manualLeaveForm.end_date)}
                </p>
              </div>
            )}

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
    </MainLayout>
  );
};

export default HRManagement;
