import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, TrendingUp } from 'lucide-react';
import { useAnimatedCounter } from '@/hooks/useAnimatedCounter';
import { format, startOfMonth, subMonths } from 'date-fns';
import { ro } from 'date-fns/locale';

interface MonthStat {
  label: string;
  count: number;
  date: Date;
}

const PayslipDownloadsCard = () => {
  const [months, setMonths] = useState<MonthStat[]>([]);
  const [thisMonth, setThisMonth] = useState(0);
  const [loading, setLoading] = useState(true);
  const animated = useAnimatedCounter(thisMonth);

  useEffect(() => {
    (async () => {
      const now = new Date();
      const sixAgo = startOfMonth(subMonths(now, 5));
      const { data } = await supabase
        .from('payslip_audit_log')
        .select('created_at')
        .eq('action', 'download')
        .gte('created_at', sixAgo.toISOString());

      const buckets: Record<string, number> = {};
      for (let i = 5; i >= 0; i--) {
        const d = startOfMonth(subMonths(now, i));
        buckets[format(d, 'yyyy-MM')] = 0;
      }
      (data || []).forEach((r: any) => {
        const key = format(new Date(r.created_at), 'yyyy-MM');
        if (key in buckets) buckets[key]++;
      });

      const stats: MonthStat[] = Object.entries(buckets).map(([key, count]) => {
        const [y, m] = key.split('-').map(Number);
        const date = new Date(y, m - 1, 1);
        return { label: format(date, 'LLL', { locale: ro }), count, date };
      });
      setMonths(stats);
      setThisMonth(stats[stats.length - 1]?.count || 0);
      setLoading(false);
    })();
  }, []);

  const max = Math.max(1, ...months.map(m => m.count));
  const prev = months[months.length - 2]?.count || 0;
  const delta = prev === 0 ? (thisMonth > 0 ? 100 : 0) : Math.round(((thisMonth - prev) / prev) * 100);

  return (
    <Card className="border-border/60 shadow-card hover:shadow-card-hover transition-all duration-300">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-info flex items-center justify-center shadow-md">
            <Download className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <div>Descărcări fluturași</div>
            <div className="text-xs font-normal text-muted-foreground">Ultimele 6 luni</div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <p className="text-3xl font-display font-bold tracking-tight">{loading ? '—' : animated}</p>
            <p className="text-xs text-muted-foreground font-medium">luna curentă</p>
          </div>
          {!loading && prev > 0 && (
            <div className={`flex items-center gap-1 text-xs font-medium ${delta >= 0 ? 'text-success' : 'text-destructive'}`}>
              <TrendingUp className={`w-3.5 h-3.5 ${delta < 0 ? 'rotate-180' : ''}`} />
              {delta >= 0 ? '+' : ''}{delta}% vs luna trecută
            </div>
          )}
        </div>
        <div className="flex items-end gap-2 h-24">
          {months.map((m, i) => {
            const h = (m.count / max) * 100;
            const isCurrent = i === months.length - 1;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="w-full flex-1 flex items-end">
                  <div
                    className={`w-full rounded-t-md transition-all ${isCurrent ? 'bg-gradient-to-t from-primary to-info' : 'bg-muted-foreground/30'}`}
                    style={{ height: `${Math.max(h, 4)}%` }}
                    title={`${m.count} descărcări`}
                  />
                </div>
                <div className="text-[10px] text-muted-foreground font-medium">{m.label}</div>
                <div className="text-[10px] font-semibold">{m.count}</div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default PayslipDownloadsCard;
