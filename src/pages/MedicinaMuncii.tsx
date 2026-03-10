import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ro } from 'date-fns/locale';
import {
  Search, Plus, FileText, Calendar, BarChart3, AlertTriangle,
  CheckCircle, XCircle, Clock, Upload, Trash2, Eye, Activity,
  Users, ShieldCheck, Download
} from 'lucide-react';
import { Navigate } from 'react-router-dom';

type MedicalFitness = 'apt' | 'apt_conditionat' | 'inapt' | 'pending';
type ConsultationType = 'angajare' | 'periodic' | 'reluare' | 'urgenta' | 'altele';
type ExamStatus = 'scheduled' | 'completed' | 'missed' | 'cancelled';

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  department: string | null;
  position: string | null;
  email: string;
}

interface MedicalRecord {
  id: string;
  epd_id: string;
  medical_fitness: MedicalFitness;
  fitness_valid_until: string | null;
  risk_category: string | null;
  chronic_conditions: string | null;
  restrictions: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Consultation {
  id: string;
  medical_record_id: string;
  consultation_type: ConsultationType;
  consultation_date: string;
  diagnosis: string | null;
  recommendations: string | null;
  next_consultation_date: string | null;
  doctor_id: string | null;
  created_at: string;
}

interface ScheduledExam {
  id: string;
  epd_id: string;
  exam_type: string;
  scheduled_date: string;
  status: ExamStatus;
  notes: string | null;
}

interface MedicalDocument {
  id: string;
  medical_record_id: string;
  document_type: string;
  file_url: string;
  file_name: string | null;
  created_at: string;
}

const fitnessColors: Record<MedicalFitness, string> = {
  apt: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  apt_conditionat: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  inapt: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  pending: 'bg-muted text-muted-foreground',
};

const fitnessLabels: Record<MedicalFitness, string> = {
  apt: 'Apt',
  apt_conditionat: 'Apt condiționat',
  inapt: 'Inapt',
  pending: 'În așteptare',
};

const consultationLabels: Record<ConsultationType, string> = {
  angajare: 'La angajare',
  periodic: 'Periodic',
  reluare: 'La reluare',
  urgenta: 'Urgență',
  altele: 'Altele',
};

const examStatusLabels: Record<ExamStatus, string> = {
  scheduled: 'Programat',
  completed: 'Efectuat',
  missed: 'Ratat',
  cancelled: 'Anulat',
};

const MedicinaMuncii = () => {
  const { user } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const isDoctor = role === 'medic_medicina_muncii';
  const isHR = role === 'hr' || role === 'sef_srus' || role === 'super_admin';
  const canAccess = isDoctor || isHR;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<Record<string, MedicalRecord>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [scheduledExams, setScheduledExams] = useState<ScheduledExam[]>([]);
  const [documents, setDocuments] = useState<MedicalDocument[]>([]);
  const [showRecordDialog, setShowRecordDialog] = useState(false);
  const [showConsultationDialog, setShowConsultationDialog] = useState(false);
  const [showExamDialog, setShowExamDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [detailTab, setDetailTab] = useState('info');

  // Form states
  const [recordForm, setRecordForm] = useState({
    medical_fitness: 'pending' as MedicalFitness,
    fitness_valid_until: '',
    risk_category: '',
    chronic_conditions: '',
    restrictions: '',
    notes: '',
  });
  const [consultForm, setConsultForm] = useState({
    consultation_type: 'periodic' as ConsultationType,
    consultation_date: format(new Date(), 'yyyy-MM-dd'),
    diagnosis: '',
    recommendations: '',
    next_consultation_date: '',
  });
  const [examForm, setExamForm] = useState({
    exam_type: 'periodic',
    scheduled_date: '',
    notes: '',
  });

  useEffect(() => {
    if (!canAccess) return;
    fetchEmployees();
    fetchAllRecords();
    fetchAllExams();
  }, [canAccess]);

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from('employee_personal_data')
      .select('id, first_name, last_name, department, position, email')
      .eq('is_archived', false)
      .order('last_name');
    if (data) setEmployees(data);
  };

  const fetchAllRecords = async () => {
    const { data } = await supabase.from('medical_records' as any).select('*');
    if (data) {
      const map: Record<string, MedicalRecord> = {};
      (data as any[]).forEach((r: any) => { map[r.epd_id] = r; });
      setRecords(map);
    }
  };

  const fetchAllExams = async () => {
    const { data } = await supabase
      .from('medical_scheduled_exams' as any)
      .select('*')
      .eq('status', 'scheduled')
      .order('scheduled_date');
    if (data) setScheduledExams(data as any[]);
  };

  const fetchEmployeeDetails = async (emp: Employee) => {
    setSelectedEmployee(emp);
    setDetailTab('info');
    const record = records[emp.id];
    if (record) {
      // Fetch consultations
      const { data: consData } = await supabase
        .from('medical_consultations' as any)
        .select('*')
        .eq('medical_record_id', record.id)
        .order('consultation_date', { ascending: false });
      if (consData) setConsultations(consData as any[]);

      // Fetch documents (only for doctor)
      if (isDoctor) {
        const { data: docsData } = await supabase
          .from('medical_documents' as any)
          .select('*')
          .eq('medical_record_id', record.id)
          .order('created_at', { ascending: false });
        if (docsData) setDocuments(docsData as any[]);
      }
    } else {
      setConsultations([]);
      setDocuments([]);
    }

    // Fetch exams for this employee
    const { data: examData } = await supabase
      .from('medical_scheduled_exams' as any)
      .select('*')
      .eq('epd_id', emp.id)
      .order('scheduled_date', { ascending: false });
    if (examData) setScheduledExams(examData as any[]);

    setActiveTab('detail');
  };

  const saveRecord = async () => {
    if (!selectedEmployee || !user) return;
    const existing = records[selectedEmployee.id];

    if (existing) {
      const { error } = await supabase
        .from('medical_records' as any)
        .update({
          medical_fitness: recordForm.medical_fitness,
          fitness_valid_until: recordForm.fitness_valid_until || null,
          risk_category: recordForm.risk_category || null,
          chronic_conditions: recordForm.chronic_conditions || null,
          restrictions: recordForm.restrictions || null,
          notes: recordForm.notes || null,
        })
        .eq('id', existing.id);
      if (error) { toast.error('Eroare la salvare: ' + error.message); return; }
    } else {
      const { error } = await supabase
        .from('medical_records' as any)
        .insert({
          epd_id: selectedEmployee.id,
          medical_fitness: recordForm.medical_fitness,
          fitness_valid_until: recordForm.fitness_valid_until || null,
          risk_category: recordForm.risk_category || null,
          chronic_conditions: recordForm.chronic_conditions || null,
          restrictions: recordForm.restrictions || null,
          notes: recordForm.notes || null,
          created_by: user.id,
        });
      if (error) { toast.error('Eroare la salvare: ' + error.message); return; }
    }

    toast.success('Fișă medicală salvată');
    setShowRecordDialog(false);
    fetchAllRecords();
  };

  const saveConsultation = async () => {
    if (!selectedEmployee || !user) return;
    const record = records[selectedEmployee.id];
    if (!record) { toast.error('Creați mai întâi fișa medicală'); return; }

    const { error } = await supabase
      .from('medical_consultations' as any)
      .insert({
        medical_record_id: record.id,
        consultation_type: consultForm.consultation_type,
        consultation_date: consultForm.consultation_date,
        diagnosis: consultForm.diagnosis || null,
        recommendations: consultForm.recommendations || null,
        next_consultation_date: consultForm.next_consultation_date || null,
        doctor_id: user.id,
      });
    if (error) { toast.error('Eroare: ' + error.message); return; }
    toast.success('Consultație adăugată');
    setShowConsultationDialog(false);
    fetchEmployeeDetails(selectedEmployee);
  };

  const saveExam = async () => {
    if (!selectedEmployee || !user) return;
    const { error } = await supabase
      .from('medical_scheduled_exams' as any)
      .insert({
        epd_id: selectedEmployee.id,
        exam_type: examForm.exam_type,
        scheduled_date: examForm.scheduled_date,
        notes: examForm.notes || null,
        created_by: user.id,
      });
    if (error) { toast.error('Eroare: ' + error.message); return; }
    toast.success('Programare adăugată');
    setShowExamDialog(false);
    fetchEmployeeDetails(selectedEmployee);
    fetchAllExams();
  };

  const updateExamStatus = async (examId: string, status: ExamStatus) => {
    const { error } = await supabase
      .from('medical_scheduled_exams' as any)
      .update({ status })
      .eq('id', examId);
    if (error) { toast.error('Eroare'); return; }
    toast.success('Status actualizat');
    if (selectedEmployee) fetchEmployeeDetails(selectedEmployee);
    fetchAllExams();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length || !selectedEmployee || !user) return;
    const record = records[selectedEmployee.id];
    if (!record) { toast.error('Creați mai întâi fișa medicală'); return; }

    const file = e.target.files[0];
    const filePath = `${selectedEmployee.id}/${Date.now()}_${file.name}`;

    const { error: uploadErr } = await supabase.storage
      .from('medical-documents')
      .upload(filePath, file);
    if (uploadErr) { toast.error('Eroare upload: ' + uploadErr.message); return; }

    const { data: urlData } = supabase.storage
      .from('medical-documents')
      .getPublicUrl(filePath);

    const { error } = await supabase
      .from('medical_documents' as any)
      .insert({
        medical_record_id: record.id,
        document_type: 'aviz',
        file_url: filePath,
        file_name: file.name,
        uploaded_by: user.id,
      });
    if (error) { toast.error('Eroare: ' + error.message); return; }
    toast.success('Document încărcat');
    fetchEmployeeDetails(selectedEmployee);
  };

  const deleteDocument = async (doc: MedicalDocument) => {
    await supabase.storage.from('medical-documents').remove([doc.file_url]);
    await supabase.from('medical_documents' as any).delete().eq('id', doc.id);
    toast.success('Document șters');
    if (selectedEmployee) fetchEmployeeDetails(selectedEmployee);
  };

  const downloadDocument = async (doc: MedicalDocument) => {
    const { data } = await supabase.storage.from('medical-documents').download(doc.file_url);
    if (data) {
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name || 'document';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  if (roleLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </MainLayout>
    );
  }

  if (!canAccess) {
    return <Navigate to="/" replace />;
  }

  // Stats
  const departments = [...new Set(employees.map(e => e.department).filter(Boolean))] as string[];
  const totalEmployees = employees.length;
  const withRecord = employees.filter(e => records[e.id]).length;
  const aptCount = employees.filter(e => records[e.id]?.medical_fitness === 'apt').length;
  const condCount = employees.filter(e => records[e.id]?.medical_fitness === 'apt_conditionat').length;
  const inaptCount = employees.filter(e => records[e.id]?.medical_fitness === 'inapt').length;
  const expiringSoon = employees.filter(e => {
    const r = records[e.id];
    if (!r?.fitness_valid_until) return false;
    const days = differenceInDays(parseISO(r.fitness_valid_until), new Date());
    return days >= 0 && days <= 30;
  }).length;
  const expired = employees.filter(e => {
    const r = records[e.id];
    if (!r?.fitness_valid_until) return false;
    return differenceInDays(parseISO(r.fitness_valid_until), new Date()) < 0;
  }).length;

  const filteredEmployees = employees.filter(e => {
    const matchSearch = `${e.first_name} ${e.last_name} ${e.email}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchDept = deptFilter === 'all' || e.department === deptFilter;
    return matchSearch && matchDept;
  });

  const openRecordDialog = (emp: Employee) => {
    const existing = records[emp.id];
    setRecordForm({
      medical_fitness: existing?.medical_fitness || 'pending',
      fitness_valid_until: existing?.fitness_valid_until || '',
      risk_category: existing?.risk_category || '',
      chronic_conditions: existing?.chronic_conditions || '',
      restrictions: existing?.restrictions || '',
      notes: existing?.notes || '',
    });
    setShowRecordDialog(true);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Activity className="w-7 h-7 text-primary" />
              Medicină a Muncii
            </h1>
            <p className="text-muted-foreground mt-1">
              {isDoctor ? 'Gestionare dosare medicale și programări' : 'Vizualizare status avize medicale'}
            </p>
          </div>
          {isDoctor && (
            <Badge variant="outline" className="text-xs">
              <ShieldCheck className="w-3 h-3 mr-1" /> Medic
            </Badge>
          )}
        </div>

        {activeTab === 'detail' && selectedEmployee ? (
          /* Employee Detail View */
          <div className="space-y-4">
            <Button variant="outline" size="sm" onClick={() => { setActiveTab('dashboard'); setSelectedEmployee(null); }}>
              ← Înapoi la listă
            </Button>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{selectedEmployee.last_name} {selectedEmployee.first_name}</CardTitle>
                    <CardDescription>{selectedEmployee.department} — {selectedEmployee.position}</CardDescription>
                  </div>
                  {records[selectedEmployee.id] && (
                    <Badge className={fitnessColors[records[selectedEmployee.id].medical_fitness]}>
                      {fitnessLabels[records[selectedEmployee.id].medical_fitness]}
                    </Badge>
                  )}
                </div>
              </CardHeader>
            </Card>

            <Tabs value={detailTab} onValueChange={setDetailTab}>
              <TabsList>
                <TabsTrigger value="info">
                  <FileText className="w-4 h-4 mr-1" /> Fișă Medicală
                </TabsTrigger>
                {isDoctor && (
                  <TabsTrigger value="consultations">
                    <Activity className="w-4 h-4 mr-1" /> Consultații
                  </TabsTrigger>
                )}
                <TabsTrigger value="exams">
                  <Calendar className="w-4 h-4 mr-1" /> Programări
                </TabsTrigger>
                {isDoctor && (
                  <TabsTrigger value="documents">
                    <FileText className="w-4 h-4 mr-1" /> Documente
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="info" className="space-y-4">
                {records[selectedEmployee.id] ? (
                  <Card>
                    <CardContent className="pt-6 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-muted-foreground text-xs">Status aviz</Label>
                          <p className="font-medium">{fitnessLabels[records[selectedEmployee.id].medical_fitness]}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-xs">Valabil până la</Label>
                          <p className="font-medium">
                            {records[selectedEmployee.id].fitness_valid_until
                              ? format(parseISO(records[selectedEmployee.id].fitness_valid_until!), 'dd MMM yyyy', { locale: ro })
                              : '—'}
                          </p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-xs">Restricții</Label>
                          <p>{records[selectedEmployee.id].restrictions || '—'}</p>
                        </div>
                        {isDoctor && (
                          <>
                            <div>
                              <Label className="text-muted-foreground text-xs">Categorie risc</Label>
                              <p>{records[selectedEmployee.id].risk_category || '—'}</p>
                            </div>
                            <div>
                              <Label className="text-muted-foreground text-xs">Afecțiuni cronice</Label>
                              <p>{records[selectedEmployee.id].chronic_conditions || '—'}</p>
                            </div>
                            <div className="md:col-span-2">
                              <Label className="text-muted-foreground text-xs">Observații medic</Label>
                              <p>{records[selectedEmployee.id].notes || '—'}</p>
                            </div>
                          </>
                        )}
                      </div>
                      {isDoctor && (
                        <Button size="sm" onClick={() => openRecordDialog(selectedEmployee)}>
                          Editează fișa
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="pt-6 text-center text-muted-foreground">
                      <p>Nu există fișă medicală.</p>
                      {isDoctor && (
                        <Button className="mt-3" size="sm" onClick={() => openRecordDialog(selectedEmployee)}>
                          <Plus className="w-4 h-4 mr-1" /> Creează fișă medicală
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {isDoctor && (
                <TabsContent value="consultations" className="space-y-4">
                  <div className="flex justify-end">
                    <Button size="sm" onClick={() => {
                      setConsultForm({
                        consultation_type: 'periodic',
                        consultation_date: format(new Date(), 'yyyy-MM-dd'),
                        diagnosis: '', recommendations: '', next_consultation_date: '',
                      });
                      setShowConsultationDialog(true);
                    }}>
                      <Plus className="w-4 h-4 mr-1" /> Consultație nouă
                    </Button>
                  </div>
                  {consultations.length === 0 ? (
                    <Card><CardContent className="pt-6 text-center text-muted-foreground">Nicio consultație înregistrată.</CardContent></Card>
                  ) : (
                    <div className="space-y-3">
                      {consultations.map(c => (
                        <Card key={c.id}>
                          <CardContent className="pt-4 pb-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className="text-xs">{consultationLabels[c.consultation_type]}</Badge>
                                  <span className="text-sm text-muted-foreground">
                                    {format(parseISO(c.consultation_date), 'dd MMM yyyy', { locale: ro })}
                                  </span>
                                </div>
                                {c.diagnosis && <p className="text-sm"><strong>Diagnostic:</strong> {c.diagnosis}</p>}
                                {c.recommendations && <p className="text-sm"><strong>Recomandări:</strong> {c.recommendations}</p>}
                                {c.next_consultation_date && (
                                  <p className="text-sm text-muted-foreground mt-1">
                                    Următorul control: {format(parseISO(c.next_consultation_date), 'dd MMM yyyy', { locale: ro })}
                                  </p>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
              )}

              <TabsContent value="exams" className="space-y-4">
                {isDoctor && (
                  <div className="flex justify-end">
                    <Button size="sm" onClick={() => {
                      setExamForm({ exam_type: 'periodic', scheduled_date: '', notes: '' });
                      setShowExamDialog(true);
                    }}>
                      <Plus className="w-4 h-4 mr-1" /> Programare nouă
                    </Button>
                  </div>
                )}
                {scheduledExams.length === 0 ? (
                  <Card><CardContent className="pt-6 text-center text-muted-foreground">Nicio programare.</CardContent></Card>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tip</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Note</TableHead>
                        {isDoctor && <TableHead>Acțiuni</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scheduledExams.map(ex => (
                        <TableRow key={ex.id}>
                          <TableCell className="font-medium">{ex.exam_type}</TableCell>
                          <TableCell>{format(parseISO(ex.scheduled_date), 'dd MMM yyyy', { locale: ro })}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{examStatusLabels[ex.status]}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{ex.notes || '—'}</TableCell>
                          {isDoctor && (
                            <TableCell>
                              <div className="flex gap-1">
                                {ex.status === 'scheduled' && (
                                  <>
                                    <Button size="sm" variant="ghost" onClick={() => updateExamStatus(ex.id, 'completed')}>
                                      <CheckCircle className="w-4 h-4 text-green-600" />
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => updateExamStatus(ex.id, 'missed')}>
                                      <XCircle className="w-4 h-4 text-red-600" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              {isDoctor && (
                <TabsContent value="documents" className="space-y-4">
                  <div className="flex justify-end">
                    <label className="cursor-pointer">
                      <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.jpg,.png,.doc,.docx" />
                      <Button size="sm" asChild>
                        <span><Upload className="w-4 h-4 mr-1" /> Încarcă document</span>
                      </Button>
                    </label>
                  </div>
                  {documents.length === 0 ? (
                    <Card><CardContent className="pt-6 text-center text-muted-foreground">Niciun document.</CardContent></Card>
                  ) : (
                    <div className="space-y-2">
                      {documents.map(doc => (
                        <Card key={doc.id}>
                          <CardContent className="pt-3 pb-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm font-medium">{doc.file_name || doc.document_type}</span>
                              <Badge variant="outline" className="text-xs">{doc.document_type}</Badge>
                              <span className="text-xs text-muted-foreground">
                                {format(parseISO(doc.created_at), 'dd MMM yyyy', { locale: ro })}
                              </span>
                            </div>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" onClick={() => downloadDocument(doc)}>
                                <Download className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => deleteDocument(doc)}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
              )}
            </Tabs>
          </div>
        ) : (
          /* Dashboard / List View */
          <div className="space-y-6">
            {/* Stats cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <Card>
                <CardContent className="pt-4 pb-4 text-center">
                  <Users className="w-5 h-5 mx-auto text-primary mb-1" />
                  <p className="text-2xl font-bold">{totalEmployees}</p>
                  <p className="text-xs text-muted-foreground">Total angajați</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4 text-center">
                  <CheckCircle className="w-5 h-5 mx-auto text-green-600 mb-1" />
                  <p className="text-2xl font-bold text-green-600">{aptCount}</p>
                  <p className="text-xs text-muted-foreground">Apt</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4 text-center">
                  <AlertTriangle className="w-5 h-5 mx-auto text-yellow-600 mb-1" />
                  <p className="text-2xl font-bold text-yellow-600">{condCount}</p>
                  <p className="text-xs text-muted-foreground">Condiționat</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4 text-center">
                  <XCircle className="w-5 h-5 mx-auto text-red-600 mb-1" />
                  <p className="text-2xl font-bold text-red-600">{inaptCount}</p>
                  <p className="text-xs text-muted-foreground">Inapt</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4 text-center">
                  <Clock className="w-5 h-5 mx-auto text-orange-500 mb-1" />
                  <p className="text-2xl font-bold text-orange-500">{expiringSoon}</p>
                  <p className="text-xs text-muted-foreground">Expiră în 30 zile</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4 text-center">
                  <AlertTriangle className="w-5 h-5 mx-auto text-destructive mb-1" />
                  <p className="text-2xl font-bold text-destructive">{expired}</p>
                  <p className="text-xs text-muted-foreground">Expirate</p>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Caută angajat..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Departament" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toate departamentele</SelectItem>
                  {departments.map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Employee table */}
            <Card>
              <ScrollArea className="max-h-[60vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Angajat</TableHead>
                      <TableHead>Departament</TableHead>
                      <TableHead>Status Aviz</TableHead>
                      <TableHead>Valabil până la</TableHead>
                      <TableHead>Restricții</TableHead>
                      <TableHead>Acțiuni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmployees.map(emp => {
                      const record = records[emp.id];
                      const daysLeft = record?.fitness_valid_until
                        ? differenceInDays(parseISO(record.fitness_valid_until), new Date())
                        : null;
                      return (
                        <TableRow key={emp.id} className="cursor-pointer hover:bg-muted/50" onClick={() => fetchEmployeeDetails(emp)}>
                          <TableCell className="font-medium">{emp.last_name} {emp.first_name}</TableCell>
                          <TableCell className="text-muted-foreground">{emp.department || '—'}</TableCell>
                          <TableCell>
                            {record ? (
                              <Badge className={fitnessColors[record.medical_fitness]}>
                                {fitnessLabels[record.medical_fitness]}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">Fără fișă</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {record?.fitness_valid_until ? (
                              <span className={daysLeft !== null && daysLeft < 0 ? 'text-destructive font-medium' : daysLeft !== null && daysLeft <= 30 ? 'text-orange-500 font-medium' : ''}>
                                {format(parseISO(record.fitness_valid_until), 'dd MMM yyyy', { locale: ro })}
                                {daysLeft !== null && daysLeft < 0 && ' (expirat)'}
                                {daysLeft !== null && daysLeft >= 0 && daysLeft <= 30 && ` (${daysLeft} zile)`}
                              </span>
                            ) : '—'}
                          </TableCell>
                          <TableCell className="text-sm">{record?.restrictions || '—'}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); fetchEmployeeDetails(emp); }}>
                              <Eye className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </Card>
          </div>
        )}

        {/* Record Dialog */}
        <Dialog open={showRecordDialog} onOpenChange={setShowRecordDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {records[selectedEmployee?.id || ''] ? 'Editează fișa medicală' : 'Creează fișă medicală'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Status aviz</Label>
                <Select value={recordForm.medical_fitness} onValueChange={v => setRecordForm(f => ({ ...f, medical_fitness: v as MedicalFitness }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(fitnessLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valabil până la</Label>
                <Input type="date" value={recordForm.fitness_valid_until} onChange={e => setRecordForm(f => ({ ...f, fitness_valid_until: e.target.value }))} />
              </div>
              <div>
                <Label>Categorie risc</Label>
                <Input value={recordForm.risk_category} onChange={e => setRecordForm(f => ({ ...f, risk_category: e.target.value }))} placeholder="Ex: chimic, biologic" />
              </div>
              <div>
                <Label>Afecțiuni cronice</Label>
                <Textarea value={recordForm.chronic_conditions} onChange={e => setRecordForm(f => ({ ...f, chronic_conditions: e.target.value }))} />
              </div>
              <div>
                <Label>Restricții medicale</Label>
                <Textarea value={recordForm.restrictions} onChange={e => setRecordForm(f => ({ ...f, restrictions: e.target.value }))} />
              </div>
              <div>
                <Label>Observații</Label>
                <Textarea value={recordForm.notes} onChange={e => setRecordForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRecordDialog(false)}>Anulează</Button>
              <Button onClick={saveRecord}>Salvează</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Consultation Dialog */}
        <Dialog open={showConsultationDialog} onOpenChange={setShowConsultationDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>Consultație nouă</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Tip consultație</Label>
                <Select value={consultForm.consultation_type} onValueChange={v => setConsultForm(f => ({ ...f, consultation_type: v as ConsultationType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(consultationLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data</Label>
                <Input type="date" value={consultForm.consultation_date} onChange={e => setConsultForm(f => ({ ...f, consultation_date: e.target.value }))} />
              </div>
              <div>
                <Label>Diagnostic</Label>
                <Textarea value={consultForm.diagnosis} onChange={e => setConsultForm(f => ({ ...f, diagnosis: e.target.value }))} />
              </div>
              <div>
                <Label>Recomandări</Label>
                <Textarea value={consultForm.recommendations} onChange={e => setConsultForm(f => ({ ...f, recommendations: e.target.value }))} />
              </div>
              <div>
                <Label>Data următorului control</Label>
                <Input type="date" value={consultForm.next_consultation_date} onChange={e => setConsultForm(f => ({ ...f, next_consultation_date: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowConsultationDialog(false)}>Anulează</Button>
              <Button onClick={saveConsultation}>Salvează</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Exam Dialog */}
        <Dialog open={showExamDialog} onOpenChange={setShowExamDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>Programare nouă</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Tip examen</Label>
                <Select value={examForm.exam_type} onValueChange={v => setExamForm(f => ({ ...f, exam_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="periodic">Control periodic</SelectItem>
                    <SelectItem value="angajare">Control la angajare</SelectItem>
                    <SelectItem value="reluare">Control la reluare</SelectItem>
                    <SelectItem value="special">Examen special</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data programării</Label>
                <Input type="date" value={examForm.scheduled_date} onChange={e => setExamForm(f => ({ ...f, scheduled_date: e.target.value }))} />
              </div>
              <div>
                <Label>Note</Label>
                <Textarea value={examForm.notes} onChange={e => setExamForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowExamDialog(false)}>Anulează</Button>
              <Button onClick={saveExam}>Programează</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
};

export default MedicinaMuncii;
