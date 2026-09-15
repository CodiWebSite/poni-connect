import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Salvare automată a unui formular lung în localStorage.
 * Nu salvează niciodată câmpuri sensibile (parole, CNP, coduri) — apelantul
 * decide ce pune în `value`.
 *
 * Folosire:
 *   const draft = useFormDraft('leave-request', { startDate, endDate, notes });
 *   draft.hasDraft && <buton „Reia ce ai completat" onClick={() => apply(draft.data)} />
 */

const PREFIX = 'icmpp_draft_v1:';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 zile

interface StoredDraft<T> {
  savedAt: number;
  data: T;
}

export interface FormDraft<T> {
  /** Există o versiune salvată, diferită de starea inițială. */
  hasDraft: boolean;
  /** Datele salvate (sau null). */
  data: T | null;
  /** Momentul ultimei salvări automate. */
  savedAt: Date | null;
  /** Șterge ciorna (după trimitere reușită sau la refuzul restaurării). */
  clear: () => void;
}

function isEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.values(value as object).every(isEmpty);
  return false;
}

export function useFormDraft<T extends Record<string, unknown>>(
  key: string,
  value: T,
  options: { enabled?: boolean; debounceMs?: number } = {},
): FormDraft<T> {
  const { enabled = true, debounceMs = 800 } = options;
  const storageKey = `${PREFIX}${key}`;
  const [stored, setStored] = useState<StoredDraft<T> | null>(null);
  const loadedRef = useRef(false);

  // Încărcare inițială
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredDraft<T>;
        if (Date.now() - parsed.savedAt <= MAX_AGE_MS && !isEmpty(parsed.data)) {
          setStored(parsed);
        } else {
          localStorage.removeItem(storageKey);
        }
      }
    } catch {
      localStorage.removeItem(storageKey);
    }
    loadedRef.current = true;
  }, [storageKey]);

  // Salvare automată, cu debounce
  useEffect(() => {
    if (!enabled || !loadedRef.current) return;
    if (isEmpty(value)) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify({ savedAt: Date.now(), data: value }));
      } catch {
        /* localStorage plin — ignorăm, nu blocăm formularul */
      }
    }, debounceMs);
    return () => clearTimeout(t);
  }, [enabled, storageKey, debounceMs, JSON.stringify(value)]);

  const clear = useCallback(() => {
    try { localStorage.removeItem(storageKey); } catch { /* noop */ }
    setStored(null);
  }, [storageKey]);

  return {
    hasDraft: !!stored,
    data: stored?.data ?? null,
    savedAt: stored ? new Date(stored.savedAt) : null,
    clear,
  };
}
