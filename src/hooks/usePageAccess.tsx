import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from './useUserRole';
import { useImpersonation } from '@/contexts/ImpersonationContext';

interface PagePermission {
  page_key: string;
  can_access: boolean;
}

export function usePageAccess() {
  const { role, isRealSuperAdmin } = useUserRole();
  const { isImpersonating } = useImpersonation();
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!role) {
      setLoading(false);
      return;
    }

    // Real super admin NOT impersonating → full access, skip DB
    if (isRealSuperAdmin && !isImpersonating) {
      setPermissions({});
      setLoading(false);
      return;
    }

    // Fetch permissions for the effective role
    const fetchPermissions = async () => {
      const { data, error } = await supabase
        .from('role_page_permissions')
        .select('page_key, can_access')
        .eq('role_key', role);

      if (!error && data) {
        const map: Record<string, boolean> = {};
        (data as PagePermission[]).forEach(row => {
          map[row.page_key] = row.can_access;
        });
        setPermissions(map);
      }
      setLoading(false);
    };

    fetchPermissions();
  }, [role, isRealSuperAdmin, isImpersonating]);

  const canAccessPage = useCallback((pageKey: string): boolean => {
    // Real super admin not impersonating bypasses everything
    if (isRealSuperAdmin && !isImpersonating) return true;
    // If permission exists in DB, use it; otherwise default to true
    if (pageKey in permissions) return permissions[pageKey];
    return true;
  }, [isRealSuperAdmin, isImpersonating, permissions]);

  return { canAccessPage, permissions, loading };
}
