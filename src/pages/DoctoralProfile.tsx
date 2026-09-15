import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ro } from 'date-fns/locale';
import {
  GraduationCap, BookOpen, User, Phone, Mail, Camera, Loader2,
  School, CalendarRange, Target, BadgeCheck, Pencil, Check, X,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AvatarCropDialog } from '@/components/profile/AvatarCropDialog';
import { toast } from 'sonner';

type DoctoralProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  doctoral_school: string | null;
  thesis_title: string | null;
  study_year: number | null;
  start_date: string | null;
  expected_completion_date: string | null;
  coordinator_name: string | null;
  status: string;
  progress_percent: number;
};

const statusLabel: Record<string, string> = {
  active: 'Activ',
  pending: 'În așteptare',
  completed: 'Finalizat',
  suspended: 'Suspendat',
};

const DoctoralProfile = () => {
  const { user } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const [profile, setProfile] = useState<DoctoralProfileRow | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneValue, setPhoneValue] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    const [{ data: dp }, { data: p }] = await Promise.all([
      supabase.from('doctoral_profiles').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('profiles').select('avatar_url').eq('user_id', user.id).maybeSingle(),
    ]);
    setProfile(dp as DoctoralProfileRow | null);
    setPhoneValue(dp?.phone || '');
    setAvatarUrl(p?.avatar_url || null);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  if (!roleLoading && role !== 'doctorand') return <Navigate to="/" replace />;

  const savePhone = async () => {
    if (!profile) return;
    setSavingPhone(true);
    const { error } = await supabase.from('doctoral_profiles').update({ phone: phoneValue.trim() || null }).eq('id', profile.id);
    if (error) toast.error('Numărul de telefon nu a putut fi salvat');
    else {
      toast.success('Telefon actualizat');
      setProfile({ ...profile, phone: phoneValue.trim() || null });
      setEditingPhone(false);
    }
    setSavingPhone(false);
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) { toast.error('Selectează un fișier imagine'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Imaginea trebuie să fie sub 5 MB'); return; }
    const reader = new FileReader();
    reader.onload = () => { setCropImageSrc(reader.result as string); setCropDialogOpen(true); };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCroppedAvatar = async (croppedBlob: Blob) => {
    if (!user) return;
    setUploadingAvatar(true);
    try {
      const filePath = `${user.id}/avatar.jpg`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, croppedBlob, { upsert: true, contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const url = `${publicUrl}?t=${Date.now()}`;
      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: url }).eq('user_id', user.id);
      if (updateError) throw updateError;
      setAvatarUrl(url);
      toast.success('Poza de profil a fost actualizată');
    } catch {
      toast.error('Poza nu a putut fi încărcată');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const initials = (profile?.full_name || 'D')
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <MainLayout title="Profilul Meu">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <PageHeader
          eyebrow="ICMPP · Doctoranzi"
          title="Profilul meu academic"
          description="Datele tale din programul de doctorat"
          icon={GraduationCap}
        />

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : !profile ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Profilul doctoral nu a fost găsit.</CardContent></Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardContent className="flex flex-col items-center gap-6 py-8 sm:flex-row sm:items-start">
                <div className="relative">
                  <Avatar className="h-28 w-28 border-4 border-primary/10">
                    <AvatarImage src={avatarUrl || undefined} alt={profile.full_name || 'Doctorand'} />
                    <AvatarFallback className="bg-primary/10 text-2xl font-bold text-primary">{initials}</AvatarFallback>
                  </Avatar>
                  <label className="absolute -bottom-1 -right-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform hover:scale-105">
                    {uploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
                  </label>
                </div>
                <div className="flex-1 space-y-2 text-center sm:text-left">
                  <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                    <h2 className="text-2xl font-bold">{profile.full_name || 'Doctorand'}</h2>
                    <Badge variant="outline" className="gap-1">
                      <BadgeCheck className="h-3 w-3" />
                      {statusLabel[profile.status] || profile.status}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">Doctorand ICMPP · Anul {profile.study_year || '—'}</p>
                  <div className="flex flex-col gap-1 pt-1 text-sm text-muted-foreground">
                    <span className="flex items-center justify-center gap-2 sm:justify-start"><Mail className="h-4 w-4" />{profile.email || user?.email}</span>
                    <span className="flex items-center justify-center gap-2 sm:justify-start">
                      <Phone className="h-4 w-4" />
                      {editingPhone ? (
                        <span className="flex items-center gap-1">
                          <Input value={phoneValue} onChange={(e) => setPhoneValue(e.target.value)} className="h-8 w-44" placeholder="07xx xxx xxx" />
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={savePhone} disabled={savingPhone}>
                            {savingPhone ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditingPhone(false); setPhoneValue(profile.phone || ''); }}>
                            <X className="h-4 w-4" />
                          </Button>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          {profile.phone || 'Necompletat'}
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingPhone(true)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BookOpen className="h-5 w-5" /> Programul de doctorat
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Titlul tezei</p>
                  <p className="mt-1 font-medium">{profile.thesis_title || 'Necompletată'}</p>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="flex items-start gap-3">
                    <School className="mt-0.5 h-5 w-5 text-primary" />
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Școala doctorală</p>
                      <p className="mt-0.5 font-medium">{profile.doctoral_school || 'Necompletată'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <User className="mt-0.5 h-5 w-5 text-primary" />
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Conducător de doctorat</p>
                      <p className="mt-0.5 font-medium">{profile.coordinator_name || 'Nealocat'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CalendarRange className="mt-0.5 h-5 w-5 text-primary" />
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Perioada studiilor</p>
                      <p className="mt-0.5 font-medium">
                        {profile.start_date ? format(parseISO(profile.start_date), 'MMMM yyyy', { locale: ro }) : '—'}
                        {' → '}
                        {profile.expected_completion_date ? format(parseISO(profile.expected_completion_date), 'MMMM yyyy', { locale: ro }) : '—'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Target className="mt-0.5 h-5 w-5 text-primary" />
                    <div className="flex-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Progres general</p>
                      <div className="mt-1.5 flex items-center gap-3">
                        <Progress value={profile.progress_percent || 0} className="flex-1" />
                        <span className="text-sm font-semibold">{profile.progress_percent || 0}%</span>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="border-t border-border pt-4 text-xs text-muted-foreground">
                  Datele academice sunt gestionate de secretariatul științific. Pentru corecturi, trimite o cerere din Spațiul Doctoral sau contactează conducătorul de doctorat.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <AvatarCropDialog
          open={cropDialogOpen}
          onOpenChange={setCropDialogOpen}
          imageSrc={cropImageSrc}
          onCropComplete={handleCroppedAvatar}
        />
      </div>
    </MainLayout>
  );
};

export default DoctoralProfile;
