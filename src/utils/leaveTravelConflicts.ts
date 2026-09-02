// Detectarea suprapunerilor dintre concedii și deplasări pentru același angajat.
// Deplasările sunt înregistrate de HR în `hr_requests` (details.leaveType = 'd'),
// iar concediile pot exista atât în `hr_requests`, cât și în `leave_requests`.
import { supabase } from '@/integrations/supabase/client';
import { LEAVE_TYPE_MAP } from '@/utils/leaveTypes';

export interface PeriodConflict {
  leaveType: string;
  label: string;
  startDate: string;
  endDate: string;
  source: 'hr' | 'request';
}

export const TRAVEL_LEAVE_TYPE = 'd';

const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string) =>
  aStart <= bEnd && aEnd >= bStart;

const typeLabel = (key?: string) => {
  const cfg = LEAVE_TYPE_MAP[(key || 'co').toLowerCase().trim()];
  return cfg?.description || key || 'Absență';
};

interface Options {
  userId?: string | null;
  epdId?: string | null;
  startDate: string;
  endDate: string;
  /** Exclude o intrare existentă (la editare) */
  excludeHrRequestId?: string | null;
  excludeLeaveRequestId?: string | null;
}

/**
 * Returnează toate perioadele deja înregistrate pentru angajat care se suprapun
 * cu intervalul dat (concedii + deplasări).
 */
export async function fetchOwnPeriodConflicts({
  userId,
  epdId,
  startDate,
  endDate,
  excludeHrRequestId,
  excludeLeaveRequestId,
}: Options): Promise<PeriodConflict[]> {
  if (!startDate || !endDate || (!userId && !epdId)) return [];

  const found: PeriodConflict[] = [];
  const seen = new Set<string>();

  const pushHr = (rows: any[] | null) => {
    (rows || []).forEach((row) => {
      if (excludeHrRequestId && row.id === excludeHrRequestId) return;
      const d = row.details || {};
      if (!d.startDate || !d.endDate) return;
      if (!overlaps(d.startDate, d.endDate, startDate, endDate)) return;
      const key = `hr:${row.id}`;
      if (seen.has(key)) return;
      seen.add(key);
      found.push({
        leaveType: (d.leaveType || 'co').toLowerCase(),
        label: typeLabel(d.leaveType),
        startDate: d.startDate,
        endDate: d.endDate,
        source: 'hr',
      });
    });
  };

  const hrQueries: Promise<any>[] = [];
  if (userId) {
    hrQueries.push(
      supabase
        .from('hr_requests')
        .select('id, details')
        .eq('request_type', 'concediu')
        .eq('status', 'approved')
        .eq('user_id', userId)
        .then((r) => r),
    );
  }
  if (epdId) {
    hrQueries.push(
      supabase
        .from('hr_requests')
        .select('id, details')
        .eq('request_type', 'concediu')
        .eq('status', 'approved')
        .eq('details->>epd_id', epdId)
        .then((r) => r),
    );
  }

  const leaveQuery = supabase
    .from('leave_requests')
    .select('id, start_date, end_date, status, epd_id, user_id')
    .not('status', 'in', '("rejected","cancelled")')
    .lte('start_date', endDate)
    .gte('end_date', startDate);

  const [hrResults, leaveResult] = await Promise.all([
    Promise.all(hrQueries),
    userId
      ? leaveQuery.eq('user_id', userId)
      : leaveQuery.eq('epd_id', epdId as string),
  ]);

  hrResults.forEach((r) => pushHr(r?.data));

  (leaveResult?.data || []).forEach((row: any) => {
    if (excludeLeaveRequestId && row.id === excludeLeaveRequestId) return;
    const key = `req:${row.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push({
      leaveType: 'co',
      label: 'Concediu de odihnă (cerere)',
      startDate: row.start_date,
      endDate: row.end_date,
      source: 'request',
    });
  });

  return found;
}

export const formatConflict = (c: PeriodConflict) => {
  const f = (d: string) => d.split('-').reverse().join('.');
  return `${c.label}: ${f(c.startDate)} – ${f(c.endDate)}`;
};
