import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole, AppRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Search, Shield, Users, Loader2, Trash2, AlertTriangle, UserX, UserPlus, Mail, Globe, Lock, ClipboardList, UserCheck, Activity, Package, Settings, Headset, Megaphone, CalendarDays, Bell, MonitorCheck, FileText } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AuditLog from '@/components/admin/AuditLog';
import PreAssignRoles from '@/components/admin/PreAssignRoles';
import ManualAccountCreate from '@/components/admin/ManualAccountCreate';
import AccountRequestsPanel from '@/components/admin/AccountRequestsPanel';
import AuthLoginLog from '@/components/admin/AuthLoginLog';
import EquipmentRegistry from '@/components/admin/EquipmentRegistry';
import AppSettingsPanel from '@/components/admin/AppSettingsPanel';
import InvitePlatformPanel from '@/components/admin/InvitePlatformPanel';
import HelpdeskPanel from '@/components/admin/HelpdeskPanel';
import AnnouncementPublishersPanel from '@/components/admin/AnnouncementPublishersPanel';
import EventPublishersPanel from '@/components/admin/EventPublishersPanel';
import AccountReminderPanel from '@/components/admin/AccountReminderPanel';
import OperationalRulesPanel from '@/components/admin/OperationalRulesPanel';
import UptimeMonitorPanel from '@/components/admin/UptimeMonitorPanel';

const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  director_institut: 'Director',
  director_adjunct: 'Director Adjunct',
  secretar_stiintific: 'Secretar Științific',
  sef_srus: 'Șef Serviciu Resurse Umane',
  sef: 'Șef Departament',
  hr: 'HR (SRUS)',
  bibliotecar: 'Bibliotecar',
  salarizare: 'Salarizare',
  secretariat: 'Secretariat',
  achizitii: 'Achiziții',
  contabilitate: 'Contabilitate',
  oficiu_juridic: 'Oficiu Juridic',
  compartiment_comunicare: 'Compartiment Comunicare',
  medic_medicina_muncii: 'Medic Medicina Muncii',
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

const Admin = () => {
  const { user } = useAuth();
  const { role, isRealSuperAdmin } = useUserRole();
  const { toast } = useToast();
  
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<UserWithRole | null>(null);
  const [bypassUsers, setBypassUsers] = useState<Set<string>>(new Set());
  const [togglingBypass, setTogglingBypass] = useState<string | null>(null);
  useEffect(() => {
    if (isRealSuperAdmin) {
      fetchUsers();
      fetchBypassUsers();
    }
  }, [isRealSuperAdmin]);

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
      const r = userRole?.role as string || 'user';
      const validRoles = ['super_admin', 'director_institut', 'director_adjunct', 'secretar_stiintific', 'sef_srus', 'sef', 'hr', 'bibliotecar', 'salarizare', 'achizitii', 'contabilitate', 'oficiu_juridic', 'compartiment_comunicare', 'secretariat', 'admin', 'user'];
      const mappedRole = validRoles.includes(r) ? r : r;
      return {
        user_id: profile.user_id,
        full_name: profile.full_name,
        department: profile.department,
        position: profile.position,
        role: mappedRole,
        role_id: userRole?.id || ''
      };
    });

    setUsers(usersWithRoles);
    setLoading(false);
  };

  const updateUserRole = async (userId: string, roleId: string, newRole: string) => {
    setUpdating(userId);
    const oldUser = users.find(u => u.user_id === userId);
    
      const { error } = await supabase
      .from('user_roles')
      .update({ role: newRole as any })
      .eq('id', roleId);

    if (error) {
      toast({ title: 'Eroare', description: 'Nu s-a putut actualiza rolul.', variant: 'destructive' });
    } else {
      toast({ title: 'Succes', description: 'Rolul a fost actualizat.' });
      setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, role: newRole } : u));
      if (user?.id) {
        await supabase.rpc('log_audit_event', {
          _user_id: user.id,
          _action: 'role_change',
          _entity_type: 'user_role',
          _entity_id: userId,
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
            _user_id: user.id,
            _action: 'user_delete',
            _entity_type: 'user',
            _entity_id: userId,
            _details: { deleted_user_name: deletedUser?.full_name, deleted_user_id: userId }
          });
        }
      } else {
        toast({ title: 'Eroare', description: data?.error || 'Nu s-a putut șterge contul.', variant: 'destructive' });
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Eroare necunoscută';
      toast({ title: 'Eroare', description: msg, variant: 'destructive' });
    }
    
    setDeleting(null);
    setDeleteConfirmUser(null);
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

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

  const filteredUsers = users.filter(u =>
    u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.department?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (role && !isRealSuperAdmin) return <Navigate to="/" replace />;

  return (
    <MainLayout title="Administrare" description="Gestionează rolurile și configurările sistemului">
      <Tabs defaultValue="roles" className="space-y-4 md:space-y-6">
         <div className="overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0 scrollbar-hide">
           <TabsList className="inline-flex md:flex md:flex-wrap h-auto gap-1 p-1.5 min-w-max md:min-w-0 bg-muted/50 backdrop-blur-sm">
             <TabsTrigger value="roles" className="text-[11px] sm:text-sm px-2.5 sm:px-3 gap-1.5 data-[state=active]:shadow-md">
               <Shield className="w-3.5 h-3.5" />
               Roluri
             </TabsTrigger>
             <TabsTrigger value="preassign" className="text-[11px] sm:text-sm px-2.5 sm:px-3 gap-1.5 data-[state=active]:shadow-md">
               <Lock className="w-3.5 h-3.5" />
               Pre-atribuire
             </TabsTrigger>
             <TabsTrigger value="create-account" className="text-[11px] sm:text-sm px-2.5 sm:px-3 gap-1.5 data-[state=active]:shadow-md">
               <UserPlus className="w-3.5 h-3.5" />
               Creare Cont
             </TabsTrigger>
             <TabsTrigger value="account-requests" className="text-[11px] sm:text-sm px-2.5 sm:px-3 gap-1.5 data-[state=active]:shadow-md">
               <ClipboardList className="w-3.5 h-3.5" />
               Cereri Cont
             </TabsTrigger>
             <TabsTrigger value="audit" className="text-[11px] sm:text-sm px-2.5 sm:px-3 gap-1.5 data-[state=active]:shadow-md">
               <FileText className="w-3.5 h-3.5" />
               Audit
             </TabsTrigger>
             <TabsTrigger value="auth-log" className="text-[11px] sm:text-sm px-2.5 sm:px-3 gap-1.5 data-[state=active]:shadow-md">
               <Activity className="w-3.5 h-3.5" />
               Autentificări
             </TabsTrigger>
             <TabsTrigger value="inventory" className="text-[11px] sm:text-sm px-2.5 sm:px-3 gap-1.5 data-[state=active]:shadow-md">
               <Package className="w-3.5 h-3.5" />
               Inventar
             </TabsTrigger>
             <TabsTrigger value="invitations" className="text-[11px] sm:text-sm px-2.5 sm:px-3 gap-1.5 data-[state=active]:shadow-md">
               <Mail className="w-3.5 h-3.5" />
               Invitații
             </TabsTrigger>
             <TabsTrigger value="helpdesk" className="text-[11px] sm:text-sm px-2.5 sm:px-3 gap-1.5 data-[state=active]:shadow-md">
               <Headset className="w-3.5 h-3.5" />
               HelpDesk
             </TabsTrigger>
             <TabsTrigger value="publishers" className="text-[11px] sm:text-sm px-2.5 sm:px-3 gap-1.5 data-[state=active]:shadow-md">
               <Megaphone className="w-3.5 h-3.5" />
               Anunțuri
             </TabsTrigger>
             <TabsTrigger value="event-publishers" className="text-[11px] sm:text-sm px-2.5 sm:px-3 gap-1.5 data-[state=active]:shadow-md">
               <CalendarDays className="w-3.5 h-3.5" />
               Evenimente
             </TabsTrigger>
             <TabsTrigger value="reminders" className="text-[11px] sm:text-sm px-2.5 sm:px-3 gap-1.5 data-[state=active]:shadow-md">
               <Bell className="w-3.5 h-3.5" />
               Remindere
             </TabsTrigger>
             <TabsTrigger value="rules" className="text-[11px] sm:text-sm px-2.5 sm:px-3 gap-1.5 data-[state=active]:shadow-md">
               <Settings className="w-3.5 h-3.5" />
               Reguli Acces
             </TabsTrigger>
             <TabsTrigger value="monitoring" className="text-[11px] sm:text-sm px-2.5 sm:px-3 gap-1.5 data-[state=active]:shadow-md">
               <MonitorCheck className="w-3.5 h-3.5" />
               Monitoring
             </TabsTrigger>
             <TabsTrigger value="settings" className="text-[11px] sm:text-sm px-2.5 sm:px-3 gap-1.5 data-[state=active]:shadow-md">
               <Settings className="w-3.5 h-3.5" />
               Setări
             </TabsTrigger>
           </TabsList>
         </div>
        <TabsContent value="roles" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Gestionare Roluri
              </CardTitle>
              <CardDescription>Setează rolurile pentru fiecare utilizator din sistem</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 group">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                   <Input placeholder="Caută utilizatori..." className="pl-10 transition-shadow duration-300 focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.1)]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                 </div>
               </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nu există utilizatori</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredUsers.map((u) => (
                    <div key={u.user_id} className="flex flex-col gap-3 p-3 sm:p-4 bg-secondary/30 rounded-lg border border-border">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs sm:text-sm">{getInitials(u.full_name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                            <p className="font-medium text-sm text-foreground truncate">{u.full_name}</p>
                            <Badge className={`${roleBadgeColors[u.role] || roleBadgeColors.user} text-[10px] sm:text-xs`} variant="secondary">
                              {roleLabels[u.role] || 'Angajat'}
                            </Badge>
                          </div>
                          <p className="text-[11px] sm:text-sm text-muted-foreground truncate">
                            {u.position || 'Fără funcție'} • {u.department || 'Fără departament'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5" title={bypassUsers.has(u.user_id) ? 'Acces global activ — poate intra de oriunde' : 'Acces doar din rețeaua institutului'}>
                          <Globe className={`w-3.5 h-3.5 ${bypassUsers.has(u.user_id) ? 'text-emerald-500' : 'text-muted-foreground/40'}`} />
                          <Switch
                            checked={bypassUsers.has(u.user_id)}
                            onCheckedChange={(checked) => toggleBypass(u.user_id, checked)}
                            disabled={togglingBypass === u.user_id}
                            className="scale-90"
                          />
                        </div>
                        <Select value={u.role} onValueChange={(value) => updateUserRole(u.user_id, u.role_id, value)} disabled={updating === u.user_id}>
                          <SelectTrigger className="flex-1 min-w-[140px] sm:w-48 sm:flex-none text-xs sm:text-sm">
                            {updating === u.user_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <SelectValue />}
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(roleLabels).map(([value, label]) => (
                              <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" className="flex-shrink-0 h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteConfirmUser(u)} disabled={u.user_id === user?.id} title={u.user_id === user?.id ? 'Nu îți poți șterge propriul cont' : 'Șterge cont'}>
                          <UserX className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="preassign">
          <PreAssignRoles />
        </TabsContent>
        <TabsContent value="create-account">
          <ManualAccountCreate />
        </TabsContent>
        <TabsContent value="account-requests">
          <AccountRequestsPanel />
        </TabsContent>
        <TabsContent value="audit">
          <AuditLog />
        </TabsContent>
        <TabsContent value="auth-log">
          <AuthLoginLog />
        </TabsContent>
        <TabsContent value="inventory">
          <EquipmentRegistry />
        </TabsContent>
        <TabsContent value="invitations">
          <InvitePlatformPanel />
        </TabsContent>
        <TabsContent value="helpdesk">
          <HelpdeskPanel />
        </TabsContent>
        <TabsContent value="publishers">
          <AnnouncementPublishersPanel />
        </TabsContent>
        <TabsContent value="event-publishers">
          <EventPublishersPanel />
        </TabsContent>
        <TabsContent value="reminders">
          <AccountReminderPanel />
        </TabsContent>
        <TabsContent value="rules">
          <OperationalRulesPanel />
        </TabsContent>
        <TabsContent value="monitoring">
          <UptimeMonitorPanel />
        </TabsContent>
        <TabsContent value="settings">
          <AppSettingsPanel />
        </TabsContent>
      </Tabs>

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
    </MainLayout>
  );
};

export default Admin;
