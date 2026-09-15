import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/** Detectează dacă utilizatorul curent este conducător de doctorat (înregistrat sau cu doctoranzi alocați). */
export const useDoctoralCoordinator = () => {
  const { user } = useAuth();
  const [isCoordinator, setIsCoordinator] = useState(false);
  const [studentCount, setStudentCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const check = async () => {
      if (!user) { setIsCoordinator(false); setStudentCount(0); setLoading(false); return; }
      const [{ count }, { data: registered }] = await Promise.all([
        supabase.from('doctoral_profiles').select('id', { count: 'exact', head: true }).eq('coordinator_user_id', user.id),
        supabase.from('doctoral_coordinators').select('id').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
      ]);
      if (!active) return;
      setStudentCount(count || 0);
      setIsCoordinator(!!registered || (count || 0) > 0);
      setLoading(false);
    };
    check();
    return () => { active = false; };
  }, [user]);

  return { isCoordinator, studentCount, loading };
};

export default useDoctoralCoordinator;
