import { useEffect, useState } from 'react';
import SocialLayout from '@/components/layout/SocialLayout';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

interface AnniversaryItem {
  id: string;
  name: string;
  day: number;
  years?: number;
}

const monthNames = [
  'ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
  'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie',
];

const Birthdays = () => {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const year = now.getFullYear();
  const monthLabel = `${monthNames[now.getMonth()].charAt(0).toUpperCase() + monthNames[now.getMonth()].slice(1)} ${year}`;

  const [workAnniversaries, setWorkAnniversaries] = useState<AnniversaryItem[]>([]);
  const [birthdays, setBirthdays] = useState<AnniversaryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      // Work anniversaries from employee_records.hire_date joined with profile name
      const { data: records } = await supabase
        .from('employee_records')
        .select('id, user_id, hire_date')
        .not('hire_date', 'is', null);

      const monthRecords = (records || []).filter((r) => {
        if (!r.hire_date) return false;
        const d = new Date(r.hire_date);
        return d.getMonth() + 1 === month && year - d.getFullYear() > 0;
      });

      const userIds = monthRecords.map((r) => r.user_id).filter(Boolean) as string[];
      let nameMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds);
        (profs || []).forEach((p) => {
          if (p.user_id) nameMap[p.user_id] = p.full_name || '';
        });
      }

      const works: AnniversaryItem[] = monthRecords
        .map((r) => {
          const d = new Date(r.hire_date as string);
          return {
            id: r.id,
            name: (r.user_id && nameMap[r.user_id]) || 'Coleg',
            day: d.getDate(),
            years: year - d.getFullYear(),
          };
        })
        .sort((a, b) => a.day - b.day);

      setWorkAnniversaries(works);

      // Birthdays — opt-in pentru zile de naștere (va fi adăugat ulterior).
      setBirthdays([]);

      setLoading(false);
    };
    fetchData();
  }, [month, year]);

  return (
    <SocialLayout title="Aniversări" description="Zile de naștere și aniversări de muncă">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AnniversaryCard
          emoji="🎉"
          title="Zile de naștere"
          subtitle={monthLabel}
          items={birthdays}
          emptyText="Se pare că nu există zile de naștere luna aceasta"
          loading={loading}
        />
        <AnniversaryCard
          emoji="🎉"
          title="Aniversări de muncă"
          subtitle={monthLabel}
          items={workAnniversaries}
          emptyText="Se pare că nu există aniversări de muncă luna aceasta"
          loading={loading}
          showYears
        />
      </div>
    </SocialLayout>
  );
};

interface AnniversaryCardProps {
  emoji: string;
  title: string;
  subtitle: string;
  items: AnniversaryItem[];
  emptyText: string;
  loading: boolean;
  showYears?: boolean;
}

const AnniversaryCard = ({
  emoji,
  title,
  subtitle,
  items,
  emptyText,
  loading,
  showYears,
}: AnniversaryCardProps) => (
  <Card className="rounded-2xl border-border p-6 min-h-[400px]">
    <div className="mb-1">
      <h2 className="font-display font-bold text-xl flex items-center gap-2">
        <span>{emoji}</span>
        {title}
      </h2>
      <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
    </div>
    <div className="mt-6">
      {loading ? (
        <p className="text-center text-sm text-muted-foreground py-10">Se încarcă…</p>
      ) : items.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-10">{emptyText}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/60 transition-colors"
            >
              <span className="text-sm font-medium">{item.name}</span>
              <span className="text-xs text-muted-foreground">
                Ziua {item.day}
                {showYears && item.years ? ` · ${item.years} ani` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  </Card>
);

export default Birthdays;
