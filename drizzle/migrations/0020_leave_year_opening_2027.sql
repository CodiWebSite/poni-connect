ALTER TABLE public.leave_carryover
  ADD COLUMN IF NOT EXISTS expires_at date,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_by uuid,
  ADD COLUMN IF NOT EXISTS close_reason text;

CREATE TABLE IF NOT EXISTS public.leave_year_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_personal_data_id uuid NOT NULL REFERENCES public.employee_personal_data(id) ON DELETE CASCADE,
  year integer NOT NULL,
  days integer NOT NULL,
  reason text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_personal_data_id, year)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_year_entitlements TO authenticated;
GRANT ALL ON public.leave_year_entitlements TO service_role;
ALTER TABLE public.leave_year_entitlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR manage entitlements" ON public.leave_year_entitlements FOR ALL TO authenticated
  USING (public.can_manage_hr(auth.uid())) WITH CHECK (public.can_manage_hr(auth.uid()));
CREATE POLICY "Own entitlement read" ON public.leave_year_entitlements FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.employee_personal_data e JOIN public.employee_records r ON r.id = e.employee_record_id
                 WHERE e.id = employee_personal_data_id AND r.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.leave_year_openings (
  year integer PRIMARY KEY,
  opened_at timestamptz NOT NULL DEFAULT now(),
  opened_by uuid,
  employees_count integer NOT NULL DEFAULT 0,
  details jsonb
);
GRANT SELECT ON public.leave_year_openings TO authenticated;
GRANT ALL ON public.leave_year_openings TO service_role;
ALTER TABLE public.leave_year_openings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR read openings" ON public.leave_year_openings FOR SELECT TO authenticated
  USING (public.can_manage_hr(auth.uid()));

-- Default standard entitlement (editable later by HR)
CREATE OR REPLACE FUNCTION public.leave_standard_days(_year int)
RETURNS int LANGUAGE sql IMMUTABLE AS $$ SELECT 36 $$;

-- Recalculate with multi-year FIFO over open (not manually closed) carryovers
CREATE OR REPLACE FUNCTION public.recalculate_leave_balance(target_epd_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(epd_id uuid, employee_name text, total_co_days integer, carryover_used integer, current_used integer, carryover_remaining integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  rec RECORD; c RECORD;
  v_year int := EXTRACT(YEAR FROM CURRENT_DATE)::int;
  v_digital int; v_manual int; v_total int; v_left int; v_take int;
  v_carry_used int; v_carry_rem int;
BEGIN
  FOR rec IN
    SELECT e.id, e.first_name, e.last_name, e.employee_record_id
    FROM employee_personal_data e
    WHERE e.is_archived = false AND (target_epd_id IS NULL OR e.id = target_epd_id)
  LOOP
    SELECT COALESCE(SUM(lr.working_days),0) INTO v_digital FROM leave_requests lr
    WHERE lr.epd_id = rec.id AND lr.status = 'approved' AND lr.year = v_year;

    SELECT COALESCE(SUM((hr.details->>'numberOfDays')::int),0) INTO v_manual FROM hr_requests hr
    WHERE hr.request_type = 'concediu' AND hr.status = 'approved' AND (hr.details->>'leaveType') = 'co'
      AND ((hr.details->>'epd_id') = rec.id::text OR ((hr.details->>'epd_id') IS NULL AND hr.user_id IN
           (SELECT er.user_id FROM employee_records er WHERE er.id = rec.employee_record_id)))
      AND COALESCE((hr.details->>'year')::int, EXTRACT(YEAR FROM (hr.details->>'startDate')::date)) = v_year;

    v_total := v_digital + v_manual; v_left := v_total; v_carry_used := 0; v_carry_rem := 0;

    FOR c IN SELECT lc.id, lc.initial_days FROM leave_carryover lc
             WHERE lc.employee_personal_data_id = rec.id AND lc.to_year = v_year AND lc.closed_at IS NULL
             ORDER BY lc.from_year ASC
    LOOP
      v_take := LEAST(v_left, COALESCE(c.initial_days,0));
      v_left := v_left - v_take;
      UPDATE leave_carryover SET used_days = v_take, remaining_days = COALESCE(c.initial_days,0) - v_take WHERE id = c.id;
      v_carry_used := v_carry_used + v_take;
      v_carry_rem := v_carry_rem + COALESCE(c.initial_days,0) - v_take;
    END LOOP;

    UPDATE employee_personal_data SET used_leave_days = v_left WHERE id = rec.id;
    IF rec.employee_record_id IS NOT NULL THEN
      UPDATE employee_records SET used_leave_days = v_left,
        remaining_leave_days = total_leave_days - v_left WHERE id = rec.employee_record_id;
    END IF;

    epd_id := rec.id; employee_name := rec.last_name || ' ' || rec.first_name;
    total_co_days := v_total; carryover_used := v_carry_used; current_used := v_left; carryover_remaining := v_carry_rem;
    RETURN NEXT;
  END LOOP;
END;
$function$;

-- Opens a new leave year. Idempotent.
CREATE OR REPLACE FUNCTION public.open_leave_year(_year int, _force boolean DEFAULT false)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  e RECORD; v_count int := 0; v_prev int := _year - 1;
  v_prev_left int; v_bonus int; v_days int; v_old RECORD;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.can_manage_hr(auth.uid()) THEN
    RAISE EXCEPTION 'Acces interzis';
  END IF;
  IF EXISTS (SELECT 1 FROM leave_year_openings WHERE year = _year) THEN
    RETURN 0;
  END IF;

  FOR e IN SELECT id, employee_record_id, COALESCE(total_leave_days,0) AS total, COALESCE(used_leave_days,0) AS used
           FROM employee_personal_data WHERE is_archived = false
  LOOP
    -- 1) leftover of previous year -> carryover to new year
    SELECT COALESCE(SUM(bonus_days),0) INTO v_bonus FROM leave_bonus
      WHERE employee_personal_data_id = e.id AND year = v_prev;
    v_prev_left := GREATEST(e.total + v_bonus - e.used, 0);
    INSERT INTO leave_carryover (employee_personal_data_id, from_year, to_year, initial_days, used_days, remaining_days, notes)
    VALUES (e.id, v_prev, _year, v_prev_left, 0, v_prev_left, 'Report automat la deschiderea anului ' || _year)
    ON CONFLICT DO NOTHING;

    -- 2) older open carryovers (e.g. 2025 into 2026) keep their remaining days in the new year
    FOR v_old IN SELECT * FROM leave_carryover
                 WHERE employee_personal_data_id = e.id AND to_year = v_prev AND from_year < v_prev
                   AND closed_at IS NULL AND COALESCE(remaining_days,0) > 0
    LOOP
      IF NOT EXISTS (SELECT 1 FROM leave_carryover WHERE employee_personal_data_id = e.id
                     AND from_year = v_old.from_year AND to_year = _year) THEN
        INSERT INTO leave_carryover (employee_personal_data_id, from_year, to_year, initial_days, used_days, remaining_days, expires_at, notes)
        VALUES (e.id, v_old.from_year, _year, v_old.remaining_days, 0, v_old.remaining_days,
                make_date(v_old.from_year + 2, 6, 30),
                'Report ' || v_old.from_year || ' păstrat; termen orientativ, închidere manuală HR');
      END IF;
    END LOOP;

    -- 3) new year entitlement (HR exceptions kept)
    INSERT INTO leave_year_entitlements (employee_personal_data_id, year, days, reason)
    VALUES (e.id, _year, public.leave_standard_days(_year), 'Sold standard')
    ON CONFLICT (employee_personal_data_id, year) DO NOTHING;
    SELECT days INTO v_days FROM leave_year_entitlements WHERE employee_personal_data_id = e.id AND year = _year;

    UPDATE employee_personal_data SET total_leave_days = v_days, used_leave_days = 0 WHERE id = e.id;
    IF e.employee_record_id IS NOT NULL THEN
      UPDATE employee_records SET total_leave_days = v_days, used_leave_days = 0, remaining_leave_days = v_days
      WHERE id = e.employee_record_id;
    END IF;
    v_count := v_count + 1;
  END LOOP;

  INSERT INTO leave_year_openings (year, opened_by, employees_count) VALUES (_year, auth.uid(), v_count);
  PERFORM public.log_audit_event(auth.uid(), 'leave_year_opened', 'leave_year', _year::text, jsonb_build_object('employees', v_count));

  IF EXTRACT(YEAR FROM CURRENT_DATE)::int >= _year THEN
    PERFORM public.recalculate_leave_balance(NULL);
  END IF;
  RETURN v_count;
END;
$$;

-- HR manual close of an old carryover
CREATE OR REPLACE FUNCTION public.close_leave_carryover(_from_year int, _to_year int, _reason text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v int;
BEGIN
  IF NOT public.can_manage_hr(auth.uid()) THEN RAISE EXCEPTION 'Acces interzis'; END IF;
  IF length(coalesce(_reason,'')) < 5 THEN RAISE EXCEPTION 'Motiv obligatoriu'; END IF;
  UPDATE leave_carryover SET closed_at = now(), closed_by = auth.uid(), close_reason = _reason
  WHERE from_year = _from_year AND to_year = _to_year AND closed_at IS NULL;
  GET DIAGNOSTICS v = ROW_COUNT;
  PERFORM public.log_audit_event(auth.uid(), 'leave_carryover_closed', 'leave_carryover', _from_year || '->' || _to_year, jsonb_build_object('rows', v, 'reason', _reason));
  PERFORM public.recalculate_leave_balance(NULL);
  RETURN v;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.open_leave_year(int, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.close_leave_carryover(int,int,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_leave_year(int, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.close_leave_carryover(int,int,text) TO authenticated, service_role;

DO $$
BEGIN
  PERFORM cron.schedule('open-leave-year', '5 22 31 12 *', 'SELECT public.open_leave_year(EXTRACT(YEAR FROM now() + interval ''1 day'')::int)');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'cron not available: %', SQLERRM;
END $$;