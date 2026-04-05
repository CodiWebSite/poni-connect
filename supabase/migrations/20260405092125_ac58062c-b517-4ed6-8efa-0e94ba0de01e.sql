
-- Function to recalculate leave balance for one employee (by epd_id)
CREATE OR REPLACE FUNCTION public.recalculate_leave_balance(target_epd_id uuid DEFAULT NULL)
RETURNS TABLE(epd_id uuid, employee_name text, total_co_days int, carryover_used int, current_used int, carryover_remaining int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  v_digital_days int;
  v_manual_days int;
  v_total_days int;
  v_carryover_initial int;
  v_carryover_id uuid;
  v_deduct_from_carry int;
  v_deduct_from_current int;
  v_carry_remaining int;
BEGIN
  FOR rec IN
    SELECT e.id, e.first_name, e.last_name, e.employee_record_id,
           COALESCE(lc.id, NULL) as lc_id,
           COALESCE(lc.initial_days, 0) as lc_initial
    FROM employee_personal_data e
    LEFT JOIN leave_carryover lc ON lc.employee_personal_data_id = e.id 
      AND lc.from_year = EXTRACT(YEAR FROM CURRENT_DATE)::int - 1 
      AND lc.to_year = EXTRACT(YEAR FROM CURRENT_DATE)::int
    WHERE e.is_archived = false
      AND (target_epd_id IS NULL OR e.id = target_epd_id)
  LOOP
    -- Count digital CO days (approved or pending_srus for current year)
    SELECT COALESCE(SUM(lr.working_days), 0) INTO v_digital_days
    FROM leave_requests lr
    WHERE lr.epd_id = rec.id
      AND lr.status IN ('approved', 'pending_srus')
      AND lr.year = EXTRACT(YEAR FROM CURRENT_DATE)::int;

    -- Count manual CO days from hr_requests (approved, type concediu, leaveType co)
    SELECT COALESCE(SUM((hr.details->>'numberOfDays')::int), 0) INTO v_manual_days
    FROM hr_requests hr
    WHERE hr.request_type = 'concediu'
      AND hr.status = 'approved'
      AND (hr.details->>'leaveType') = 'co'
      AND (
        (hr.details->>'epd_id') = rec.id::text
        OR (
          (hr.details->>'epd_id') IS NULL 
          AND hr.user_id IN (
            SELECT er.user_id FROM employee_records er WHERE er.id = rec.employee_record_id
          )
        )
      )
      AND COALESCE((hr.details->>'year')::int, EXTRACT(YEAR FROM (hr.details->>'startDate')::date)) = EXTRACT(YEAR FROM CURRENT_DATE)::int;

    v_total_days := v_digital_days + v_manual_days;
    v_carryover_initial := rec.lc_initial;
    v_carryover_id := rec.lc_id;

    -- FIFO: carryover first
    v_deduct_from_carry := LEAST(v_total_days, v_carryover_initial);
    v_deduct_from_current := v_total_days - v_deduct_from_carry;
    v_carry_remaining := v_carryover_initial - v_deduct_from_carry;

    -- Update carryover
    IF v_carryover_id IS NOT NULL THEN
      UPDATE leave_carryover
      SET used_days = v_deduct_from_carry,
          remaining_days = v_carry_remaining
      WHERE leave_carryover.id = v_carryover_id;
    END IF;

    -- Update employee_personal_data
    UPDATE employee_personal_data
    SET used_leave_days = v_deduct_from_current
    WHERE employee_personal_data.id = rec.id;

    -- Update employee_records if linked
    IF rec.employee_record_id IS NOT NULL THEN
      UPDATE employee_records
      SET used_leave_days = v_deduct_from_current
      WHERE employee_records.id = rec.employee_record_id;
    END IF;

    -- Return result
    epd_id := rec.id;
    employee_name := rec.last_name || ' ' || rec.first_name;
    total_co_days := v_total_days;
    carryover_used := v_deduct_from_carry;
    current_used := v_deduct_from_current;
    carryover_remaining := v_carry_remaining;
    RETURN NEXT;
  END LOOP;
END;
$$;
