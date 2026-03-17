import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type AppRole = 'user' | 'admin' | 'super_admin' | 'hr' | 'sef' | 'sef_srus' | 'director_institut' | 'director_adjunct' | 'secretar_stiintific' | 'bibliotecar' | 'salarizare' | 'achizitii' | 'contabilitate' | 'oficiu_juridic' | 'compartiment_comunicare' | 'secretariat' | 'medic_medicina_muncii';

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRole(null);
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
        setRole('user');
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
      setRole(resolvedRole);
      setLoading(false);
    };

    fetchRole();
  }, [user]);

  const isSuperAdmin = role === 'super_admin';
  const isHR = role === 'hr';
  const isSef = role === 'sef';
  const isSefSRUS = role === 'sef_srus';
  const isBibliotecar = role === 'bibliotecar';
  const isSalarizare = role === 'salarizare';
  const isMedicMuncii = role === 'medic_medicina_muncii';
  const isStaff = isSuperAdmin || isHR || isSefSRUS;
  
  const canManageHR = isSuperAdmin || isHR || isSefSRUS;
  const canManageContent = role !== null && role !== 'user';
  const canManageLibrary = isSuperAdmin || isBibliotecar;
  const canAccessMedical = isMedicMuncii || isHR || isSefSRUS || isSuperAdmin;

  return { 
    role, 
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
