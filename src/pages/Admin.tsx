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
import { Search, Shield, Users, Loader2, Building, Trash2, Plus, AlertTriangle, UserX } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type AppRole = 'admin' | 'user' | 'super_admin' | 'department_head' | 'secretariat' | 'director' | 'hr' | 'achizitii_contabilitate';

interface UserWithRole {
  user_id: string;
  full_name: string;
  department: string | null;
  position: string | null;
  role: AppRole;
  role_id: string;
}

interface DepartmentHead {
  id: string;
  department: string;
  head_user_id: string;
  head_name?: string;
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
  
  // Department Heads state
  const [departmentHeads, setDepartmentHeads] = useState<DepartmentHead[]>([]);
  const [loadingDeptHeads, setLoadingDeptHeads] = useState(true);
  const [newDepartment, setNewDepartment] = useState('');
  const [newHeadUserId, setNewHeadUserId] = useState('');
  const [savingDeptHead, setSavingDeptHead] = useState(false);

  useEffect(() => {
    if (role === 'super_admin') {
      fetchUsers();
      fetchDepartmentHeads();
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

  const fetchDepartmentHeads = async () => {
    setLoadingDeptHeads(true);
    
    const { data, error } = await supabase
      .from('department_heads')
      .select('*')
      .order('department');
    
    if (error) {
      console.error('Error fetching department heads:', error);
      toast({ title: 'Eroare', description: 'Nu s-au putut încărca șefii de departament.', variant: 'destructive' });
    } else if (data) {
      setDepartmentHeads(data);
    }
    
    setLoadingDeptHeads(false);
  };

  const updateUserRole = async (userId: string, roleId: string, newRole: AppRole) => {
    setUpdating(userId);
    
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
    }
    
    setUpdating(null);
  };

  const saveDepartmentHead = async () => {
    if (!newDepartment.trim() || !newHeadUserId) {
      toast({ title: 'Eroare', description: 'Completați departamentul și selectați șeful.', variant: 'destructive' });
      return;
    }

    setSavingDeptHead(true);
    
    // Check if department already exists
    const existing = departmentHeads.find(d => d.department.toLowerCase() === newDepartment.trim().toLowerCase());
    
    if (existing) {
      // Update existing
      const { error } = await supabase
        .from('department_heads')
        .update({ head_user_id: newHeadUserId })
        .eq('id', existing.id);
      
      if (error) {
        console.error('Error updating department head:', error);
        toast({ title: 'Eroare', description: 'Nu s-a putut actualiza șeful de departament.', variant: 'destructive' });
      } else {
        toast({ title: 'Succes', description: 'Șeful de departament a fost actualizat.' });
        fetchDepartmentHeads();
        setNewDepartment('');
        setNewHeadUserId('');
      }
    } else {
      // Insert new
      const { error } = await supabase
        .from('department_heads')
        .insert({ department: newDepartment.trim(), head_user_id: newHeadUserId });
      
      if (error) {
        console.error('Error inserting department head:', error);
        toast({ title: 'Eroare', description: 'Nu s-a putut adăuga șeful de departament.', variant: 'destructive' });
      } else {
        toast({ title: 'Succes', description: 'Șeful de departament a fost adăugat.' });
        fetchDepartmentHeads();
        setNewDepartment('');
        setNewHeadUserId('');
      }
    }
    
    setSavingDeptHead(false);
  };

  const deleteDepartmentHead = async (id: string) => {
    const { error } = await supabase
      .from('department_heads')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting department head:', error);
      toast({ title: 'Eroare', description: 'Nu s-a putut șterge configurația.', variant: 'destructive' });
    } else {
      toast({ title: 'Succes', description: 'Configurația a fost ștearsă.' });
      fetchDepartmentHeads();
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setDeleting(userId);
    
    try {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId },
      });

      if (error) throw error;

      if (data?.success) {
        toast({ title: 'Succes', description: 'Contul a fost șters din sistem.' });
        setUsers(prev => prev.filter(u => u.user_id !== userId));
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

  // Get unique departments from profiles
  const uniqueDepartments = [...new Set(users.map(u => u.department).filter(Boolean))] as string[];

  // Filter users by selected department for the head selection
  const usersInSelectedDepartment = newDepartment 
    ? users.filter(u => u.department?.toLowerCase() === newDepartment.toLowerCase())
    : [];

  const getHeadName = (headUserId: string) => {
    const user = users.find(u => u.user_id === headUserId);
    return user?.full_name || 'Necunoscut';
  };

  // Redirect if not super_admin
  if (role && role !== 'super_admin') {
    return <Navigate to="/" replace />;
  }

  return (
    <MainLayout title="Administrare" description="Gestionează rolurile și configurările sistemului">
      <div className="space-y-6">
        <Tabs defaultValue="roles" className="space-y-6">
          <TabsList>
            <TabsTrigger value="roles" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Roluri
            </TabsTrigger>
            <TabsTrigger value="departments" className="flex items-center gap-2">
              <Building className="w-4 h-4" />
              Șefi Departament
            </TabsTrigger>
          </TabsList>

          <TabsContent value="roles">
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

          <TabsContent value="departments">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="w-5 h-5 text-primary" />
                  Configurare Șefi de Departament
                </CardTitle>
                <CardDescription>
                  Asociază fiecare departament cu șeful său. Cererile HR vor fi rutate automat la șeful corespunzător.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Add new department head */}
                <div className="p-4 border rounded-lg bg-secondary/20 space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Adaugă / Actualizează Departament
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Departament</label>
                      <Select 
                        value={newDepartment} 
                        onValueChange={(val) => {
                          setNewDepartment(val);
                          setNewHeadUserId(''); // Reset head selection when department changes
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selectează departament" />
                        </SelectTrigger>
                        <SelectContent>
                          {uniqueDepartments.map(dept => (
                            <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input 
                        placeholder="Sau introdu manual..."
                        value={newDepartment}
                        onChange={(e) => {
                          setNewDepartment(e.target.value);
                          setNewHeadUserId('');
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Șef Compartiment</label>
                      <Select 
                        value={newHeadUserId} 
                        onValueChange={setNewHeadUserId}
                        disabled={!newDepartment}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={newDepartment ? "Selectează șef" : "Selectează departament întâi"} />
                        </SelectTrigger>
                        <SelectContent>
                          {usersInSelectedDepartment.length === 0 ? (
                            <SelectItem value="none" disabled>
                              {newDepartment ? "Nu există angajați în acest departament" : "Selectează un departament"}
                            </SelectItem>
                          ) : (
                            usersInSelectedDepartment.map(u => (
                              <SelectItem key={u.user_id} value={u.user_id}>
                                {u.full_name} - {u.position || 'Fără funcție'}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {newDepartment 
                          ? `${usersInSelectedDepartment.length} angajați în ${newDepartment}`
                          : "Selectează un departament pentru a vedea angajații"
                        }
                      </p>
                    </div>
                    <div className="flex items-end">
                      <Button 
                        onClick={saveDepartmentHead} 
                        disabled={savingDeptHead || !newDepartment || !newHeadUserId}
                        className="w-full"
                      >
                        {savingDeptHead ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                        Salvează
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Current department heads */}
                <div className="space-y-3">
                  <h4 className="font-medium">Configurări Curente</h4>
                  {loadingDeptHeads ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : departmentHeads.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Building className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Nu există configurări. Adaugă un departament mai sus.</p>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {departmentHeads.map(dh => {
                        const headUser = users.find(u => u.user_id === dh.head_user_id);
                        return (
                          <div 
                            key={dh.id}
                            className="flex items-center justify-between p-4 border rounded-lg bg-background"
                          >
                            <div className="flex items-center gap-4">
                              <div className="p-2 rounded-lg bg-primary/10">
                                <Building className="w-5 h-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium">{dh.department}</p>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                  <p className="text-sm text-muted-foreground">
                                    Șef: <span className="font-medium text-foreground">{getHeadName(dh.head_user_id)}</span>
                                  </p>
                                  {headUser?.position && (
                                    <span className="text-xs text-muted-foreground">
                                      • {headUser.position}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => deleteDepartmentHead(dh.id)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

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
                <li>Cererile HR și documentele angajatului</li>
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
