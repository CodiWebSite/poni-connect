
-- Create chat_reactions table
CREATE TABLE public.chat_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

ALTER TABLE public.chat_reactions ENABLE ROW LEVEL SECURITY;

-- Users can view reactions on messages in their conversations
CREATE POLICY "Users can view reactions in their conversations"
ON public.chat_reactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chat_messages cm
    WHERE cm.id = message_id
    AND is_chat_participant(auth.uid(), cm.conversation_id)
  )
);

-- Users can add reactions
CREATE POLICY "Users can add reactions"
ON public.chat_reactions FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.chat_messages cm
    WHERE cm.id = message_id
    AND is_chat_participant(auth.uid(), cm.conversation_id)
  )
);

-- Users can remove own reactions
CREATE POLICY "Users can remove own reactions"
ON public.chat_reactions FOR DELETE
USING (auth.uid() = user_id);

-- Add RLS policy for users to delete their own messages (unsend)
CREATE POLICY "Users can delete own messages"
ON public.chat_messages FOR DELETE
USING (auth.uid() = sender_id);
