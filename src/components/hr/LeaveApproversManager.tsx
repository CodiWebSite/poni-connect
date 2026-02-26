import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, Search, Users, ArrowRight, Building2, Clock } from 'lucide-react';

interface ApproverMapping {
  id: string;
  employee_user_id: string | null;
  approver_user_id: string | null;
  employee_email: string | null;
  approver_email: string | null;
  notes: string | null;
  created_at: string;
  employee_name?: string;
  employee_department?: string;
  approver_name?: string;
  approver_department?: string;
  employee_pending?: boolean;
  approver_pending?: boolean;
}

interface DeptApproverMapping {
  id: string;
  department: string;
  approver_user_id: string | null;
  approver_email: string | null;
  notes: string | null;
  created_at: string;
  approver_name?: string;
  approver_pending?: boolean;
}

// Unified person option: from profiles (with account) or EPD (without)
interface PersonOption {
  key: string; // user_id or 'epd_' + email
  user_id: string | null;
  email: string;
  full_name: string;
  department: string | null;
  position: string | null;
  has_account: boolean;
}

export function LeaveApproversManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [mappings, setMappings] = useState<ApproverMapping[]>([]);
  const [deptMappings, setDeptMappings] = useState<DeptApproverMapping[]>([]);
  const [persons, setPersons] = useState<PersonOption[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Per-employee form
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedApprover, setSelectedApprover] = useState('');
  const [notes, setNotes] = useState('');

  // Per-department form
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedDeptApprover, setSelectedDeptApprover] = useState('');
  const [deptNotes, setDeptNotes] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);

    // Fetch profiles (users with accounts) and EPD (all employees)
    const [profilesRes, epdRes] = await Promise.all([
      supabase.from('profiles').select('user_id, full_name, department, position').order('full_name'),
      supabase.from('employee_personal_data').select('email, first_name, last_name, department, position').eq('is_archived', false).order('last_name'),
    ]);

    const profilesData = profilesRes.data || [];
    const epdData = epdRes.data || [];

    // Build unified person list
    const profileEmails = new Set<string>();
    const personMap = new Map<string, PersonOption>();

    // First add profiles (with accounts) - we need to get their emails
    for (const p of profilesData) {
      // Match EPD by name to get email
      const matchedEpd = epdData.find(e => 
        `${e.last_name} ${e.first_name}`.toLowerCase() === p.full_name.toLowerCase() ||
        `${e.first_name} ${e.last_name}`.toLowerCase() === p.full_name.toLowerCase()
      );
      const email = matchedEpd?.email || '';
      if (email) profileEmails.add(email.toLowerCase());

      personMap.set(p.user_id, {
        key: p.user_id,
        user_id: p.user_id,
        email: email,
        full_name: p.full_name,
        department: p.department,
        position: p.position,
        has_account: true,
      });
    }

    // Then add EPD entries that DON'T have a matching profile
    for (const e of epdData) {
      if (!profileEmails.has(e.email.toLowerCase())) {
        const key = `epd_${e.email}`;
        personMap.set(key, {
          key,
          user_id: null,
          email: e.email,
          full_name: `${e.last_name} ${e.first_name}`,
          department: e.department,
          position: e.position,
          has_account: false,
        });
      }
    }

    const allPersons = Array.from(personMap.values()).sort((a, b) => a.full_name.localeCompare(b.full_name));
    setPersons(allPersons);

    // Extract unique departments from both sources
    const depts = [...new Set([
      ...profilesData.map(p => p.department).filter(Boolean) as string[],
      ...epdData.map(e => e.department).filter(Boolean) as string[],
    ])].sort();
    setDepartments(depts);

    // Fetch per-employee mappings
    const { data: mappingsData } = await supabase
      .from('leave_approvers')
      .select('*')
      .order('created_at', { ascending: false });

    const enriched: ApproverMapping[] = (mappingsData || []).map((m: any) => {
      const empPerson = m.employee_user_id 
        ? personMap.get(m.employee_user_id) 
        : allPersons.find(p => p.email.toLowerCase() === m.employee_email?.toLowerCase());
      const appPerson = m.approver_user_id 
        ? personMap.get(m.approver_user_id)
        : allPersons.find(p => p.email.toLowerCase() === m.approver_email?.toLowerCase());

      return {
        ...m,
        employee_name: empPerson?.full_name || m.employee_email || 'Necunoscut',
        employee_department: empPerson?.department || '',
        approver_name: appPerson?.full_name || m.approver_email || 'Necunoscut',
        approver_department: appPerson?.department || '',
        employee_pending: !m.employee_user_id && !!m.employee_email,
        approver_pending: !m.approver_user_id && !!m.approver_email,
      };
    });
    setMappings(enriched);

    // Fetch per-department mappings
    const { data: deptMappingsData } = await supabase
      .from('leave_department_approvers')
      .select('*')
      .order('department');

    const enrichedDept: DeptApproverMapping[] = (deptMappingsData || []).map((m: any) => {
      const appPerson = m.approver_user_id
        ? personMap.get(m.approver_user_id)
        : allPersons.find(p => p.email.toLowerCase() === m.approver_email?.toLowerCase());
      return {
        ...m,
        approver_name: appPerson?.full_name || m.approver_email || 'Necunoscut',
        approver_pending: !m.approver_user_id && !!m.approver_email,
      };
    });
    setDeptMappings(enrichedDept);

    setLoading(false);
  };

  const getPersonByKey = (key: string): PersonOption | undefined => persons.find(p => p.key === key);

  const handleAdd = async () => {
    if (!selectedEmployee || !selectedApprover || !user) {
      toast({ title: 'Eroare', description: 'Selectați angajatul și aprobatorul.', variant: 'destructive' });
      return;
    }
    if (selectedEmployee === selectedApprover) {
      toast({ title: 'Eroare', description: 'Angajatul nu poate fi propriul aprobator.', variant: 'destructive' });
      return;
    }

    const empPerson = getPersonByKey(selectedEmployee);
    const appPerson = getPersonByKey(selectedApprover);
    if (!empPerson || !appPerson) return;

    setSaving(true);
    const { error } = await supabase.from('leave_approvers').insert({
      employee_user_id: empPerson.user_id,
      approver_user_id: appPerson.user_id,
      employee_email: empPerson.email || null,
      approver_email: appPerson.email || null,
      created_by: user.id,
      notes: notes || null,
    } as any);

    if (error) {
      console.error('Error adding approver:', error);
      const msg = error.message.includes('duplicate') ? 'Acest angajat are deja un aprobator configurat.' : 'Nu s-a putut salva maparea.';
      toast({ title: 'Eroare', description: msg, variant: 'destructive' });
    } else {
      toast({ title: 'Salvat', description: 'Relația aprobator-angajat a fost salvată.' });
      setSelectedEmployee('');
      setSelectedApprover('');
      setNotes('');
      fetchData();
    }
    setSaving(false);
  };

  const handleAddDept = async () => {
    if (!selectedDept || !selectedDeptApprover || !user) {
      toast({ title: 'Eroare', description: 'Selectați departamentul și aprobatorul.', variant: 'destructive' });
      return;
    }

    const appPerson = getPersonByKey(selectedDeptApprover);
    if (!appPerson) return;

    setSaving(true);
    const { error } = await supabase.from('leave_department_approvers').upsert({
      department: selectedDept,
      approver_user_id: appPerson.user_id,
      approver_email: appPerson.email || null,
      created_by: user.id,
      notes: deptNotes || null,
    } as any, { onConflict: 'department' });

    if (error) {
      toast({ title: 'Eroare', description: 'Nu s-a putut salva maparea pe departament.', variant: 'destructive' });
    } else {
      toast({ title: 'Salvat', description: `Aprobator configurat pentru departamentul ${selectedDept}.` });
      setSelectedDept('');
      setSelectedDeptApprover('');
      setDeptNotes('');
      fetchData();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('leave_approvers').delete().eq('id', id);
    if (!error) { toast({ title: 'Șters' }); fetchData(); }
    else toast({ title: 'Eroare', description: 'Nu s-a putut șterge.', variant: 'destructive' });
  };

  const handleDeleteDept = async (id: string) => {
    const { error } = await supabase.from('leave_department_approvers').delete().eq('id', id);
    if (!error) { toast({ title: 'Șters' }); fetchData(); }
    else toast({ title: 'Eroare', description: 'Nu s-a putut șterge.', variant: 'destructive' });
  };

  const filteredMappings = mappings.filter(m => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return m.employee_name?.toLowerCase().includes(q) || m.approver_name?.toLowerCase().includes(q) || m.employee_department?.toLowerCase().includes(q);
  });

  const mappedEmployeeKeys = new Set(mappings.map(m => m.employee_user_id || m.employee_email).filter(Boolean));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const renderPersonOption = (p: PersonOption) => (
    <SelectItem key={p.key} value={p.key}>
      {p.full_name} {p.department ? `(${p.department})` : ''} {p.position ? `- ${p.position}` : ''}
      {!p.has_account ? ' 📧' : ''}
      {mappedEmployeeKeys.has(p.user_id || p.email) ? ' ✓' : ''}
    </SelectItem>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardDescription>
            Configurați cine aprobă cererile de concediu. Puteți seta aprobatori <strong>per departament</strong> (se aplică tuturor) sau <strong>per angajat</strong> (prioritar). Angajații marcați cu 📧 nu au cont încă — relația se va activa automat la crearea contului.
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="department" className="w-full">
        <TabsList>
          <TabsTrigger value="department" className="gap-2">
            <Building2 className="w-4 h-4" />
            Per Departament
          </TabsTrigger>
          <TabsTrigger value="employee" className="gap-2">
            <Users className="w-4 h-4" />
            Per Angajat
          </TabsTrigger>
        </TabsList>

        {/* === Department-level tab === */}
        <TabsContent value="department" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Plus className="w-5 h-5" />
                Aprobator pe Departament
              </CardTitle>
              <CardDescription>
                Setează un aprobator unic pentru toți angajații unui departament.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Departament</Label>
                  <Select value={selectedDept} onValueChange={setSelectedDept}>
                    <SelectTrigger><SelectValue placeholder="Selectează departament..." /></SelectTrigger>
                    <SelectContent>
                      {departments.map(d => (
                        <SelectItem key={d} value={d}>
                          {d}{deptMappings.some(m => m.department === d) ? ' ✓' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Aprobator desemnat</Label>
                  <Select value={selectedDeptApprover} onValueChange={setSelectedDeptApprover}>
                    <SelectTrigger><SelectValue placeholder="Selectează aprobator..." /></SelectTrigger>
                    <SelectContent>
                      {persons.map(renderPersonOption)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Notă (opțional)</Label>
                  <div className="flex gap-2">
                    <Input value={deptNotes} onChange={e => setDeptNotes(e.target.value)} placeholder="ex: Șef compartiment..." />
                    <Button onClick={handleAddDept} disabled={saving || !selectedDept || !selectedDeptApprover}>
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="w-5 h-5" />
                Aprobatori per Departament ({deptMappings.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {deptMappings.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">Nu sunt configurate relații pe departament.</p>
              ) : (
                <div className="space-y-2">
                  {deptMappings.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3 flex-wrap">
                        <Badge variant="outline">{m.department}</Badge>
                        <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="font-medium text-primary">{m.approver_name}</span>
                        {m.approver_pending && (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Clock className="w-3 h-3" />
                            Fără cont
                          </Badge>
                        )}
                        {m.notes && <span className="text-xs text-muted-foreground italic">({m.notes})</span>}
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteDept(m.id)} className="text-destructive hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === Per-employee tab === */}
        <TabsContent value="employee" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Plus className="w-5 h-5" />
                Aprobator Individual
              </CardTitle>
              <CardDescription>
                Definește un aprobator specific pentru un angajat. Aceasta are prioritate față de aprobatorul pe departament.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Angajat</Label>
                  <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                    <SelectTrigger><SelectValue placeholder="Selectează angajat..." /></SelectTrigger>
                    <SelectContent>
                      {persons.map(renderPersonOption)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Aprobator desemnat</Label>
                  <Select value={selectedApprover} onValueChange={setSelectedApprover}>
                    <SelectTrigger><SelectValue placeholder="Selectează aprobator..." /></SelectTrigger>
                    <SelectContent>
                      {persons.filter(p => p.key !== selectedEmployee).map(renderPersonOption)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Notă (opțional)</Label>
                  <div className="flex gap-2">
                    <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="ex: Șef compartiment..." />
                    <Button onClick={handleAdd} disabled={saving || !selectedEmployee || !selectedApprover}>
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="w-5 h-5" />
                Relații Individuale ({mappings.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {mappings.length > 5 && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Caută..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
                </div>
              )}
              {filteredMappings.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  {mappings.length === 0 ? 'Nu sunt configurate relații individuale.' : 'Niciun rezultat.'}
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredMappings.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="text-sm">
                          <span className="font-medium">{m.employee_name}</span>
                          {m.employee_department && <Badge variant="outline" className="ml-2 text-xs">{m.employee_department}</Badge>}
                          {m.employee_pending && (
                            <Badge variant="secondary" className="ml-1 text-xs gap-1"><Clock className="w-3 h-3" />Fără cont</Badge>
                          )}
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <div className="text-sm">
                          <span className="font-medium text-primary">{m.approver_name}</span>
                          {m.approver_department && <Badge variant="secondary" className="ml-2 text-xs">{m.approver_department}</Badge>}
                          {m.approver_pending && (
                            <Badge variant="secondary" className="ml-1 text-xs gap-1"><Clock className="w-3 h-3" />Fără cont</Badge>
                          )}
                        </div>
                        {m.notes && <span className="text-xs text-muted-foreground italic">({m.notes})</span>}
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(m.id)} className="text-destructive hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
