import { useEffect, useState } from 'react';
import { Check, GraduationCap, MessageSquareText, Search, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

type Application = { id: string; full_name: string; email: string; doctoral_school: string | null; thesis_title: string | null; study_year: number | null; coordinator_name: string | null; status: string; created_at: string; admin_notes: string | null };

const statusLabels: Record<string, string> = { pending: 'Cerere nouă', active: 'Activ', changes_requested: 'Completări', rejected: 'Respins', suspended: 'Suspendat', completed: 'Finalizat' };

const DoctoralApplicationsPanel = () => {
  const [rows, setRows] = useState<Application[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Application | null>(null);
  const [decision, setDecision] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.from('doctoral_profiles').select('id,full_name,email,doctoral_school,thesis_title,study_year,coordinator_name,status,created_at,admin_notes').order('created_at', { ascending: false });
    if (error) toast.error('Cererile doctoranzilor nu au putut fi încărcate'); else setRows(data || []);
  };
  useEffect(() => { load(); }, []);
  const filtered = rows.filter((row) => `${row.full_name} ${row.email} ${row.coordinator_name || ''}`.toLowerCase().includes(search.toLowerCase()));

  const openDecision = (row: Application, value: string) => { setSelected(row); setDecision(value); setNotes(value === 'active' ? 'Cerere verificată și aprobată.' : row.admin_notes || ''); };
  const submit = async () => {
    if (!selected || ((decision === 'changes_requested' || decision === 'rejected') && !notes.trim())) return;
    setSaving(true);
    const { error } = await supabase.rpc('review_doctoral_application', { _profile_id: selected.id, _decision: decision, _notes: notes.trim() || null });
    if (error) toast.error(error.message.includes('confirmată') ? 'Doctorandul trebuie să confirme mai întâi adresa @icmpp.ro.' : 'Decizia nu a putut fi salvată');
    else { toast.success('Cererea a fost actualizată'); setSelected(null); await load(); }
    setSaving(false);
  };

  return <div className="space-y-5">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><div className="flex items-center gap-2"><GraduationCap className="h-5 w-5 text-primary" /><h2 className="font-display text-xl font-bold">Doctoranzi</h2></div><p className="mt-1 text-sm text-muted-foreground">Verifică cererile și administrează accesul în Spațiul Doctoral.</p></div><div className="relative w-full sm:w-72"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Caută doctorand..." className="pl-9" /></div></div>
    <div className="overflow-hidden border-y border-border">{filtered.map((row) => <article key={row.id} className="grid gap-4 border-b border-border px-1 py-5 last:border-0 lg:grid-cols-[1.1fr_1fr_auto] lg:items-center"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{row.full_name}</p><Badge variant={row.status === 'pending' ? 'default' : 'outline'}>{statusLabels[row.status] || row.status}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{row.email} · Anul {row.study_year || '—'}</p></div><div><p className="text-sm font-medium">{row.thesis_title || 'Tema necompletată'}</p><p className="mt-1 text-xs text-muted-foreground">Coordonator: {row.coordinator_name || 'nealocat'} · {row.doctoral_school || 'școală necompletată'}</p></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => openDecision(row, 'changes_requested')}><MessageSquareText className="mr-1 h-4 w-4" />Completări</Button>{row.status !== 'active' && <Button size="sm" onClick={() => openDecision(row, 'active')}><Check className="mr-1 h-4 w-4" />Aprobă</Button>}<Button size="icon" variant="ghost" className="text-destructive" aria-label="Respinge cererea" onClick={() => openDecision(row, 'rejected')}><X className="h-4 w-4" /></Button></div></article>)}{filtered.length === 0 && <p className="py-12 text-center text-muted-foreground">Nu există cereri care corespund căutării.</p>}</div>
    <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}><DialogContent><DialogHeader><DialogTitle>{decision === 'active' ? 'Aprobă accesul' : decision === 'rejected' ? 'Respinge cererea' : 'Solicită completări'}</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">{selected?.full_name}</p><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Mesaj pentru doctorand..." rows={5} /><DialogFooter><Button variant="outline" onClick={() => setSelected(null)}>Renunță</Button><Button variant={decision === 'rejected' ? 'destructive' : 'default'} onClick={submit} disabled={saving || ((decision === 'changes_requested' || decision === 'rejected') && !notes.trim())}>Confirmă</Button></DialogFooter></DialogContent></Dialog>
  </div>;
};

export default DoctoralApplicationsPanel;