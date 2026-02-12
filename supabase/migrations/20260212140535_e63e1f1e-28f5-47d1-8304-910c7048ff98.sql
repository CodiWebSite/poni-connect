
-- Fix: restrict INSERT on auth_login_logs to authenticated users inserting their own logs
DROP POLICY "Service can insert auth logs" ON public.auth_login_logs;

-- Edge function uses service_role key which bypasses RLS entirely
-- So we don't need a permissive INSERT policy at all
-- But if we want authenticated users to also log, restrict to own user_id
CREATE POLICY "Authenticated can insert own auth logs"
  ON public.auth_login_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
