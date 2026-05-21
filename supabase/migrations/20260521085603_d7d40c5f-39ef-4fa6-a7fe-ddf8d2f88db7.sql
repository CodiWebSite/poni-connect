
DROP POLICY IF EXISTS "Users revoke own trusted devices" ON public.trusted_auth_devices;
CREATE POLICY "Users revoke own trusted devices"
  ON public.trusted_auth_devices FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'super_admin'::app_role));
