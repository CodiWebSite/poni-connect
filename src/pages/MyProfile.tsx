import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { CorrectionRequestForm } from '@/components/profile/CorrectionRequestForm';
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
  MapPin,
  CreditCard,
  Hash,
  History,
  Mail,
  BadgeCheck,
  AlertTriangle,
  Trash2
} from 'lucide-react';
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
  department: string | null;
  position: string | null;
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

const roleLabels: Record<string, string> = {
  user: 'Angajat',
  admin: 'Administrator',
  super_admin: 'Super Administrator',
  department_head: 'Șef Compartiment',
  hr: 'HR (SRUS)',
  secretariat: 'Secretariat',
  director: 'Director',
  achizitii_contabilitate: 'Achiziții / Contabilitate'
};

const MyProfile = () => {
  const { user } = useAuth();
  const { role, canApproveHR, canManageHR } = useUserRole();
  const { toast } = useToast();
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [employeeRecord, setEmployeeRecord] = useState<EmployeeRecord | null>(null);
  const [personalData, setPersonalData] = useState<PersonalData | null>(null);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [leaveHistory, setLeaveHistory] = useState<LeaveHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCorrectionForm, setShowCorrectionForm] = useState(false);
  const [deletingLeave, setDeletingLeave] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    
    const [profileRes, recordRes, docsRes, leaveRes] = await Promise.all([
      supabase.from('profiles').select('full_name, department, position, phone, avatar_url, birth_date').eq('user_id', user.id).single(),
      supabase.from('employee_records').select('*').eq('user_id', user.id).single(),
      supabase.from('employee_documents').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('hr_requests').select('id, status, details, created_at').eq('user_id', user.id).eq('request_type', 'concediu').order('created_at', { ascending: false }),
    ]);

    if (profileRes.data) setProfile(profileRes.data);
    if (recordRes.data) setEmployeeRecord(recordRes.data);
    if (docsRes.data) setDocuments(docsRes.data);
    if (leaveRes.data) setLeaveHistory(leaveRes.data);

    // Fetch personal data linked to employee record
    if (recordRes.data) {
      const { data: pd } = await supabase
        .from('employee_personal_data')
        .select('*')
        .eq('employee_record_id', recordRes.data.id)
        .maybeSingle();
      if (pd) setPersonalData(pd);
    }

    setLoading(false);
  };

  const downloadDocument = async (doc: EmployeeDocument) => {
    if (!doc.file_url) {
      toast({ title: 'Eroare', description: 'Fișierul nu este disponibil.', variant: 'destructive' });
      return;
    }
    try {
      const { data, error } = await supabase.storage.from('employee-documents').download(doc.file_url);
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

  const deleteLeaveRequest = async (leave: LeaveHistoryItem) => {
    if (!confirm('Sigur doriți să ștergeți acest concediu? Zilele vor fi readăugate în sold.')) return;
    
    setDeletingLeave(leave.id);
    try {
      const numberOfDays = leave.details?.numberOfDays || 0;
      
      // Delete the HR request
      const { error: deleteError } = await supabase
        .from('hr_requests')
        .delete()
        .eq('id', leave.id);
      
      if (deleteError) throw deleteError;

      // Revert leave balance if days were deducted
      if (numberOfDays > 0 && employeeRecord) {
        const newUsedDays = Math.max(0, employeeRecord.used_leave_days - numberOfDays);
        
        await supabase
          .from('employee_records')
          .update({ used_leave_days: newUsedDays })
          .eq('id', employeeRecord.id);

        // Also update employee_personal_data
        if (user) {
          const { data: epd } = await supabase
            .from('employee_personal_data')
            .select('id')
            .eq('employee_record_id', employeeRecord.id)
            .maybeSingle();
          
          if (epd) {
            await supabase
              .from('employee_personal_data')
              .update({ used_leave_days: newUsedDays })
              .eq('id', epd.id);
          }
        }
      }

      // Log audit event
      if (user) {
        await supabase.rpc('log_audit_event', {
          _user_id: user.id,
          _action: 'leave_delete',
          _entity_type: 'hr_request',
          _entity_id: leave.id,
          _details: { 
            days_reverted: numberOfDays,
            period: `${leave.details?.startDate || '?'} - ${leave.details?.endDate || '?'}`
          }
        });
      }

      toast({ title: 'Șters', description: `Concediul a fost șters. ${numberOfDays} zile au fost readăugate în sold.` });
      fetchData();
    } catch (error) {
      console.error('Delete leave error:', error);
      toast({ title: 'Eroare', description: 'Nu s-a putut șterge concediul.', variant: 'destructive' });
    }
    setDeletingLeave(null);
  };

  const leaveProgress = employeeRecord 
    ? (employeeRecord.used_leave_days / employeeRecord.total_leave_days) * 100 
    : 0;

  // Determine department and position from personalData or profile
  const department = personalData?.department || profile?.department;
  const position = personalData?.position || profile?.position;

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
      <div className="space-y-6 max-w-5xl mx-auto">

        {/* Profile Header Card */}
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
              <div className="w-20 h-20 rounded-full bg-primary/15 border-2 border-primary/20 flex items-center justify-center shrink-0">
                <User className="w-10 h-10 text-primary" />
              </div>
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-2xl font-bold tracking-tight">{profile?.full_name || 'N/A'}</h2>
                  <Badge variant="secondary" className="text-xs font-medium">
                    <BadgeCheck className="w-3 h-3 mr-1" />
                    {roleLabels[role || 'user']}
                  </Badge>
                </div>
                {position && (
                  <p className="text-base text-muted-foreground font-medium">{position}</p>
                )}
              </div>
            </div>
          </div>

          <CardContent className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <InfoItem icon={Building} label="Departament" value={department || 'Nespecificat'} />
              <InfoItem icon={Briefcase} label="Funcție" value={position || 'Nespecificată'} />
              {user?.email && (
                <InfoItem icon={Mail} label="Email" value={user.email} />
              )}
              {profile?.phone && (
                <InfoItem icon={Phone} label="Telefon" value={profile.phone} />
              )}
            </div>
            
            <div className="mt-4 pt-4 border-t">
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-muted-foreground hover:text-foreground gap-2"
                onClick={() => setShowCorrectionForm(true)}
              >
                <AlertTriangle className="w-4 h-4" />
                Date incorecte? Solicitați o corecție
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Leave Balance */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="w-5 h-5 text-primary" />
              Sold Concediu — {new Date().getFullYear()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {employeeRecord ? (
              <div className="space-y-5">
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <div className="text-center p-3 sm:p-4 rounded-xl bg-primary/10 border border-primary/20">
                    <p className="text-2xl sm:text-3xl font-bold text-primary">{employeeRecord.remaining_leave_days}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 font-medium">Disponibile</p>
                  </div>
                  <div className="text-center p-3 sm:p-4 rounded-xl bg-secondary/50 border border-secondary">
                    <p className="text-2xl sm:text-3xl font-bold text-secondary-foreground">{employeeRecord.used_leave_days}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 font-medium">Utilizate</p>
                  </div>
                  <div className="text-center p-3 sm:p-4 rounded-xl bg-muted/50 border">
                    <p className="text-2xl sm:text-3xl font-bold">{employeeRecord.total_leave_days}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 font-medium">Total cuvenite</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Progres utilizare</span>
                    <span className="font-semibold">{Math.round(leaveProgress)}%</span>
                  </div>
                  <Progress value={leaveProgress} className="h-2.5" />
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Nu există date despre concediu.</p>
                <p className="text-xs">Contactați departamentul HR pentru actualizare.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Leave History */}
        {leaveHistory.length > 0 && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <History className="w-5 h-5 text-primary" />
                Istoricul Concediilor
              </CardTitle>
              <CardDescription>Toate concediile înregistrate în sistem</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {leaveHistory.map((leave) => {
                  const details = leave.details || {};
                  const status = leaveStatusConfig[leave.status] || leaveStatusConfig.pending;
                  const startDate = details.startDate ? new Date(details.startDate) : null;
                  const endDate = details.endDate ? new Date(details.endDate) : null;
                  
                  return (
                    <div key={leave.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 border rounded-lg hover:bg-muted/40 transition-colors">
                      <div className="space-y-0.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">
                            {startDate && endDate
                              ? `${format(startDate, 'dd MMM', { locale: ro })} — ${format(endDate, 'dd MMM yyyy', { locale: ro })}`
                              : 'Perioadă nespecificată'}
                          </p>
                          <Badge variant={status.variant} className="text-xs">{status.label}</Badge>
                          {details.manualEntry && (
                            <Badge variant="outline" className="text-[10px]">HR</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {details.numberOfDays && (
                            <span className="font-medium">{details.numberOfDays} zile</span>
                          )}
                          <span>Înreg.: {format(new Date(leave.created_at), 'dd MMM yyyy', { locale: ro })}</span>
                        </div>
                        {details.notes && (
                          <p className="text-xs text-muted-foreground italic mt-1">{details.notes}</p>
                        )}
                      </div>
                      {canManageHR && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive shrink-0"
                          onClick={() => deleteLeaveRequest(leave)}
                          disabled={deletingLeave === leave.id}
                        >
                          {deletingLeave === leave.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4 mr-1" />
                          )}
                          Șterge
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {leaveHistory.length === 0 && employeeRecord && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <History className="w-5 h-5 text-primary" />
                Istoricul Concediilor
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-6 text-muted-foreground">
                <History className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Nu aveți concedii înregistrate în sistem.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Personal Data Section */}
        {personalData && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CreditCard className="w-5 h-5 text-primary" />
                Date de Identificare
              </CardTitle>
              <CardDescription>Informații confidențiale din dosarul de personal</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    <Hash className="w-3.5 h-3.5" />
                    CNP
                  </div>
                  <p className="font-mono font-semibold text-base">{personalData.cnp}</p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    <CreditCard className="w-3.5 h-3.5" />
                    Carte de Identitate
                  </div>
                  <p className="font-medium">
                    {personalData.ci_series && personalData.ci_number 
                      ? `${personalData.ci_series} ${personalData.ci_number}`
                      : 'Nespecificat'}
                  </p>
                  {personalData.ci_issued_by && (
                    <p className="text-xs text-muted-foreground">Eliberat de: {personalData.ci_issued_by}</p>
                  )}
                  {personalData.ci_issued_date && (
                    <p className="text-xs text-muted-foreground">La data: {format(new Date(personalData.ci_issued_date), 'dd.MM.yyyy')}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    <MapPin className="w-3.5 h-3.5" />
                    Adresă
                  </div>
                  <p className="font-medium text-sm">
                    {[
                      personalData.address_street,
                      personalData.address_number && `Nr. ${personalData.address_number}`,
                      personalData.address_block && `Bl. ${personalData.address_block}`,
                      personalData.address_floor && `Et. ${personalData.address_floor}`,
                      personalData.address_apartment && `Ap. ${personalData.address_apartment}`
                    ].filter(Boolean).join(', ') || 'Nespecificată'}
                  </p>
                  {(personalData.address_city || personalData.address_county) && (
                    <p className="text-xs text-muted-foreground">
                      {[personalData.address_city, personalData.address_county].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Documents */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="w-5 h-5 text-primary" />
              Documentele Mele
            </CardTitle>
            <CardDescription>Contracte, certificate și alte documente personale</CardDescription>
          </CardHeader>
          <CardContent>
            {documents.length > 0 ? (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <DocumentItem key={doc.id} doc={doc} onDownload={downloadDocument} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Nu aveți documente încărcate.</p>
                <p className="text-xs">Documentele vor fi adăugate de departamentul HR.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <CorrectionRequestForm 
        open={showCorrectionForm} 
        onOpenChange={setShowCorrectionForm}
        currentData={{
          full_name: profile?.full_name,
          department: department || undefined,
          position: position || undefined,
          phone: profile?.phone || undefined,
        }}
      />
    </MainLayout>
  );
};

const InfoItem = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
    <Icon className="w-4 h-4 text-primary mt-0.5 shrink-0" />
    <div className="min-w-0">
      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium break-words">{value}</p>
    </div>
  </div>
);

const DocumentItem = ({ doc, onDownload }: { doc: EmployeeDocument; onDownload: (doc: EmployeeDocument) => void }) => (
  <div className="flex items-center justify-between p-3.5 border rounded-lg hover:bg-muted/40 transition-colors">
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
        <FileText className="w-4 h-4 text-primary" />
      </div>
      <div className="min-w-0">
        <p className="font-medium text-sm truncate">{doc.name}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-[10px]">
            {documentTypeLabels[doc.document_type] || doc.document_type}
          </Badge>
          <span>{format(new Date(doc.created_at), 'dd MMM yyyy', { locale: ro })}</span>
        </div>
      </div>
    </div>
    {doc.file_url && (
      <Button variant="ghost" size="sm" onClick={() => onDownload(doc)} className="shrink-0 ml-2">
        <Download className="w-4 h-4" />
      </Button>
    )}
  </div>
);

export default MyProfile;
