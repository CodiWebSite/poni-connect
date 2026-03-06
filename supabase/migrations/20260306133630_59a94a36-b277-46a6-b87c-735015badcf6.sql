
-- Function to ensure a department group exists and the user is a member
CREATE OR REPLACE FUNCTION public.ensure_department_group(_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _department text;
  _conv_id uuid;
BEGIN
  -- Get user's department
  SELECT department INTO _department FROM profiles WHERE user_id = _user_id;
  IF _department IS NULL THEN
    RETURN NULL;
  END IF;

  -- Check if department group already exists
  SELECT id INTO _conv_id FROM chat_conversations
  WHERE type = 'group' AND department = _department
  LIMIT 1;

  -- Create if not exists
  IF _conv_id IS NULL THEN
    INSERT INTO chat_conversations (type, name, department, created_by)
    VALUES ('group', _department, _department, _user_id)
    RETURNING id INTO _conv_id;
  END IF;

  -- Ensure user is a participant
  INSERT INTO chat_participants (conversation_id, user_id)
  VALUES (_conv_id, _user_id)
  ON CONFLICT DO NOTHING;

  -- Also add all other department members who aren't yet participants
  INSERT INTO chat_participants (conversation_id, user_id)
  SELECT _conv_id, p.user_id
  FROM profiles p
  WHERE p.department = _department
    AND p.user_id != _user_id
    AND NOT EXISTS (
      SELECT 1 FROM chat_participants cp
      WHERE cp.conversation_id = _conv_id AND cp.user_id = p.user_id
    );

  RETURN _conv_id;
END;
$$;

-- Add unique constraint to prevent duplicate participants
ALTER TABLE public.chat_participants
  ADD CONSTRAINT chat_participants_conversation_user_unique
  UNIQUE (conversation_id, user_id);
