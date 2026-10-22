CREATE OR REPLACE FUNCTION public.open_leave_year(_year integer, _force boolean DEFAULT false)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  e RECORD; v_count int := 0; v_prev int := _year - 1;
  v_prev_left int; v_bonus int; v_days int; v_old RECORD;
BEGIN
  IF _year IS NULL OR _year < 1 OR _year > 9999 THEN
    RAISE EXCEPTION 'An invalid';
  END IF;
  -- Neither force, HR nor the scheduled service may reset balances before January 1.
  IF (now() AT TIME ZONE 'Europe/Bucharest')::date < make_date(_year, 1, 1) THEN
    RAISE EXCEPTION 'Anul % se poate deschide doar din 1 ianuarie %', _year, _year;
  END IF;
  IF auth.uid() IS NOT NULL AND NOT public.can_manage_hr(auth.uid()) THEN
    RAISE EXCEPTION 'Acces interzis';
  END IF;
  IF EXISTS (SELECT 1 FROM leave_year_openings WHERE year = _year) THEN
    RETURN 0;
  END IF;

  FOR e IN SELECT id, employee_record_id, COALESCE(total_leave_days,0) AS total, COALESCE(used_leave_days,0) AS used
           FROM employee_personal_data WHERE is_archived = false
  LOOP
    SELECT COALESCE(SUM(bonus_days),0) INTO v_bonus FROM leave_bonus
      WHERE employee_personal_data_id = e.id AND year = v_prev;
    v_prev_left := GREATEST(e.total + v_bonus - e.used, 0);
    INSERT INTO leave_carryover (employee_personal_data_id, from_year, to_year, initial_days, used_days, remaining_days, notes)
    VALUES (e.id, v_prev, _year, v_prev_left, 0, v_prev_left, 'Report automat la deschiderea anului ' || _year)
    ON CONFLICT DO NOTHING;

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
$function$;