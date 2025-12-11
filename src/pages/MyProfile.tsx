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
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

interface Profile {
  full_name: string;
  department: string | null;
  position: string | null;
  phone: string | null;
  avatar_url: string | null;
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

const documentTypeLabels: Record<string, string> = {
  cv: 'CV',
  contract: 'Contract de Muncă',
  anexa: 'Anexă Contract',
  certificat: 'Certificat',
  diploma: 'Diplomă',
  adeverinta: 'Adeverință',
  altele: 'Altele'
};

const MyProfile = () => {
  const { user } = useAuth();
  const { role } = useUserRole();
  const { toast } = useToast();
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [employeeRecord, setEmployeeRecord] = useState<EmployeeRecord | null>(null);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [loading, setLoading] = useState(true);

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
      .select('full_name, department, position, phone, avatar_url')
      .eq('user_id', user.id)
      .single();
    
    if (profileData) {
      setProfile(profileData);
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

  const roleLabels: Record<string, string> = {
    user: 'Angajat',
    admin: 'Administrator',
    super_admin: 'Super Administrator',
    department_head: 'Șef Compartiment',
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
