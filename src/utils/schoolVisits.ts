export type VisitStatus = 'aprobata' | 'semnare' | 'intentie' | 'anulata' | 'nou';

export const STATUS_LABEL: Record<VisitStatus, string> = {
  aprobata: 'Aprobată', semnare: 'În semnare', intentie: 'Intenție transmisă', anulata: 'Anulată', nou: 'Fără aprobare',
};

export function resolveVisitStatus(v: { status?: string | null; approval_no?: string | null; cancelled_at?: string | null }): VisitStatus {
  if (v.cancelled_at) return 'anulata';
  if (v.status && v.status !== 'auto' && v.status in STATUS_LABEL) return v.status as VisitStatus;
  const a = (v.approval_no || '').toLowerCase();
  if (!a.trim()) return 'nou';
  if (a.includes('semnat')) return 'semnare';
  if (a.includes('intenti')) return 'intentie';
  if (/\d+\s*\/\s*\d/.test(a)) return 'aprobata';
  return 'nou';
}

const MONTHS = ['IANUARIE','FEBRUARIE','MARTIE','APRILIE','MAI','IUNIE','IULIE','AUGUST','SEPTEMBRIE','OCTOMBRIE','NOIEMBRIE','DECEMBRIE'];
export const monthLabel = (iso: string) => { const [y, m] = iso.split('-'); return `LUNA ${MONTHS[+m - 1]} ${y}`; };
