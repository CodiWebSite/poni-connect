CREATE TABLE IF NOT EXISTS public.leave_year_closures (
  year integer PRIMARY KEY,
  closed_at timestamptz NOT NULL DEFAULT now(),
  closed_by uuid,
  reason text NOT NULL,
  employees_count integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.leave_year_closures TO authenticated;
GRANT ALL ON public.leave_year_closures TO service_role;
ALTER TABLE public.leave_year_closures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR read closures" ON public.leave_year_closures FOR SELECT TO authenticated
  USING (public.can_manage_hr(auth.uid()));

-- Closes a year early: freezes leftover as carryover into next year. Balances switch on 1 January.
CREATE OR REPLACE FUNCTION public.close_leave_year(_year int, _reason text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE e RECORD; v_old RECORD; v_bonus int; v_left int; v_count int := 0; v_next int := _year + 1;
BEGIN
  IF NOT public.can_manage_hr(auth.uid()) THEN RAISE EXCEPTION 'Acces interzis'; END IF;
  IF length(coalesce(trim(_reason),'')) < 5 THEN RAISE EXCEPTION 'Motiv obligatoriu (minim 5 caractere)'; END IF;
  IF EXISTS (SELECT 1 FROM leave_year_closures WHERE year = _year) THEN RAISE EXCEPTION 'Anul % este deja închis', _year; END IF;
  IF EXISTS (SELECT 1 FROM leave_year_openings WHERE year = v_next) THEN RAISE EXCEPTION 'Anul % este deja deschis', v_next; END IF;

  PERFORM public.recalculate_leave_balance(NULL);

  FOR e IN SELECT id, COALESCE(total_leave_days,0) total, COALESCE(used_leave_days,0) used
           FROM employee_personal_data WHERE is_archived = false
  LOOP
    SELECT COALESCE(SUM(bonus_days),0) INTO v_bonus FROM leave_bonus WHERE employee_personal_data_id = e.id AND year = _year;
    v_left := GREATEST(e.total + v_bonus - e.used, 0);
    INSERT INTO leave_carryover (employee_personal_data_id, from_year, to_year, initial_days, used_days, remaining_days, notes)
    VALUES (e.id, _year, v_next, v_left, 0, v_left, 'Închidere an ' || _year || ': ' || trim(_reason))
    ON CONFLICT (employee_personal_data_id, from_year, to_year)
    DO UPDATE SET initial_days = EXCLUDED.initial_days, remaining_days = EXCLUDED.remaining_days, used_days = 0, notes = EXCLUDED.notes;

    FOR v_old IN SELECT * FROM leave_carryover WHERE employee_personal_data_id = e.id AND to_year = _year
                 AND from_year < _year AND closed_at IS NULL AND COALESCE(remaining_days,0) > 0
    LOOP
      INSERT INTO leave_carryover (employee_personal_data_id, from_year, to_year, initial_days, used_days, remaining_days, expires_at, notes)
      VALUES (e.id, v_old.from_year, v_next, v_old.remaining_days, 0, v_old.remaining_days, make_date(v_old.from_year + 2, 6, 30),
              'Report ' || v_old.from_year || ' păstrat; închidere manuală HR')
      ON CONFLICT (employee_personal_data_id, from_year, to_year)
      DO UPDATE SET initial_days = EXCLUDED.initial_days, remaining_days = EXCLUDED.remaining_days, used_days = 0;
    END LOOP;

    INSERT INTO leave_year_entitlements (employee_personal_data_id, year, days, reason)
    VALUES (e.id, v_next, public.leave_standard_days(v_next), 'Sold standard')
    ON CONFLICT (employee_personal_data_id, year) DO NOTHING;
    v_count := v_count + 1;
  END LOOP;

  INSERT INTO leave_year_closures (year, closed_by, reason, employees_count) VALUES (_year, auth.uid(), trim(_reason), v_count);
  PERFORM public.log_audit_event(auth.uid(), 'leave_year_closed', 'leave_year', _year::text, jsonb_build_object('employees', v_count, 'reason', trim(_reason)));
  RETURN v_count;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.close_leave_year(int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_leave_year(int, text) TO authenticated, service_role;