import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { ro } from 'date-fns/locale';
import { BookOpenCheck, CalendarClock, FileUp, GraduationCap, MessageCircle, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

type DoctoralProfile = { id: string; thesis_title: string | null; coordinator_name: string | null; doctoral_school: string | null; study_year: number | null; expected_completion_date: string | null; progress_percent: number; status: string };
type Milestone = { id: string; title: string; description: string | null; due_date: string | null; status: string };
type DocumentRow = { id: string; title: string; file_name: string; status: string; created_at: string };

const statusLabel: Record<string, string> = { pending: 'În așteptare', submitted: 'Trimis', approved: 'Aprobat', changes_requested: 'Completări', overdue: 'Depășit', rejected: 'Respins' };

const MANAGER_ROLES = ['super_admin', 'hr', 'sef_srus', 'director_institut', 'director_adjunct', 'secretar_stiintific'];

const DoctoralDashboard = () => {
  const { user } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const isManager = !!role && MANAGER_ROLES.includes(role);
  const [profile, setProfile] = useState<DoctoralProfile | null>(null);
  const [allProfiles, setAllProfiles] = useState<(DoctoralProfile & { full_name: string | null })[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [documentTitle, setDocumentTitle] = useState('');

  const loadData = useCallback(async () => {
    if (!user) return;
    let profileData: DoctoralProfile | null = null;
    if (isManager) {
      const { data } = await supabase.from('doctoral_profiles').select('id,full_name,thesis_title,coordinator_name,doctoral_school,study_year,expected_completion_date,progress_percent,status').order('full_name');
      const list = (data || []) as (DoctoralProfile & { full_name: string | null })[];
      setAllProfiles(list);
      profileData = list.find((item) => item.id === selectedId) || list[0] || null;
      if (profileData) setSelectedId(profileData.id);
    } else {
      const { data } = await supabase.from('doctoral_profiles').select('id,thesis_title,coordinator_name,doctoral_school,study_year,expected_completion_date,progress_percent,status').eq('user_id', user.id).maybeSingle();
      profileData = data;
    }
    setProfile(profileData);
    if (!profileData) { setMilestones([]); setDocuments([]); return; }
    const [{ data: milestoneData }, { data: documentData }] = await Promise.all([
      supabase.from('doctoral_milestones').select('id,title,description,due_date,status').eq('doctoral_profile_id', profileData.id).order('due_date'),
      supabase.from('doctoral_documents').select('id,title,file_name,status,created_at').eq('doctoral_profile_id', profileData.id).order('created_at', { ascending: false }),
    ]);
    setMilestones(milestoneData || []); setDocuments(documentData || []);
  }, [user, isManager, selectedId]);

  useEffect(() => { loadData(); }, [loadData]);
  const nextMilestone = useMemo(() => milestones.find((item) => item.status !== 'approved'), [milestones]);

  if (!roleLoading && role === 'doctorand_pending') return <Navigate to="/doctoral/pending" replace />;
  if (!roleLoading && role !== 'doctorand' && !isManager) return <Navigate to="/" replace />;

  const uploadDocument = async (file?: File) => {
    if (!file || !profile || !user || !documentTitle.trim()) { toast.error('Completează titlul și alege documentul'); return; }
    setUploading(true);
    const path = `${profile.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error: uploadError } = await supabase.storage.from('doctoral-documents').upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) { toast.error('Documentul nu a putut fi încărcat'); setUploading(false); return; }
    const { error } = await supabase.from('doctoral_documents').insert({ doctoral_profile_id: profile.id, title: documentTitle.trim(), storage_path: path, file_name: file.name, mime_type: file.type, file_size: file.size, uploaded_by: user.id });
    if (error) toast.error('Documentul nu a putut fi înregistrat'); else { toast.success('Document trimis pentru verificare'); setDocumentTitle(''); await loadData(); }
    setUploading(false);
  };

  return (
    <MainLayout title="Spațiul Doctoral"><div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <PageHeader eyebrow="ICMPP · Doctoranzi" title="Parcursul meu doctoral" description={profile?.thesis_title || 'Profil academic'} icon={GraduationCap} />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Progres general</CardTitle></CardHeader><CardContent><div className="mb-2 flex items-end justify-between"><span className="text-3xl font-bold">{profile?.progress_percent || 0}%</span><span className="text-sm">Anul {profile?.study_year || '—'}</span></div><Progress value={profile?.progress_percent || 0} /></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm text-muted-foreground"><CalendarClock className="h-4 w-4" />Următorul termen</CardTitle></CardHeader><CardContent><p className="font-semibold">{nextMilestone?.title || 'Niciun termen stabilit'}</p>{nextMilestone?.due_date && <p className="mt-1 text-sm text-muted-foreground">{format(parseISO(nextMilestone.due_date), 'd MMMM yyyy', { locale: ro })} · {Math.max(0, differenceInCalendarDays(parseISO(nextMilestone.due_date), new Date()))} zile</p>}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm text-muted-foreground"><MessageCircle className="h-4 w-4" />Conducător doctorat</CardTitle></CardHeader><CardContent><p className="font-semibold">{profile?.coordinator_name || 'Nealocat'}</p><p className="mt-1 text-sm text-muted-foreground">{profile?.doctoral_school || 'Școala doctorală'}</p></CardContent></Card>
      </div>
      <Tabs defaultValue="journey"><TabsList className="mb-5 h-auto flex-wrap"><TabsTrigger value="journey">Parcurs și termene</TabsTrigger><TabsTrigger value="documents">Documentele mele</TabsTrigger></TabsList>
        <TabsContent value="journey"><div className="space-y-3">{milestones.length === 0 ? <div className="border-y border-border py-12 text-center text-muted-foreground"><BookOpenCheck className="mx-auto mb-3 h-9 w-9" /><p>Parcursul va apărea după stabilirea primelor termene.</p></div> : milestones.map((item) => <div key={item.id} className="flex items-start gap-4 border-b border-border py-4"><div className="mt-1 h-3 w-3 shrink-0 rounded-full bg-primary" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{item.title}</h3><Badge variant="outline">{statusLabel[item.status] || item.status}</Badge></div>{item.description && <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>}{item.due_date && <p className="mt-2 text-xs font-medium text-primary">Termen: {format(parseISO(item.due_date), 'd MMMM yyyy', { locale: ro })}</p>}</div></div>)}</div></TabsContent>
        <TabsContent value="documents"><div className="grid gap-6 lg:grid-cols-[340px_1fr]"><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileUp className="h-5 w-5" />Trimite un document</CardTitle></CardHeader><CardContent className="space-y-4"><div className="space-y-2"><Label htmlFor="doc-title">Denumire</Label><Input id="doc-title" value={documentTitle} onChange={(event) => setDocumentTitle(event.target.value)} placeholder="Ex: Raport anual" /></div><div className="space-y-2"><Label htmlFor="doc-file">Fișier PDF, Word sau imagine</Label><Input id="doc-file" type="file" accept=".pdf,.docx,image/png,image/jpeg" disabled={uploading} onChange={(event) => uploadDocument(event.target.files?.[0])} /></div><p className="text-xs text-muted-foreground"><Upload className="mr-1 inline h-3 w-3" />Fișierul este privat și vizibil doar persoanelor autorizate.</p></CardContent></Card><div className="space-y-2">{documents.map((doc) => <div key={doc.id} className="flex items-center justify-between gap-3 border-b border-border py-3"><div><p className="font-medium">{doc.title}</p><p className="text-xs text-muted-foreground">{doc.file_name} · {format(new Date(doc.created_at), 'dd.MM.yyyy')}</p></div><Badge variant="outline">{statusLabel[doc.status] || doc.status}</Badge></div>)}{documents.length === 0 && <p className="py-10 text-center text-muted-foreground">Nu ai încă documente încărcate.</p>}</div></div></TabsContent>
      </Tabs>
    </div></MainLayout>
  );
};

export default DoctoralDashboard;