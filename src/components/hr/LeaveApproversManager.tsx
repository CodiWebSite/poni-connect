import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, Search, Users, ArrowRight } from 'lucide-react';

interface ApproverMapping {
  id: string;
  employee_user_id: string;
  approver_user_id: string;
  notes: string | null;
  created_at: string;
  employee_name?: string;
  employee_department?: string;
  approver_name?: string;
  approver_department?: string;
}

interface ProfileOption {
  user_id: string;
  full_name: string;
  department: string | null;
  position: string | null;
}

export function LeaveApproversManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [mappings, setMappings] = useState<ApproverMapping[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // New mapping form
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedApprover, setSelectedApprover] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);

    // Fetch all profiles
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('user_id, full_name, department, position')
      .order('full_name');

    setProfiles(profilesData || []);

    // Fetch existing mappings
    const { data: mappingsData } = await supabase
      .from('leave_approvers')
      .select('*')
      .order('created_at', { ascending: false });

    // Enrich mappings with names
    const profileMap = new Map((profilesData || []).map(p => [p.user_id, p]));
    const enriched = (mappingsData || []).map(m => ({
      ...m,
      employee_name: profileMap.get(m.employee_user_id)?.full_name || 'Necunoscut',
      employee_department: profileMap.get(m.employee_user_id)?.department || '',
      approver_name: profileMap.get(m.approver_user_id)?.full_name || 'Necunoscut',
      approver_department: profileMap.get(m.approver_user_id)?.department || '',
    }));

    setMappings(enriched);
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!selectedEmployee || !selectedApprover || !user) {
      toast({ title: 'Eroare', description: 'Selectați angajatul și aprobatorul.', variant: 'destructive' });
      return;
    }

    if (selectedEmployee === selectedApprover) {
      toast({ title: 'Eroare', description: 'Angajatul nu poate fi propriul aprobator.', variant: 'destructive' });
      return;
    }

    setSaving(true);

    const { error } = await supabase.from('leave_approvers').upsert({
      employee_user_id: selectedEmployee,
      approver_user_id: selectedApprover,
      created_by: user.id,
      notes: notes || null,
    }, { onConflict: 'employee_user_id' });

    if (error) {
      console.error('Error adding approver mapping:', error);
      toast({ title: 'Eroare', description: 'Nu s-a putut salva maparea.', variant: 'destructive' });
    } else {
      toast({ title: 'Salvat', description: 'Relația aprobator-angajat a fost salvată.' });
      setSelectedEmployee('');
      setSelectedApprover('');
      setNotes('');
      fetchData();
    }

    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('leave_approvers').delete().eq('id', id);
    if (error) {
      toast({ title: 'Eroare', description: 'Nu s-a putut șterge maparea.', variant: 'destructive' });
    } else {
      toast({ title: 'Șters', description: 'Relația a fost eliminată.' });
      fetchData();
    }
  };

  const filteredMappings = mappings.filter(m => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.employee_name?.toLowerCase().includes(q) ||
      m.approver_name?.toLowerCase().includes(q) ||
      m.employee_department?.toLowerCase().includes(q)
    );
  });

  // Employees that already have an approver mapped
  const mappedEmployeeIds = new Set(mappings.map(m => m.employee_user_id));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add new mapping */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Plus className="w-5 h-5" />
            Adaugă Relație Aprobator
          </CardTitle>
          <CardDescription>
            Definește cine aprobă cererea de concediu pentru fiecare angajat. Dacă un angajat nu are aprobator configurat, cererea merge la orice șef din departament (comportament implicit).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Angajat (al cărui concediu se aprobă)</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Selectează angajat..." />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map(p => (
                    <SelectItem key={p.user_id} value={p.user_id}>
                      {p.full_name} {p.department ? `(${p.department})` : ''}
                      {mappedEmployeeIds.has(p.user_id) ? ' ✓' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Aprobator desemnat</Label>
              <Select value={selectedApprover} onValueChange={setSelectedApprover}>
                <SelectTrigger>
                  <SelectValue placeholder="Selectează aprobator..." />
                </SelectTrigger>
                <SelectContent>
                  {profiles
                    .filter(p => p.user_id !== selectedEmployee)
                    .map(p => (
                      <SelectItem key={p.user_id} value={p.user_id}>
                        {p.full_name} {p.department ? `(${p.department})` : ''} {p.position ? `- ${p.position}` : ''}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notă (opțional)</Label>
              <div className="flex gap-2">
                <Input
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="ex: Șef compartiment..."
                />
                <Button onClick={handleAdd} disabled={saving || !selectedEmployee || !selectedApprover}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Existing mappings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="w-5 h-5" />
            Relații Aprobator Configurate ({mappings.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {mappings.length > 5 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Caută după nume sau departament..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          )}

          {filteredMappings.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              {mappings.length === 0
                ? 'Nu sunt configurate relații de aprobare. Adăugați prima relație mai sus.'
                : 'Niciun rezultat pentru căutarea curentă.'}
            </p>
          ) : (
            <div className="space-y-2">
              {filteredMappings.map(m => (
                <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="text-sm">
                      <span className="font-medium">{m.employee_name}</span>
                      {m.employee_department && (
                        <Badge variant="outline" className="ml-2 text-xs">{m.employee_department}</Badge>
                      )}
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="text-sm">
                      <span className="font-medium text-primary">{m.approver_name}</span>
                      {m.approver_department && (
                        <Badge variant="secondary" className="ml-2 text-xs">{m.approver_department}</Badge>
                      )}
                    </div>
                    {m.notes && (
                      <span className="text-xs text-muted-foreground italic">({m.notes})</span>
                    )}
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
    </div>
  );
}

