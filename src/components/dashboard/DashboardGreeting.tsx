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
    <div className="animate-fade-in">
      <h2 className="text-lg sm:text-2xl font-display font-bold text-foreground">
        {getGreeting()}, {displayName || 'utilizator'}! 👋
      </h2>
      <p className="text-sm sm:text-base text-muted-foreground mt-0.5">
        {today} {subtitle ? `— ${subtitle}` : ''}
      </p>
    </div>
  );
};

export default DashboardGreeting;
