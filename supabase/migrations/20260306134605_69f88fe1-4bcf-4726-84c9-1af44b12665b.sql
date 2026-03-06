
CREATE OR REPLACE FUNCTION public.ensure_department_group(_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _department text;
  _conv_id uuid;
  _approver_id uuid;
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

  -- Find department approver to set as admin
  SELECT lda.approver_user_id INTO _approver_id
  FROM leave_department_approvers lda
  WHERE lda.department = _department
    AND lda.approver_user_id IS NOT NULL
  LIMIT 1;

  -- Create if not exists
  IF _conv_id IS NULL THEN
    INSERT INTO chat_conversations (type, name, department, created_by, admin_id)
    VALUES ('group', _department, _department, COALESCE(_approver_id, _user_id), COALESCE(_approver_id, _user_id))
    RETURNING id INTO _conv_id;
  ELSE
    -- Update admin_id to department approver if not already set correctly
    IF _approver_id IS NOT NULL THEN
      UPDATE chat_conversations
      SET admin_id = _approver_id
      WHERE id = _conv_id
        AND (admin_id IS NULL OR admin_id != _approver_id);
    END IF;
  END IF;

  -- Ensure user is a participant
  INSERT INTO chat_participants (conversation_id, user_id)
  VALUES (_conv_id, _user_id)
  ON CONFLICT DO NOTHING;

  -- Ensure approver is a participant too
  IF _approver_id IS NOT NULL THEN
    INSERT INTO chat_participants (conversation_id, user_id)
    VALUES (_conv_id, _approver_id)
    ON CONFLICT DO NOTHING;
  END IF;

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
$function$;
