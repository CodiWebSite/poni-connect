import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { ro } from 'date-fns/locale';
import { BookOpenCheck, CalendarClock, Check, Download, GraduationCap, MessageSquareText, Pencil, Plus, RotateCcw, Search, Trash2, Upload, Users, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useDoctoralCoordinator } from '@/hooks/useDoctoralCoordinator';
import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Student = {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  thesis_title: string | null;
  doctoral_school: string | null;
  study_year: number | null;
  start_date: string | null;
  expected_completion_date: string | null;
  progress_percent: number;
  status: string;
};
type Milestone = { id: string; title: string; description: string | null; due_date: string | null; status: string };
type DocumentRow = { id: string; title: string; file_name: string; storage_path: string; status: string; review_notes: string | null; created_at: string };
type Note = { id: string; body: string; visibility: string; created_at: string; author_id: string };

const statusLabel: Record<string, string> = { pending: 'În așteptare', submitted: 'Trimis', approved: 'Aprobat', changes_requested: 'Completări cerute', overdue: 'Depășit', rejected: 'Respins', active: 'Activ', in_progress: 'În lucru' };
const MANAGER_ROLES = ['super_admin', 'hr', 'sef_srus', 'director_institut', 'director_adjunct', 'secretar_stiintific'];

const DoctoralCoordinator = () => {
  const { user } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const { isCoordinator, loading: coordLoading } = useDoctoralCoordinator();
  const isManager = !!role && MANAGER_ROLES.includes(role);

  const [students, setStudents] = useState<Student[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [thesisForm, setThesisForm] = useState({ thesis_title: '', doctoral_school: '', study_year: '', expected_completion_date: '', progress_percent: '' });
  const [milestoneForm, setMilestoneForm] = useState({ title: '', description: '', due_date: '' });
  const [noteBody, setNoteBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [coordOptions, setCoordOptions] = useState<{ id: string; full_name: string; user_id: string | null }[]>([]);
  const [search, setSearch] = useState('');
  const [editingMilestone, setEditingMilestone] = useState<{ id: string; title: string; description: string; due_date: string } | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!isManager) return;
    supabase.from('doctoral_coordinators').select('id,full_name,user_id').eq('is_active', true).order('full_name')
      .then(({ data }) => setCoordOptions(data || []));
  }, [isManager]);

  const assignCoordinator = async (coordinatorId: string, profileId: string) => {
    const option = coordOptions.find((item) => item.id === coordinatorId);
    if (!option) return;
    const { error } = await supabase.from('doctoral_profiles')
      .update({ coordinator_user_id: option.user_id, coordinator_name: option.full_name })
      .eq('id', profileId);
    if (error) { toast.error('Conducătorul nu a putut fi alocat'); return; }
    toast.success(option.user_id ? 'Conducător alocat — are acum acces la doctorand' : 'Conducător alocat (fără cont conectat)');
    await loadStudents();
  };

  const selected = useMemo(() => students.find((item) => item.id === selectedId) || null, [students, selectedId]);

  const loadStudents = useCallback(async () => {
    if (!user) return;
    let query = supabase.from('doctoral_profiles')
      .select('id,user_id,full_name,email,thesis_title,doctoral_school,study_year,start_date,expected_completion_date,progress_percent,status')
      .order('full_name');
    if (!isManager) query = query.eq('coordinator_user_id', user.id);
    const { data, error } = await query;
    if (error) { toast.error('Doctoranzii nu au putut fi încărcați'); return; }
    const list = (data || []) as Student[];
    setStudents(list);
    setSelectedId((prev) => (prev && list.some((item) => item.id === prev) ? prev : list[0]?.id || null));
  }, [user, isManager]);

  const loadDetails = useCallback(async (profileId: string) => {
    const [{ data: milestoneData }, { data: documentData }, { data: noteData }] = await Promise.all([
      supabase.from('doctoral_milestones').select('id,title,description,due_date,status').eq('doctoral_profile_id', profileId).order('due_date', { nullsFirst: false }),
      supabase.from('doctoral_documents').select('id,title,file_name,storage_path,status,review_notes,created_at').eq('doctoral_profile_id', profileId).order('created_at', { ascending: false }),
      supabase.from('doctoral_notes').select('id,body,visibility,created_at,author_id').eq('doctoral_profile_id', profileId).order('created_at', { ascending: false }),
    ]);
    setMilestones((milestoneData || []) as Milestone[]);
    setDocuments((documentData || []) as DocumentRow[]);
    setNotes((noteData || []) as Note[]);
  }, []);

  useEffect(() => { loadStudents(); }, [loadStudents]);
  useEffect(() => {
    if (!selected) { setMilestones([]); setDocuments([]); setNotes([]); return; }
    setThesisForm({
      thesis_title: selected.thesis_title || '',
      doctoral_school: selected.doctoral_school || '',
      study_year: selected.study_year ? String(selected.study_year) : '',
      expected_completion_date: selected.expected_completion_date || '',
      progress_percent: String(selected.progress_percent ?? 0),
    });
    loadDetails(selected.id);
  }, [selected, loadDetails]);

  const notifyStudent = async (title: string, message: string, type = 'info') => {
    if (!selected) return;
    await supabase.rpc('notify_doctoral_student', { _profile_id: selected.id, _title: title, _message: message, _type: type });
  };

  const saveThesis = async () => {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase.from('doctoral_profiles').update({
      thesis_title: thesisForm.thesis_title.trim() || null,
      doctoral_school: thesisForm.doctoral_school.trim() || null,
      study_year: thesisForm.study_year ? Number(thesisForm.study_year) : null,
      expected_completion_date: thesisForm.expected_completion_date || null,
      progress_percent: Math.min(100, Math.max(0, Number(thesisForm.progress_percent) || 0)),
    }).eq('id', selected.id);
    setSaving(false);
    if (error) { toast.error('Modificările nu au putut fi salvate'); return; }
    toast.success('Datele tezei au fost actualizate');
    await notifyStudent('Teza ta a fost actualizată', 'Conducătorul de doctorat a actualizat datele parcursului tău doctoral.');
    await loadStudents();
  };

  const addMilestone = async () => {
    if (!selected || !user || !milestoneForm.title.trim()) { toast.error('Scrie titlul termenului'); return; }
    const { error } = await supabase.from('doctoral_milestones').insert({
      doctoral_profile_id: selected.id,
      title: milestoneForm.title.trim(),
      description: milestoneForm.description.trim() || null,
      due_date: milestoneForm.due_date || null,
      created_by: user.id,
    });
    if (error) { toast.error('Termenul nu a putut fi adăugat'); return; }
    toast.success('Termen adăugat');
    await notifyStudent('Termen nou în parcursul doctoral', `${milestoneForm.title.trim()}${milestoneForm.due_date ? ` · termen ${format(parseISO(milestoneForm.due_date), 'd MMMM yyyy', { locale: ro })}` : ''}`, 'warning');
    setMilestoneForm({ title: '', description: '', due_date: '' });
    await loadDetails(selected.id);
  };

  const setMilestoneStatus = async (milestone: Milestone, status: string) => {
    if (!selected) return;
    const { error } = await supabase.from('doctoral_milestones').update({ status, completed_at: status === 'approved' ? new Date().toISOString() : null }).eq('id', milestone.id);
    if (error) { toast.error('Statusul nu a putut fi salvat'); return; }
    await notifyStudent(status === 'approved' ? 'Etapă validată' : 'Etapă actualizată', `${milestone.title}: ${statusLabel[status] || status}`, status === 'approved' ? 'success' : 'info');
    await loadDetails(selected.id);
  };

  const reviewDocument = async (doc: DocumentRow, status: 'approved' | 'changes_requested') => {
    if (!selected || !user) return;
    let notes_text: string | null = doc.review_notes;
    if (status === 'changes_requested') {
      const input = window.prompt('Ce trebuie completat în document?', doc.review_notes || '');
      if (input === null) return;
      notes_text = input.trim() || null;
    }
    const { error } = await supabase.from('doctoral_documents').update({ status, review_notes: notes_text, reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq('id', doc.id);
    if (error) { toast.error('Verificarea nu a putut fi salvată'); return; }
    toast.success(status === 'approved' ? 'Document aprobat' : 'Ai cerut completări');
    await notifyStudent(status === 'approved' ? 'Document aprobat' : 'Document: completări cerute', `${doc.title}${notes_text ? ` — ${notes_text}` : ''}`, status === 'approved' ? 'success' : 'warning');
    await loadDetails(selected.id);
  };

  const openDocument = async (doc: DocumentRow) => {
    const { data, error } = await supabase.storage.from('doctoral-documents').createSignedUrl(doc.storage_path, 120);
    if (error || !data) { toast.error('Documentul nu a putut fi deschis'); return; }
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  const addNote = async (visibility: 'shared' | 'private') => {
    if (!selected || !user || !noteBody.trim()) { toast.error('Scrie mesajul'); return; }
    const { error } = await supabase.from('doctoral_notes').insert({ doctoral_profile_id: selected.id, author_id: user.id, body: noteBody.trim(), visibility });
    if (error) { toast.error('Nota nu a putut fi salvată'); return; }
    toast.success(visibility === 'shared' ? 'Feedback trimis doctorandului' : 'Notă privată salvată');
    if (visibility === 'shared') await notifyStudent('Feedback de la conducător', noteBody.trim().slice(0, 160), 'info');
    setNoteBody('');
    await loadDetails(selected.id);
  };

  const saveMilestoneEdit = async () => {
    if (!selected || !editingMilestone) return;
    if (!editingMilestone.title.trim()) { toast.error('Scrie titlul termenului'); return; }
    const { error } = await supabase.from('doctoral_milestones').update({
      title: editingMilestone.title.trim(),
      description: editingMilestone.description.trim() || null,
      due_date: editingMilestone.due_date || null,
    }).eq('id', editingMilestone.id);
    if (error) { toast.error('Termenul nu a putut fi modificat'); return; }
    toast.success('Termen actualizat');
    await notifyStudent('Termen actualizat', editingMilestone.title.trim(), 'info');
    setEditingMilestone(null);
    await loadDetails(selected.id);
  };

  const deleteMilestone = async (milestone: Milestone) => {
    if (!selected) return;
    if (!window.confirm(`Ștergi termenul „${milestone.title}”?`)) return;
    const { error } = await supabase.from('doctoral_milestones').delete().eq('id', milestone.id);
    if (error) { toast.error('Termenul nu a putut fi șters'); return; }
    toast.success('Termen șters');
    await loadDetails(selected.id);
  };

  const uploadDocument = async (file: File) => {
    if (!selected || !user) return;
    if (file.size > 20 * 1024 * 1024) { toast.error('Fișierul depășește 20 MB'); return; }
    setUploading(true);
    const safeName = file.name.replace(/[^\w.\-]+/g, '_');
    const path = `${selected.id}/${Date.now()}_${safeName}`;
    const { error: uploadError } = await supabase.storage.from('doctoral-documents').upload(path, file);
    if (uploadError) { setUploading(false); toast.error('Fișierul nu a putut fi încărcat'); return; }
    const { error } = await supabase.from('doctoral_documents').insert({
      doctoral_profile_id: selected.id,
      title: uploadTitle.trim() || file.name,
      file_name: file.name,
      storage_path: path,
      file_size: file.size,
      mime_type: file.type || null,
      status: 'approved',
      uploaded_by: user.id,
    });
    setUploading(false);
    if (error) {
      await supabase.storage.from('doctoral-documents').remove([path]);
      toast.error('Documentul nu a putut fi salvat');
      return;
    }
    toast.success('Document adăugat pentru doctorand');
    await notifyStudent('Document nou de la conducător', uploadTitle.trim() || file.name, 'info');
    setUploadTitle('');
    await loadDetails(selected.id);
  };

  const deleteDocument = async (doc: DocumentRow) => {
    if (!selected) return;
    if (!window.confirm(`Ștergi documentul „${doc.title}”?`)) return;
    const { error } = await supabase.from('doctoral_documents').delete().eq('id', doc.id);
    if (error) { toast.error('Documentul nu a putut fi șters'); return; }
    await supabase.storage.from('doctoral-documents').remove([doc.storage_path]);
    toast.success('Document șters');
    await loadDetails(selected.id);
  };

  const changeStudentStatus = async (status: string) => {
    if (!selected) return;
    const labels: Record<string, string> = { active: 'activ', suspended: 'suspendat', completed: 'finalizat' };
    if (!window.confirm(`Marchezi parcursul lui ${selected.full_name} ca ${labels[status] || status}?`)) return;
    const { error } = await supabase.from('doctoral_profiles').update({ status }).eq('id', selected.id);
    if (error) { toast.error('Statusul nu a putut fi schimbat'); return; }
    toast.success('Status actualizat');
    await notifyStudent('Statusul parcursului doctoral a fost actualizat', `Parcursul tău este acum: ${labels[status] || status}.`, status === 'completed' ? 'success' : 'info');
    await loadStudents();
  };

  const deleteNote = async (note: Note) => {
    if (!selected) return;
    if (!window.confirm('Ștergi această notă?')) return;
    const { error } = await supabase.from('doctoral_notes').delete().eq('id', note.id);
    if (error) { toast.error('Nota nu a putut fi ștearsă'); return; }
    await loadDetails(selected.id);
  };

  if (!roleLoading && !coordLoading && !isCoordinator && !isManager) return <Navigate to="/" replace />;

  const nextMilestone = milestones.find((item) => item.status !== 'approved');
  const pendingDocs = documents.filter((item) => item.status === 'submitted').length;
  const query = search.trim().toLowerCase();
  const visibleStudents = query
    ? students.filter((item) => `${item.full_name} ${item.thesis_title || ''} ${item.email}`.toLowerCase().includes(query))
    : students;

  return (
    <MainLayout title="Doctoranzii mei">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <PageHeader
          eyebrow="ICMPP · Conducere doctorat"
          title="Doctoranzii mei"
          description="Teza, termenele, documentele și feedbackul doctoranzilor alocați"
          icon={GraduationCap}
        />

        {students.length === 0 ? (
          <Card><CardContent className="py-16 text-center text-muted-foreground">
            <Users className="mx-auto mb-3 h-10 w-10" />
            <p>Nu ai încă doctoranzi alocați. Vor apărea aici imediat ce te selectează la înregistrare.</p>
          </CardContent></Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
            <div className="space-y-2">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Caută doctorand sau temă" className="pl-9" />
              </div>
              {visibleStudents.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Niciun rezultat.</p>}
              {visibleStudents.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={cn('w-full rounded-xl border p-3 text-left transition-colors', selectedId === item.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-semibold">{item.full_name}</p>
                    <Badge variant="outline">{item.progress_percent}%</Badge>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{item.thesis_title || 'Temă necompletată'}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Anul {item.study_year || '—'} · {statusLabel[item.status] || item.status}</p>
                </button>
              ))}
            </div>

            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Progres teză</CardTitle></CardHeader><CardContent>
                  <div className="mb-2 flex items-end justify-between"><span className="text-3xl font-bold">{selected?.progress_percent ?? 0}%</span><span className="text-sm">Anul {selected?.study_year || '—'}</span></div>
                  <Progress value={selected?.progress_percent ?? 0} />
                </CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm text-muted-foreground"><CalendarClock className="h-4 w-4" />Următorul termen</CardTitle></CardHeader><CardContent>
                  <p className="font-semibold">{nextMilestone?.title || 'Niciun termen stabilit'}</p>
                  {nextMilestone?.due_date && <p className="mt-1 text-sm text-muted-foreground">{format(parseISO(nextMilestone.due_date), 'd MMMM yyyy', { locale: ro })} · {Math.max(0, differenceInCalendarDays(parseISO(nextMilestone.due_date), new Date()))} zile</p>}
                </CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm text-muted-foreground"><BookOpenCheck className="h-4 w-4" />De verificat</CardTitle></CardHeader><CardContent>
                  <p className="text-3xl font-bold">{pendingDocs}</p>
                  <p className="mt-1 text-sm text-muted-foreground">documente trimise</p>
                </CardContent></Card>
              </div>

              <Tabs defaultValue="thesis">
                <TabsList className="mb-5 h-auto flex-wrap">
                  <TabsTrigger value="thesis">Teza</TabsTrigger>
                  <TabsTrigger value="milestones">Termene</TabsTrigger>
                  <TabsTrigger value="documents">Documente {pendingDocs > 0 && <Badge className="ml-2">{pendingDocs}</Badge>}</TabsTrigger>
                  <TabsTrigger value="feedback">Feedback</TabsTrigger>
                </TabsList>

                <TabsContent value="thesis">
                  <Card><CardContent className="space-y-4 pt-6">
                    <div className="space-y-2"><Label htmlFor="thesis">Titlul tezei</Label><Input id="thesis" value={thesisForm.thesis_title} onChange={(e) => setThesisForm({ ...thesisForm, thesis_title: e.target.value })} /></div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2"><Label htmlFor="school">Școala doctorală</Label><Input id="school" value={thesisForm.doctoral_school} onChange={(e) => setThesisForm({ ...thesisForm, doctoral_school: e.target.value })} /></div>
                      <div className="space-y-2"><Label htmlFor="year">An de studiu</Label><Input id="year" type="number" min={1} max={6} value={thesisForm.study_year} onChange={(e) => setThesisForm({ ...thesisForm, study_year: e.target.value })} /></div>
                      <div className="space-y-2"><Label htmlFor="deadline">Termen estimat de finalizare</Label><Input id="deadline" type="date" value={thesisForm.expected_completion_date} onChange={(e) => setThesisForm({ ...thesisForm, expected_completion_date: e.target.value })} /></div>
                      <div className="space-y-2"><Label htmlFor="progress">Progres (%)</Label><Input id="progress" type="number" min={0} max={100} value={thesisForm.progress_percent} onChange={(e) => setThesisForm({ ...thesisForm, progress_percent: e.target.value })} /></div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={saveThesis} disabled={saving}>{saving ? 'Se salvează...' : 'Salvează modificările'}</Button>
                      <select
                        aria-label="Stare parcurs doctoral"
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                        value={selected?.status || ''}
                        onChange={(event) => changeStudentStatus(event.target.value)}
                      >
                        <option value="active">Parcurs activ</option>
                        <option value="suspended">Suspendat</option>
                        <option value="completed">Finalizat</option>
                      </select>
                      {isManager && selected && (
                        <select
                          aria-label="Alocă conducător de doctorat"
                          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                          value=""
                          onChange={(event) => assignCoordinator(event.target.value, selected.id)}
                        >
                          <option value="">Alocă alt conducător...</option>
                          {coordOptions.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}
                        </select>
                      )}
                      <p className="self-center text-xs text-muted-foreground">{selected?.email} · început {selected?.start_date ? format(parseISO(selected.start_date), 'd MMM yyyy', { locale: ro }) : '—'}</p>
                    </div>
                  </CardContent></Card>
                </TabsContent>

                <TabsContent value="milestones">
                  <Card className="mb-4"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Plus className="h-4 w-4" />Adaugă un termen</CardTitle></CardHeader><CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
                      <div className="space-y-2"><Label htmlFor="ms-title">Titlu</Label><Input id="ms-title" value={milestoneForm.title} onChange={(e) => setMilestoneForm({ ...milestoneForm, title: e.target.value })} placeholder="Ex: Raport de cercetare anual" /></div>
                      <div className="space-y-2"><Label htmlFor="ms-date">Termen</Label><Input id="ms-date" type="date" value={milestoneForm.due_date} onChange={(e) => setMilestoneForm({ ...milestoneForm, due_date: e.target.value })} /></div>
                    </div>
                    <div className="space-y-2"><Label htmlFor="ms-desc">Detalii</Label><Textarea id="ms-desc" rows={2} value={milestoneForm.description} onChange={(e) => setMilestoneForm({ ...milestoneForm, description: e.target.value })} /></div>
                    <Button onClick={addMilestone}>Adaugă termen</Button>
                  </CardContent></Card>
                  <div className="space-y-2">
                    {milestones.length === 0 && <p className="py-10 text-center text-muted-foreground">Niciun termen stabilit deocamdată.</p>}
                    {milestones.map((item) => (
                      <div key={item.id} className="flex flex-wrap items-start justify-between gap-3 border-b border-border py-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{item.title}</p><Badge variant="outline">{statusLabel[item.status] || item.status}</Badge></div>
                          {item.description && <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>}
                          {item.due_date && <p className="mt-1 text-xs font-medium text-primary">Termen: {format(parseISO(item.due_date), 'd MMMM yyyy', { locale: ro })}</p>}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {item.status !== 'approved'
                            ? <Button size="sm" onClick={() => setMilestoneStatus(item, 'approved')}><Check className="mr-1 h-4 w-4" />Validează</Button>
                            : <Button size="sm" variant="outline" onClick={() => setMilestoneStatus(item, 'in_progress')}><RotateCcw className="mr-1 h-4 w-4" />Redeschide</Button>}
                          <Button size="sm" variant="outline" onClick={() => setEditingMilestone({ id: item.id, title: item.title, description: item.description || '', due_date: item.due_date || '' })}><Pencil className="mr-1 h-4 w-4" />Modifică</Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteMilestone(item)}><Trash2 className="mr-1 h-4 w-4" />Șterge</Button>
                        </div>
                        {editingMilestone?.id === item.id && (
                          <div className="w-full space-y-3 rounded-xl border border-primary/40 bg-primary/5 p-4">
                            <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
                              <div className="space-y-2"><Label htmlFor={`edit-title-${item.id}`}>Titlu</Label><Input id={`edit-title-${item.id}`} value={editingMilestone.title} onChange={(e) => setEditingMilestone({ ...editingMilestone, title: e.target.value })} /></div>
                              <div className="space-y-2"><Label htmlFor={`edit-date-${item.id}`}>Termen</Label><Input id={`edit-date-${item.id}`} type="date" value={editingMilestone.due_date} onChange={(e) => setEditingMilestone({ ...editingMilestone, due_date: e.target.value })} /></div>
                            </div>
                            <div className="space-y-2"><Label htmlFor={`edit-desc-${item.id}`}>Detalii</Label><Textarea id={`edit-desc-${item.id}`} rows={2} value={editingMilestone.description} onChange={(e) => setEditingMilestone({ ...editingMilestone, description: e.target.value })} /></div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={saveMilestoneEdit}><Check className="mr-1 h-4 w-4" />Salvează</Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingMilestone(null)}><X className="mr-1 h-4 w-4" />Renunță</Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="documents">
                  <Card className="mb-4"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Upload className="h-4 w-4" />Încarcă un document pentru doctorand</CardTitle></CardHeader><CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                      <div className="space-y-2"><Label htmlFor="doc-title">Titlu document</Label><Input id="doc-title" value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} placeholder="Ex: Fișă de evaluare anuală" /></div>
                      <div className="space-y-2">
                        <Label htmlFor="doc-file">Fișier (max. 20 MB)</Label>
                        <Input
                          id="doc-file"
                          type="file"
                          disabled={uploading}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.target.value = '';
                            if (file) uploadDocument(file);
                          }}
                        />
                      </div>
                    </div>
                    {uploading && <p className="text-sm text-muted-foreground">Se încarcă documentul...</p>}
                  </CardContent></Card>
                  <div className="space-y-2">
                    {documents.length === 0 && <p className="py-10 text-center text-muted-foreground">Nu există încă documente.</p>}
                    {documents.map((doc) => (
                      <div key={doc.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2"><p className="font-medium">{doc.title}</p><Badge variant="outline">{statusLabel[doc.status] || doc.status}</Badge></div>
                          <p className="mt-1 text-xs text-muted-foreground">{doc.file_name} · {format(new Date(doc.created_at), 'dd.MM.yyyy')}</p>
                          {doc.review_notes && <p className="mt-1 text-xs text-amber-600">Observații: {doc.review_notes}</p>}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => openDocument(doc)}><Download className="mr-1 h-4 w-4" />Deschide</Button>
                          <Button size="sm" variant="outline" onClick={() => reviewDocument(doc, 'changes_requested')}><MessageSquareText className="mr-1 h-4 w-4" />Completări</Button>
                          {doc.status !== 'approved' && <Button size="sm" onClick={() => reviewDocument(doc, 'approved')}><Check className="mr-1 h-4 w-4" />Aprobă</Button>}
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteDocument(doc)}><Trash2 className="mr-1 h-4 w-4" />Șterge</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="feedback">
                  <Card className="mb-4"><CardContent className="space-y-3 pt-6">
                    <Label htmlFor="note">Mesaj pentru doctorand sau notă proprie</Label>
                    <Textarea id="note" rows={3} value={noteBody} onChange={(e) => setNoteBody(e.target.value)} placeholder="Observații despre capitolul curent, recomandări bibliografice..." />
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => addNote('shared')}>Trimite doctorandului</Button>
                      <Button variant="outline" onClick={() => addNote('private')}>Salvează doar pentru mine</Button>
                    </div>
                  </CardContent></Card>
                  <div className="space-y-2">
                    {notes.length === 0 && <p className="py-10 text-center text-muted-foreground">Nu există încă note sau feedback.</p>}
                    {notes.map((note) => (
                      <div key={note.id} className="border-b border-border py-4">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant={note.visibility === 'shared' ? 'default' : 'secondary'}>{note.visibility === 'shared' ? 'Trimis doctorandului' : 'Notă privată'}</Badge>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{format(new Date(note.created_at), 'dd.MM.yyyy HH:mm')}</span>
                            {(note.author_id === user?.id || isManager) && (
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={() => deleteNote(note)}><Trash2 className="h-3.5 w-3.5" /></Button>
                            )}
                          </div>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm">{note.body}</p>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default DoctoralCoordinator;
