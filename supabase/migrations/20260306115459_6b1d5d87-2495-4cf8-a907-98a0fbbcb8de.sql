
-- Fix: creators must be able to see their own conversations (needed for adding participants)
CREATE POLICY "Creators can view own conversations"
ON public.chat_conversations FOR SELECT
TO authenticated
USING (created_by = auth.uid());

-- Fix: Use a security definer function to check conversation creator (bypasses RLS on chat_conversations)
CREATE OR REPLACE FUNCTION public.is_chat_conversation_creator(_user_id uuid, _conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_conversations
    WHERE id = _conversation_id AND created_by = _user_id
  )
$$;

-- Drop old participant insert policy and recreate with security definer function
DROP POLICY IF EXISTS "Conversation creators can add participants" ON public.chat_participants;

CREATE POLICY "Conversation creators can add participants"
ON public.chat_participants FOR INSERT
TO authenticated
WITH CHECK (
  is_chat_conversation_creator(auth.uid(), conversation_id)
  OR auth.uid() = user_id
);
