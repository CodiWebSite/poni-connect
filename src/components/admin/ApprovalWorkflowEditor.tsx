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
import { Loader2, GitBranch, Plus, Trash2, GripVertical, Save, ChevronDown, ChevronUp } from 'lucide-react';
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

interface Workflow {
  id: string;
  name: string;
  description: string | null;
  request_type: string;
  is_active: boolean;
}

interface WorkflowStep {
  id: string;
  workflow_id: string;
  step_order: number;
  approver_role: string;
  step_label: string;
  is_optional: boolean;
}

const ApprovalWorkflowEditor = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedWorkflow, setExpandedWorkflow] = useState<string | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newWorkflow, setNewWorkflow] = useState({ name: '', description: '', request_type: '' });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: wf }, { data: st }] = await Promise.all([
      supabase.from('approval_workflows').select('*').order('created_at'),
      supabase.from('approval_workflow_steps').select('*').order('step_order'),
    ]);
    setWorkflows((wf || []) as Workflow[]);
    setSteps((st || []) as WorkflowStep[]);
    setLoading(false);
  };

  const toggleActive = async (wfId: string, current: boolean) => {
    await supabase.from('approval_workflows').update({ is_active: !current }).eq('id', wfId);
    setWorkflows(prev => prev.map(w => w.id === wfId ? { ...w, is_active: !current } : w));
  };

  const getStepsForWorkflow = (wfId: string) =>
    steps.filter(s => s.workflow_id === wfId).sort((a, b) => a.step_order - b.step_order);

  const addStep = async (wfId: string) => {
    const existing = getStepsForWorkflow(wfId);
    const nextOrder = existing.length > 0 ? Math.max(...existing.map(s => s.step_order)) + 1 : 1;
    const { data, error } = await supabase.from('approval_workflow_steps').insert({
      workflow_id: wfId,
      step_order: nextOrder,
      approver_role: 'hr',
      step_label: 'Pas nou',
    }).select().single();
    if (!error && data) {
      setSteps(prev => [...prev, data as WorkflowStep]);
    }
  };

  const updateStep = async (stepId: string, field: string, value: string | boolean) => {
    await supabase.from('approval_workflow_steps').update({ [field]: value }).eq('id', stepId);
    setSteps(prev => prev.map(s => s.id === stepId ? { ...s, [field]: value } : s));
  };

  const deleteStep = async (stepId: string) => {
    await supabase.from('approval_workflow_steps').delete().eq('id', stepId);
    setSteps(prev => prev.filter(s => s.id !== stepId));
  };

  const moveStep = async (wfId: string, stepId: string, direction: 'up' | 'down') => {
    const wfSteps = getStepsForWorkflow(wfId);
    const idx = wfSteps.findIndex(s => s.id === stepId);
    if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === wfSteps.length - 1)) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const orderA = wfSteps[idx].step_order;
    const orderB = wfSteps[swapIdx].step_order;
    await Promise.all([
      supabase.from('approval_workflow_steps').update({ step_order: orderB }).eq('id', wfSteps[idx].id),
      supabase.from('approval_workflow_steps').update({ step_order: orderA }).eq('id', wfSteps[swapIdx].id),
    ]);
    setSteps(prev => prev.map(s => {
      if (s.id === wfSteps[idx].id) return { ...s, step_order: orderB };
      if (s.id === wfSteps[swapIdx].id) return { ...s, step_order: orderA };
      return s;
    }));
  };

  const createWorkflow = async () => {
    if (!newWorkflow.name || !newWorkflow.request_type) return;
    setSaving(true);
    const { data, error } = await supabase.from('approval_workflows').insert({
      name: newWorkflow.name,
      description: newWorkflow.description || null,
      request_type: newWorkflow.request_type,
    }).select().single();
    if (!error && data) {
      setWorkflows(prev => [...prev, data as Workflow]);
      setShowNewDialog(false);
      setNewWorkflow({ name: '', description: '', request_type: '' });
      toast({ title: 'Succes', description: 'Flux de aprobare creat.' });
      if (user?.id) {
        await supabase.rpc('log_audit_event', {
          _user_id: user.id, _action: 'workflow_create', _entity_type: 'approval_workflow',
          _entity_id: (data as Workflow).id, _details: { name: newWorkflow.name },
        });
      }
    }
    setSaving(false);
  };

  const deleteWorkflow = async (wfId: string) => {
    await supabase.from('approval_workflows').delete().eq('id', wfId);
    setWorkflows(prev => prev.filter(w => w.id !== wfId));
    setSteps(prev => prev.filter(s => s.workflow_id !== wfId));
    toast({ title: 'Șters', description: 'Fluxul a fost eliminat.' });
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
                <GitBranch className="w-5 h-5 text-primary" />
                Fluxuri de Aprobare
              </CardTitle>
              <CardDescription>Definește pașii de aprobare pentru fiecare tip de cerere</CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowNewDialog(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Flux Nou
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {workflows.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nu există fluxuri definite.</p>
          ) : (
            workflows.map(wf => {
              const wfSteps = getStepsForWorkflow(wf.id);
              const isExpanded = expandedWorkflow === wf.id;
              return (
                <div key={wf.id} className="border rounded-lg overflow-hidden">
                  <div
                    className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedWorkflow(isExpanded ? null : wf.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{wf.name}</span>
                        <Badge variant="outline" className="text-[10px]">{wf.request_type}</Badge>
                        <Badge variant={wf.is_active ? 'default' : 'secondary'} className="text-[10px]">
                          {wf.is_active ? 'Activ' : 'Inactiv'}
                        </Badge>
                      </div>
                      {wf.description && <p className="text-xs text-muted-foreground mt-0.5">{wf.description}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{wfSteps.length} pași</span>
                      <Switch checked={wf.is_active} onCheckedChange={() => toggleActive(wf.id, wf.is_active)} onClick={e => e.stopPropagation()} />
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t p-4 space-y-3 bg-muted/10">
                      {/* Visual flow */}
                      <div className="flex items-center gap-2 flex-wrap mb-4">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Angajat</Badge>
                        {wfSteps.map((step, i) => (
                          <div key={step.id} className="flex items-center gap-2">
                            <span className="text-muted-foreground">→</span>
                            <Badge variant="outline" className={step.is_optional ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}>
                              {step.step_label}
                            </Badge>
                          </div>
                        ))}
                        <span className="text-muted-foreground">→</span>
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">✓ Aprobat</Badge>
                      </div>

                      {/* Editable steps */}
                      {wfSteps.map((step, i) => (
                        <div key={step.id} className="flex items-center gap-2 p-3 bg-background rounded-lg border">
                          <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="text-xs font-bold text-muted-foreground w-6">{i + 1}.</span>
                          <Input
                            value={step.step_label}
                            onChange={e => updateStep(step.id, 'step_label', e.target.value)}
                            className="flex-1 h-8 text-sm"
                            placeholder="Nume pas"
                          />
                          <Select value={step.approver_role} onValueChange={v => updateStep(step.id, 'approver_role', v)}>
                            <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(ROLE_LABELS).map(([k, v]) => (
                                <SelectItem key={k} value={k}>{v}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveStep(wf.id, step.id, 'up')} disabled={i === 0}>
                              <ChevronUp className="w-3 h-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveStep(wf.id, step.id, 'down')} disabled={i === wfSteps.length - 1}>
                              <ChevronDown className="w-3 h-3" />
                            </Button>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteStep(step.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}

                      <div className="flex gap-2 pt-2">
                        <Button variant="outline" size="sm" onClick={() => addStep(wf.id)}>
                          <Plus className="w-3 h-3 mr-1" />Adaugă Pas
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive ml-auto" onClick={() => deleteWorkflow(wf.id)}>
                          <Trash2 className="w-3 h-3 mr-1" />Șterge Flux
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Flux de Aprobare Nou</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nume flux</Label>
              <Input value={newWorkflow.name} onChange={e => setNewWorkflow(p => ({ ...p, name: e.target.value }))} placeholder="ex: Aprobare Achiziție" />
            </div>
            <div>
              <Label>Tip cerere</Label>
              <Input value={newWorkflow.request_type} onChange={e => setNewWorkflow(p => ({ ...p, request_type: e.target.value }))} placeholder="ex: achizitie, delegare" />
            </div>
            <div>
              <Label>Descriere (opțional)</Label>
              <Textarea value={newWorkflow.description} onChange={e => setNewWorkflow(p => ({ ...p, description: e.target.value }))} placeholder="Descrie scopul fluxului..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>Anulează</Button>
            <Button onClick={createWorkflow} disabled={saving || !newWorkflow.name || !newWorkflow.request_type}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
              Creează
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ApprovalWorkflowEditor;
