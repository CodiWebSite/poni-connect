import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScrollText, Loader2, RefreshCw, UserPlus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInDays } from 'date-fns';
import { ro } from 'date-fns/locale';
import { logSensitiveAction } from '@/lib/sensitiveActionAudit';

interface GdprReq {
  id: string; user_id: string; request_type: string; description: string | null;
  status: string; handled_by: string | null; response: string | null;
  created_at: string; closed_at: string | null;
}
interface Officer { user_id: string; assigned_at: string; notes: string | null; }

const typeLabel: Record<string, string> = {
  access: 'Acces date', rectification: 'Rectificare', restriction: 'Restricționare',
  deletion: 'Ștergere', portability: 'Portabilitate', complaint: 'Reclamație',
};
const statusLabel: Record<string, string> = {
  open: 'Deschis', in_progress: 'În lucru', closed: 'Închis', rejected: 'Respins',
};

const GdprPanel = () => {
  const { toast } = useToast();
  const [reqs, setReqs] = useState<GdprReq[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<GdprReq | null>(null);
  const [response, setResponse] = useState('');
  const [newStatus, setNewStatus] = useState('open');
  const [saving, setSaving] = useState(false);
  const [newOfficerEmail, setNewOfficerEmail] = useState('');

  const load = async () => {
    setLoading(true);
    const [r1, r2] = await Promise.all([
      supabase.from('gdpr_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('gdpr_officers').select('*'),
    ]);
    if (r1.error) toast({ title: 'Eroare cereri', description: r1.error.message, variant: 'destructive' });
    if (r2.error) toast({ title: 'Eroare DPO', description: r2.error.message, variant: 'destructive' });
    setReqs((r1.data as GdprReq[]) ?? []);
    setOfficers((r2.data as Officer[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const open = (r: GdprReq) => {
    setSelected(r); setResponse(r.response ?? ''); setNewStatus(r.status);
    // Audit access to GDPR request
    void logSensitiveAction({
      action: 'gdpr_request_viewed', reason: 'Vizualizare cerere GDPR',
      entity_type: 'gdpr_request', entity_id: r.id,
    });
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const upd: Partial<GdprReq> = {
        status: newStatus, response: response || null,
        closed_at: newStatus === 'closed' || newStatus === 'rejected' ? new Date().toISOString() : null,
      };
      const { error } = await supabase.from('gdpr_requests').update(upd).eq('id', selected.id);
      if (error) throw error;
      await logSensitiveAction({
        action: 'gdpr_request_update', reason: `Status: ${selected.status} → ${newStatus}`,
        entity_type: 'gdpr_request', entity_id: selected.id,
      });
      toast({ title: 'Salvat' });
      setSelected(null); await load();
    } catch (e) { toast({ title: 'Eroare', description: (e as Error).message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const addOfficer = async () => {
    if (!newOfficerEmail.trim()) return;
    try {
      // Lookup user via profiles isn't possible by email; require an existing profile-aware path. Use auth admin via RPC? Skip: ask user_id.
      const { data: prof } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .ilike('full_name', `%${newOfficerEmail.trim()}%`)
        .limit(1)
        .maybeSingle();
      if (!prof) throw new Error('Utilizator negăsit (caută după nume complet)');
      const { error } = await supabase.from('gdpr_officers').insert({ user_id: prof.user_id, notes: `Adăugat manual: ${newOfficerEmail}` });
      if (error) throw error;
      await logSensitiveAction({ action: 'gdpr_officer_added', reason: `Adăugare DPO: ${prof.full_name}`, entity_type: 'gdpr_officer', entity_id: prof.user_id });
      setNewOfficerEmail(''); await load();
      toast({ title: 'DPO adăugat' });
    } catch (e) { toast({ title: 'Eroare', description: (e as Error).message, variant: 'destructive' }); }
  };

  const removeOfficer = async (uid: string) => {
    if (!confirm('Sigur eliminăm acest DPO?')) return;
    const { error } = await supabase.from('gdpr_officers').delete().eq('user_id', uid);
    if (error) return toast({ title: 'Eroare', description: error.message, variant: 'destructive' });
    await logSensitiveAction({ action: 'gdpr_officer_removed', reason: 'Eliminare DPO', entity_type: 'gdpr_officer', entity_id: uid });
    await load();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2"><ScrollText className="w-4 h-4 text-primary" />Cereri GDPR</CardTitle>
              <CardDescription className="text-xs">SLA 30 zile · vizibil doar pentru Super Admin și DPO desemnați.</CardDescription>
            </div>
            <Button onClick={load} size="sm" variant="outline" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {reqs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nicio cerere GDPR.</p>
          ) : (
            <div className="space-y-2">
              {reqs.map(r => {
                const days = differenceInDays(new Date(), new Date(r.created_at));
                const overdue = days > 30 && !r.closed_at;
                return (
                  <button key={r.id} onClick={() => open(r)} className="w-full text-left p-3 border rounded-lg hover:bg-accent/40">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant="outline">{typeLabel[r.request_type] ?? r.request_type}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{statusLabel[r.status] ?? r.status}</Badge>
                      {overdue && <Badge variant="destructive" className="text-[10px]">SLA depășit ({days}z)</Badge>}
                      <span className="ml-auto text-[11px] text-muted-foreground">
                        {format(new Date(r.created_at), "d MMM yyyy", { locale: ro })}
                      </span>
                    </div>
                    {r.description && <p className="text-sm line-clamp-2 text-muted-foreground">{r.description}</p>}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">DPO desemnați</CardTitle>
          <CardDescription className="text-xs">Persoane autorizate să gestioneze cererile GDPR (în plus față de Super Admin).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-3">
            <Input placeholder="Nume complet utilizator" value={newOfficerEmail} onChange={e => setNewOfficerEmail(e.target.value)} />
            <Button onClick={addOfficer} size="sm"><UserPlus className="w-4 h-4 mr-1" />Adaugă</Button>
          </div>
          {officers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Niciun DPO desemnat.</p>
          ) : (
            <div className="space-y-1">
              {officers.map(o => (
                <div key={o.user_id} className="flex items-center justify-between p-2 border rounded text-sm">
                  <span className="font-mono text-xs">{o.user_id}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{format(new Date(o.assigned_at), 'd MMM yyyy', { locale: ro })}</span>
                    <Button size="sm" variant="ghost" onClick={() => removeOfficer(o.user_id)}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Cerere GDPR</DialogTitle>
            <DialogDescription>
              {selected && typeLabel[selected.request_type]} · {selected && format(new Date(selected.created_at), 'd MMM yyyy HH:mm', { locale: ro })}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3">
              {selected.description && (
                <div>
                  <Label className="text-xs text-muted-foreground">Solicitare</Label>
                  <p className="text-sm mt-1 p-2 bg-muted/40 rounded whitespace-pre-wrap">{selected.description}</p>
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
                <Label className="text-xs">Răspuns / acțiuni întreprinse</Label>
                <Textarea rows={4} value={response} onChange={e => setResponse(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Închide</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvează</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GdprPanel;
