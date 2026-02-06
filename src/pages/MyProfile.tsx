import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  User, 
  FileText, 
  Download, 
  Calendar,
  Briefcase,
  Building,
  Phone,
  Clock,
  Loader2,
  Cake,
  Save,
  MapPin,
  CreditCard,
  Hash,
  History
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

interface Profile {
  full_name: string;
  department: string | null;
  position: string | null;
  phone: string | null;
  avatar_url: string | null;
  birth_date: string | null;
}

interface EmployeeRecord {
  id: string;
  hire_date: string | null;
  contract_type: string;
  total_leave_days: number;
  used_leave_days: number;
  remaining_leave_days: number;
}

interface EmployeeDocument {
  id: string;
  document_type: string;
  name: string;
  description: string | null;
  file_url: string | null;
  created_at: string;
}

interface PersonalData {
  first_name: string;
  last_name: string;
  cnp: string;
  ci_series: string | null;
  ci_number: string | null;
  ci_issued_by: string | null;
  ci_issued_date: string | null;
  address_street: string | null;
  address_number: string | null;
  address_block: string | null;
  address_floor: string | null;
  address_apartment: string | null;
  address_city: string | null;
  address_county: string | null;
  employment_date: string;
}

interface LeaveHistoryItem {
  id: string;
  status: string;
  details: any;
  created_at: string;
}

const documentTypeLabels: Record<string, string> = {
  cv: 'CV',
  contract: 'Contract de Muncă',
  anexa: 'Anexă Contract',
  certificat: 'Certificat',
  diploma: 'Diplomă',
  adeverinta: 'Adeverință',
  altele: 'Altele'
};

const leaveStatusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  approved: { label: 'Aprobat', variant: 'default' },
  pending: { label: 'În așteptare', variant: 'secondary' },
  rejected: { label: 'Respins', variant: 'destructive' },
};

const MyProfile = () => {
  const { user } = useAuth();
  const { role } = useUserRole();
  const { toast } = useToast();
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [employeeRecord, setEmployeeRecord] = useState<EmployeeRecord | null>(null);
  const [personalData, setPersonalData] = useState<PersonalData | null>(null);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [leaveHistory, setLeaveHistory] = useState<LeaveHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [birthDate, setBirthDate] = useState('');
  const [savingBirthDate, setSavingBirthDate] = useState(false);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    
    setLoading(true);
    
    // Fetch profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name, department, position, phone, avatar_url, birth_date')
      .eq('user_id', user.id)
      .single();
    
    if (profileData) {
      setProfile(profileData);
      setBirthDate(profileData.birth_date || '');
    }

    // Fetch employee record
    const { data: recordData } = await supabase
      .from('employee_records')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (recordData) {
      setEmployeeRecord(recordData);
    }

    // Fetch employee documents
    const { data: docsData } = await supabase
      .from('employee_documents')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (docsData) {
      setDocuments(docsData);
    }

    // Fetch leave history
    const { data: leaveData } = await supabase
      .from('hr_requests')
      .select('id, status, details, created_at')
      .eq('user_id', user.id)
      .eq('request_type', 'concediu')
      .order('created_at', { ascending: false });
    
    if (leaveData) {
      setLeaveHistory(leaveData);
    }

    // Fetch personal data linked to employee record
    if (recordData) {
      const { data: personalDataResult } = await supabase
        .from('employee_personal_data')
        .select('*')
        .eq('employee_record_id', recordData.id)
        .maybeSingle();
      
      if (personalDataResult) {
        setPersonalData(personalDataResult);
      }
    }

    setLoading(false);
  };

  const downloadDocument = async (doc: EmployeeDocument) => {
    if (!doc.file_url) {
      toast({ title: 'Eroare', description: 'Fișierul nu este disponibil.', variant: 'destructive' });
      return;
    }

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
      console.error('Download error:', error);
      toast({ title: 'Eroare', description: 'Nu s-a putut descărca fișierul.', variant: 'destructive' });
    }
  };

  const saveBirthDate = async () => {
    if (!user) return;
    
    setSavingBirthDate(true);
    
    const { error } = await supabase
      .from('profiles')
      .update({ birth_date: birthDate || null })
      .eq('user_id', user.id);

    if (error) {
      toast({ title: 'Eroare', description: 'Nu s-a putut salva data nașterii.', variant: 'destructive' });
    } else {
      toast({ title: 'Salvat', description: 'Data nașterii a fost actualizată.' });
    }
    
    setSavingBirthDate(false);
  };

  const roleLabels: Record<string, string> = {
    user: 'Angajat',
    admin: 'Administrator',
    super_admin: 'Super Administrator',
    department_head: 'Șef Compartiment',
    hr: 'HR (SRUS)',
    secretariat: 'Secretariat',
    director: 'Director'
  };

  const leaveProgress = employeeRecord 
    ? (employeeRecord.used_leave_days / employeeRecord.total_leave_days) * 100 
    : 0;

  if (loading) {
    return (
      <MainLayout title="Profilul Meu">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Profilul Meu" description="Vizualizați datele personale și documentele dvs.">
      <div className="space-y-6">
        {/* Profile Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Personal Info Card */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                Date Personale
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{profile?.full_name || 'N/A'}</h3>
                  <Badge variant="secondary">{roleLabels[role || 'user']}</Badge>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-center gap-3 text-sm">
                  <Briefcase className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Funcție:</span>
                  <span className="font-medium">{profile?.position || 'Nespecificat'}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Building className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Compartiment:</span>
                  <span className="font-medium">{profile?.department || 'Nespecificat'}</span>
                </div>
                {profile?.phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Telefon:</span>
                    <span className="font-medium">{profile.phone}</span>
                  </div>
                )}
              </div>

            </CardContent>
          </Card>

          {/* Leave Balance Card */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Sold Zile Concediu
              </CardTitle>
              <CardDescription>
                Anul {new Date().getFullYear()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {employeeRecord ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-green-500/10 rounded-lg">
                      <p className="text-3xl font-bold text-green-600">{employeeRecord.remaining_leave_days}</p>
                      <p className="text-sm text-muted-foreground">Zile Disponibile</p>
                    </div>
                    <div className="text-center p-4 bg-blue-500/10 rounded-lg">
                      <p className="text-3xl font-bold text-blue-600">{employeeRecord.used_leave_days}</p>
                      <p className="text-sm text-muted-foreground">Zile Utilizate</p>
                    </div>
                    <div className="text-center p-4 bg-gray-500/10 rounded-lg">
                      <p className="text-3xl font-bold text-gray-600">{employeeRecord.total_leave_days}</p>
                      <p className="text-sm text-muted-foreground">Total Zile</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Progres utilizare</span>
                      <span className="font-medium">{Math.round(leaveProgress)}%</span>
                    </div>
                    <Progress value={leaveProgress} className="h-3" />
                  </div>

                  {employeeRecord.hire_date && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2 border-t">
                      <Clock className="w-4 h-4" />
                      <span>Data angajării: {format(new Date(employeeRecord.hire_date), 'dd MMMM yyyy', { locale: ro })}</span>
                    </div>
                  )}

                  {employeeRecord.contract_type && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FileText className="w-4 h-4" />
                      <span>Tip contract: {employeeRecord.contract_type === 'nedeterminat' ? 'Perioadă nedeterminată' : 'Perioadă determinată'}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Nu există date despre concediu.</p>
                  <p className="text-sm">Contactați departamentul HR pentru actualizare.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Leave History */}
        {leaveHistory.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                Istoricul Concediilor
              </CardTitle>
              <CardDescription>
                Toate concediile înregistrate în sistem
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {leaveHistory.map((leave) => {
                  const details = leave.details || {};
                  const status = leaveStatusConfig[leave.status] || leaveStatusConfig.pending;
                  const startDate = details.startDate ? new Date(details.startDate) : null;
                  const endDate = details.endDate ? new Date(details.endDate) : null;
                  
                  return (
                    <div key={leave.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">
                            {startDate && endDate
                              ? `${format(startDate, 'dd MMMM', { locale: ro })} — ${format(endDate, 'dd MMMM yyyy', { locale: ro })}`
                              : 'Perioadă nespecificată'}
                          </p>
                          <Badge variant={status.variant}>{status.label}</Badge>
                          {details.manualEntry && (
                            <Badge variant="outline" className="text-xs">Înregistrare manuală HR</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {details.numberOfDays && (
                            <span className="font-medium">{details.numberOfDays} zile lucrătoare</span>
                          )}
                          <span>Înregistrat: {format(new Date(leave.created_at), 'dd MMM yyyy', { locale: ro })}</span>
                        </div>
                        {details.notes && (
                          <p className="text-xs text-muted-foreground italic">{details.notes}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {leaveHistory.length === 0 && employeeRecord && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                Istoricul Concediilor
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-6 text-muted-foreground">
                <History className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nu aveți concedii înregistrate în sistem.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Personal Data Section - CNP, CI, Address */}
        {personalData && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                Date de Identificare
              </CardTitle>
              <CardDescription>
                Informații confidențiale din dosarul de personal
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* CNP */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Hash className="w-4 h-4" />
                    CNP
                  </div>
                  <p className="font-mono font-medium text-lg">{personalData.cnp}</p>
                </div>

                {/* Carte de Identitate */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CreditCard className="w-4 h-4" />
                    Carte de Identitate
                  </div>
                  <p className="font-medium">
                    {personalData.ci_series && personalData.ci_number 
                      ? `${personalData.ci_series} ${personalData.ci_number}`
                      : 'Nespecificat'}
                  </p>
                  {personalData.ci_issued_by && (
                    <p className="text-sm text-muted-foreground">
                      Eliberat de: {personalData.ci_issued_by}
                    </p>
                  )}
                  {personalData.ci_issued_date && (
                    <p className="text-sm text-muted-foreground">
                      La data: {format(new Date(personalData.ci_issued_date), 'dd.MM.yyyy')}
                    </p>
                  )}
                </div>

                {/* Address */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    Adresă de Domiciliu
                  </div>
                  <p className="font-medium">
                    {[
                      personalData.address_street,
                      personalData.address_number && `Nr. ${personalData.address_number}`,
                      personalData.address_block && `Bl. ${personalData.address_block}`,
                      personalData.address_floor && `Et. ${personalData.address_floor}`,
                      personalData.address_apartment && `Ap. ${personalData.address_apartment}`
                    ].filter(Boolean).join(', ') || 'Nespecificată'}
                  </p>
                  {(personalData.address_city || personalData.address_county) && (
                    <p className="text-sm text-muted-foreground">
                      {[personalData.address_city, personalData.address_county].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Documents Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Documentele Mele
            </CardTitle>
            <CardDescription>
              CV, contracte, certificate și alte documente personale
            </CardDescription>
          </CardHeader>
          <CardContent>
            {documents.length > 0 ? (
              <Tabs defaultValue="all" className="space-y-4">
                <TabsList className="flex-wrap h-auto">
                  <TabsTrigger value="all">Toate</TabsTrigger>
                  <TabsTrigger value="contract">Contracte</TabsTrigger>
                  <TabsTrigger value="cv">CV</TabsTrigger>
                  <TabsTrigger value="certificat">Certificate</TabsTrigger>
                </TabsList>

                <TabsContent value="all" className="space-y-3">
                  {documents.map((doc) => (
                    <DocumentItem key={doc.id} doc={doc} onDownload={downloadDocument} />
                  ))}
                </TabsContent>

                <TabsContent value="contract" className="space-y-3">
                  {documents.filter(d => d.document_type === 'contract' || d.document_type === 'anexa').map((doc) => (
                    <DocumentItem key={doc.id} doc={doc} onDownload={downloadDocument} />
                  ))}
                </TabsContent>

                <TabsContent value="cv" className="space-y-3">
                  {documents.filter(d => d.document_type === 'cv').map((doc) => (
                    <DocumentItem key={doc.id} doc={doc} onDownload={downloadDocument} />
                  ))}
                </TabsContent>

                <TabsContent value="certificat" className="space-y-3">
                  {documents.filter(d => d.document_type === 'certificat' || d.document_type === 'diploma').map((doc) => (
                    <DocumentItem key={doc.id} doc={doc} onDownload={downloadDocument} />
                  ))}
                </TabsContent>
              </Tabs>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Nu aveți documente încărcate.</p>
                <p className="text-sm">Documentele vor fi adăugate de departamentul HR.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

const DocumentItem = ({ doc, onDownload }: { doc: EmployeeDocument; onDownload: (doc: EmployeeDocument) => void }) => {
  return (
    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
          <FileText className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="font-medium">{doc.name}</p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline" className="text-xs">
              {documentTypeLabels[doc.document_type] || doc.document_type}
            </Badge>
            <span>•</span>
            <span>{format(new Date(doc.created_at), 'dd MMM yyyy', { locale: ro })}</span>
          </div>
          {doc.description && (
            <p className="text-sm text-muted-foreground mt-1">{doc.description}</p>
          )}
        </div>
      </div>
      {doc.file_url && (
        <Button variant="outline" size="sm" onClick={() => onDownload(doc)}>
          <Download className="w-4 h-4 mr-1" />
          Descarcă
        </Button>
      )}
    </div>
  );
};

export default MyProfile;
