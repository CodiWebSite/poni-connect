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
import { Search, Shield, Users, Loader2 } from 'lucide-react';
import { Navigate } from 'react-router-dom';

type AppRole = 'admin' | 'user' | 'super_admin' | 'department_head' | 'secretariat' | 'director';

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
  secretariat: 'Secretariat',
  user: 'Angajat'
};

const roleBadgeColors: Record<AppRole, string> = {
  super_admin: 'bg-destructive text-destructive-foreground',
  admin: 'bg-primary text-primary-foreground',
  director: 'bg-accent text-accent-foreground',
  department_head: 'bg-info text-info-foreground',
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
    <MainLayout title="Administrare" description="Gestionează rolurile utilizatorilor">
      <div className="space-y-6">
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
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default Admin;
