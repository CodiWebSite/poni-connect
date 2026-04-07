import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const EVENTS: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll', 'click'];

export function useIdleLogout() {
  const { user, signOut } = useAuth();
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleLogout = useCallback(async () => {
    if (!user) return;
    await signOut();
    toast({
      title: 'Sesiune expirată',
      description: 'Ai fost deconectat automat după 30 de minute de inactivitate.',
      variant: 'destructive',
    });
  }, [user, signOut]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (user) {
      timerRef.current = setTimeout(handleLogout, IDLE_TIMEOUT);
    }
  }, [user, handleLogout]);

  useEffect(() => {
    if (!user) return;

    resetTimer();

    const handler = () => resetTimer();
    EVENTS.forEach(e => window.addEventListener(e, handler, { passive: true }));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      EVENTS.forEach(e => window.removeEventListener(e, handler));
    };
  }, [user, resetTimer]);
}
