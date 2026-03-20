import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Route, Plus, Trash2, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin', admin: 'Admin', director_institut: 'Director',
  director_adjunct: 'Dir. Adjunct', secretar_stiintific: 'Secretar Șt.',
  sef_srus: 'Șef SRUS', sef: 'Șef Dept.', hr: 'HR',
  bibliotecar: 'Bibliotecar', salarizare: 'Salarizare', secretariat: 'Secretariat',
  achizitii: 'Achiziții', contabilitate: 'Contabilitate', oficiu_juridic: 'Oficiu Juridic',
  compartiment_comunicare: 'Comunicare', medic_medicina_muncii: 'Medic MM', user: 'Angajat',
};

interface RoutingRule {
  id: string;
  request_type: string;
  request_label: string;
  target_role: string;
  target_department: string | null;
  description: string | null;
  is_active: boolean;
}

const RequestRoutingEditor = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newRule, setNewRule] = useState({ request_type: '', request_label: '', target_role: 'hr', description: '' });

  useEffect(() => { fetchRules(); }, []);

  const fetchRules = async () => {
    setLoading(true);
    const { data } = await supabase.from('request_routing_rules').select('*').order('request_type');
    setRules((data || []) as RoutingRule[]);
    setLoading(false);
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from('request_routing_rules').update({ is_active: !current }).eq('id', id);
    setRules(prev => prev.map(r => r.id === id ? { ...r, is_active: !current } : r));
  };

  const updateField = async (id: string, field: string, value: string) => {
    await supabase.from('request_routing_rules').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', id);
    setRules(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const createRule = async () => {
    if (!newRule.request_type || !newRule.request_label) return;
    setSaving(true);
    const { data, error } = await supabase.from('request_routing_rules').insert({
      request_type: newRule.request_type,
      request_label: newRule.request_label,
      target_role: newRule.target_role,
      description: newRule.description || null,
    }).select().single();
    if (!error && data) {
      setRules(prev => [...prev, data as RoutingRule]);
      setShowNewDialog(false);
      setNewRule({ request_type: '', request_label: '', target_role: 'hr', description: '' });
      toast({ title: 'Succes', description: 'Regulă de rutare creată.' });
    }
    setSaving(false);
  };

  const deleteRule = async (id: string) => {
    await supabase.from('request_routing_rules').delete().eq('id', id);
    setRules(prev => prev.filter(r => r.id !== id));
    toast({ title: 'Șters', description: 'Regula a fost eliminată.' });
  };

  if (loading) {
    return <Card><CardContent className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Route className="w-5 h-5 text-primary" />
                Rutare Cereri
              </CardTitle>
              <CardDescription>Definește către cine ajunge fiecare tip de cerere</CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowNewDialog(true)}>
              <Plus className="w-4 h-4 mr-1" />Regulă Nouă
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {rules.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nu există reguli de rutare.</p>
          ) : (
            rules.map(rule => (
              <div key={rule.id} className={`p-4 rounded-lg border transition-opacity ${rule.is_active ? '' : 'opacity-50'}`}>
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                        {rule.request_label}
                      </Badge>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      <Select value={rule.target_role} onValueChange={v => updateField(rule.id, 'target_role', v)}>
                        <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(ROLE_LABELS).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {rule.description && <p className="text-xs text-muted-foreground mt-1">{rule.description}</p>}
                  </div>
                  <Switch checked={rule.is_active} onCheckedChange={() => toggleActive(rule.id, rule.is_active)} />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteRule(rule.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Regulă de Rutare Nouă</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Etichetă cerere</Label>
              <Input value={newRule.request_label} onChange={e => setNewRule(p => ({ ...p, request_label: e.target.value }))} placeholder="ex: Cerere Delegare" />
            </div>
            <div>
              <Label>Tip cerere (identificator)</Label>
              <Input value={newRule.request_type} onChange={e => setNewRule(p => ({ ...p, request_type: e.target.value }))} placeholder="ex: delegare" />
            </div>
            <div>
              <Label>Rol destinatar</Label>
              <Select value={newRule.target_role} onValueChange={v => setNewRule(p => ({ ...p, target_role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descriere (opțional)</Label>
              <Textarea value={newRule.description} onChange={e => setNewRule(p => ({ ...p, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>Anulează</Button>
            <Button onClick={createRule} disabled={saving || !newRule.request_type || !newRule.request_label}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Creează
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RequestRoutingEditor;
