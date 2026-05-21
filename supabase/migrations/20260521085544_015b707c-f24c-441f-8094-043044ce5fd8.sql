
CREATE TABLE public.trusted_auth_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_token_hash text NOT NULL,
  friendly_name text,
  user_agent_summary text,
  created_ip text,
  last_ip text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoked_reason text
);

CREATE UNIQUE INDEX trusted_auth_devices_token_hash_idx ON public.trusted_auth_devices(device_token_hash);
CREATE INDEX trusted_auth_devices_user_idx ON public.trusted_auth_devices(user_id, expires_at, revoked_at);

ALTER TABLE public.trusted_auth_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own trusted devices"
  ON public.trusted_auth_devices FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Users revoke own trusted devices"
  ON public.trusted_auth_devices FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (true);

CREATE TABLE public.mfa_recovery_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  batch_id uuid NOT NULL,
  used_at timestamptz,
  used_ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mfa_recovery_codes_user_idx ON public.mfa_recovery_codes(user_id, used_at);
CREATE UNIQUE INDEX mfa_recovery_codes_hash_idx ON public.mfa_recovery_codes(code_hash);

ALTER TABLE public.mfa_recovery_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own recovery codes status"
  ON public.mfa_recovery_codes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'super_admin'::app_role));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS force_mfa_reenroll boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS force_mfa_reason text,
  ADD COLUMN IF NOT EXISTS force_mfa_set_at timestamptz;

ALTER TABLE public.helpdesk_tickets
  ADD COLUMN IF NOT EXISTS ticket_type text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS related_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS helpdesk_tickets_type_priority_idx
  ON public.helpdesk_tickets(ticket_type, priority, status);

INSERT INTO public.app_settings (key, value)
VALUES ('trusted_device_days', '30'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.revoke_all_trusted_devices(_user_id uuid, _reason text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE affected integer;
BEGIN
  UPDATE public.trusted_auth_devices
  SET revoked_at = now(), revoked_reason = _reason
  WHERE user_id = _user_id AND revoked_at IS NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;
