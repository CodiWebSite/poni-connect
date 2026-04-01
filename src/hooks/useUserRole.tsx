import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useImpersonation } from '@/contexts/ImpersonationContext';

export type AppRole = 'user' | 'super_admin' | 'hr' | 'sef' | 'sef_srus' | 'director_institut' | 'director_adjunct' | 'secretar_stiintific' | 'bibliotecar' | 'salarizare' | 'achizitii' | 'contabilitate' | 'oficiu_juridic' | 'compartiment_comunicare' | 'secretariat' | 'medic_medicina_muncii';

export function useUserRole() {
  const { user } = useAuth();
  const { isImpersonating, impersonatedRole } = useImpersonation();
  const [realRole, setRealRole] = useState<AppRole | null>(null);
  const [allRoles, setAllRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRealRole(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const fetchRole = async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (error || !data?.length) {
        setRealRole('user');
        setLoading(false);
        return;
      }

      const validRoles: AppRole[] = [
        'super_admin', 'admin', 'hr', 'sef_srus', 'salarizare', 'sef',
        'director_institut', 'director_adjunct', 'secretar_stiintific',
        'bibliotecar', 'achizitii', 'contabilitate', 'oficiu_juridic',
        'compartiment_comunicare', 'secretariat', 'medic_medicina_muncii', 'user'
      ];

      const assignedRoles = data
        .map((row) => row.role as string)
        .filter((r): r is AppRole => validRoles.includes(r as AppRole));

      const resolvedRole = validRoles.find((r) => assignedRoles.includes(r)) ?? 'user';
      setRealRole(resolvedRole);
      setAllRoles(assignedRoles);
      setLoading(false);
    };

    fetchRole();
  }, [user]);

  // Effective role: impersonated if active, otherwise real
  const role = isImpersonating && impersonatedRole ? impersonatedRole : realRole;
  // Real super_admin status (never overridden by impersonation — needed for admin access)
  const isRealSuperAdmin = realRole === 'super_admin';

  const isSuperAdmin = role === 'super_admin';
  const isHR = role === 'hr' || (isSuperAdmin && allRoles.includes('hr'));
  const isSef = role === 'sef' || (isSuperAdmin && allRoles.includes('sef'));
  const isSefSRUS = role === 'sef_srus' || (isSuperAdmin && allRoles.includes('sef_srus'));
  const isBibliotecar = role === 'bibliotecar' || isSuperAdmin || allRoles.includes('bibliotecar');
  const isSalarizare = role === 'salarizare' || isSuperAdmin || allRoles.includes('salarizare');
  const isMedicMuncii = role === 'medic_medicina_muncii' || (isSuperAdmin && allRoles.includes('medic_medicina_muncii'));
  const isStaff = isSuperAdmin || isHR || isSefSRUS;
  
  const canManageHR = isSuperAdmin || isHR || isSefSRUS;
  const canManageContent = role !== null && role !== 'user';
  const canManageLibrary = isSuperAdmin || isBibliotecar;
  const canAccessMedical = isMedicMuncii || isHR || isSefSRUS || isSuperAdmin;

  return { 
    role, 
    realRole,
    isRealSuperAdmin,
    isSuperAdmin,
    isHR,
    isSef,
    isSefSRUS,
    isBibliotecar,
    isSalarizare,
    isMedicMuncii,
    isStaff,
    canManageContent,
    canManageHR,
    canManageLibrary,
    canAccessMedical,
    loading 
  };
}
