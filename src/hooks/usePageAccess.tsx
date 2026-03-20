import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from './useUserRole';
import { useAuth } from './useAuth';
import { useImpersonation } from '@/contexts/ImpersonationContext';

interface PagePermission {
  page_key: string;
  can_access: boolean;
}

export function usePageAccess() {
  const { user } = useAuth();
  const { role, isRealSuperAdmin } = useUserRole();
  const { isImpersonating } = useImpersonation();
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!role || !user) {
      setLoading(false);
      return;
    }

    // Real super admin NOT impersonating → full access, skip DB
    if (isRealSuperAdmin && !isImpersonating) {
      setPermissions({});
      setLoading(false);
      return;
    }

    const fetchPermissions = async () => {
      // Fetch base role permissions
      const { data: rolePerms } = await supabase
        .from('role_page_permissions')
        .select('page_key, can_access')
        .eq('role_key', role);

      const map: Record<string, boolean> = {};
      ((rolePerms || []) as PagePermission[]).forEach(row => {
        map[row.page_key] = row.can_access;
      });

      // Also fetch custom role permissions for this user
      const { data: userCR } = await supabase
        .from('user_custom_roles')
        .select('custom_role_id, custom_roles(key)')
        .eq('user_id', user.id);

      if (userCR && userCR.length > 0) {
        const customKeys = userCR
          .map((ucr: any) => ucr.custom_roles?.key)
          .filter(Boolean);

        if (customKeys.length > 0) {
          const { data: customPerms } = await supabase
            .from('role_page_permissions')
            .select('page_key, can_access')
            .in('role_key', customKeys);

          // Custom roles ADD permissions (union - if any custom role grants access, grant it)
          ((customPerms || []) as PagePermission[]).forEach(row => {
            if (row.can_access) map[row.page_key] = true;
          });
        }
      }

      setPermissions(map);
      setLoading(false);
    };

    fetchPermissions();
  }, [role, user, isRealSuperAdmin, isImpersonating]);

  const canAccessPage = useCallback((pageKey: string): boolean => {
    if (isRealSuperAdmin && !isImpersonating) return true;
    if (pageKey in permissions) return permissions[pageKey];
    return true;
  }, [isRealSuperAdmin, isImpersonating, permissions]);

  return { canAccessPage, permissions, loading };
}
