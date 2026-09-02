import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { formatNumePrenume } from '@/utils/formatName';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bună dimineața';
  if (hour < 18) return 'Bună ziua';
  return 'Bună seara';
};

interface DashboardGreetingProps {
  subtitle?: string;
}

const DashboardGreeting = ({ subtitle }: DashboardGreetingProps) => {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const [{ data: epd }, { data: profile }] = await Promise.all([
        supabase.from('employee_personal_data').select('last_name, first_name').eq('email', user.email || '').eq('is_archived', false).maybeSingle(),
        supabase.from('profiles').select('full_name').eq('user_id', user.id).single(),
      ]);
      setDisplayName(formatNumePrenume({ firstName: epd?.first_name, lastName: epd?.last_name, fullName: profile?.full_name }));
    };
    fetch();
  }, [user]);

  const today = format(new Date(), 'd MMMM yyyy', { locale: ro });

  return (
    <div className="animate-fade-in flex items-start gap-3 sm:gap-4">
      <span
        aria-hidden="true"
        className="mt-1 hidden sm:block h-12 w-[3px] shrink-0 rounded-full bg-gradient-to-b from-primary to-accent"
      />
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Intranet ICMPP
        </p>
        <h2 className="font-display text-lg font-bold tracking-tight text-foreground sm:text-2xl">
          {getGreeting()}, {displayName || 'utilizator'}!
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground sm:text-base">
          {today} {subtitle ? `— ${subtitle}` : ''}
        </p>
      </div>
    </div>
  );

};

export default DashboardGreeting;
