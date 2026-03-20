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
import { Loader2, Bell, Plus, Trash2, Mail, BellRing } from 'lucide-react';
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

const CHANNEL_LABELS: Record<string, { label: string; icon: typeof Bell }> = {
  in_app: { label: 'Notificare în aplicație', icon: BellRing },
  email: { label: 'Email', icon: Mail },
  both: { label: 'Ambele', icon: Bell },
};

const RECIPIENT_TYPES: Record<string, string> = {
  role: 'Rol specific',
  requester: 'Solicitantul',
  approver: 'Aprobatorul desemnat',
  department: 'Tot departamentul',
};

interface NotificationRule {
  id: string;
  name: string;
  trigger_event: string;
  trigger_label: string;
  recipient_role: string | null;
  recipient_type: string;
  channel: string;
  message_template: string | null;
  is_active: boolean;
}

const NotificationRulesEditor = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newRule, setNewRule] = useState({
    name: '', trigger_event: '', trigger_label: '',
    recipient_role: 'hr', recipient_type: 'role', channel: 'in_app', message_template: '',
  });

  useEffect(() => { fetchRules(); }, []);

  const fetchRules = async () => {
    setLoading(true);
    const { data } = await supabase.from('notification_rules').select('*').order('trigger_event');
    setRules((data || []) as NotificationRule[]);
    setLoading(false);
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from('notification_rules').update({ is_active: !current }).eq('id', id);
    setRules(prev => prev.map(r => r.id === id ? { ...r, is_active: !current } : r));
  };

  const updateField = async (id: string, field: string, value: string | null) => {
    await supabase.from('notification_rules').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', id);
    setRules(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const createRule = async () => {
    if (!newRule.name || !newRule.trigger_event) return;
    setSaving(true);
    const { data, error } = await supabase.from('notification_rules').insert({
      name: newRule.name,
      trigger_event: newRule.trigger_event,
      trigger_label: newRule.trigger_label || newRule.name,
      recipient_role: newRule.recipient_type === 'role' ? newRule.recipient_role : null,
      recipient_type: newRule.recipient_type,
      channel: newRule.channel,
      message_template: newRule.message_template || null,
    }).select().single();
    if (!error && data) {
      setRules(prev => [...prev, data as NotificationRule]);
      setShowNewDialog(false);
      setNewRule({ name: '', trigger_event: '', trigger_label: '', recipient_role: 'hr', recipient_type: 'role', channel: 'in_app', message_template: '' });
      toast({ title: 'Succes', description: 'Regulă de notificare creată.' });
    }
    setSaving(false);
  };

  const deleteRule = async (id: string) => {
    await supabase.from('notification_rules').delete().eq('id', id);
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
                <Bell className="w-5 h-5 text-primary" />
                Reguli de Notificare
              </CardTitle>
              <CardDescription>Configurează ce notificări pleacă, către cine și pe ce canal</CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowNewDialog(true)}>
              <Plus className="w-4 h-4 mr-1" />Regulă Nouă
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {rules.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nu există reguli de notificare.</p>
          ) : (
            rules.map(rule => {
              const ChannelIcon = CHANNEL_LABELS[rule.channel]?.icon || Bell;
              const isEditing = editingId === rule.id;
              return (
                <div key={rule.id} className={`p-4 rounded-lg border transition-opacity ${rule.is_active ? '' : 'opacity-50'}`}>
                  <div className="flex items-start gap-3">
                    <ChannelIcon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{rule.name}</span>
                        <Badge variant="outline" className="text-[10px]">{rule.trigger_label}</Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {CHANNEL_LABELS[rule.channel]?.label || rule.channel}
                        </Badge>
                      </div>

                      {isEditing ? (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                          <div>
                            <Label className="text-xs">Destinatar</Label>
                            <Select value={rule.recipient_type} onValueChange={v => updateField(rule.id, 'recipient_type', v)}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {Object.entries(RECIPIENT_TYPES).map(([k, v]) => (
                                  <SelectItem key={k} value={k}>{v}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {rule.recipient_type === 'role' && (
                            <div>
                              <Label className="text-xs">Rol</Label>
                              <Select value={rule.recipient_role || 'hr'} onValueChange={v => updateField(rule.id, 'recipient_role', v)}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {Object.entries(ROLE_LABELS).map(([k, v]) => (
                                    <SelectItem key={k} value={k}>{v}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          <div>
                            <Label className="text-xs">Canal</Label>
                            <Select value={rule.channel} onValueChange={v => updateField(rule.id, 'channel', v)}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {Object.entries(CHANNEL_LABELS).map(([k, v]) => (
                                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Către: <span className="font-medium">
                            {rule.recipient_type === 'role' ? (ROLE_LABELS[rule.recipient_role || ''] || rule.recipient_role) : RECIPIENT_TYPES[rule.recipient_type]}
                          </span>
                          {rule.message_template && <> — {rule.message_template}</>}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingId(isEditing ? null : rule.id)}>
                        {isEditing ? 'Închide' : 'Editează'}
                      </Button>
                      <Switch checked={rule.is_active} onCheckedChange={() => toggleActive(rule.id, rule.is_active)} />
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteRule(rule.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Regulă de Notificare Nouă</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nume regulă</Label>
              <Input value={newRule.name} onChange={e => setNewRule(p => ({ ...p, name: e.target.value }))} placeholder="ex: Alertă expiare CI" />
            </div>
            <div>
              <Label>Eveniment declanșator (identificator)</Label>
              <Input value={newRule.trigger_event} onChange={e => setNewRule(p => ({ ...p, trigger_event: e.target.value }))} placeholder="ex: ci_expiry_warning" />
            </div>
            <div>
              <Label>Etichetă eveniment</Label>
              <Input value={newRule.trigger_label} onChange={e => setNewRule(p => ({ ...p, trigger_label: e.target.value }))} placeholder="ex: CI expiră în 30 zile" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tip destinatar</Label>
                <Select value={newRule.recipient_type} onValueChange={v => setNewRule(p => ({ ...p, recipient_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(RECIPIENT_TYPES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Canal</Label>
                <Select value={newRule.channel} onValueChange={v => setNewRule(p => ({ ...p, channel: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CHANNEL_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {newRule.recipient_type === 'role' && (
              <div>
                <Label>Rol destinatar</Label>
                <Select value={newRule.recipient_role} onValueChange={v => setNewRule(p => ({ ...p, recipient_role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Template mesaj (opțional)</Label>
              <Textarea value={newRule.message_template} onChange={e => setNewRule(p => ({ ...p, message_template: e.target.value }))} placeholder="Mesajul notificării..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>Anulează</Button>
            <Button onClick={createRule} disabled={saving || !newRule.name || !newRule.trigger_event}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Creează
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NotificationRulesEditor;
