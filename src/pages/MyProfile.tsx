import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ProgressRing } from '@/components/ui/progress-ring';
import { useAnimatedCounter } from '@/hooks/useAnimatedCounter';
import { useToast } from '@/hooks/use-toast';
import { CorrectionRequestForm } from '@/components/profile/CorrectionRequestForm';
import { AvatarCropDialog } from '@/components/profile/AvatarCropDialog';
import { ProfileSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { 
  User, FileText, Download, Calendar, Briefcase, Building, Phone,
  Loader2, MapPin, CreditCard, Hash, History, Mail, BadgeCheck, AlertTriangle, Camera,
  Gift, ArrowRightLeft, Scale, ShieldCheck, HelpCircle, Copy, Check,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { formatNumePrenume } from '@/utils/formatName';
import { isHrRequestOwnedByUser, isLeaveRequestOwnedByUser } from '@/utils/leaveOwnership';
import { getLeaveStyle } from '@/utils/leaveTypes';

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
  ci_expiry_date: string | null;
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
  grade: string | null;
}

interface LeaveHistoryItem {
  id: string;
  status: string;
  details: any;
  created_at: string;
  source?: 'hr_requests' | 'leave_requests';
  request_number?: string;
}

interface LeaveCarryover {
  from_year: number;
  to_year: number;
  initial_days: number;
  used_days: number;
  remaining_days: number;
}

interface LeaveBonus {
  id: string;
  year: number;
  bonus_days: number;
  reason: string;
  legal_basis: string | null;
}

const documentTypeLabels: Record<string, string> = {
  cv: 'CV', contract: 'Contract de Muncă', anexa: 'Anexă Contract',
  certificat: 'Certificat', diploma: 'Diplomă', adeverinta: 'Adeverință',
  carte_identitate: 'Carte de Identitate', altele: 'Altele'
};

const leaveStatusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive'; color: string }> = {
  approved: { label: 'Aprobat', variant: 'default', color: 'bg-success' },
  pending: { label: 'În așteptare', variant: 'secondary', color: 'bg-warning' },
  pending_director: { label: 'Așteptare Director', variant: 'secondary', color: 'bg-warning' },
  pending_department_head: { label: 'Așteptare Șef', variant: 'secondary', color: 'bg-warning' },
  pending_srus: { label: 'Așteptare SRUS', variant: 'secondary', color: 'bg-warning' },
  draft: { label: 'Ciornă', variant: 'secondary', color: 'bg-muted-foreground' },
  rejected: { label: 'Respins', variant: 'destructive', color: 'bg-destructive' },
};

const roleLabels: Record<string, string> = {
  user: 'Angajat', super_admin: 'Super Administrator', hr: 'HR (SRUS)',
};

const getDocIcon = (name: string) => {
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf')) return { color: 'text-destructive bg-destructive/10', label: 'PDF' };
  if (lower.endsWith('.doc') || lower.endsWith('.docx')) return { color: 'text-info bg-info/10', label: 'DOC' };
  if (lower.endsWith('.xls') || lower.endsWith('.xlsx')) return { color: 'text-success bg-success/10', label: 'XLS' };
  return { color: 'text-primary bg-primary/10', label: 'FILE' };
};

const MyProfile = () => {
  const { user } = useAuth();
  const { role, canManageHR } = useUserRole();
  const { toast } = useToast();
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [employeeRecord, setEmployeeRecord] = useState<EmployeeRecord | null>(null);
  const [personalData, setPersonalData] = useState<PersonalData | null>(null);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [leaveHistory, setLeaveHistory] = useState<LeaveHistoryItem[]>([]);
  const [carryovers, setCarryovers] = useState<LeaveCarryover[]>([]);
  const [bonuses, setBonuses] = useState<LeaveBonus[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCorrectionForm, setShowCorrectionForm] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [approverName, setApproverName] = useState<string | null>(null);
  const [approverAvatarUrl, setApproverAvatarUrl] = useState<string | null>(null);
  const [delegateAvatarUrl, setDelegateAvatarUrl] = useState<string | null>(null);
  const [approverSource, setApproverSource] = useState<'individual' | 'department' | null>(null);
  const [delegateName, setDelegateName] = useState<string | null>(null);
  const [delegatePeriod, setDelegatePeriod] = useState<string | null>(null);
  const [actingAsDelegate, setActingAsDelegate] = useState<{ delegatorName: string; delegatorAvatar: string | null; period: string } | null>(null);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string>('');
  const [cnpCopied, setCnpCopied] = useState(false);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    
    const [profileRes, recordRes, docsRes, leaveRes, leaveReqRes] = await Promise.all([
      supabase.from('profiles').select('full_name, department, position, phone, avatar_url, birth_date').eq('user_id', user.id).single(),
      supabase.from('employee_records').select('*').eq('user_id', user.id).single(),
      supabase.from('employee_documents').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('hr_requests').select('id, status, details, created_at').eq('user_id', user.id).eq('request_type', 'concediu').order('created_at', { ascending: false }),
      supabase.from('leave_requests').select('id, status, start_date, end_date, working_days, year, request_number, created_at, replacement_name, epd_id').eq('user_id', user.id).order('created_at', { ascending: false }),
    ]);

    if (profileRes.data) setProfile(profileRes.data);
    if (recordRes.data) setEmployeeRecord(recordRes.data);
    if (docsRes.data) setDocuments(docsRes.data);

    let ownEpdId: string | null = null;

    if (recordRes.data) {
      const { data: pd } = await supabase
        .from('employee_personal_data')
        .select('*')
        .eq('employee_record_id', recordRes.data.id)
        .maybeSingle();
      if (pd) {
        ownEpdId = pd.id;
        setPersonalData(pd);
        const [carryRes, bonusRes] = await Promise.all([
          supabase.from('leave_carryover').select('from_year, to_year, initial_days, used_days, remaining_days').eq('employee_personal_data_id', pd.id).order('from_year', { ascending: false }),
          supabase.from('leave_bonus').select('id, year, bonus_days, reason, legal_basis').eq('employee_personal_data_id', pd.id).eq('year', new Date().getFullYear()),
        ]);
        setCarryovers((carryRes.data as LeaveCarryover[]) || []);
        setBonuses((bonusRes.data as LeaveBonus[]) || []);
      }
    }

    const ownerFullName = profileRes.data?.full_name ?? null;

    const hrItems: LeaveHistoryItem[] = (leaveRes.data || [])
      .filter((r: any) =>
        isHrRequestOwnedByUser({
          details: r.details,
          ownerEpdId: ownEpdId,
          ownerFullName,
        })
      )
      .map((r: any) => ({
        ...r,
        source: 'hr_requests' as const,
      }));

    const leaveReqItems: LeaveHistoryItem[] = (leaveReqRes.data || [])
      .filter((r: any) => isLeaveRequestOwnedByUser({ requestEpdId: r.epd_id, ownerEpdId: ownEpdId }))
      .map((r: any) => ({
        id: r.id,
        status: r.status === 'approved' ? 'approved' : r.status === 'rejected' ? 'rejected' : 'pending',
        details: { startDate: r.start_date, endDate: r.end_date, numberOfDays: r.working_days, year: r.year, replacementName: r.replacement_name },
        created_at: r.created_at,
        source: 'leave_requests' as const,
        request_number: r.request_number,
      }));

    const allHistory = [...hrItems, ...leaveReqItems].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setLeaveHistory(allHistory);

    let foundApproverId: string | null = null;
    let foundApproverEmail: string | null = null;
    let foundApproverSource: 'individual' | 'department' | null = null;

    const { data: empApprover } = await supabase
      .from('leave_approvers')
      .select('approver_user_id, approver_email')
      .eq('employee_user_id', user.id)
      .maybeSingle();

    if (empApprover?.approver_user_id || empApprover?.approver_email) {
      foundApproverId = empApprover.approver_user_id;
      foundApproverEmail = empApprover.approver_email;
      foundApproverSource = 'individual';
    } else if (!empApprover && user.email) {
      const { data: empApproverByEmail } = await supabase
        .from('leave_approvers')
        .select('approver_user_id, approver_email')
        .eq('employee_email', user.email.toLowerCase())
        .maybeSingle();
      if (empApproverByEmail?.approver_user_id || empApproverByEmail?.approver_email) {
        foundApproverId = empApproverByEmail.approver_user_id;
        foundApproverEmail = empApproverByEmail.approver_email;
        foundApproverSource = 'individual';
      }
    }

    if (!foundApproverId && !foundApproverEmail) {
      const dept = profileRes.data?.department;
      if (dept) {
        const { data: deptApprover } = await supabase
          .from('leave_department_approvers')
          .select('approver_user_id, approver_email')
          .eq('department', dept)
          .maybeSingle();
        if (deptApprover?.approver_user_id || deptApprover?.approver_email) {
          foundApproverId = deptApprover.approver_user_id;
          foundApproverEmail = deptApprover.approver_email;
          foundApproverSource = 'department';
        }
      }
    }

    if (foundApproverId) {
      const { data: ap } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('user_id', foundApproverId)
        .maybeSingle();
      setApproverName(formatNumePrenume({ fullName: ap?.full_name }) || foundApproverEmail || 'Necunoscut');
      setApproverAvatarUrl(ap?.avatar_url || null);
      setApproverSource(foundApproverSource);

      const today = new Date().toISOString().split('T')[0];
      const { data: activeDelegate } = await supabase
        .from('leave_approval_delegates' as any)
        .select('delegate_user_id, start_date, end_date')
        .eq('delegator_user_id', foundApproverId)
        .eq('is_active', true)
        .lte('start_date', today)
        .gte('end_date', today)
        .limit(1);

      if (activeDelegate && activeDelegate.length > 0) {
        const del = activeDelegate[0] as any;
        const { data: delProfile } = await supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('user_id', del.delegate_user_id)
          .maybeSingle();
        setDelegateName(delProfile?.full_name ? formatNumePrenume({ fullName: delProfile.full_name }) : null);
        setDelegateAvatarUrl(delProfile?.avatar_url || null);
        setDelegatePeriod(`${format(new Date(del.start_date), 'dd.MM.yyyy')} – ${format(new Date(del.end_date), 'dd.MM.yyyy')}`);
      } else {
        setDelegateName(null);
        setDelegateAvatarUrl(null);
        setDelegatePeriod(null);
      }
    } else if (foundApproverEmail) {
      setApproverName(foundApproverEmail);
      setApproverAvatarUrl(null);
      setApproverSource(foundApproverSource);
      setDelegateName(null);
      setDelegateAvatarUrl(null);
      setDelegatePeriod(null);
    } else {
      setApproverName(null);
      setApproverAvatarUrl(null);
      setApproverSource(null);
      setDelegateName(null);
      setDelegateAvatarUrl(null);
      setDelegatePeriod(null);
    }

    // Check if current user is acting as delegate for someone
    const todayStr = new Date().toISOString().split('T')[0];
    const { data: actingAsDelegateData } = await supabase
      .from('leave_approval_delegates' as any)
      .select('delegator_user_id, start_date, end_date')
      .eq('delegate_user_id', user.id)
      .eq('is_active', true)
      .lte('start_date', todayStr)
      .gte('end_date', todayStr)
      .limit(1);

    if (actingAsDelegateData && actingAsDelegateData.length > 0) {
      const del = actingAsDelegateData[0] as any;
      const { data: delegatorProfile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('user_id', del.delegator_user_id)
        .maybeSingle();
      setActingAsDelegate({
        delegatorName: delegatorProfile?.full_name ? formatNumePrenume({ fullName: delegatorProfile.full_name }) : 'Necunoscut',
        delegatorAvatar: delegatorProfile?.avatar_url || null,
        period: `${format(new Date(del.start_date), 'dd.MM.yyyy')} – ${format(new Date(del.end_date), 'dd.MM.yyyy')}`,
      });
    } else {
      setActingAsDelegate(null);
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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Eroare', description: 'Selectați un fișier imagine.', variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Eroare', description: 'Imaginea trebuie să fie sub 5MB.', variant: 'destructive' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(reader.result as string);
      setCropDialogOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCroppedAvatar = async (croppedBlob: Blob) => {
    if (!user) return;
    setUploadingAvatar(true);
    try {
      const filePath = `${user.id}/avatar.jpg`;

      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, croppedBlob, { 
        upsert: true, 
        contentType: 'image/jpeg' 
      });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const avatarUrl = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('user_id', user.id);
      if (updateError) throw updateError;

      setProfile(prev => prev ? { ...prev, avatar_url: avatarUrl } : prev);
      toast({ title: 'Succes', description: 'Avatarul a fost actualizat.' });
    } catch (error: any) {
      console.error('Avatar upload error:', error);
      toast({ title: 'Eroare', description: 'Nu s-a putut încărca avatarul.', variant: 'destructive' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const copyCnp = () => {
    if (personalData?.cnp) {
      navigator.clipboard.writeText(personalData.cnp);
      setCnpCopied(true);
      setTimeout(() => setCnpCopied(false), 2000);
    }
  };

  const leaveProgress = employeeRecord 
    ? (employeeRecord.used_leave_days / employeeRecord.total_leave_days) * 100 
    : 0;

  const department = personalData?.department || profile?.department;
  const position = personalData?.position || profile?.position;

  // Animated counters for leave balance
  const currentYear = new Date().getFullYear();
  const carryover2025 = carryovers.find(c => c.from_year === currentYear - 1 && c.to_year === currentYear);
  const carry2025Remaining = carryover2025?.remaining_days ?? 0;
  const carry2025Initial = carryover2025?.initial_days ?? 0;
  const carry2025Used = carryover2025?.used_days ?? 0;
  const totalBonusDays = bonuses.reduce((s, b) => s + b.bonus_days, 0);
  const available2026 = employeeRecord ? employeeRecord.total_leave_days - employeeRecord.used_leave_days : 0;
  const totalAvailable = available2026 + carry2025Remaining + totalBonusDays;

  const animatedTotal = useAnimatedCounter(totalAvailable);
  const animatedAvailable2026 = useAnimatedCounter(available2026);
  const animatedUsed = useAnimatedCounter(employeeRecord?.used_leave_days ?? 0);

  if (loading) {
    return (
      <MainLayout title="Profilul Meu">
        <div className="max-w-6xl mx-auto">
          <ProfileSkeleton />
        </div>
      </MainLayout>
    );
  }

  const addressParts = personalData ? [
    personalData.address_street,
    personalData.address_number && `Nr. ${personalData.address_number}`,
    personalData.address_block && `Bl. ${personalData.address_block}`,
    personalData.address_floor && `Et. ${personalData.address_floor}`,
    personalData.address_apartment && `Ap. ${personalData.address_apartment}`
  ].filter(Boolean).join(', ') : '';

  const addressLocality = personalData 
    ? [personalData.address_city, personalData.address_county].filter(Boolean).join(', ') 
    : '';

  return (
    <MainLayout title="Profilul Meu" description="Vizualizați datele personale și documentele dvs.">
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">

        {/* ─── Hero Header ─── */}
        <Card className="overflow-hidden border-0 shadow-lg animate-fade-in">
          <div className="relative bg-gradient-to-br from-primary/15 via-primary/5 to-accent/10 p-5 sm:p-8">
            {/* Dot pattern overlay */}
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, hsl(var(--foreground)) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
            
            <div className="relative flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
              {/* Avatar with gradient ring */}
              <div className="relative shrink-0 group">
                <div className="avatar-gradient-ring p-[3px] rounded-full shadow-lg">
                  <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-background flex items-center justify-center overflow-hidden transition-transform duration-300 group-hover:scale-105">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-8 h-8 sm:w-12 sm:h-12 text-primary" />
                    )}
                  </div>
                </div>
                <label className="absolute inset-0 flex items-center justify-center bg-foreground/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  {uploadingAvatar ? (
                    <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground animate-spin" />
                  ) : (
                    <Camera className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground" />
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
                </label>
                <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 sm:w-6 sm:h-6 bg-success rounded-full border-[3px] border-background animate-pulse" />
              </div>
              
              {/* Info */}
              <div className="text-center sm:text-left space-y-2 flex-1 min-w-0">
                <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-foreground">
                  {formatNumePrenume({ firstName: personalData?.first_name, lastName: personalData?.last_name, fullName: profile?.full_name })}
                </h1>
                {position && (
                  <p className="text-sm sm:text-base text-muted-foreground font-medium">
                    {position}{personalData?.grade ? ` ${personalData.grade}` : ''}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start pt-1">
                  <Badge className="glass border-primary/20 text-primary hover:bg-primary/15 backdrop-blur">
                    <BadgeCheck className="w-3 h-3 mr-1" />
                    {roleLabels[role || 'user'] || 'Angajat'}
                  </Badge>
                  {department && (
                    <Badge variant="outline" className="glass backdrop-blur gap-1">
                      <Building className="w-3 h-3" />
                      {department}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Quick contact pills */}
              <div className="hidden lg:flex flex-col gap-2 text-sm">
                {user?.email && (
                  <div className="flex items-center gap-2 text-muted-foreground glass rounded-lg px-3 py-2 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                    <Mail className="w-4 h-4 text-primary" />
                    <span>{user.email}</span>
                  </div>
                )}
                {profile?.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground glass rounded-lg px-3 py-2 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                    <Phone className="w-4 h-4 text-primary" />
                    <span>{profile.phone}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile contact */}
          <div className="lg:hidden p-4 border-t flex flex-wrap gap-3">
            {user?.email && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="w-4 h-4 text-primary" />
                <span>{user.email}</span>
              </div>
            )}
            {profile?.phone && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="w-4 h-4 text-primary" />
                <span>{profile.phone}</span>
              </div>
            )}
          </div>
        </Card>

        {/* ─── Two-column layout ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
          
          {/* ─── Left Column (3/5) ─── */}
          <div className="lg:col-span-3 space-y-4 sm:space-y-6">

            {/* Leave Balance */}
            <Card className="animate-fade-in" style={{ animationDelay: '50ms' }}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="w-5 h-5 text-primary" />
                  Sold Concediu
                </CardTitle>
              </CardHeader>
              <CardContent>
                {employeeRecord ? (
                  <div className="space-y-4">
                    {/* Total combined with ProgressRing */}
                    <div className="p-5 rounded-xl bg-gradient-to-br from-primary/8 via-primary/4 to-accent/6 border border-primary/15 flex flex-col sm:flex-row items-center gap-5">
                      <ProgressRing value={employeeRecord.total_leave_days > 0 ? leaveProgress : 0} size={110} strokeWidth={10}>
                        <div className="text-center">
                          <p className="text-3xl font-bold text-primary leading-none">{animatedTotal}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">disponibile</p>
                        </div>
                      </ProgressRing>
                      <div className="flex-1 text-center sm:text-left">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Sold Total Disponibil</p>
                        <p className="text-xs text-muted-foreground">
                          {currentYear}: {available2026} + {currentYear - 1}: {carry2025Remaining}{totalBonusDays > 0 ? ` + Bonus: ${totalBonusDays}` : ''}
                        </p>
                        {employeeRecord.total_leave_days > 0 && (
                          <div className="mt-3">
                            <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                              <span>Utilizate {currentYear}</span>
                              <span>{animatedUsed} / {employeeRecord.total_leave_days}</span>
                            </div>
                            <Progress value={leaveProgress} className="h-2" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Year cards with mini progress */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* 2026 balance */}
                      <div className="p-3 rounded-xl border space-y-2 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sold {currentYear}</p>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="text-center p-2 rounded-lg bg-success/10 border border-success/20">
                            <p className="text-lg font-bold text-success">{animatedAvailable2026}</p>
                            <p className="text-[9px] text-muted-foreground">Disponibile</p>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-info/10 border border-info/20">
                            <p className="text-lg font-bold text-info">{animatedUsed}</p>
                            <p className="text-[9px] text-muted-foreground">Utilizate</p>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-muted/50 border">
                            <p className="text-lg font-bold text-foreground">{employeeRecord.total_leave_days}</p>
                            <p className="text-[9px] text-muted-foreground">Cuvenite</p>
                          </div>
                        </div>
                        {employeeRecord.total_leave_days > 0 && (
                          <Progress value={(employeeRecord.used_leave_days / employeeRecord.total_leave_days) * 100} className="h-1.5" />
                        )}
                      </div>

                      {/* 2025 balance */}
                      <div className="p-3 rounded-xl border space-y-2 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sold {currentYear - 1} (reportat)</p>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="text-center p-2 rounded-lg bg-warning/10 border border-warning/20">
                            <p className="text-lg font-bold text-warning">{carry2025Remaining}</p>
                            <p className="text-[9px] text-muted-foreground">Disponibile</p>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-info/10 border border-info/20">
                            <p className="text-lg font-bold text-info">{carry2025Used}</p>
                            <p className="text-[9px] text-muted-foreground">Utilizate</p>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-muted/50 border">
                            <p className="text-lg font-bold text-foreground">{carry2025Initial}</p>
                            <p className="text-[9px] text-muted-foreground">Reportate</p>
                          </div>
                        </div>
                        {carry2025Initial > 0 && (
                          <Progress value={(carry2025Used / carry2025Initial) * 100} className="h-1.5" />
                        )}
                      </div>
                    </div>

                    {/* Bonus leave */}
                    {bonuses.length > 0 && (
                      <div className="p-3 rounded-xl border border-success/20 bg-success/5 space-y-2 profile-shimmer-border">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                          <Gift className="w-3.5 h-3.5 text-success" />
                          Sold+ (Suplimentar) — {totalBonusDays} zile
                        </p>
                        {bonuses.map((b) => (
                          <div key={b.id} className="flex items-center justify-between p-2 rounded-lg bg-background/60 transition-colors hover:bg-background/80">
                            <div>
                              <p className="text-sm font-medium">+{b.bonus_days} zile — {b.reason}</p>
                              {b.legal_basis && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <Scale className="w-3 h-3" />
                                  {b.legal_basis}
                                </p>
                              )}
                            </div>
                            <Badge variant="outline" className="text-success border-success/30 text-xs">
                              +{b.bonus_days}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Nu există date despre concediu.</p>
                    <p className="text-xs">Contactați departamentul HR.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Leave History — Timeline Style */}
            <Card className="animate-fade-in" style={{ animationDelay: '100ms' }}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="w-5 h-5 text-primary" />
                  Istoricul Concediilor
                </CardTitle>
                {leaveHistory.length > 0 && (
                  <CardDescription>{leaveHistory.length} {leaveHistory.length === 1 ? 'înregistrare' : 'înregistrări'}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {leaveHistory.length > 0 ? (
                  <div className="relative pl-6">
                    {/* Timeline line */}
                    <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />
                    
                    <div className="space-y-3">
                      {leaveHistory.map((leave, idx) => {
                        const details = leave.details || {};
                        const status = leaveStatusConfig[leave.status] || leaveStatusConfig.pending;
                        const startDate = details.startDate ? new Date(details.startDate) : null;
                        const endDate = details.endDate ? new Date(details.endDate) : null;
                        
                        return (
                          <div 
                            key={leave.id} 
                            className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 border rounded-lg hover:bg-muted/30 hover:shadow-sm transition-all duration-300 hover:-translate-y-0.5"
                            style={{ animationDelay: `${idx * 30}ms` }}
                          >
                            {/* Timeline dot */}
                            <div className={`absolute -left-6 top-4 w-[18px] h-[18px] rounded-full border-[3px] border-background ${status.color} shadow-sm`} />
                            
                              <div className="space-y-0.5 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                {(() => {
                                  const leaveTypeKey = leave.source === 'leave_requests' ? 'co' : (details.leaveType || details.leave_type || 'co');
                                  const style = getLeaveStyle(leaveTypeKey);
                                  return (
                                    <Badge variant="outline" className={`text-[10px] font-bold ${style.color} ${style.bg} border-0`}>
                                      {style.label}
                                    </Badge>
                                  );
                                })()}
                                <p className="font-semibold text-sm">
                                  {startDate && endDate
                                    ? `${format(startDate, 'dd MMM', { locale: ro })} — ${format(endDate, 'dd MMM yyyy', { locale: ro })}`
                                    : 'Perioadă nespecificată'}
                                </p>
                                <Badge variant={status.variant} className="text-xs">{status.label}</Badge>
                                {leave.source === 'leave_requests' && leave.request_number && (
                                  <Badge variant="outline" className="text-[10px] font-mono">{leave.request_number}</Badge>
                                )}
                                {details.manualEntry && <Badge variant="outline" className="text-[10px]">HR</Badge>}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                {details.numberOfDays && <span className="font-medium">{details.numberOfDays} zile</span>}
                                {details.replacementName && <span>Înlocuitor: {details.replacementName}</span>}
                                <span>Înreg.: {format(new Date(leave.created_at), 'dd MMM yyyy', { locale: ro })}</span>
                              </div>
                              {details.notes && <p className="text-xs text-muted-foreground italic mt-1">{details.notes}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <History className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Nu aveți concedii înregistrate.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ─── Right Column (2/5) ─── */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">

            {/* Approver Info */}
             {approverName && (
              <Card className="animate-fade-in" style={{ animationDelay: '150ms' }}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                    Aprobator Concediu
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                    {approverAvatarUrl ? (
                      <img src={approverAvatarUrl} alt={approverName} className="w-10 h-10 rounded-full object-cover flex-shrink-0 shadow-md" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0 text-primary-foreground font-bold text-sm shadow-md">
                        {approverName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-sm">{approverName}</p>
                      <p className="text-xs text-muted-foreground">
                        {approverSource === 'individual' ? 'Aprobator desemnat individual' : 'Aprobator departament'}
                      </p>
                    </div>
                  </div>
                  {delegateName && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-warning/5 border border-warning/20">
                      {delegateAvatarUrl ? (
                        <img src={delegateAvatarUrl} alt={delegateName} className="w-10 h-10 rounded-full object-cover flex-shrink-0 shadow-md" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-warning to-warning/60 flex items-center justify-center flex-shrink-0 text-warning-foreground font-bold text-sm shadow-md">
                          {delegateName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-sm">{delegateName}</p>
                        <p className="text-xs text-muted-foreground">Înlocuitor temporar</p>
                        {delegatePeriod && (
                          <p className="text-xs text-warning font-medium mt-0.5">{delegatePeriod}</p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Personal Data */}
            {personalData && (
              <Card className="animate-fade-in" style={{ animationDelay: '200ms' }}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CreditCard className="w-5 h-5 text-primary" />
                    Date de Identificare
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* CNP with copy */}
                  <div className="p-3 rounded-lg bg-muted/40 border group transition-all duration-300 hover:shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                        <Hash className="w-3.5 h-3.5" />
                        CNP
                      </div>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={copyCnp}>
                        {cnpCopied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                      </Button>
                    </div>
                    <p className="font-mono font-bold text-lg tracking-[0.15em]">{personalData.cnp}</p>
                  </div>

                  {/* CI */}
                  <div className="p-3 rounded-lg bg-muted/40 border transition-all duration-300 hover:shadow-sm">
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1.5">
                      <CreditCard className="w-3.5 h-3.5" />
                      Carte de Identitate
                    </div>
                    <p className="font-semibold">
                      {personalData.ci_series && personalData.ci_number 
                        ? `${personalData.ci_series} ${personalData.ci_number}`
                        : 'Nespecificat'}
                    </p>
                    <div className="mt-2 space-y-0.5">
                      {personalData.ci_issued_by && (
                        <p className="text-xs text-muted-foreground">Eliberat de: {personalData.ci_issued_by}</p>
                      )}
                      {personalData.ci_issued_date && (
                        <p className="text-xs text-muted-foreground">La data: {format(new Date(personalData.ci_issued_date), 'dd.MM.yyyy')}</p>
                      )}
                      {personalData.ci_expiry_date && (
                        <p className="text-xs text-muted-foreground font-medium">Expiră: {format(new Date(personalData.ci_expiry_date), 'dd.MM.yyyy')}</p>
                      )}
                    </div>
                  </div>

                  {/* Address */}
                  <div className="p-3 rounded-lg bg-muted/40 border transition-all duration-300 hover:shadow-sm">
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      Adresă
                    </div>
                    <p className="font-medium text-sm break-words">{addressParts || 'Nespecificată'}</p>
                    {addressLocality && (
                      <p className="text-xs text-muted-foreground mt-0.5">{addressLocality}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Documents — File cards with type icons */}
            <Card className="animate-fade-in" style={{ animationDelay: '250ms' }}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="w-5 h-5 text-primary" />
                  Documentele Mele
                </CardTitle>
                {documents.length > 0 && (
                  <CardDescription>{documents.length} {documents.length === 1 ? 'document' : 'documente'}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {documents.length > 0 ? (
                  <div className="space-y-2">
                    {documents.map((doc) => {
                      const docStyle = getDocIcon(doc.name);
                      return (
                        <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 hover:shadow-sm transition-all duration-300 hover:-translate-y-0.5 group">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-9 h-9 ${docStyle.color} rounded-lg flex items-center justify-center shrink-0 font-bold text-[10px] transition-transform duration-300 group-hover:scale-110`}>
                              {docStyle.label}
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
                            <Button variant="ghost" size="sm" onClick={() => downloadDocument(doc)} className="shrink-0 ml-2 transition-all duration-300 hover:text-primary hover:scale-110">
                              <Download className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-muted/50 flex items-center justify-center">
                      <FileText className="w-8 h-8 opacity-30" />
                    </div>
                    <p className="text-sm">Nu aveți documente încărcate.</p>
                    <p className="text-xs mt-1">Documentele vor fi adăugate de HR.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Correction request — Glass card */}
            <Card className="glass border-border/40 animate-fade-in" style={{ animationDelay: '300ms' }}>
              <CardContent className="p-4">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full text-muted-foreground hover:text-foreground gap-2"
                  onClick={() => setShowCorrectionForm(true)}
                >
                  <HelpCircle className="w-4 h-4" />
                  Observați o eroare? Solicitați o corecție
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <CorrectionRequestForm 
        open={showCorrectionForm} 
        onOpenChange={setShowCorrectionForm}
        currentData={{
          full_name: formatNumePrenume({ firstName: personalData?.first_name, lastName: personalData?.last_name, fullName: profile?.full_name }),
          department: department || undefined,
          position: position || undefined,
          phone: profile?.phone || undefined,
        }}
      />

      <AvatarCropDialog
        open={cropDialogOpen}
        onOpenChange={setCropDialogOpen}
        imageSrc={cropImageSrc}
        onCropComplete={handleCroppedAvatar}
      />
    </MainLayout>
  );
};

export default MyProfile;
