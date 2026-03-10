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

    const fetchRole = async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data && !error) {
        const r = data.role as string;
        if (['admin', 'super_admin', 'hr', 'sef', 'sef_srus', 'director_institut', 'director_adjunct', 'secretar_stiintific', 'bibliotecar', 'salarizare', 'achizitii', 'contabilitate', 'oficiu_juridic', 'compartiment_comunicare', 'secretariat', 'medic_medicina_muncii'].includes(r)) {
          setRole(r as AppRole);
        } else {
          setRole('user');
        }
      } else {
        setRole('user');
      }
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
  const isStaff = isSuperAdmin || isHR || isSefSRUS;
  
  const canManageHR = isSuperAdmin || isHR || isSefSRUS;
  const canManageContent = role !== null && role !== 'user';
  const canManageLibrary = isSuperAdmin || isBibliotecar;

  return { 
    role, 
    isSuperAdmin,
    isHR,
    isSef,
    isSefSRUS,
    isBibliotecar,
    isSalarizare,
    isStaff,
    canManageContent,
    canManageHR,
    canManageLibrary,
    loading 
  };
}
