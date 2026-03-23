import { useState, useEffect } from 'react';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, Users, User } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const ROLE_LABELS: Record<string, string> = {
  user: 'Angajat',
  admin: 'Admin',
  super_admin: 'Super Admin',
  director_institut: 'Director',
  director_adjunct: 'Dir. Adjunct',
  secretar_stiintific: 'Secretar Șt.',
  sef_srus: 'Șef SRUS',
  sef: 'Șef Dept.',
  hr: 'HR',
  bibliotecar: 'Bibliotecar',
  salarizare: 'Salarizare',
  secretariat: 'Secretariat',
  achizitii: 'Achiziții',
  contabilitate: 'Contabilitate',
  oficiu_juridic: 'Oficiu Juridic',
  compartiment_comunicare: 'Comunicare',
  medic_medicina_muncii: 'Medic MM',
};

interface UserOption {
  user_id: string;
  full_name: string;
  role: string;
}

const ImpersonationBanner = () => {
  const { user } = useAuth();
  const {
    isImpersonating, impersonatedRole, impersonatedUserName,
    startRoleImpersonation, startUserImpersonation, stopImpersonation,
  } = useImpersonation();
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [search, setSearch] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Check real super_admin status directly (bypass impersonation)
  const [isRealSuperAdmin, setIsRealSuperAdmin] = useState(false);
  useEffect(() => {
    if (!user) return;
    supabase.from('user_roles').select('role').eq('user_id', user.id).then(({ data }) => {
      setIsRealSuperAdmin(data?.some(r => r.role === 'super_admin') || false);
    });
  }, [user]);

  const fetchUsers = async () => {
    if (users.length > 0) return;
    setLoadingUsers(true);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from('profiles').select('user_id, full_name, email:user_id'),
      supabase.from('user_roles').select('user_id, role'),
    ]);
    // Fetch emails from employee_personal_data via employee_records
    const userIds = (profiles || []).map(p => p.user_id);
    let emailMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: records } = await supabase.from('employee_records').select('user_id').in('user_id', userIds);
      const recordUserIds = (records || []).map(r => r.user_id);
      if (recordUserIds.length > 0) {
        const { data: epdData } = await supabase.from('employee_personal_data').select('email, employee_record_id').in('employee_record_id', 
          (await supabase.from('employee_records').select('id, user_id').in('user_id', recordUserIds)).data?.map(r => r.id) || []
        );
        const recToUser: Record<string, string> = {};
        (await supabase.from('employee_records').select('id, user_id').in('user_id', recordUserIds)).data?.forEach(r => { recToUser[r.id] = r.user_id; });
        (epdData || []).forEach(e => { if (e.employee_record_id && recToUser[e.employee_record_id]) emailMap[recToUser[e.employee_record_id]] = e.email; });
      }
    }
    if (profiles && roles) {
      const roleMap = new Map(roles.map(r => [r.user_id, r.role as string]));
      setUsers(
        profiles
          .filter(p => p.user_id !== user?.id)
          .map(p => ({
            user_id: p.user_id,
            full_name: p.full_name || 'Fără nume',
            role: roleMap.get(p.user_id) || 'user',
            email: emailMap[p.user_id] || '',
          }))
          .sort((a, b) => a.full_name.localeCompare(b.full_name))
      );
    }
    setLoadingUsers(false);
  };

  if (!isRealSuperAdmin) return null;

  const filteredUsers = users.filter(u =>
    u.full_name.toLowerCase().includes(search.toLowerCase())
  );

  if (isImpersonating) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-center gap-3 shadow-lg animate-in slide-in-from-top duration-300">
        <Eye className="w-4 h-4" />
        <span className="text-sm font-semibold">
          Vizualizare ca: {impersonatedUserName || ROLE_LABELS[impersonatedRole || ''] || impersonatedRole}
          {impersonatedRole && (
            <Badge variant="outline" className="ml-2 bg-amber-400/30 border-amber-700/30 text-amber-950 text-[10px]">
              {ROLE_LABELS[impersonatedRole] || impersonatedRole}
            </Badge>
          )}
        </span>
        <Button
          size="sm"
          variant="outline"
          className="h-7 bg-amber-400/40 border-amber-700/30 text-amber-950 hover:bg-amber-400/60 hover:text-amber-950 text-xs"
          onClick={stopImpersonation}
        >
          <EyeOff className="w-3 h-3 mr-1" />
          Oprește
        </Button>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) fetchUsers(); }}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="fixed top-3 right-3 z-[100] h-8 gap-1.5 bg-background/80 backdrop-blur-sm border-border/50 text-xs shadow-md hover:shadow-lg transition-shadow"
        >
          <Eye className="w-3.5 h-3.5" />
          View As
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <Tabs defaultValue="role" className="w-full">
          <div className="border-b px-3 pt-3 pb-0">
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-primary" />
              Impersonare Controlată
            </h4>
            <TabsList className="w-full h-8 mb-2">
              <TabsTrigger value="role" className="text-xs flex-1 gap-1">
                <Users className="w-3 h-3" />Rol
              </TabsTrigger>
              <TabsTrigger value="user" className="text-xs flex-1 gap-1">
                <User className="w-3 h-3" />Utilizator
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="role" className="p-3 space-y-2 mt-0">
            <p className="text-xs text-muted-foreground">Selectează un rol pentru a vedea platforma ca acel rol:</p>
            <div className="grid grid-cols-2 gap-1.5">
              {Object.entries(ROLE_LABELS)
                .filter(([k]) => k !== 'super_admin')
                .map(([key, label]) => (
                  <Button
                    key={key}
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs justify-start"
                    onClick={() => {
                      startRoleImpersonation(key as AppRole);
                      setOpen(false);
                    }}
                  >
                    {label}
                  </Button>
                ))}
            </div>
          </TabsContent>

          <TabsContent value="user" className="p-3 space-y-2 mt-0">
            <Input
              placeholder="Caută utilizator..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8 text-xs"
            />
            <div className="max-h-56 overflow-y-auto space-y-1">
              {loadingUsers ? (
                <p className="text-xs text-muted-foreground text-center py-4">Se încarcă...</p>
              ) : filteredUsers.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Niciun rezultat</p>
              ) : (
                filteredUsers.slice(0, 50).map(u => (
                  <button
                    key={u.user_id}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors text-left"
                    onClick={() => {
                      startUserImpersonation(u.user_id, u.full_name, u.role as AppRole);
                      setOpen(false);
                    }}
                  >
                    <span className="text-xs font-medium flex-1 truncate">{u.full_name}</span>
                    <Badge variant="secondary" className="text-[9px] shrink-0">
                      {ROLE_LABELS[u.role] || u.role}
                    </Badge>
                  </button>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
};

export default ImpersonationBanner;
