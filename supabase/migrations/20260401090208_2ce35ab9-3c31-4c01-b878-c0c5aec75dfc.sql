CREATE UNIQUE INDEX idx_leave_requests_no_duplicate
ON public.leave_requests (user_id, start_date, end_date)
WHERE status NOT IN ('rejected');