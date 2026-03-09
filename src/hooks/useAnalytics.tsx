import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

const PAGE_NAMES: Record<string, string> = {
  '/': 'Dashboard',
  '/my-profile': 'Profil',
  '/leave-calendar': 'Calendar Concedii',
  '/leave-request': 'Cerere Concediu',
  '/hr-management': 'Gestiune HR',
  '/admin': 'Administrare',
  '/calendar': 'Calendar',
  '/formulare': 'Formulare',
  '/library': 'Bibliotecă',
  '/salarizare': 'Salarizare',
  '/announcements': 'Anunțuri',
  '/my-team': 'Echipa Mea',
  '/room-bookings': 'Programări Săli',
  '/activitati': 'Activități',
  '/chat': 'Mesagerie',
  '/settings': 'Setări',
  '/ghid': 'Ghid Platformă',
  '/system-status': 'Stare Sistem',
  '/install': 'Instalare App',
};

export function usePageTracking() {
  const { user } = useAuth();
  const location = useLocation();
  const lastTracked = useRef('');

  useEffect(() => {
    if (!user) return;
    const path = location.pathname;
    if (path === lastTracked.current) return;
    lastTracked.current = path;

    const pageName = PAGE_NAMES[path] || path;
    supabase.from('analytics_events').insert([{
      user_id: user.id,
      event_type: 'page_view',
      page: pageName,
    }]).then(() => {});
  }, [location.pathname, user]);
}

export function useTrackAction() {
  const { user } = useAuth();

  return useCallback((action: string, page?: string, metadata?: Record<string, string | number | boolean | null>) => {
    if (!user) return;
    supabase.from('analytics_events').insert([{
      user_id: user.id,
      event_type: 'action',
      page: page || window.location.pathname,
      action,
      metadata: metadata || {},
    }]).then(() => {});
  }, [user]);
}
