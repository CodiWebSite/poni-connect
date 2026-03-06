
-- 1. Create chat_conversations table
CREATE TABLE public.chat_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type text NOT NULL DEFAULT 'direct' CHECK (type IN ('direct', 'group')),
  name text,
  department text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 2. Create chat_participants table
CREATE TABLE public.chat_participants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  last_read_at timestamp with time zone DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

-- 3. Create chat_messages table
CREATE TABLE public.chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  is_edited boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 4. Security definer function to check participation
CREATE OR REPLACE FUNCTION public.is_chat_participant(_user_id uuid, _conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE user_id = _user_id AND conversation_id = _conversation_id
  )
$$;

-- 5. Enable RLS
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- 6. RLS for chat_conversations
CREATE POLICY "Users can view conversations they participate in"
ON public.chat_conversations FOR SELECT
TO authenticated
USING (is_chat_participant(auth.uid(), id));

CREATE POLICY "Authenticated users can create conversations"
ON public.chat_conversations FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators can update conversations"
ON public.chat_conversations FOR UPDATE
TO authenticated
USING (auth.uid() = created_by);

-- 7. RLS for chat_participants
CREATE POLICY "Participants can view co-participants"
ON public.chat_participants FOR SELECT
TO authenticated
USING (is_chat_participant(auth.uid(), conversation_id));

CREATE POLICY "Conversation creators can add participants"
ON public.chat_participants FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chat_conversations
    WHERE id = conversation_id AND created_by = auth.uid()
  )
  OR auth.uid() = user_id
);

CREATE POLICY "Users can update own participant record"
ON public.chat_participants FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- 8. RLS for chat_messages
CREATE POLICY "Participants can view messages"
ON public.chat_messages FOR SELECT
TO authenticated
USING (is_chat_participant(auth.uid(), conversation_id));

CREATE POLICY "Participants can send messages"
ON public.chat_messages FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND is_chat_participant(auth.uid(), conversation_id)
);

CREATE POLICY "Senders can update own messages"
ON public.chat_messages FOR UPDATE
TO authenticated
USING (auth.uid() = sender_id);

-- 9. Enable realtime for chat_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- 10. Indexes
CREATE INDEX idx_chat_participants_user ON public.chat_participants(user_id);
CREATE INDEX idx_chat_participants_conv ON public.chat_participants(conversation_id);
CREATE INDEX idx_chat_messages_conv ON public.chat_messages(conversation_id, created_at);
CREATE INDEX idx_chat_messages_sender ON public.chat_messages(sender_id);
