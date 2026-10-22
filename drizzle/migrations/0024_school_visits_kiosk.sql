ALTER TABLE public.school_visits ADD COLUMN show_on_kiosk boolean NOT NULL DEFAULT true;
CREATE OR REPLACE FUNCTION public.kiosk_today_visits()
RETURNS TABLE(visit_time text, institution text, class_level text, participants integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT visit_time, trim(institution), class_level, participants FROM public.school_visits
  WHERE visit_date = (now() AT TIME ZONE 'Europe/Bucharest')::date
    AND cancelled_at IS NULL AND show_on_kiosk AND trim(institution) <> ''
  ORDER BY visit_time
$$;
REVOKE ALL ON FUNCTION public.kiosk_today_visits() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_today_visits() TO anon, authenticated;