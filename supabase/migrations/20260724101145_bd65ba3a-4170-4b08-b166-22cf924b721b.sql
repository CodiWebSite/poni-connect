UPDATE public.payslips
SET match_status = 'distributed',
    distributed_at = COALESCE(distributed_at, now())
WHERE id = '1ebad64b-024f-468d-af84-4570217c9440'
  AND employee_epd_id = '72e2f177-f850-4b35-a27e-704f6213b165';

UPDATE public.payslip_batches
SET matched_count = matched_count + 1,
    unmatched_count = GREATEST(unmatched_count - 1, 0)
WHERE id = '8aef84aa-b734-4f73-b52d-4d79cc92fe46';