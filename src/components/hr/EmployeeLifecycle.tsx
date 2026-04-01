import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, RefreshCw, Loader2, CheckCircle, ListChecks, ArrowRightLeft, UserMinus } from 'lucide-react';

interface EmployeeLifecycleProps {
  departments: string[];
  onRefresh: () => void;
  onSync: () => void;
  syncing: boolean;
}

export default function EmployeeLifecycle({ departments, onRefresh, onSync, syncing }: EmployeeLifecycleProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [addForm, setAddForm] = useState({
    first_name: '', last_name: '', cnp: '', email: '', department: '', customDepartment: '',
    position: '', employment_date: '', contract_type: 'nedeterminat', total_leave_days: 21,
  });
  const [adding, setAdding] = useState(false);

  const handleAddEmployee = async () => {
    const dept = addForm.department === '__custom__' ? addForm.customDepartment.trim() : addForm.department;
    if (!addForm.first_name.trim() || !addForm.last_name.trim() || !addForm.cnp.trim() || !addForm.email.trim() || !dept || !addForm.employment_date) {
      toast({ title: 'Eroare', description: 'Completați toate câmpurile obligatorii.', variant: 'destructive' });
      return;
    }
    if (!/^\d{13}$/.test(addForm.cnp.trim())) {
      toast({ title: 'Eroare', description: 'CNP-ul trebuie să conțină exact 13 cifre.', variant: 'destructive' });
      return;
    }
    setAdding(true);
    const { error } = await supabase.from('employee_personal_data').insert({
      first_name: addForm.first_name.trim(), last_name: addForm.last_name.trim(), cnp: addForm.cnp.trim(),
      email: addForm.email.trim().toLowerCase(), department: dept, position: addForm.position.trim() || null,
      employment_date: addForm.employment_date, contract_type: addForm.contract_type, total_leave_days: addForm.total_leave_days, used_leave_days: 0,
    });
    if (error) {
      const msg = error.message.includes('duplicate') ? 'Un angajat cu acest CNP sau email există deja.' : 'Nu s-a putut adăuga angajatul.';
      toast({ title: 'Eroare', description: msg, variant: 'destructive' });
    } else {
      toast({ title: 'Succes', description: `${addForm.last_name} ${addForm.first_name} a fost adăugat(ă).` });
      setShowAddEmployee(false);
      setAddForm({ first_name: '', last_name: '', cnp: '', email: '', department: '', customDepartment: '', position: '', employment_date: '', contract_type: 'nedeterminat', total_leave_days: 21 });
      onRefresh();
    }
    setAdding(false);
  };

  const onboardingChecklist = [
    { label: 'Creare fișă angajat în sistem', description: 'Adăugarea datelor personale și profesionale', action: () => setShowAddEmployee(true), actionLabel: 'Adaugă Angajat', icon: UserPlus },
    { label: 'Asociere cont platformă', description: 'Sincronizarea automată a angajaților fără cont cu profiluri existente', action: onSync, actionLabel: syncing ? 'Sincronizare...' : 'Sincronizează', icon: RefreshCw },
    { label: 'Încărcare documente inițiale', description: 'CI, contract, diplome, fișă medicală', icon: ListChecks },
    { label: 'Configurare aprobator concediu', description: 'Setarea superiorului direct în tab-ul Aprobatori', icon: ArrowRightLeft },
  ];

  return (
    <div className="space-y-6">
      {/* Onboarding Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ListChecks className="w-5 h-5 text-primary" />Onboarding Angajat Nou</CardTitle>
          <CardDescription>Pașii necesari pentru integrarea unui angajat în platformă</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {onboardingChecklist.map((item, i) => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-border/60 bg-card hover:shadow-card-hover transition-all">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <item.icon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
              {item.action && (
                <Button variant="outline" size="sm" onClick={item.action} disabled={syncing && item.icon === RefreshCw}>
                  {syncing && item.icon === RefreshCw && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                  {item.actionLabel}
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Lifecycle Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><ArrowRightLeft className="w-4 h-4 text-primary" />Schimbare Departament / Funcție</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Folosiți butonul „Editează" din tab-ul Angajați pentru a modifica departamentul sau funcția unui angajat. Modificarea se propagă automat în profil.</p>
            <Badge variant="secondary" className="text-xs">Audit log automat la fiecare modificare</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><UserMinus className="w-4 h-4 text-destructive" />Încetare Activitate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Arhivarea unui angajat se face din meniul „⋯" → „Arhivează" pe cardul angajatului. Datele sunt păstrate integral și pot fi restaurate.</p>
            <Badge variant="secondary" className="text-xs">Soft-delete cu motiv și trasabilitate</Badge>
          </CardContent>
        </Card>
      </div>

      {/* Add Employee Dialog */}
      <Dialog open={showAddEmployee} onOpenChange={setShowAddEmployee}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="w-5 h-5" />Adaugă Angajat Manual</DialogTitle>
            <DialogDescription>Câmpurile marcate cu * sunt obligatorii.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Nume *</Label><Input value={addForm.last_name} onChange={e => setAddForm(f => ({ ...f, last_name: e.target.value }))} placeholder="ex: POPESCU" /></div>
              <div className="space-y-2"><Label>Prenume *</Label><Input value={addForm.first_name} onChange={e => setAddForm(f => ({ ...f, first_name: e.target.value }))} placeholder="ex: Maria" /></div>
            </div>
            <div className="space-y-2"><Label>CNP *</Label><Input value={addForm.cnp} onChange={e => setAddForm(f => ({ ...f, cnp: e.target.value.replace(/\D/g, '').slice(0, 13) }))} maxLength={13} /></div>
            <div className="space-y-2"><Label>Email *</Label><Input type="email" value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Departament *</Label>
              <Select value={addForm.department} onValueChange={v => setAddForm(f => ({ ...f, department: v }))}>
                <SelectTrigger><SelectValue placeholder="Selectează departamentul" /></SelectTrigger>
                <SelectContent>
                  {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  <SelectItem value="__custom__">+ Alt departament...</SelectItem>
                </SelectContent>
              </Select>
              {addForm.department === '__custom__' && <Input value={addForm.customDepartment} onChange={e => setAddForm(f => ({ ...f, customDepartment: e.target.value }))} placeholder="Numele departamentului" className="mt-2" />}
            </div>
            <div className="space-y-2"><Label>Funcția</Label><Input value={addForm.position} onChange={e => setAddForm(f => ({ ...f, position: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Data angajării *</Label><Input type="date" value={addForm.employment_date} onChange={e => setAddForm(f => ({ ...f, employment_date: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Zile CO/an</Label><Input type="number" min={0} max={60} value={addForm.total_leave_days} onChange={e => setAddForm(f => ({ ...f, total_leave_days: parseInt(e.target.value) || 21 }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddEmployee(false)}>Anulează</Button>
            <Button onClick={handleAddEmployee} disabled={adding}>{adding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}Adaugă Angajat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
