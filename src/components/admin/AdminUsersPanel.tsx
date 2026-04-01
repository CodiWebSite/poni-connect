import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Search, Shield, Users, Loader2, Trash2, AlertTriangle, UserX, UserPlus,
  Globe, RefreshCw, Mail, Headset, Bell, ClipboardList, Lock, Filter
} from 'lucide-react';
import ManualAccountCreate from './ManualAccountCreate';
import AccountRequestsPanel from './AccountRequestsPanel';
import InvitePlatformPanel from './InvitePlatformPanel';
import AccountReminderPanel from './AccountReminderPanel';
import PreAssignRoles from './PreAssignRoles';
import HelpdeskPanel from './HelpdeskPanel';

const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  director_institut: 'Director',
  director_adjunct: 'Director Adjunct',
  secretar_stiintific: 'Secretar Științific',
  sef_srus: 'Șef SRUS',
  sef: 'Șef Departament',
  hr: 'HR (SRUS)',
  bibliotecar: 'Bibliotecar',
  salarizare: 'Salarizare',
  secretariat: 'Secretariat',
  achizitii: 'Achiziții',
  contabilitate: 'Contabilitate',
  oficiu_juridic: 'Oficiu Juridic',
  compartiment_comunicare: 'Comunicare',
  medic_medicina_muncii: 'Medic Muncii',
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
  salarizare: 'bg-orange-600 text-white',
  secretariat: 'bg-cyan-600 text-white',
  achizitii: 'bg-rose-600 text-white',
  contabilitate: 'bg-lime-700 text-white',
  oficiu_juridic: 'bg-slate-600 text-white',
  compartiment_comunicare: 'bg-fuchsia-600 text-white',
  medic_medicina_muncii: 'bg-pink-600 text-white',
  user: 'bg-muted text-muted-foreground',
};

interface UserWithRole {
  user_id: string;
  full_name: string;
  department: string | null;
  position: string | null;
  role: string;
  role_id: string;
}

const AdminUsersPanel = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [updating, setUpdating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<UserWithRole | null>(null);
  const [bypassUsers, setBypassUsers] = useState<Set<string>>(new Set());
  const [togglingBypass, setTogglingBypass] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
    fetchBypassUsers();
  }, []);

  const fetchBypassUsers = async () => {
    const { data } = await supabase.from('ip_bypass_users').select('user_id');
    if (data) setBypassUsers(new Set(data.map(d => d.user_id)));
  };

  const fetchUsers = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from('profiles').select('user_id, full_name, department, position'),
      supabase.from('user_roles').select('id, user_id, role'),
    ]);
    if (!profiles || !roles) {
      toast({ title: 'Eroare', description: 'Nu s-au putut încărca utilizatorii.', variant: 'destructive' });
      setLoading(false);
      return;
    }
    const usersWithRoles: UserWithRole[] = profiles.map(profile => {
      const userRole = roles.find(r => r.user_id === profile.user_id);
      return {
        user_id: profile.user_id,
        full_name: profile.full_name,
        department: profile.department,
        position: profile.position,
        role: (userRole?.role as string) || 'user',
        role_id: userRole?.id || ''
      };
    });
    setUsers(usersWithRoles);
    setLoading(false);
  };

  const updateUserRole = async (userId: string, roleId: string, newRole: string) => {
    setUpdating(userId);
    const oldUser = users.find(u => u.user_id === userId);
    const { error } = await supabase.from('user_roles').update({ role: newRole as any }).eq('id', roleId);
    if (error) {
      toast({ title: 'Eroare', description: 'Nu s-a putut actualiza rolul.', variant: 'destructive' });
    } else {
      toast({ title: 'Succes', description: 'Rolul a fost actualizat.' });
      setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, role: newRole } : u));
      if (user?.id) {
        await supabase.rpc('log_audit_event', {
          _user_id: user.id, _action: 'role_change', _entity_type: 'user_role', _entity_id: userId,
          _details: { user_name: oldUser?.full_name, old_role: oldUser?.role, new_role: newRole }
        });
      }
    }
    setUpdating(null);
  };

  const handleDeleteUser = async (userId: string) => {
    setDeleting(userId);
    const deletedUser = users.find(u => u.user_id === userId);
    try {
      const { data, error } = await supabase.functions.invoke('delete-user', { body: { userId } });
      if (error) throw error;
      if (data?.success) {
        toast({ title: 'Succes', description: 'Contul a fost șters din sistem.' });
        setUsers(prev => prev.filter(u => u.user_id !== userId));
        if (user?.id) {
          await supabase.rpc('log_audit_event', {
            _user_id: user.id, _action: 'user_delete', _entity_type: 'user', _entity_id: userId,
            _details: { deleted_user_name: deletedUser?.full_name, deleted_user_id: userId }
          });
        }
      } else {
        toast({ title: 'Eroare', description: data?.error || 'Nu s-a putut șterge contul.', variant: 'destructive' });
      }
    } catch (error: unknown) {
      toast({ title: 'Eroare', description: error instanceof Error ? error.message : 'Eroare necunoscută', variant: 'destructive' });
    }
    setDeleting(null);
    setDeleteConfirmUser(null);
  };

  const toggleBypass = async (userId: string, enabled: boolean) => {
    setTogglingBypass(userId);
    if (enabled) {
      const { error } = await supabase.from('ip_bypass_users').insert({ user_id: userId, added_by: user?.id } as any);
      if (!error) setBypassUsers(prev => new Set([...prev, userId]));
      else toast({ title: 'Eroare', description: 'Nu s-a putut activa bypass-ul.', variant: 'destructive' });
    } else {
      const { error } = await supabase.from('ip_bypass_users').delete().eq('user_id', userId);
      if (!error) setBypassUsers(prev => { const s = new Set(prev); s.delete(userId); return s; });
      else toast({ title: 'Eroare', description: 'Nu s-a putut dezactiva bypass-ul.', variant: 'destructive' });
    }
    setTogglingBypass(null);
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.department?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || (roleFilter === 'no_role' ? u.role_id === '' : u.role === roleFilter);
    return matchesSearch && matchesRole;
  });

  const noRoleCount = users.filter(u => u.role_id === '').length;

  return (
    <div className="space-y-4">
      <Tabs defaultValue="list" className="space-y-4">
        <TabsList className="h-auto flex-wrap gap-1 p-1">
          <TabsTrigger value="list" className="text-xs gap-1.5"><Users className="w-3.5 h-3.5" />Utilizatori ({users.length})</TabsTrigger>
          <TabsTrigger value="create" className="text-xs gap-1.5"><UserPlus className="w-3.5 h-3.5" />Creare Cont</TabsTrigger>
          <TabsTrigger value="requests" className="text-xs gap-1.5"><ClipboardList className="w-3.5 h-3.5" />Cereri Cont</TabsTrigger>
          <TabsTrigger value="invitations" className="text-xs gap-1.5"><Mail className="w-3.5 h-3.5" />Invitații</TabsTrigger>
          <TabsTrigger value="reminders" className="text-xs gap-1.5"><Bell className="w-3.5 h-3.5" />Remindere</TabsTrigger>
          <TabsTrigger value="preassign" className="text-xs gap-1.5"><Lock className="w-3.5 h-3.5" />Pre-atribuire</TabsTrigger>
          <TabsTrigger value="helpdesk" className="text-xs gap-1.5"><Headset className="w-3.5 h-3.5" />HelpDesk</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" />
                    Gestionare Utilizatori
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    {users.length} utilizatori • {noRoleCount > 0 && <span className="text-destructive font-medium">{noRoleCount} fără rol</span>}
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => { fetchUsers(); fetchBypassUsers(); }}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Reîncarcă
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="relative flex-1 group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                  <Input placeholder="Caută după nume sau departament..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <Filter className="w-3.5 h-3.5 mr-1.5" />
                    <SelectValue placeholder="Filtrează rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toate rolurile</SelectItem>
                    <SelectItem value="no_role">Fără rol</SelectItem>
                    {Object.entries(roleLabels).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Table */}
              {loading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">Nu au fost găsiți utilizatori</p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-6">Utilizator</TableHead>
                        <TableHead className="hidden md:table-cell">Departament</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead className="hidden sm:table-cell text-center">IP Bypass</TableHead>
                        <TableHead className="text-right pr-6">Acțiuni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((u) => (
                        <TableRow key={u.user_id} className={cn(
                          "group",
                          u.role_id === '' && "bg-destructive/5"
                        )}>
                          <TableCell className="pl-6">
                            <div className="flex items-center gap-3">
                              <Avatar className="w-8 h-8">
                                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{getInitials(u.full_name)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-medium text-foreground">{u.full_name}</p>
                                <p className="text-[11px] text-muted-foreground md:hidden">{u.department || '—'}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <span className="text-sm text-muted-foreground">{u.position || '—'}</span>
                            <br />
                            <span className="text-[11px] text-muted-foreground/70">{u.department || '—'}</span>
                          </TableCell>
                          <TableCell>
                            <Select value={u.role} onValueChange={(v) => updateUserRole(u.user_id, u.role_id, v)} disabled={updating === u.user_id}>
                              <SelectTrigger className="w-[140px] h-8 text-xs">
                                {updating === u.user_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <SelectValue />}
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(roleLabels).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <Globe className={cn("w-3.5 h-3.5", bypassUsers.has(u.user_id) ? 'text-emerald-500' : 'text-muted-foreground/30')} />
                              <Switch
                                checked={bypassUsers.has(u.user_id)}
                                onCheckedChange={(checked) => toggleBypass(u.user_id, checked)}
                                disabled={togglingBypass === u.user_id}
                                className="scale-[0.8]"
                              />
                            </div>
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            <Button
                              variant="ghost" size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteConfirmUser(u)}
                              disabled={u.user_id === user?.id}
                              title={u.user_id === user?.id ? 'Nu îți poți șterge propriul cont' : 'Șterge cont'}
                            >
                              <UserX className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="create"><ManualAccountCreate /></TabsContent>
        <TabsContent value="requests"><AccountRequestsPanel /></TabsContent>
        <TabsContent value="invitations"><InvitePlatformPanel /></TabsContent>
        <TabsContent value="reminders"><AccountReminderPanel /></TabsContent>
        <TabsContent value="preassign"><PreAssignRoles /></TabsContent>
        <TabsContent value="helpdesk"><HelpdeskPanel /></TabsContent>
      </Tabs>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteConfirmUser} onOpenChange={() => setDeleteConfirmUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Confirmare ștergere cont
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-2">
              <p>Ești sigur că vrei să ștergi contul utilizatorului <strong>{deleteConfirmUser?.full_name}</strong>?</p>
              <p className="text-destructive font-medium">Această acțiune este ireversibilă!</p>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>Contul de autentificare</li>
                <li>Profilul și rolurile</li>
                <li>Înregistrările HR și documentele</li>
                <li>Notificările</li>
              </ul>
              <p className="text-sm text-muted-foreground mt-2">Datele personale importate nu vor fi șterse.</p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmUser(null)}>Anulează</Button>
            <Button variant="destructive" onClick={() => deleteConfirmUser && handleDeleteUser(deleteConfirmUser.user_id)} disabled={deleting === deleteConfirmUser?.user_id}>
              {deleting === deleteConfirmUser?.user_id ? (<><Loader2 className="w-4 h-4 animate-spin mr-2" />Se șterge...</>) : (<><Trash2 className="w-4 h-4 mr-2" />Șterge definitiv</>)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsersPanel;
