import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { AppRole } from '@/hooks/useUserRole';

interface ImpersonationState {
  /** The role being impersonated, or null if not impersonating */
  impersonatedRole: AppRole | null;
  /** Optional: specific user id being impersonated (for future "view as user") */
  impersonatedUserId: string | null;
  impersonatedUserName: string | null;
  /** Whether impersonation is currently active */
  isImpersonating: boolean;
  /** Start impersonating a role */
  startRoleImpersonation: (role: AppRole) => void;
  /** Start impersonating a specific user */
  startUserImpersonation: (userId: string, userName: string, role: AppRole) => void;
  /** Stop impersonation */
  stopImpersonation: () => void;
}

const ImpersonationContext = createContext<ImpersonationState>({
  impersonatedRole: null,
  impersonatedUserId: null,
  impersonatedUserName: null,
  isImpersonating: false,
  startRoleImpersonation: () => {},
  startUserImpersonation: () => {},
  stopImpersonation: () => {},
});

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const [impersonatedRole, setImpersonatedRole] = useState<AppRole | null>(null);
  const [impersonatedUserId, setImpersonatedUserId] = useState<string | null>(null);
  const [impersonatedUserName, setImpersonatedUserName] = useState<string | null>(null);

  const startRoleImpersonation = useCallback((role: AppRole) => {
    setImpersonatedRole(role);
    setImpersonatedUserId(null);
    setImpersonatedUserName(null);
  }, []);

  const startUserImpersonation = useCallback((userId: string, userName: string, role: AppRole) => {
    setImpersonatedRole(role);
    setImpersonatedUserId(userId);
    setImpersonatedUserName(userName);
  }, []);

  const stopImpersonation = useCallback(() => {
    setImpersonatedRole(null);
    setImpersonatedUserId(null);
    setImpersonatedUserName(null);
  }, []);

  return (
    <ImpersonationContext.Provider value={{
      impersonatedRole,
      impersonatedUserId,
      impersonatedUserName,
      isImpersonating: impersonatedRole !== null,
      startRoleImpersonation,
      startUserImpersonation,
      stopImpersonation,
    }}>
      {children}
    </ImpersonationContext.Provider>
  );
}

export const useImpersonation = () => useContext(ImpersonationContext);
