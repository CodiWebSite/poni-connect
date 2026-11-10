import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Plane, Wallet, Inbox, DoorOpen, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const MONTHS = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'nov', 'dec'];

interface Props { pendingRequests: number }

export interface DaySummary { leaveRemaining: number | null; payslip: string | null; roomsToday: number | null }

export default function SummaryStrip({ pendingRequests, onSummary }: Props & { onSummary?: (s: DaySummary) => void }) {
  const { user } = useAuth();
  const [s, setS] = useState<DaySummary>({ leaveRemaining: null, payslip: null, roomsToday: null });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end = new Date(); end.setHours(23, 59, 59, 999);
      const [{ data: rec }, { count: rooms }] = await Promise.all([
        supabase.from('employee_records').select('id, total_leave_days, used_leave_days, remaining_leave_days').eq('user_id', user.id).maybeSingle(),
        supabase.from('room_bookings').select('id', { count: 'exact', head: true }).gte('start_time', start.toISOString()).lte('start_time', end.toISOString()).eq('status', 'confirmed'),
      ]);
      let payslip: string | null = null;
      if (rec?.id) {
        const { data: epd } = await supabase.from('employee_personal_data').select('id').eq('employee_record_id', rec.id);
        const ids = (epd ?? []).map((e: any) => e.id);
        if (ids.length) {
          const { data: p } = await supabase.from('payslips').select('month, year').in('employee_epd_id', ids)
            .eq('match_status', 'distributed').order('year', { ascending: false }).order('month', { ascending: false }).limit(1).maybeSingle();
          if (p) payslip = `${MONTHS[p.month - 1]} ${p.year}`;
        }
      }
      const next = {
        leaveRemaining: rec ? (rec.remaining_leave_days ?? rec.total_leave_days - rec.used_leave_days) : null,
        payslip,
        roomsToday: rooms ?? 0,
      };
      setS(next);
      onSummary?.(next);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const cards = [
    { icon: Plane, label: 'Sold concediu', value: s.leaveRemaining === null ? '—' : `${s.leaveRemaining}`, unit: 'zile', to: '/leave-request', tone: 'from-primary/15 to-primary/5 text-primary' },
    { icon: Wallet, label: 'Ultimul fluturaș', value: s.payslip ?? '—', unit: '', to: '/my-profile', tone: 'from-accent/20 to-accent/5 text-accent-foreground' },
    { icon: Inbox, label: 'Cereri în lucru', value: String(pendingRequests), unit: pendingRequests === 1 ? 'cerere' : 'cereri', to: '/leave-request', tone: 'from-warning/20 to-warning/5 text-warning' },
    { icon: DoorOpen, label: 'Rezervări săli azi', value: s.roomsToday === null ? '—' : String(s.roomsToday), unit: '', to: '/room-bookings', tone: 'from-info/20 to-info/5 text-info' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c, i) => (
        <Link
          key={c.label}
          to={c.to}
          style={{ animationDelay: `${i * 60}ms` }}
          className="group animate-fade-in relative overflow-hidden rounded-2xl border border-border/60 bg-card/70 backdrop-blur p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-primary/40"
        >
          <div className={cn('w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center mb-3', c.tone)}>
            <c.icon className="w-4 h-4" />
          </div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{c.label}</div>
          <div className="mt-0.5 flex items-baseline gap-1">
            <span className="font-display text-2xl font-bold tabular-nums text-foreground capitalize">{c.value}</span>
            {c.unit && <span className="text-xs text-muted-foreground">{c.unit}</span>}
          </div>
          <ArrowUpRight className="absolute top-3 right-3 w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
        </Link>
      ))}
    </div>
  );
}
