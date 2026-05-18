import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ShieldAlert, FileText, Loader2, Paperclip, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { logSensitiveAction } from '@/lib/sensitiveActionAudit';

interface Incident {
  id: string;
  reporter_user_id: string;
  incident_type: string;
  description: string;
  occurred_at: string;
  attachment_path: string | null;
  status: string;
  severity: string;
  assigned_to: string | null;
  hr_relevant: boolean;
  resolution_notes: string | null;
  created_at: string;
}

const severityColor: Record<string, string> = {
  low: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30',
  medium: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
  high: 'bg-orange-500/10 text-orange-700 border-orange-500/30',
  critical: 'bg-red-500/10 text-red-700 border-red-500/30',
};

const statusLabel: Record<string, string> = {
  open: 'Deschis', triaging: 'În triere', in_progress: 'În lucru',
  resolved: 'Rezolvat', dismissed: 'Respins',
};

const IncidentsPanel = () => {
  const { toast } = useToast();
  const [items, setItems] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Incident | null>(null);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [newStatus, setNewStatus] = useState<string>('open');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const q = supabase.from('security_incidents').select('*').order('created_at', { ascending: false });
    const { data, error } = await q;
    if (error) toast({ title: 'Eroare', description: error.message, variant: 'destructive' });
    setItems((data as Incident[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const open = async (inc: Incident) => {
    setSelected(inc);
    setNotes(inc.resolution_notes ?? '');
    setNewStatus(inc.status);
    setAttachmentUrl(null);
    if (inc.attachment_path) {
      const { data } = await supabase.storage.from('security-incidents').createSignedUrl(inc.attachment_path, 60);
      setAttachmentUrl(data?.signedUrl ?? null);
    }
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const updates: Partial<Incident> = { status: newStatus, resolution_notes: notes || null };
      const { error } = await supabase.from('security_incidents').update(updates).eq('id', selected.id);
      if (error) throw error;
      await logSensitiveAction({
        action: 'incident_update',
        reason: `Status: ${selected.status} → ${newStatus}`,
        entity_type: 'security_incident',
        entity_id: selected.id,
        extra: { previous_status: selected.status, new_status: newStatus },
      });
      toast({ title: 'Salvat', description: 'Incident actualizat.' });
      setSelected(null);
      await load();
    } catch (e: unknown) {
      toast({ title: 'Eroare', description: (e as Error).message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const filtered = items.filter(i => statusFilter === 'all' || i.status === statusFilter);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-primary" /> Incidente de securitate
            </CardTitle>
            <CardDescription className="text-xs">Triere și gestionare incidente raportate de utilizatori.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toate</SelectItem>
                {Object.entries(statusLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={load} size="sm" variant="outline" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
            Niciun incident raportat.
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(i => (
              <button key={i.id} onClick={() => open(i)} className="w-full text-left p-3 border rounded-lg hover:bg-accent/40 transition-colors">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Badge variant="outline" className={severityColor[i.severity]}>{i.severity}</Badge>
                  <Badge variant="secondary" className="text-[10px]">{statusLabel[i.status] ?? i.status}</Badge>
                  <span className="text-xs text-muted-foreground">{i.incident_type}</span>
                  {i.attachment_path && <Paperclip className="w-3 h-3 text-muted-foreground" />}
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {format(new Date(i.created_at), "d MMM yyyy HH:mm", { locale: ro })}
                  </span>
                </div>
                <p className="text-sm line-clamp-2">{i.description}</p>
              </button>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Detalii incident</DialogTitle>
            <DialogDescription>
              {selected && format(new Date(selected.created_at), "d MMMM yyyy HH:mm", { locale: ro })} · {selected?.incident_type}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline" className={severityColor[selected.severity]}>Severitate: {selected.severity}</Badge>
                {selected.hr_relevant && <Badge variant="secondary">Relevant HR</Badge>}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Descriere</Label>
                <p className="text-sm mt-1 whitespace-pre-wrap p-2 bg-muted/40 rounded">{selected.description}</p>
              </div>
              {attachmentUrl && (
                <div>
                  <Label className="text-xs text-muted-foreground">Atașament (link valabil 60s)</Label>
                  <a href={attachmentUrl} target="_blank" rel="noreferrer" className="text-sm text-primary underline block mt-1">
                    Deschide atașament
                  </a>
                </div>
              )}
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Note rezolvare</Label>
                <Textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Închide</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvează
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default IncidentsPanel;
