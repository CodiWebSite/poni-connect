import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Search, Shield, Users, Loader2, Trash2, AlertTriangle, UserX } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AuditLog from '@/components/admin/AuditLog';

type AppRole = 'admin' | 'user' | 'super_admin' | 'department_head' | 'secretariat' | 'director' | 'hr' | 'achizitii_contabilitate';

interface UserWithRole {
  user_id: string;
  full_name: string;
  department: string | null;
  position: string | null;
  role: AppRole;
  role_id: string;
}

const roleLabels: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Administrator',
  director: 'Director',
  department_head: 'Șef Compartiment',
  hr: 'HR (SRUS)',
  achizitii_contabilitate: 'Achiziții-Contabilitate',
  secretariat: 'Secretariat',
  user: 'Angajat'
};

const roleBadgeColors: Record<AppRole, string> = {
  super_admin: 'bg-destructive text-destructive-foreground',
  admin: 'bg-primary text-primary-foreground',
  director: 'bg-accent text-accent-foreground',
  department_head: 'bg-info text-info-foreground',
  hr: 'bg-purple-500 text-white',
  achizitii_contabilitate: 'bg-orange-500 text-white',
  secretariat: 'bg-success text-success-foreground',
  user: 'bg-muted text-muted-foreground'
};

const Admin = () => {
  const { user } = useAuth();
  const { role } = useUserRole();
  const { toast } = useToast();
  
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<UserWithRole | null>(null);

  useEffect(() => {
    if (role === 'super_admin') {
      fetchUsers();
    }
  }, [role]);

  const fetchUsers = async () => {
    setLoading(true);
    
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, full_name, department, position');
    
    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      toast({ title: 'Eroare', description: 'Nu s-au putut încărca utilizatorii.', variant: 'destructive' });
      setLoading(false);
      return;
    }

    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('id, user_id, role');
    
    if (rolesError) {
      console.error('Error fetching roles:', rolesError);
      toast({ title: 'Eroare', description: 'Nu s-au putut încărca rolurile.', variant: 'destructive' });
      setLoading(false);
      return;
    }

    const usersWithRoles: UserWithRole[] = profiles?.map(profile => {
      const userRole = roles?.find(r => r.user_id === profile.user_id);
      return {
        user_id: profile.user_id,
        full_name: profile.full_name,
        department: profile.department,
        position: profile.position,
        role: (userRole?.role as AppRole) || 'user',
        role_id: userRole?.id || ''
      };
    }) || [];

    setUsers(usersWithRoles);
    setLoading(false);
  };

  const updateUserRole = async (userId: string, roleId: string, newRole: AppRole) => {
    setUpdating(userId);
    const oldUser = users.find(u => u.user_id === userId);
    
    const { error } = await supabase
      .from('user_roles')
      .update({ role: newRole })
      .eq('id', roleId);

    if (error) {
      console.error('Error updating role:', error);
      toast({ title: 'Eroare', description: 'Nu s-a putut actualiza rolul.', variant: 'destructive' });
    } else {
      toast({ title: 'Succes', description: 'Rolul a fost actualizat.' });
      setUsers(prev => prev.map(u => 
        u.user_id === userId ? { ...u, role: newRole } : u
      ));
      // Log audit event
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
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId },
      });

      if (error) throw error;

      if (data?.success) {
        toast({ title: 'Succes', description: 'Contul a fost șters din sistem.' });
        setUsers(prev => prev.filter(u => u.user_id !== userId));
        // Log audit event
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
      console.error('Error deleting user:', error);
      const msg = error instanceof Error ? error.message : 'Eroare necunoscută';
      toast({ title: 'Eroare', description: msg, variant: 'destructive' });
    }
    
    setDeleting(null);
    setDeleteConfirmUser(null);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const filteredUsers = users.filter(u =>
    u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.department?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.position?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Redirect if not super_admin
  if (role && role !== 'super_admin') {
    return <Navigate to="/" replace />;
  }

  return (
    <MainLayout title="Administrare" description="Gestionează rolurile și configurările sistemului">
      <Tabs defaultValue="roles" className="space-y-6">
        <TabsList>
          <TabsTrigger value="roles">Roluri</TabsTrigger>
          <TabsTrigger value="audit">Jurnal Audit</TabsTrigger>
        </TabsList>
        <TabsContent value="roles" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Gestionare Roluri
            </CardTitle>
            <CardDescription>
              Setează rolurile pentru fiecare utilizator din sistem
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Caută utilizatori..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
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
                  <div
                    key={u.user_id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 bg-secondary/30 rounded-lg border border-border"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Avatar className="w-10 h-10 flex-shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {getInitials(u.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-foreground truncate">{u.full_name}</p>
                          <Badge className={`${roleBadgeColors[u.role]} text-xs`} variant="secondary">
                            {roleLabels[u.role]}
                          </Badge>
                        </div>
                        <p className="text-xs sm:text-sm text-muted-foreground truncate">
                          {u.position || 'Fără funcție'} • {u.department || 'Fără departament'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Select
                        value={u.role}
                        onValueChange={(value) => updateUserRole(u.user_id, u.role_id, value as AppRole)}
                        disabled={updating === u.user_id}
                      >
                        <SelectTrigger className="w-full sm:w-48">
                          {updating === u.user_id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <SelectValue />
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(roleLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        className="flex-shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteConfirmUser(u)}
                        disabled={u.user_id === user?.id}
                        title={u.user_id === user?.id ? 'Nu îți poți șterge propriul cont' : 'Șterge cont'}
                      >
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
        <TabsContent value="audit">
          <AuditLog />
        </TabsContent>
      </Tabs>

      {/* Delete user confirmation dialog */}
      <Dialog open={!!deleteConfirmUser} onOpenChange={() => setDeleteConfirmUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Confirmare ștergere cont
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-2">
              <p>
                Ești sigur că vrei să ștergi contul utilizatorului{' '}
                <strong>{deleteConfirmUser?.full_name}</strong>?
              </p>
              <p className="text-destructive font-medium">
                Această acțiune este ireversibilă! Se vor șterge:
              </p>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>Contul de autentificare</li>
                <li>Profilul și rolurile</li>
                <li>Înregistrările HR și documentele angajatului</li>
                <li>Cererile de achiziții</li>
                <li>Sugestiile trimise</li>
                <li>Notificările</li>
              </ul>
              <p className="text-sm text-muted-foreground mt-2">
                Datele personale importate (CNP, CI, adresă) nu vor fi șterse.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmUser(null)}>
              Anulează
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmUser && handleDeleteUser(deleteConfirmUser.user_id)}
              disabled={deleting === deleteConfirmUser?.user_id}
            >
              {deleting === deleteConfirmUser?.user_id ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Se șterge...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Șterge definitiv
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Admin;
