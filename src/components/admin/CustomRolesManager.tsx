import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Plus, Pencil, Trash2, Users, Tag, UserPlus, X } from 'lucide-react';

interface CustomRole {
  id: string;
  key: string;
  label: string;
  description: string | null;
  color: string;
  created_at: string;
}

interface UserCustomRole {
  id: string;
  user_id: string;
  custom_role_id: string;
  full_name?: string;
}

interface ProfileOption {
  user_id: string;
  full_name: string;
}

const COLOR_OPTIONS = [
  { value: 'bg-blue-600 text-white', label: 'Albastru' },
  { value: 'bg-emerald-600 text-white', label: 'Verde' },
  { value: 'bg-purple-600 text-white', label: 'Violet' },
  { value: 'bg-amber-600 text-white', label: 'Amber' },
  { value: 'bg-rose-600 text-white', label: 'Roșu' },
  { value: 'bg-cyan-600 text-white', label: 'Cyan' },
  { value: 'bg-teal-600 text-white', label: 'Teal' },
  { value: 'bg-orange-600 text-white', label: 'Portocaliu' },
  { value: 'bg-pink-600 text-white', label: 'Roz' },
  { value: 'bg-indigo-600 text-white', label: 'Indigo' },
  { value: 'bg-slate-600 text-white', label: 'Gri' },
  { value: 'bg-lime-700 text-white', label: 'Lime' },
];

const PAGE_KEYS = [
  'dashboard', 'announcements', 'my-profile', 'leave-calendar', 'formulare',
  'leave-request', 'my-team', 'library', 'room-bookings', 'activitati',
  'chat', 'medicina-muncii', 'arhiva', 'ghid', 'install', 'hr-management',
  'salarizare', 'settings', 'system-status', 'carti-vizita', 'admin', 'changelog',
];

const CustomRolesManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editRole, setEditRole] = useState<CustomRole | null>(null);
  const [assignOpen, setAssignOpen] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formKey, setFormKey] = useState('');
  const [formLabel, setFormLabel] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formColor, setFormColor] = useState(COLOR_OPTIONS[0].value);

  // Assignment state
  const [assignments, setAssignments] = useState<UserCustomRole[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [assignSearch, setAssignSearch] = useState('');
  const [loadingAssign, setLoadingAssign] = useState(false);

  useEffect(() => { fetchRoles(); }, []);

  const fetchRoles = async () => {
    setLoading(true);
    const { data } = await supabase.from('custom_roles').select('*').order('created_at');
    setRoles((data as CustomRole[]) || []);
    setLoading(false);
  };

  const resetForm = () => {
    setFormKey(''); setFormLabel(''); setFormDesc(''); setFormColor(COLOR_OPTIONS[0].value);
  };

  const openCreate = () => {
    resetForm();
    setEditRole(null);
    setCreateOpen(true);
  };

  const openEdit = (role: CustomRole) => {
    setFormKey(role.key);
    setFormLabel(role.label);
    setFormDesc(role.description || '');
    setFormColor(role.color);
    setEditRole(role);
    setCreateOpen(true);
  };

  const slugify = (text: string) =>
    text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

  const handleSave = async () => {
    if (!formLabel.trim()) {
      toast({ title: 'Eroare', description: 'Denumirea rolului este obligatorie.', variant: 'destructive' });
      return;
    }
    const key = formKey.trim() || slugify(formLabel);
    if (!key) return;

    setSaving(true);

    if (editRole) {
      const { error } = await supabase.from('custom_roles')
        .update({ label: formLabel.trim(), description: formDesc.trim() || null, color: formColor, updated_at: new Date().toISOString() })
        .eq('id', editRole.id);
      if (error) {
        toast({ title: 'Eroare', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Succes', description: 'Rolul a fost actualizat.' });
        setCreateOpen(false);
        fetchRoles();
      }
    } else {
      const { data, error } = await supabase.from('custom_roles')
        .insert({ key, label: formLabel.trim(), description: formDesc.trim() || null, color: formColor, created_by: user?.id })
        .select()
        .single();
      if (error) {
        toast({ title: 'Eroare', description: error.message, variant: 'destructive' });
      } else {
        // Auto-seed page permissions for this new role
        const permRows = PAGE_KEYS.map(pk => ({
          role_key: key,
          page_key: pk,
          can_access: ['dashboard', 'my-profile', 'announcements', 'chat', 'settings', 'ghid', 'install', 'carti-vizita', 'room-bookings'].includes(pk),
        }));
        await supabase.from('role_page_permissions').insert(permRows);
        toast({ title: 'Succes', description: `Rolul „${formLabel}" a fost creat. Configurează accesul din tab-ul Acces Pagini.` });
        setCreateOpen(false);
        fetchRoles();
      }
    }
    setSaving(false);
  };

  const handleDelete = async (role: CustomRole) => {
    if (!confirm(`Sigur vrei să ștergi rolul „${role.label}"? Aceasta va elimina și toate atribuirile utilizatorilor.`)) return;
    // Delete permissions
    await supabase.from('role_page_permissions').delete().eq('role_key', role.key);
    const { error } = await supabase.from('custom_roles').delete().eq('id', role.id);
    if (error) {
      toast({ title: 'Eroare', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Șters', description: `Rolul „${role.label}" a fost eliminat.` });
      fetchRoles();
    }
  };

  // Assignments
  const openAssignments = async (roleId: string) => {
    setAssignOpen(roleId);
    setLoadingAssign(true);
    setAssignSearch('');
    const [{ data: ucr }, { data: profs }] = await Promise.all([
      supabase.from('user_custom_roles').select('id, user_id, custom_role_id').eq('custom_role_id', roleId),
      supabase.from('profiles').select('user_id, full_name'),
    ]);
    const assignedList = (ucr || []) as UserCustomRole[];
    const profList = (profs || []) as ProfileOption[];
    // Enrich assignments with names
    setAssignments(assignedList.map(a => ({
      ...a,
      full_name: profList.find(p => p.user_id === a.user_id)?.full_name || 'Necunoscut',
    })));
    setProfiles(profList.sort((a, b) => a.full_name.localeCompare(b.full_name)));
    setLoadingAssign(false);
  };

  const assignUser = async (userId: string, roleId: string) => {
    const { error } = await supabase.from('user_custom_roles')
      .insert({ user_id: userId, custom_role_id: roleId, assigned_by: user?.id });
    if (error) {
      toast({ title: 'Eroare', description: error.message, variant: 'destructive' });
    } else {
      openAssignments(roleId);
    }
  };

  const removeAssignment = async (assignmentId: string, roleId: string) => {
    await supabase.from('user_custom_roles').delete().eq('id', assignmentId);
    openAssignments(roleId);
  };

  const assignedUserIds = new Set(assignments.map(a => a.user_id));
  const filteredProfiles = profiles
    .filter(p => !assignedUserIds.has(p.user_id))
    .filter(p => p.full_name.toLowerCase().includes(assignSearch.toLowerCase()));

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Tag className="w-5 h-5 text-primary" />
                Roluri Personalizate
              </CardTitle>
              <CardDescription>Creează roluri noi și atribuie-le utilizatorilor. Configurează accesul din tab-ul „Acces Pagini".</CardDescription>
            </div>
            <Button size="sm" onClick={openCreate} className="gap-1.5">
              <Plus className="w-4 h-4" />
              Rol Nou
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {roles.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Tag className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Nu ai creat niciun rol personalizat încă.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={openCreate}>
                <Plus className="w-4 h-4 mr-1" /> Creează primul rol
              </Button>
            </div>
          ) : (
            <div className="grid gap-3">
              {roles.map(role => (
                <div key={role.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                  <Badge className={`${role.color} text-xs shrink-0`} variant="secondary">
                    {role.label}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground truncate">
                      <code className="bg-muted px-1 py-0.5 rounded text-[10px]">{role.key}</code>
                      {role.description && <span className="ml-2">{role.description}</span>}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openAssignments(role.id)}>
                      <Users className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(role)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(role)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editRole ? 'Editează Rol' : 'Creează Rol Nou'}</DialogTitle>
            <DialogDescription>
              {editRole ? 'Modifică detaliile rolului.' : 'Definește un rol personalizat. Cheia (key) va fi generată automat.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Denumire *</Label>
              <Input value={formLabel} onChange={e => {
                setFormLabel(e.target.value);
                if (!editRole) setFormKey(slugify(e.target.value));
              }} placeholder="ex: Responsabil Proiecte" />
            </div>
            <div>
              <Label>Cheie (key)</Label>
              <Input value={formKey} onChange={e => setFormKey(slugify(e.target.value))} placeholder="responsabil_proiecte" disabled={!!editRole} className="font-mono text-xs" />
              <p className="text-[10px] text-muted-foreground mt-1">Se folosește intern. Nu se poate modifica după creare.</p>
            </div>
            <div>
              <Label>Descriere</Label>
              <Textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Opțional" rows={2} />
            </div>
            <div>
              <Label>Culoare</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {COLOR_OPTIONS.map(c => (
                  <button
                    key={c.value}
                    className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all ${c.value} ${formColor === c.value ? 'ring-2 ring-primary ring-offset-2' : 'opacity-70 hover:opacity-100'}`}
                    onClick={() => setFormColor(c.value)}
                    type="button"
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Anulează</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {editRole ? 'Salvează' : 'Creează'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assignment Dialog */}
      <Dialog open={!!assignOpen} onOpenChange={() => setAssignOpen(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Atribuire Utilizatori
            </DialogTitle>
            <DialogDescription>
              {roles.find(r => r.id === assignOpen)?.label && (
                <Badge className={`${roles.find(r => r.id === assignOpen)?.color} text-xs mt-1`} variant="secondary">
                  {roles.find(r => r.id === assignOpen)?.label}
                </Badge>
              )}
            </DialogDescription>
          </DialogHeader>

          {loadingAssign ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-4">
              {/* Assigned */}
              <div>
                <Label className="text-xs text-muted-foreground">Utilizatori atribuiți ({assignments.length})</Label>
                {assignments.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">Niciun utilizator atribuit.</p>
                ) : (
                  <div className="space-y-1 mt-1 max-h-32 overflow-y-auto">
                    {assignments.map(a => (
                      <div key={a.id} className="flex items-center justify-between px-2 py-1.5 rounded bg-muted/30 text-xs">
                        <span className="font-medium">{a.full_name}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeAssignment(a.id, assignOpen!)}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add */}
              <div>
                <Label className="text-xs text-muted-foreground">Adaugă utilizator</Label>
                <Input placeholder="Caută..." value={assignSearch} onChange={e => setAssignSearch(e.target.value)} className="h-8 text-xs mt-1" />
                <ScrollArea className="max-h-40 mt-1">
                  {filteredProfiles.slice(0, 30).map(p => (
                    <button
                      key={p.user_id}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted/50 text-xs transition-colors"
                      onClick={() => assignUser(p.user_id, assignOpen!)}
                    >
                      <span>{p.full_name}</span>
                      <UserPlus className="w-3 h-3 text-muted-foreground" />
                    </button>
                  ))}
                </ScrollArea>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomRolesManager;
