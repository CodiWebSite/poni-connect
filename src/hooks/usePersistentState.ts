import { useEffect, useState } from 'react';

/**
 * Stare care supraviețuiește remontării componentei (revenire în tab, refresh
 * de sesiune, selectarea unui fișier de pe PC etc.). Se păstrează pe durata
 * sesiunii de browser, în sessionStorage.
 */
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(key);
      return raw !== null ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* noop */
    }
  }, [key, value]);

  return [value, setValue] as const;
}

export function clearPersistentState(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* noop */
  }
}
