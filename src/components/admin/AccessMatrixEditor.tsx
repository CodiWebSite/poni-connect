import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Shield, Save, RotateCcw, Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const PAGE_META: Record<string, { label: string; category: string }> = {
  'dashboard': { label: 'Dashboard', category: 'General' },
  'announcements': { label: 'Anunțuri', category: 'General' },
  'my-profile': { label: 'Profilul Meu', category: 'General' },
  'leave-calendar': { label: 'Calendar Concedii', category: 'Concedii' },
  'formulare': { label: 'Formulare', category: 'General' },
  'leave-request': { label: 'Cerere Concediu', category: 'Concedii' },
  'my-team': { label: 'Echipa Mea', category: 'Management' },
  'library': { label: 'Bibliotecă', category: 'Servicii' },
  'room-bookings': { label: 'Programări Săli', category: 'General' },
  'activitati': { label: 'Activități Recreative', category: 'General' },
  'chat': { label: 'Mesagerie', category: 'General' },
  'medicina-muncii': { label: 'Medicină Muncii', category: 'Servicii' },
  'arhiva': { label: 'Arhivă Online', category: 'Servicii' },
  'ghid': { label: 'Ghid Platformă', category: 'General' },
  'install': { label: 'Instalează App', category: 'General' },
  'hr-management': { label: 'Gestiune HR', category: 'Management' },
  'salarizare': { label: 'Salarizare', category: 'Management' },
  'settings': { label: 'Setări', category: 'General' },
  'system-status': { label: 'Stare Sistem', category: 'Admin' },
  'carti-vizita': { label: 'Carte de Vizită', category: 'General' },
  'admin': { label: 'Administrare', category: 'Admin' },
  'changelog': { label: 'Changelog', category: 'Admin' },
};

const ROLE_META: Record<string, { label: string; color: string }> = {
  super_admin: { label: 'Super Admin', color: 'bg-destructive text-destructive-foreground' },
  admin: { label: 'Admin', color: 'bg-red-500 text-white' },
  director_institut: { label: 'Director', color: 'bg-indigo-700 text-white' },
  director_adjunct: { label: 'Dir. Adjunct', color: 'bg-indigo-500 text-white' },
  secretar_stiintific: { label: 'Secretar Șt.', color: 'bg-teal-600 text-white' },
  sef_srus: { label: 'Șef SRUS', color: 'bg-blue-600 text-white' },
  sef: { label: 'Șef Dept.', color: 'bg-amber-600 text-white' },
  hr: { label: 'HR', color: 'bg-purple-500 text-white' },
  bibliotecar: { label: 'Bibliotecar', color: 'bg-emerald-600 text-white' },
  salarizare: { label: 'Salarizare', color: 'bg-orange-600 text-white' },
  secretariat: { label: 'Secretariat', color: 'bg-cyan-600 text-white' },
  achizitii: { label: 'Achiziții', color: 'bg-rose-600 text-white' },
  contabilitate: { label: 'Contabilitate', color: 'bg-lime-700 text-white' },
  oficiu_juridic: { label: 'Oficiu Juridic', color: 'bg-slate-600 text-white' },
  compartiment_comunicare: { label: 'Comunicare', color: 'bg-fuchsia-600 text-white' },
  medic_medicina_muncii: { label: 'Medic MM', color: 'bg-pink-600 text-white' },
  user: { label: 'Angajat', color: 'bg-muted text-muted-foreground' },
};

const BUILTIN_ROLE_ORDER = Object.keys(ROLE_META);
const PAGE_ORDER = Object.keys(PAGE_META);
const CATEGORIES = [...new Set(Object.values(PAGE_META).map(p => p.category))];

interface PermissionRow {
  id: string;
  role_key: string;
  page_key: string;
  can_access: boolean;
}

interface CustomRoleMeta {
  key: string;
  label: string;
  color: string;
}

const AccessMatrixEditor = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [original, setOriginal] = useState<PermissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchRole, setSearchRole] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [customRoles, setCustomRoles] = useState<CustomRoleMeta[]>([]);

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    setLoading(true);
    const [{ data, error }, { data: crData }] = await Promise.all([
      supabase.from('role_page_permissions').select('id, role_key, page_key, can_access'),
      supabase.from('custom_roles').select('key, label, color'),
    ]);

    if (error) {
      toast({ title: 'Eroare', description: 'Nu s-au putut încărca permisiunile.', variant: 'destructive' });
    } else {
      const rows = (data || []) as PermissionRow[];
      setPermissions(rows);
      setOriginal(JSON.parse(JSON.stringify(rows)));
    }
    setCustomRoles((crData || []) as CustomRoleMeta[]);
    setLoading(false);
  };

  const togglePermission = (roleKey: string, pageKey: string) => {
    // Don't allow toggling super_admin permissions
    if (roleKey === 'super_admin') return;

    setPermissions(prev =>
      prev.map(p =>
        p.role_key === roleKey && p.page_key === pageKey
          ? { ...p, can_access: !p.can_access }
          : p
      )
    );
  };

  const getPermission = (roleKey: string, pageKey: string): boolean => {
    const row = permissions.find(p => p.role_key === roleKey && p.page_key === pageKey);
    return row?.can_access ?? true;
  };

  const hasChanges = (): boolean => {
    return permissions.some(p => {
      const orig = original.find(o => o.id === p.id);
      return orig && orig.can_access !== p.can_access;
    });
  };

  const changedCount = (): number => {
    return permissions.filter(p => {
      const orig = original.find(o => o.id === p.id);
      return orig && orig.can_access !== p.can_access;
    }).length;
  };

  const saveChanges = async () => {
    setSaving(true);
    const changed = permissions.filter(p => {
      const orig = original.find(o => o.id === p.id);
      return orig && orig.can_access !== p.can_access;
    });

    let errorCount = 0;
    for (const perm of changed) {
      const { error } = await supabase
        .from('role_page_permissions')
        .update({ can_access: perm.can_access, updated_at: new Date().toISOString() })
        .eq('id', perm.id);
      if (error) errorCount++;
    }

    if (errorCount === 0) {
      toast({ title: 'Succes', description: `${changed.length} permisiuni actualizate.` });
      setOriginal(JSON.parse(JSON.stringify(permissions)));
      // Log audit
      if (user?.id) {
        await supabase.rpc('log_audit_event', {
          _user_id: user.id,
          _action: 'permissions_update',
          _entity_type: 'role_page_permissions',
          _entity_id: null,
          _details: {
            changes: changed.map(c => ({
              role: c.role_key,
              page: c.page_key,
              new_access: c.can_access,
            })),
          },
        });
      }
    } else {
      toast({ title: 'Eroare', description: `${errorCount} permisiuni nu au putut fi salvate.`, variant: 'destructive' });
    }
    setSaving(false);
  };

  const resetChanges = () => {
    setPermissions(JSON.parse(JSON.stringify(original)));
  };

  // Merge built-in + custom roles
  const allRoleMeta: Record<string, { label: string; color: string }> = { ...ROLE_META };
  const ROLE_ORDER = [...BUILTIN_ROLE_ORDER];
  customRoles.forEach(cr => {
    allRoleMeta[cr.key] = { label: cr.label, color: cr.color };
    ROLE_ORDER.push(cr.key);
  });

  const filteredPages = PAGE_ORDER.filter(pk => {
    if (filterCategory !== 'all' && PAGE_META[pk].category !== filterCategory) return false;
    return true;
  });

  const filteredRoles = ROLE_ORDER.filter(rk =>
    allRoleMeta[rk]?.label.toLowerCase().includes(searchRole.toLowerCase())
  );

  const accessCountForRole = (roleKey: string) =>
    filteredPages.filter(pk => getPermission(roleKey, pk)).length;

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
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Matrice Acces Roluri → Pagini
          </CardTitle>
          <CardDescription>
            Configurează ce pagini poate accesa fiecare rol. Super Admin are acces permanent la tot.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex gap-2 flex-1">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Caută rol..."
                  className="pl-10"
                  value={searchRole}
                  onChange={e => setSearchRole(e.target.value)}
                />
              </div>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-40">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toate paginile</SelectItem>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              {hasChanges() && (
                <>
                  <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                    {changedCount()} modificări nesalvate
                  </Badge>
                  <Button variant="outline" size="sm" onClick={resetChanges}>
                    <RotateCcw className="w-4 h-4 mr-1" />
                    Anulează
                  </Button>
                </>
              )}
              <Button size="sm" onClick={saveChanges} disabled={!hasChanges() || saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                Salvează
              </Button>
            </div>
          </div>

          {/* Matrix */}
          <ScrollArea className="w-full">
            <div className="min-w-[800px]">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-background p-2 text-left font-semibold text-muted-foreground border-b min-w-[140px]">
                      Rol / Pagină
                    </th>
                    {filteredPages.map(pk => (
                      <th key={pk} className="p-1.5 text-center font-medium border-b min-w-[50px]">
                        <Tooltip delayDuration={0}>
                          <TooltipTrigger asChild>
                            <span className="cursor-help block truncate max-w-[60px]">
                              {PAGE_META[pk].label.split(' ')[0]}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{PAGE_META[pk].label}</TooltipContent>
                        </Tooltip>
                      </th>
                    ))}
                    <th className="p-2 text-center font-semibold text-muted-foreground border-b min-w-[60px]">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRoles.map(rk => {
                    const isSA = rk === 'super_admin';
                    return (
                      <tr key={rk} className={`border-b last:border-0 ${isSA ? 'bg-destructive/5' : 'hover:bg-muted/30'}`}>
                        <td className="sticky left-0 z-10 bg-background p-2">
                          <Badge className={`${ROLE_META[rk].color} text-[10px] whitespace-nowrap`} variant="secondary">
                            {ROLE_META[rk].label}
                          </Badge>
                        </td>
                        {filteredPages.map(pk => {
                          const enabled = getPermission(rk, pk);
                          const orig = original.find(o => o.role_key === rk && o.page_key === pk);
                          const changed = orig && orig.can_access !== enabled;
                          return (
                            <td key={pk} className={`p-1.5 text-center ${changed ? 'bg-amber-50 dark:bg-amber-950/30' : ''}`}>
                              <div className="flex justify-center">
                                <Switch
                                  checked={enabled}
                                  onCheckedChange={() => togglePermission(rk, pk)}
                                  disabled={isSA}
                                  className="scale-75"
                                />
                              </div>
                            </td>
                          );
                        })}
                        <td className="p-2 text-center">
                          <span className={`text-sm font-semibold ${
                            accessCountForRole(rk) === filteredPages.length
                              ? 'text-emerald-600'
                              : accessCountForRole(rk) === 0
                              ? 'text-destructive'
                              : 'text-amber-600'
                          }`}>
                            {accessCountForRole(rk)}/{filteredPages.length}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </ScrollArea>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 pt-4 border-t text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-emerald-500" />
              <span>Acces activat</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-muted" />
              <span>Acces dezactivat</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-amber-200" />
              <span>Modificat (nesalvat)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-destructive/20" />
              <span>Super Admin (permanent)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AccessMatrixEditor;
