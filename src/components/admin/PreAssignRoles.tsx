import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Mail, Loader2, Search, Trash2 } from 'lucide-react';

const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  director_institut: 'Director',
  director_adjunct: 'Director Adjunct',
  secretar_stiintific: 'Secretar Științific',
  sef_srus: 'Șef Serviciu Resurse Umane',
  sef: 'Șef Departament',
  hr: 'HR (SRUS)',
  bibliotecar: 'Bibliotecar',
  user: 'Angajat',
};

const roleBadgeColors: Record<string, string> = {
  super_admin: 'bg-destructive text-destructive-foreground',
  director_institut: 'bg-indigo-700 text-white',
  director_adjunct: 'bg-indigo-500 text-white',
  secretar_stiintific: 'bg-teal-600 text-white',
  sef_srus: 'bg-blue-600 text-white',
  sef: 'bg-amber-600 text-white',
  hr: 'bg-purple-500 text-white',
  bibliotecar: 'bg-emerald-600 text-white',
  user: 'bg-muted text-muted-foreground',
};

interface PreAssigned {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

interface AccountlessEmployee {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  department: string | null;
  position: string | null;
}

const PreAssignRoles = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [preAssigned, setPreAssigned] = useState<PreAssigned[]>([]);
  const [accountless, setAccountless] = useState<AccountlessEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmail, setSelectedEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState('user');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: pre }, { data: epd }, { data: profiles }] = await Promise.all([
      supabase.from('pre_assigned_roles').select('*').order('created_at', { ascending: false }),
      supabase.from('employee_personal_data').select('id, email, first_name, last_name, department, position').eq('is_archived', false),
      supabase.from('profiles').select('user_id'),
    ]);

    setPreAssigned(pre || []);

    // Find employees without accounts (no matching profile by email)
    if (epd && profiles) {
      // Get all auth user emails via profiles - we need to check which epd emails have accounts
      const { data: authUsers } = await supabase.from('profiles').select('user_id');
      // We can't query auth.users directly, so use employee_record_id as proxy
      const withAccount = new Set(
        (epd || []).filter(e => e.email && profiles.some(p => {
          // Check if employee_personal_data has a linked record
          return false; // We'll use a different approach
        })).map(e => e.email.toLowerCase())
      );

      // Better approach: employees without employee_record_id likely don't have accounts
      const { data: epdFull } = await supabase
        .from('employee_personal_data')
        .select('id, email, first_name, last_name, department, position, employee_record_id')
        .eq('is_archived', false)
        .is('employee_record_id', null);

      setAccountless(epdFull || []);
    }

    setLoading(false);
  };

  const handleAssign = async () => {
    if (!selectedEmail || !selectedRole) return;
    setSaving(true);
    
    const { error } = await supabase.from('pre_assigned_roles').upsert(
      { email: selectedEmail.toLowerCase(), role: selectedRole as any, assigned_by: user?.id },
      { onConflict: 'email' }
    );

    if (error) {
      toast({ title: 'Eroare', description: 'Nu s-a putut salva rolul.', variant: 'destructive' });
    } else {
      toast({ title: 'Succes', description: `Rolul ${roleLabels[selectedRole]} a fost pre-atribuit pentru ${selectedEmail}.` });
      setSelectedEmail('');
      setSelectedRole('user');
      fetchData();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    const { error } = await supabase.from('pre_assigned_roles').delete().eq('id', id);
    if (error) {
      toast({ title: 'Eroare', description: 'Nu s-a putut șterge.', variant: 'destructive' });
    } else {
      setPreAssigned(prev => prev.filter(p => p.id !== id));
      toast({ title: 'Succes', description: 'Rolul pre-atribuit a fost eliminat.' });
    }
    setDeleting(null);
  };

  const filteredAccountless = accountless.filter(e =>
    `${e.first_name} ${e.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.department?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Check if an email already has a pre-assigned role
  const getPreAssignedRole = (email: string) => {
    return preAssigned.find(p => p.email.toLowerCase() === email.toLowerCase());
  };

  return (
    <div className="space-y-6">
      {/* Manual assignment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Pre-atribuire Rol (după email)
          </CardTitle>
          <CardDescription>
            Atribuie un rol unui angajat înainte ca acesta să-și creeze contul. Rolul se va aplica automat la înregistrare.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Email angajat..."
              value={selectedEmail}
              onChange={(e) => setSelectedEmail(e.target.value)}
              className="flex-1"
              type="email"
            />
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(roleLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAssign} disabled={!selectedEmail || saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
              Atribuie
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Existing pre-assignments */}
      {preAssigned.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Roluri pre-atribuite active ({preAssigned.length})</CardTitle>
            <CardDescription>Aceste roluri se vor aplica automat când utilizatorul își creează cont</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {preAssigned.map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg border border-border">
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{p.email}</span>
                    <Badge className={`${roleBadgeColors[p.role] || roleBadgeColors.user} text-xs`} variant="secondary">
                      {roleLabels[p.role] || p.role}
                    </Badge>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)} disabled={deleting === p.id}>
                    {deleting === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 text-destructive" />}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Accountless employees quick assign */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Angajați fără cont ({accountless.length})</CardTitle>
          <CardDescription>Atribuie rapid un rol angajaților importați care nu au încă cont</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Caută angajat..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filteredAccountless.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {searchQuery ? 'Niciun rezultat' : 'Toți angajații au cont activ'}
            </p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredAccountless.map(e => {
                const existing = getPreAssignedRole(e.email);
                return (
                  <div key={e.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 bg-secondary/30 rounded-lg border border-border">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{e.first_name} {e.last_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{e.email} • {e.department || 'Fără dept.'}</p>
                    </div>
                    {existing ? (
                      <Badge className={`${roleBadgeColors[existing.role] || roleBadgeColors.user} text-xs`} variant="secondary">
                        {roleLabels[existing.role] || existing.role} (pre-atribuit)
                      </Badge>
                    ) : (
                      <Select onValueChange={async (role) => {
                        const { error } = await supabase.from('pre_assigned_roles').upsert(
                          { email: e.email.toLowerCase(), role: role as any, assigned_by: user?.id },
                          { onConflict: 'email' }
                        );
                        if (!error) {
                          toast({ title: 'Succes', description: `Rol ${roleLabels[role]} pre-atribuit pentru ${e.first_name} ${e.last_name}.` });
                          fetchData();
                        }
                      }}>
                        <SelectTrigger className="w-full sm:w-44">
                          <SelectValue placeholder="Selectează rol..." />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(roleLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PreAssignRoles;
