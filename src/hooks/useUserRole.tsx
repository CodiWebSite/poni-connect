import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type AppRole = 'admin' | 'user' | 'super_admin' | 'department_head' | 'secretariat' | 'director';

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
        setRole(data.role as AppRole);
      } else {
        setRole('user'); // Default role
      }
      setLoading(false);
    };

    fetchRole();
  }, [user]);

  const isAdmin = role === 'admin' || role === 'super_admin';
  const isSuperAdmin = role === 'super_admin';
  const isDepartmentHead = role === 'department_head';
  const isDirector = role === 'director';
  const isSecretariat = role === 'secretariat';
  
  // Can manage content (announcements, documents, events)
  const canManageContent = ['admin', 'super_admin', 'department_head', 'director', 'secretariat'].includes(role || '');
  
  // Can approve HR requests
  const canApproveHR = ['admin', 'super_admin', 'department_head', 'director'].includes(role || '');

  return { 
    role, 
    isAdmin, 
    isSuperAdmin,
    isDepartmentHead,
    isDirector,
    isSecretariat,
    canManageContent,
    canApproveHR,
    loading 
  };
}
