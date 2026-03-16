import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { generateFisaAptitudine, type FisaAptitudineParams, type MedicalCabinetConfig } from '@/utils/generateFisaAptitudine';
import { generateDosarMedical, type DosarMedicalParams } from '@/utils/generateDosarMedical';
import MedicalSettingsPanel, { useMedicalConfig } from '@/components/medical/MedicalSettingsPanel';
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
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ro } from 'date-fns/locale';
import {
  Search, Plus, FileText, Calendar, AlertTriangle,
  CheckCircle, XCircle, Clock, Upload, Trash2, Eye, Activity,
  Users, ShieldCheck, Download, ChevronLeft, ChevronRight, FolderOpen, Settings
} from 'lucide-react';
import { Navigate } from 'react-router-dom';

type MedicalFitness = 'apt' | 'apt_conditionat' | 'inapt' | 'pending';
type ConsultationType = 'angajare' | 'periodic' | 'reluare' | 'urgenta' | 'altele';
type ExamStatus = 'scheduled' | 'completed' | 'missed' | 'cancelled';

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  cnp: string;
  department: string | null;
  position: string | null;
  email: string;
  address_street: string | null;
  address_number: string | null;
  address_city: string | null;
  address_county: string | null;
  employment_date: string;
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

const documentTypes = [
  { value: 'aviz', label: 'Aviz medical' },
  { value: 'fisa_aptitudine', label: 'Fișă de aptitudine' },
  { value: 'analize', label: 'Rezultate analize' },
  { value: 'radiografie', label: 'Radiografie' },
  { value: 'examen_oftalmologic', label: 'Examen oftalmologic' },
  { value: 'examen_orl', label: 'Examen ORL' },
  { value: 'electrocardiograma', label: 'Electrocardiogramă' },
  { value: 'scrisoare_medicala', label: 'Scrisoare medicală' },
  { value: 'altele', label: 'Altele' },
];

const ITEMS_PER_PAGE = 20;

const MedicinaMuncii = () => {
  const { user } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const isDoctor = role === 'medic_medicina_muncii' || role === 'super_admin';
  const isHR = role === 'hr' || role === 'sef_srus' || role === 'super_admin';
  const { config: medicalConfig } = useMedicalConfig();
  const canAccess = isDoctor || isHR;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<Record<string, MedicalRecord>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [scheduledExams, setScheduledExams] = useState<ScheduledExam[]>([]);
  const [documents, setDocuments] = useState<MedicalDocument[]>([]);
  const [showRecordDialog, setShowRecordDialog] = useState(false);
  const [showConsultationDialog, setShowConsultationDialog] = useState(false);
  const [showExamDialog, setShowExamDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [detailTab, setDetailTab] = useState('info');
  const [currentPage, setCurrentPage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [uploadDocType, setUploadDocType] = useState('aviz');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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

  useEffect(() => { setCurrentPage(1); }, [searchTerm, deptFilter, statusFilter]);

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from('employee_personal_data')
      .select('id, first_name, last_name, cnp, department, position, email, address_street, address_number, address_city, address_county, employment_date')
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
      const { data: consData } = await supabase
        .from('medical_consultations' as any)
        .select('*')
        .eq('medical_record_id', record.id)
        .order('consultation_date', { ascending: false });
      if (consData) setConsultations(consData as any[]);

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
    await fetchAllRecords();
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

  const handleUploadDocument = async () => {
    if (!selectedFile || !selectedEmployee || !user) return;
    const record = records[selectedEmployee.id];
    if (!record) { toast.error('Creați mai întâi fișa medicală pentru acest angajat'); return; }

    setUploading(true);
    const filePath = `${selectedEmployee.id}/${Date.now()}_${selectedFile.name}`;

    const { error: uploadErr } = await supabase.storage
      .from('medical-documents')
      .upload(filePath, selectedFile);
    if (uploadErr) { toast.error('Eroare upload: ' + uploadErr.message); setUploading(false); return; }

    const { error } = await supabase
      .from('medical_documents' as any)
      .insert({
        medical_record_id: record.id,
        document_type: uploadDocType,
        file_url: filePath,
        file_name: selectedFile.name,
        uploaded_by: user.id,
      });
    if (error) { toast.error('Eroare: ' + error.message); setUploading(false); return; }

    toast.success('Document încărcat cu succes');
    setShowUploadDialog(false);
    setSelectedFile(null);
    setUploadDocType('aviz');
    setUploading(false);
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
      <MainLayout title="Medicină a Muncii">
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
  const aptCount = employees.filter(e => records[e.id]?.medical_fitness === 'apt').length;
  const condCount = employees.filter(e => records[e.id]?.medical_fitness === 'apt_conditionat').length;
  const inaptCount = employees.filter(e => records[e.id]?.medical_fitness === 'inapt').length;
  const noRecordCount = employees.filter(e => !records[e.id]).length;
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
    let matchStatus = true;
    if (statusFilter !== 'all') {
      const rec = records[e.id];
      if (statusFilter === 'no_record') {
        matchStatus = !rec;
      } else if (statusFilter === 'expired') {
        matchStatus = !!rec?.fitness_valid_until && differenceInDays(parseISO(rec.fitness_valid_until), new Date()) < 0;
      } else if (statusFilter === 'expiring') {
        if (!rec?.fitness_valid_until) { matchStatus = false; }
        else {
          const days = differenceInDays(parseISO(rec.fitness_valid_until), new Date());
          matchStatus = days >= 0 && days <= 30;
        }
      } else {
        matchStatus = rec?.medical_fitness === statusFilter;
      }
    }
    return matchSearch && matchDept && matchStatus;
  });

  const totalPages = Math.ceil(filteredEmployees.length / ITEMS_PER_PAGE);
  const paginatedEmployees = filteredEmployees.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

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

  const openUploadDialog = () => {
    setSelectedFile(null);
    setUploadDocType('aviz');
    setShowUploadDialog(true);
  };

  const exportExcel = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Status Avize Medicale');

    ws.columns = [
      { header: 'Nume', key: 'name', width: 30 },
      { header: 'Departament', key: 'dept', width: 25 },
      { header: 'Funcție', key: 'position', width: 25 },
      { header: 'Status Aviz', key: 'fitness', width: 18 },
      { header: 'Valabil până la', key: 'valid_until', width: 18 },
      { header: 'Zile rămase', key: 'days_left', width: 14 },
      { header: 'Restricții', key: 'restrictions', width: 35 },
    ];

    ws.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a365d' } };
    });

    filteredEmployees.forEach(emp => {
      const record = records[emp.id];
      const daysLeft = record?.fitness_valid_until
        ? differenceInDays(parseISO(record.fitness_valid_until), new Date())
        : null;
      ws.addRow({
        name: `${emp.last_name} ${emp.first_name}`,
        dept: emp.department || '',
        position: emp.position || '',
        fitness: record ? fitnessLabels[record.medical_fitness] : 'Fără fișă',
        valid_until: record?.fitness_valid_until || '',
        days_left: daysLeft !== null ? daysLeft : '',
        restrictions: record?.restrictions || '',
      });
    });

    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), `avize_medicale_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('Export generat');
  };

  return (
    <MainLayout title="Medicină a Muncii">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Activity className="w-7 h-7 text-primary" />
              Medicină a Muncii
            </h1>
            <p className="text-muted-foreground mt-1">
              {isDoctor ? 'Gestionare dosare medicale și programări' : 'Vizualizare status avize medicale'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={exportExcel}>
              <Download className="w-4 h-4 mr-1" /> Export Excel
            </Button>
            {isDoctor && (
              <>
                <Button
                  variant={activeTab === 'settings' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveTab(activeTab === 'settings' ? 'dashboard' : 'settings')}
                >
                  <Settings className="w-4 h-4 mr-1" /> Setări cabinet
                </Button>
                <Badge variant="outline" className="text-xs">
                  <ShieldCheck className="w-3 h-3 mr-1" /> Medic
                </Badge>
              </>
            )}
          </div>
        </div>

        {activeTab === 'settings' ? (
          <div className="space-y-4">
            <Button variant="outline" size="sm" onClick={() => setActiveTab('dashboard')}>
              ← Înapoi la listă
            </Button>
            <MedicalSettingsPanel />
          </div>
        ) : activeTab === 'detail' && selectedEmployee ? (
          /* Employee Detail View */
          <div className="space-y-4">
            <Button variant="outline" size="sm" onClick={() => { setActiveTab('dashboard'); setSelectedEmployee(null); }}>
              ← Înapoi la listă
            </Button>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle>{selectedEmployee.last_name} {selectedEmployee.first_name}</CardTitle>
                    <CardDescription>{selectedEmployee.department} — {selectedEmployee.position}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {records[selectedEmployee.id] && (
                      <Badge className={fitnessColors[records[selectedEmployee.id].medical_fitness]}>
                        {fitnessLabels[records[selectedEmployee.id].medical_fitness]}
                      </Badge>
                    )}
                    {isDoctor && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => openRecordDialog(selectedEmployee)}>
                          <FileText className="w-4 h-4 mr-1" />
                          {records[selectedEmployee.id] ? 'Editează fișa' : 'Creează fișă'}
                        </Button>
                        {records[selectedEmployee.id] && records[selectedEmployee.id].medical_fitness !== 'pending' && (
                          <Button size="sm" variant="outline" onClick={() => {
                            const rec = records[selectedEmployee.id];
                            const lastConsult = consultations[0];
                            const fitnessMap: Record<string, FisaAptitudineParams['medicalFitness']> = {
                              apt: 'apt', apt_conditionat: 'apt_conditionat', inapt: 'inapt',
                            };
                            const consultTypeMap: Record<string, FisaAptitudineParams['consultationType']> = {
                              angajare: 'angajare', periodic: 'periodic', reluare: 'reluare',
                              urgenta: 'urgenta', altele: 'altele',
                            };
                            const today = new Date();
                            const formatDMY = (d: string | null) => {
                              if (!d) return '';
                              const [y, m, day] = d.split('-');
                              return `${day}.${m}.${y}`;
                            };
                            generateFisaAptitudine({
                              lastName: selectedEmployee.last_name,
                              firstName: selectedEmployee.first_name,
                              cnp: selectedEmployee.cnp || '',
                              position: selectedEmployee.position || '',
                              department: selectedEmployee.department || '',
                              consultationType: lastConsult ? (consultTypeMap[lastConsult.consultation_type] || 'periodic') : 'periodic',
                              medicalFitness: fitnessMap[rec.medical_fitness] || 'apt',
                              recommendations: rec.restrictions || lastConsult?.recommendations || '',
                              consultationDate: lastConsult ? formatDMY(lastConsult.consultation_date) : format(today, 'dd.MM.yyyy'),
                              nextExamDate: rec.fitness_valid_until ? formatDMY(rec.fitness_valid_until) : '',
                              config: medicalConfig,
                            });
                            toast.success('Fișa de aptitudine a fost descărcată');
                          }}>
                            <Download className="w-4 h-4 mr-1" />
                            Fișă Aptitudine
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={async () => {
                          // Fetch dossier supplementary data
                          const { data: dossierData } = await supabase
                            .from('medical_dossier_data' as any)
                            .select('*')
                            .eq('epd_id', selectedEmployee.id)
                            .maybeSingle();
                          const d = dossierData as any;
                          const addr = [
                            selectedEmployee.address_street,
                            selectedEmployee.address_number ? `nr. ${selectedEmployee.address_number}` : '',
                            selectedEmployee.address_city,
                            selectedEmployee.address_county ? `jud. ${selectedEmployee.address_county}` : '',
                          ].filter(Boolean).join(', ');
                          generateDosarMedical({
                            lastName: selectedEmployee.last_name,
                            firstName: selectedEmployee.first_name,
                            cnp: selectedEmployee.cnp || '',
                            position: selectedEmployee.position || '',
                            department: selectedEmployee.department || '',
                            address: addr,
                            employmentDate: selectedEmployee.employment_date || '',
                            config: medicalConfig,
                            professionalTraining: d?.professional_training || undefined,
                            professionalRoute: d?.professional_route || undefined,
                            workHistory: d?.work_history || undefined,
                            currentActivities: d?.current_activities || undefined,
                            professionalDiseases: d?.professional_diseases ?? undefined,
                            professionalDiseasesDetails: d?.professional_diseases_details || undefined,
                            workAccidents: d?.work_accidents ?? undefined,
                            workAccidentsDetails: d?.work_accidents_details || undefined,
                            familyDoctor: d?.family_doctor || undefined,
                            heredoCollateral: d?.heredo_collateral || undefined,
                            personalPhysiological: d?.personal_physiological || undefined,
                            personalPathological: d?.personal_pathological || undefined,
                            smoking: d?.smoking || undefined,
                            alcohol: d?.alcohol || undefined,
                          });
                          toast.success('Dosarul medical a fost descărcat');
                        }}>
                          <Download className="w-4 h-4 mr-1" />
                          Dosar Medical
                        </Button>
                        <Button size="sm" variant="default" onClick={openUploadDialog}>
                          <Upload className="w-4 h-4 mr-1" />
                          Încarcă document
                        </Button>
                      </>
                    )}
                  </div>
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
                    <FolderOpen className="w-4 h-4 mr-1" /> Documente ({documents.length})
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
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="pt-6 text-center text-muted-foreground">
                      <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                      <p className="mb-3">Nu există fișă medicală pentru acest angajat.</p>
                      {isDoctor && (
                        <Button size="sm" onClick={() => openRecordDialog(selectedEmployee)}>
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
                  <Card>
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
                                      <Button size="sm" variant="ghost" onClick={() => updateExamStatus(ex.id, 'completed')} title="Marcare efectuat">
                                        <CheckCircle className="w-4 h-4 text-green-600" />
                                      </Button>
                                      <Button size="sm" variant="ghost" onClick={() => updateExamStatus(ex.id, 'missed')} title="Marcare ratat">
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
                  </Card>
                )}
              </TabsContent>

              {isDoctor && (
                <TabsContent value="documents" className="space-y-4">
                  <div className="flex justify-end">
                    <Button size="sm" onClick={openUploadDialog}>
                      <Upload className="w-4 h-4 mr-1" /> Încarcă document
                    </Button>
                  </div>
                  {documents.length === 0 ? (
                    <Card>
                      <CardContent className="pt-8 pb-8 text-center text-muted-foreground">
                        <FolderOpen className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                        <p className="mb-3">Niciun document medical încărcat.</p>
                        <Button size="sm" variant="outline" onClick={openUploadDialog}>
                          <Upload className="w-4 h-4 mr-1" /> Încarcă primul document
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-2">
                      {documents.map(doc => (
                        <Card key={doc.id}>
                          <CardContent className="pt-3 pb-3 flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              <span className="text-sm font-medium truncate">{doc.file_name || doc.document_type}</span>
                              <Badge variant="outline" className="text-xs flex-shrink-0">
                                {documentTypes.find(dt => dt.value === doc.document_type)?.label || doc.document_type}
                              </Badge>
                              <span className="text-xs text-muted-foreground flex-shrink-0">
                                {format(parseISO(doc.created_at), 'dd MMM yyyy', { locale: ro })}
                              </span>
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              <Button size="sm" variant="ghost" onClick={() => downloadDocument(doc)} title="Descarcă">
                                <Download className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => deleteDocument(doc)} title="Șterge">
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
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('all')}>
                <CardContent className="pt-4 pb-4 text-center">
                  <Users className="w-5 h-5 mx-auto text-primary mb-1" />
                  <p className="text-2xl font-bold">{totalEmployees}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('apt')}>
                <CardContent className="pt-4 pb-4 text-center">
                  <CheckCircle className="w-5 h-5 mx-auto text-green-600 mb-1" />
                  <p className="text-2xl font-bold text-green-600">{aptCount}</p>
                  <p className="text-xs text-muted-foreground">Apt</p>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('apt_conditionat')}>
                <CardContent className="pt-4 pb-4 text-center">
                  <AlertTriangle className="w-5 h-5 mx-auto text-yellow-600 mb-1" />
                  <p className="text-2xl font-bold text-yellow-600">{condCount}</p>
                  <p className="text-xs text-muted-foreground">Condiționat</p>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('inapt')}>
                <CardContent className="pt-4 pb-4 text-center">
                  <XCircle className="w-5 h-5 mx-auto text-red-600 mb-1" />
                  <p className="text-2xl font-bold text-red-600">{inaptCount}</p>
                  <p className="text-xs text-muted-foreground">Inapt</p>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('expiring')}>
                <CardContent className="pt-4 pb-4 text-center">
                  <Clock className="w-5 h-5 mx-auto text-orange-500 mb-1" />
                  <p className="text-2xl font-bold text-orange-500">{expiringSoon}</p>
                  <p className="text-xs text-muted-foreground">Expiră 30 zile</p>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('expired')}>
                <CardContent className="pt-4 pb-4 text-center">
                  <AlertTriangle className="w-5 h-5 mx-auto text-destructive mb-1" />
                  <p className="text-2xl font-bold text-destructive">{expired}</p>
                  <p className="text-xs text-muted-foreground">Expirate</p>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('no_record')}>
                <CardContent className="pt-4 pb-4 text-center">
                  <FileText className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
                  <p className="text-2xl font-bold">{noRecordCount}</p>
                  <p className="text-xs text-muted-foreground">Fără fișă</p>
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
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Departament" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toate departamentele</SelectItem>
                  {departments.map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toate statusurile</SelectItem>
                  <SelectItem value="apt">Apt</SelectItem>
                  <SelectItem value="apt_conditionat">Apt condiționat</SelectItem>
                  <SelectItem value="inapt">Inapt</SelectItem>
                  <SelectItem value="pending">În așteptare</SelectItem>
                  <SelectItem value="no_record">Fără fișă</SelectItem>
                  <SelectItem value="expiring">Expiră în 30 zile</SelectItem>
                  <SelectItem value="expired">Expirate</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Employee table */}
            <Card>
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
                  {paginatedEmployees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Niciun angajat găsit cu filtrele selectate.
                      </TableCell>
                    </TableRow>
                  ) : paginatedEmployees.map(emp => {
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
                        <TableCell className="text-sm max-w-[200px] truncate">{record?.restrictions || '—'}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); fetchEmployeeDetails(emp); }} title="Vezi detalii">
                              <Eye className="w-4 h-4" />
                            </Button>
                            {isDoctor && !record && (
                              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setSelectedEmployee(emp); openRecordDialog(emp); }} title="Creează fișă">
                                <Plus className="w-4 h-4 text-primary" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground px-3">
                  Pagina {currentPage} din {totalPages} ({filteredEmployees.length} angajați)
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Următor
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}
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

        {/* Upload Document Dialog */}
        <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Încarcă document medical
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {selectedEmployee && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-sm font-medium">{selectedEmployee.last_name} {selectedEmployee.first_name}</p>
                  <p className="text-xs text-muted-foreground">{selectedEmployee.department} — {selectedEmployee.position}</p>
                </div>
              )}
              {selectedEmployee && !records[selectedEmployee.id] && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5">
                  <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-destructive">
                    Trebuie mai întâi să creați o fișă medicală pentru acest angajat înainte de a încărca documente.
                  </p>
                </div>
              )}
              <div>
                <Label>Tip document</Label>
                <Select value={uploadDocType} onValueChange={setUploadDocType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {documentTypes.map(dt => (
                      <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fișier</Label>
                <div className="mt-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                    onChange={e => {
                      if (e.target.files?.length) setSelectedFile(e.target.files[0]);
                    }}
                  />
                  <div
                    className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {selectedFile ? (
                      <div className="flex items-center justify-center gap-2">
                        <FileText className="w-5 h-5 text-primary" />
                        <span className="text-sm font-medium">{selectedFile.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">
                          Click pentru a selecta un fișier
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          PDF, JPG, PNG, DOC, DOCX, XLS, XLSX (max 20MB)
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowUploadDialog(false)}>Anulează</Button>
              <Button
                onClick={handleUploadDocument}
                disabled={!selectedFile || uploading || !selectedEmployee || !records[selectedEmployee?.id || '']}
              >
                {uploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                    Se încarcă...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-1" /> Încarcă
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
};

export default MedicinaMuncii;
