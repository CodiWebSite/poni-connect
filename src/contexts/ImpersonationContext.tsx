import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { AppRole } from '@/hooks/useUserRole';

interface ImpersonationState {
  impersonatedRole: AppRole | null;
  impersonatedUserId: string | null;
  impersonatedUserName: string | null;
  impersonatedUserEmail: string | null;
  isImpersonating: boolean;
  startRoleImpersonation: (role: AppRole) => void;
  startUserImpersonation: (userId: string, userName: string, role: AppRole, email?: string) => void;
  stopImpersonation: () => void;
}

const ImpersonationContext = createContext<ImpersonationState>({
  impersonatedRole: null,
  impersonatedUserId: null,
  impersonatedUserName: null,
  impersonatedUserEmail: null,
  isImpersonating: false,
  startRoleImpersonation: () => {},
  startUserImpersonation: () => {},
  stopImpersonation: () => {},
});

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const [impersonatedRole, setImpersonatedRole] = useState<AppRole | null>(null);
  const [impersonatedUserId, setImpersonatedUserId] = useState<string | null>(null);
  const [impersonatedUserName, setImpersonatedUserName] = useState<string | null>(null);
  const [impersonatedUserEmail, setImpersonatedUserEmail] = useState<string | null>(null);

  const startRoleImpersonation = useCallback((role: AppRole) => {
    setImpersonatedRole(role);
    setImpersonatedUserId(null);
    setImpersonatedUserName(null);
    setImpersonatedUserEmail(null);
  }, []);

  const startUserImpersonation = useCallback((userId: string, userName: string, role: AppRole, email?: string) => {
    setImpersonatedRole(role);
    setImpersonatedUserId(userId);
    setImpersonatedUserName(userName);
    setImpersonatedUserEmail(email || null);
  }, []);

  const stopImpersonation = useCallback(() => {
    setImpersonatedRole(null);
    setImpersonatedUserId(null);
    setImpersonatedUserName(null);
    setImpersonatedUserEmail(null);
  }, []);

  return (
    <ImpersonationContext.Provider value={{
      impersonatedRole,
      impersonatedUserId,
      impersonatedUserName,
      impersonatedUserEmail,
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
